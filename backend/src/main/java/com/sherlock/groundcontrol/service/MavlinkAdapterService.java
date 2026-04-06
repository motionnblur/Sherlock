package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.dto.TelemetryLiteDTO;
import com.sherlock.groundcontrol.mavlink.DroneSnapshot;
import com.sherlock.groundcontrol.mavlink.MavlinkFrame;
import com.sherlock.groundcontrol.mavlink.MavlinkFrameParser;
import com.sherlock.groundcontrol.mavlink.MavlinkMessageDecoder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Listens for MAVLink telemetry on a UDP socket and publishes it via STOMP —
 * the same topics used by TelemetrySimulator, so the frontend needs no changes.
 *
 * Activated only when app.mavlink.enabled=true.
 * One bean per GCS instance; one UDP port shared across all connected drones.
 */
@Service
@ConditionalOnProperty(name = "app.mavlink.enabled", havingValue = "true")
@Slf4j
public class MavlinkAdapterService {

    private static final int    UDP_BUFFER_SIZE         = 512;
    private static final int    TELEMETRY_INTERVAL_MS   = 500;
    private static final String TELEMETRY_TOPIC_PREFIX  = "/topic/telemetry/";
    private static final String FLEET_LITE_TOPIC        = "/topic/telemetry/lite/fleet";
    private static final String DRONE_ID_PREFIX         = "MAVLINK-";
    private static final int    SNAPSHOT_STALE_SECONDS  = 10;

    public record AltitudeReference(double altitudeMsl, double relativeAltitudeMeters) {}

    private final SimpMessagingTemplate messagingTemplate;
    private final TelemetryService telemetryService;

    @Value("${app.mavlink.udp-port:14550}")
    private int udpPort;

    // Per system-ID merged state; ConcurrentHashMap because listener and scheduler run on different threads
    private final Map<Integer, DroneSnapshot> snapshots = new ConcurrentHashMap<>();
    private final AtomicInteger outboundSeq = new AtomicInteger(0);

    private volatile DatagramSocket socket;
    private volatile Thread listenerThread;

    public MavlinkAdapterService(SimpMessagingTemplate messagingTemplate, TelemetryService telemetryService) {
        this.messagingTemplate = messagingTemplate;
        this.telemetryService  = telemetryService;
    }

    @PostConstruct
    public void start() {
        try {
            socket = new DatagramSocket(udpPort);
            listenerThread = new Thread(this::listenLoop, "mavlink-udp-listener");
            listenerThread.setDaemon(true);
            listenerThread.start();
            log.info("MAVLink adapter listening on UDP:{}", udpPort);
        } catch (IOException e) {
            log.error("Failed to open MAVLink UDP socket on port {}: {}", udpPort, e.getMessage());
        }
    }

    @PreDestroy
    public void stop() {
        if (socket != null && !socket.isClosed()) {
            socket.close();
        }
        if (listenerThread != null) {
            listenerThread.interrupt();
        }
        log.info("MAVLink adapter stopped");
    }

    // ── Inbound ─────────────────────────────────────────────────────────────────

    private void listenLoop() {
        byte[] buffer = new byte[UDP_BUFFER_SIZE];
        DatagramPacket packet = new DatagramPacket(buffer, buffer.length);

        while (!Thread.currentThread().isInterrupted() && socket != null && !socket.isClosed()) {
            try {
                socket.receive(packet);
                InetSocketAddress source = (InetSocketAddress) packet.getSocketAddress();
                MavlinkFrameParser.parsePacket(packet.getData(), packet.getLength())
                        .ifPresent(frame -> applyFrame(frame, source));
            } catch (IOException e) {
                if (!socket.isClosed()) {
                    log.warn("MAVLink UDP receive error: {}", e.getMessage());
                }
            }
        }
    }

    private void applyFrame(MavlinkFrame frame, InetSocketAddress source) {
        DroneSnapshot snapshot = snapshots.computeIfAbsent(frame.systemId(), DroneSnapshot::new);
        snapshot.setSourceAddress(source);
        Instant receivedAt = Instant.now();
        boolean isSupportedTelemetry = applySupportedMessage(frame, snapshot);
        if (isSupportedTelemetry) {
            snapshot.setLastSeen(receivedAt);
        }
    }

    // ── Outbound publish ─────────────────────────────────────────────────────────

