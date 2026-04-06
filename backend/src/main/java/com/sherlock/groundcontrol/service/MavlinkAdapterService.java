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
        snapshot.setLastSeen(Instant.now());

        switch (frame.messageId()) {
            case MavlinkMessageDecoder.MSG_HEARTBEAT ->
                MavlinkMessageDecoder.decodeHeartbeat(frame.payload()).ifPresent(d -> {
                    snapshot.setArmed(d.isArmed());
                    snapshot.setFlightMode(d.flightMode());
                });
            case MavlinkMessageDecoder.MSG_SYS_STATUS ->
                MavlinkMessageDecoder.decodeSysStatus(frame.payload()).ifPresent(d ->
                    snapshot.setBatteryPercent(d.batteryPercent())
                );
            case MavlinkMessageDecoder.MSG_GPS_RAW_INT ->
                MavlinkMessageDecoder.decodeGpsRawInt(frame.payload()).ifPresent(d -> {
                    snapshot.setFixType(d.fixType());
                    snapshot.setHdop(Double.isNaN(d.hdop()) ? null : d.hdop());
                    snapshot.setSatelliteCount(d.satelliteCount() < 0 ? null : d.satelliteCount());
                });
            case MavlinkMessageDecoder.MSG_ATTITUDE ->
                MavlinkMessageDecoder.decodeAttitude(frame.payload()).ifPresent(d -> {
                    snapshot.setRoll(d.roll());
                    snapshot.setPitch(d.pitch());
                });
            case MavlinkMessageDecoder.MSG_GLOBAL_POSITION_INT ->
                MavlinkMessageDecoder.decodeGlobalPositionInt(frame.payload()).ifPresent(d -> {
                    snapshot.setLatitude(d.latitude());
                    snapshot.setLongitude(d.longitude());
                    snapshot.setAltitudeMsl(d.altitudeMsl());
                    snapshot.setSpeed(d.speed());
                    if (!Double.isNaN(d.heading())) {
                        snapshot.setHeading(d.heading());
                    }
                });
            case MavlinkMessageDecoder.MSG_RADIO_STATUS ->
                MavlinkMessageDecoder.decodeRadioStatus(frame.payload()).ifPresent(d ->
                    snapshot.setRssiPercent(d.rssiPercent())
                );
            default -> { /* unsupported message type — ignore */ }
        }
    }

    // ── Outbound publish ─────────────────────────────────────────────────────────

    @Scheduled(fixedRate = TELEMETRY_INTERVAL_MS)
    public void broadcastSnapshots() {
        if (snapshots.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        List<TelemetryDTO> batch = new ArrayList<>(snapshots.size());
        List<TelemetryLiteDTO> liteBatch = new ArrayList<>(snapshots.size());

        for (DroneSnapshot snapshot : snapshots.values()) {
            if (!snapshot.hasPosition()) {
                continue;
            }
            // Drop snapshots that haven't received data recently
            if (now.getEpochSecond() - snapshot.getLastSeen().getEpochSecond() > SNAPSHOT_STALE_SECONDS) {
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
    }

    // ── Command dispatch ─────────────────────────────────────────────────────────

    /**
     * Sends a raw MAVLink packet to the drone identified by system ID.
     * Returns false if the drone is unknown or the socket is unavailable.
     */
    public boolean sendPacket(int systemId, byte[] packet) {
        DroneSnapshot snapshot = snapshots.get(systemId);
        if (snapshot == null || snapshot.getSourceAddress() == null) {
            log.warn("sendPacket: no known address for sysId {}", systemId);
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
                .filter(s -> s.hasPosition() && s.getLastSeen().isAfter(cutoff))
                .map(s -> droneIdFor(s.getSystemId()))
                .sorted()
                .toList();
    }

    /** Returns the MAVLink system ID for a drone ID, or empty if not connected. */
    public Optional<Integer> resolveSystemId(String droneId) {
        return snapshots.entrySet().stream()
                .filter(e -> droneIdFor(e.getKey()).equals(droneId))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    public int nextSeqNum() {
        return outboundSeq.getAndIncrement() & 0xFF;
    }

    // ── Mapping helpers ──────────────────────────────────────────────────────────

    private static String droneIdFor(int systemId) {
        return DRONE_ID_PREFIX + String.format("%02d", systemId);
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