    @Scheduled(fixedRate = TELEMETRY_INTERVAL_MS)
    public void broadcastSnapshots() {
        if (snapshots.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        Instant staleCutoff = now.minusSeconds(SNAPSHOT_STALE_SECONDS);
        List<TelemetryDTO> batch = new ArrayList<>(snapshots.size());
        List<TelemetryLiteDTO> liteBatch = new ArrayList<>(snapshots.size());
        List<Integer> staleSystemIds = new ArrayList<>();

        for (Map.Entry<Integer, DroneSnapshot> entry : snapshots.entrySet()) {
            DroneSnapshot snapshot = entry.getValue();
            if (isSnapshotStale(snapshot, staleCutoff)) {
                staleSystemIds.add(entry.getKey());
                continue;
            }
            if (!snapshot.hasPosition()) {
                continue;
            }

            TelemetryDTO dto = toDTO(snapshot, now);
            batch.add(dto);
            messagingTemplate.convertAndSend(TELEMETRY_TOPIC_PREFIX + dto.getDroneId(), dto);

            liteBatch.add(toLiteDTO(dto));
        }

        if (!batch.isEmpty()) {
            telemetryService.persistBatch(batch);
            messagingTemplate.convertAndSend(FLEET_LITE_TOPIC, liteBatch);
        }

        for (Integer staleSystemId : staleSystemIds) {
            snapshots.remove(staleSystemId);
        }
    }

    // ── Command dispatch ─────────────────────────────────────────────────────────

    /**
     * Sends a raw MAVLink packet to the drone identified by system ID.
     * Returns false if the drone is unknown or the socket is unavailable.
     */
    public boolean sendPacket(int systemId, byte[] packet) {
        DroneSnapshot snapshot = snapshots.get(systemId);
        Instant staleCutoff = Instant.now().minusSeconds(SNAPSHOT_STALE_SECONDS);
        if (snapshot == null || !isSnapshotCommandable(snapshot, staleCutoff)) {
            log.warn("sendPacket: sysId {} is not currently commandable", systemId);
            return false;
        }
        if (socket == null || socket.isClosed()) {
            log.warn("sendPacket: socket unavailable");
            return false;
        }
        try {
            DatagramPacket dp = new DatagramPacket(
                    packet, packet.length, snapshot.getSourceAddress());
            socket.send(dp);
            return true;
        } catch (IOException e) {
            log.error("sendPacket failed for sysId {}: {}", systemId, e.getMessage());
            return false;
        }
    }

    /** Returns drone IDs for all snapshots that have a position and are not stale. */
    public List<String> getActiveDroneIds() {
        Instant cutoff = Instant.now().minusSeconds(SNAPSHOT_STALE_SECONDS);
        return snapshots.values().stream()
                .filter(s -> isSnapshotVisible(s, cutoff))
                .map(s -> droneIdFor(s.getSystemId()))
                .sorted()
                .toList();
    }

    /** Returns the MAVLink system ID for a drone ID, or empty if not connected. */
    public Optional<Integer> resolveSystemId(String droneId) {
        Instant cutoff = Instant.now().minusSeconds(SNAPSHOT_STALE_SECONDS);
        return snapshots.entrySet().stream()
                .filter(e -> droneIdFor(e.getKey()).equals(droneId))
                .filter(e -> isSnapshotCommandable(e.getValue(), cutoff))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    /** Returns true when the active snapshot reports an armed vehicle state. */
    public boolean isDroneArmed(int systemId) {
        DroneSnapshot snapshot = snapshots.get(systemId);
        if (snapshot == null) {
            return false;
        }
        Instant cutoff = Instant.now().minusSeconds(SNAPSHOT_STALE_SECONDS);
        return isSnapshotCommandable(snapshot, cutoff) && Boolean.TRUE.equals(snapshot.getArmed());
    }

    /**
     * Returns altitude reference values from GLOBAL_POSITION_INT if the drone is commandable.
     * altitudeMsl is AMSL, relativeAltitudeMeters is altitude above home.
     */
    public Optional<AltitudeReference> getAltitudeReference(int systemId) {
        DroneSnapshot snapshot = snapshots.get(systemId);
        if (snapshot == null) {
            return Optional.empty();
        }
        Instant cutoff = Instant.now().minusSeconds(SNAPSHOT_STALE_SECONDS);
        if (!isSnapshotCommandable(snapshot, cutoff)) {
            return Optional.empty();
        }
        Double altitudeMsl = snapshot.getAltitudeMsl();
        Double relativeAltitudeMeters = snapshot.getRelativeAltitudeMeters();
        if (altitudeMsl == null || relativeAltitudeMeters == null) {
            return Optional.empty();
        }
        return Optional.of(new AltitudeReference(altitudeMsl, relativeAltitudeMeters));
    }

    public int nextSeqNum() {
        return outboundSeq.getAndIncrement() & 0xFF;
    }

    // ── Mapping helpers ──────────────────────────────────────────────────────────

    private static String droneIdFor(int systemId) {
        return DRONE_ID_PREFIX + String.format("%02d", systemId);
    }

    private static boolean applySupportedMessage(MavlinkFrame frame, DroneSnapshot snapshot) {
        return switch (frame.messageId()) {
            case MavlinkMessageDecoder.MSG_HEARTBEAT -> applyHeartbeat(frame, snapshot);
            case MavlinkMessageDecoder.MSG_SYS_STATUS -> applySysStatus(frame, snapshot);
            case MavlinkMessageDecoder.MSG_GPS_RAW_INT -> applyGpsRawInt(frame, snapshot);
            case MavlinkMessageDecoder.MSG_ATTITUDE -> applyAttitude(frame, snapshot);
            case MavlinkMessageDecoder.MSG_GLOBAL_POSITION_INT -> applyGlobalPositionInt(frame, snapshot);
            case MavlinkMessageDecoder.MSG_RADIO_STATUS -> applyRadioStatus(frame, snapshot);
            default -> false;
        };
    }

    private static boolean applyHeartbeat(MavlinkFrame frame, DroneSnapshot snapshot) {
        Optional<MavlinkMessageDecoder.HeartbeatData> decoded = MavlinkMessageDecoder.decodeHeartbeat(frame.payload());
        if (decoded.isEmpty()) {
            return false;
        }
        snapshot.setArmed(decoded.get().isArmed());
        snapshot.setFlightMode(decoded.get().flightMode());
        return true;
    }

    private static boolean applySysStatus(MavlinkFrame frame, DroneSnapshot snapshot) {
        Optional<MavlinkMessageDecoder.SysStatusData> decoded = MavlinkMessageDecoder.decodeSysStatus(frame.payload());
        if (decoded.isEmpty()) {
            return false;
        }
        snapshot.setBatteryPercent(decoded.get().batteryPercent());
        return true;
    }

    private static boolean applyGpsRawInt(MavlinkFrame frame, DroneSnapshot snapshot) {
        Optional<MavlinkMessageDecoder.GpsRawIntData> decoded = MavlinkMessageDecoder.decodeGpsRawInt(frame.payload());
        if (decoded.isEmpty()) {
            return false;
        }
        snapshot.setFixType(decoded.get().fixType());
        snapshot.setHdop(Double.isNaN(decoded.get().hdop()) ? null : decoded.get().hdop());
        snapshot.setSatelliteCount(decoded.get().satelliteCount() < 0 ? null : decoded.get().satelliteCount());
        return true;
    }

    private static boolean applyAttitude(MavlinkFrame frame, DroneSnapshot snapshot) {
        Optional<MavlinkMessageDecoder.AttitudeData> decoded = MavlinkMessageDecoder.decodeAttitude(frame.payload());
        if (decoded.isEmpty()) {
            return false;
        }
        snapshot.setRoll(decoded.get().roll());
        snapshot.setPitch(decoded.get().pitch());
        return true;
    }

    private static boolean applyGlobalPositionInt(MavlinkFrame frame, DroneSnapshot snapshot) {
        Optional<MavlinkMessageDecoder.GlobalPositionIntData> decoded = MavlinkMessageDecoder.decodeGlobalPositionInt(frame.payload());
        if (decoded.isEmpty()) {
            return false;
        }
        snapshot.setLatitude(decoded.get().latitude());
        snapshot.setLongitude(decoded.get().longitude());
        snapshot.setAltitudeMsl(decoded.get().altitudeMsl());
        snapshot.setRelativeAltitudeMeters(decoded.get().relativeAltitudeMeters());
        snapshot.setSpeed(decoded.get().speed());
        if (!Double.isNaN(decoded.get().heading())) {
            snapshot.setHeading(decoded.get().heading());
        }
        return true;
    }

    private static boolean applyRadioStatus(MavlinkFrame frame, DroneSnapshot snapshot) {
        Optional<MavlinkMessageDecoder.RadioStatusData> decoded = MavlinkMessageDecoder.decodeRadioStatus(frame.payload());
        if (decoded.isEmpty()) {
            return false;
        }
        snapshot.setRssiPercent(decoded.get().rssiPercent());
        return true;
    }

    private static boolean isSnapshotStale(DroneSnapshot snapshot, Instant staleCutoff) {
        Instant lastSeen = snapshot.getLastSeen();
        return lastSeen == null || !lastSeen.isAfter(staleCutoff);
    }

    private static boolean isSnapshotVisible(DroneSnapshot snapshot, Instant staleCutoff) {
        return snapshot.hasPosition() && !isSnapshotStale(snapshot, staleCutoff);
    }

    private static boolean isSnapshotCommandable(DroneSnapshot snapshot, Instant staleCutoff) {
        return isSnapshotVisible(snapshot, staleCutoff) && snapshot.getSourceAddress() != null;
    }

    private static TelemetryDTO toDTO(DroneSnapshot s, Instant timestamp) {
        return TelemetryDTO.builder()
                .droneId(droneIdFor(s.getSystemId()))
                .latitude(s.getLatitude())
                .longitude(s.getLongitude())
                .altitude(s.getAltitudeMsl())
                .speed(s.getSpeed())
                .battery(s.getBatteryPercent())
                .heading(s.getHeading())
                .timestamp(timestamp)
                .roll(s.getRoll())
                .pitch(s.getPitch())
                .hdop(s.getHdop())
                .satelliteCount(s.getSatelliteCount())
                .fixType(s.getFixType())
                .rssi(s.getRssiPercent())
                .isArmed(s.getArmed())
                .flightMode(s.getFlightMode())
                .build();
    }

    private static TelemetryLiteDTO toLiteDTO(TelemetryDTO dto) {
        return TelemetryLiteDTO.builder()
                .droneId(dto.getDroneId())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .altitude(dto.getAltitude())
                .heading(dto.getHeading())
                .timestamp(dto.getTimestamp())
                .build();
    }
}
