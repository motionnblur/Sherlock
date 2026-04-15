package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.mavlink.DroneSnapshot;
import com.sherlock.groundcontrol.mavlink.MavlinkFrame;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class MavlinkAdapterServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private TelemetryService telemetryService;

    @Mock
    private GeofenceBreachService geofenceBreachService;

    @Mock
    private CommandLifecycleService commandLifecycleService;

    private DatagramSocket createdSocket;

    @AfterEach
    void tearDown() {
        if (createdSocket != null && !createdSocket.isClosed()) {
            createdSocket.close();
        }
    }

    @Test
    void broadcastSnapshotsDoesNothingWhenNoSnapshotsExist() {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );

        service.broadcastSnapshots();

        verify(telemetryService, never()).persistBatch(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void broadcastSnapshotsPublishesTelemetryAndFleetLiteForFreshSnapshot() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        DroneSnapshot snapshot = positionedSnapshot(1, true, Instant.now(), new InetSocketAddress("127.0.0.1", 14550));
        putSnapshot(service, snapshot);

        service.broadcastSnapshots();

        ArgumentCaptor<List<TelemetryDTO>> telemetryCaptor = ArgumentCaptor.forClass(List.class);
        verify(telemetryService).persistBatch(telemetryCaptor.capture());
        assertEquals(1, telemetryCaptor.getValue().size());
        assertEquals("MAVLINK-01", telemetryCaptor.getValue().get(0).getDroneId());

        verify(messagingTemplate).convertAndSend(eq("/topic/telemetry/MAVLINK-01"), any(TelemetryDTO.class));
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/telemetry/lite/fleet"), any(List.class));
        verify(geofenceBreachService).evaluateTelemetry(any(TelemetryDTO.class));
    }

    @Test
    void broadcastSnapshotsDropsStaleSnapshots() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        DroneSnapshot stale = positionedSnapshot(3, false, Instant.now().minusSeconds(20), new InetSocketAddress("127.0.0.1", 14551));
        putSnapshot(service, stale);

        service.broadcastSnapshots();

        assertTrue(getSnapshots(service).isEmpty());
        verify(telemetryService, never()).persistBatch(any());
    }

    @Test
    void registryAndResolutionMethodsUseVisibilityAndCommandabilityRules() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        DroneSnapshot visible = positionedSnapshot(1, true, Instant.now(), new InetSocketAddress("127.0.0.1", 14550));
        DroneSnapshot hiddenNoSource = positionedSnapshot(2, true, Instant.now(), null);
        DroneSnapshot stale = positionedSnapshot(4, true, Instant.now().minusSeconds(20), new InetSocketAddress("127.0.0.1", 14552));

        putSnapshot(service, visible);
        putSnapshot(service, hiddenNoSource);
        putSnapshot(service, stale);

        List<String> ids = service.getActiveDroneIds();
        assertEquals(List.of("MAVLINK-01", "MAVLINK-02"), ids);

        assertEquals(Optional.of(1), service.resolveSystemId("MAVLINK-01"));
        assertEquals(Optional.empty(), service.resolveSystemId("MAVLINK-02"));
        assertEquals(Optional.empty(), service.resolveSystemId("MAVLINK-04"));
    }

    @Test
    void armAndAltitudeReferenceQueriesRequireFreshCommandableSnapshot() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );

        DroneSnapshot armed = positionedSnapshot(5, true, Instant.now(), new InetSocketAddress("127.0.0.1", 14555));
        armed.setAltitudeMsl(1200.0);
        armed.setRelativeAltitudeMeters(80.0);
        putSnapshot(service, armed);

        assertTrue(service.isDroneArmed(5));
        assertTrue(service.getAltitudeReference(5).isPresent());
        assertEquals(1200.0, service.getAltitudeReference(5).get().altitudeMsl());

        DroneSnapshot stale = positionedSnapshot(6, true, Instant.now().minusSeconds(20), new InetSocketAddress("127.0.0.1", 14556));
        stale.setAltitudeMsl(1300.0);
        stale.setRelativeAltitudeMeters(90.0);
        putSnapshot(service, stale);

        assertFalse(service.isDroneArmed(6));
        assertTrue(service.getAltitudeReference(6).isEmpty());
    }

    @Test
    void sendPacketReturnsFalseForUnknownOrUnavailableSocket() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );

        assertFalse(service.sendPacket(99, new byte[]{1}));

        DroneSnapshot commandable = positionedSnapshot(7, true, Instant.now(), new InetSocketAddress("127.0.0.1", 14557));
        putSnapshot(service, commandable);

        assertFalse(service.sendPacket(7, new byte[]{1}));
    }

    @Test
    void sendPacketReturnsTrueWhenSocketAndCommandableSnapshotExist() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );

        DroneSnapshot commandable = positionedSnapshot(8, true, Instant.now(), new InetSocketAddress("127.0.0.1", 14558));
        putSnapshot(service, commandable);

        createdSocket = new DatagramSocket();
        setField(service, "socket", createdSocket);

        assertTrue(service.sendPacket(8, new byte[]{1, 2, 3}));
    }

    @Test
    void nextSeqNumWrapsAtEightBitBoundary() {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        int first = service.nextSeqNum();
        int lastBeforeWrap = -1;
        for (int index = 0; index < 255; index++) {
            lastBeforeWrap = service.nextSeqNum();
        }
        int wrapped = service.nextSeqNum();

        assertEquals(0, first);
        assertEquals(255, lastBeforeWrap);
        assertEquals(0, wrapped);
    }

    @Test
    void applySupportedMessageUpdatesSnapshotForEachHandledMessageType() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        DroneSnapshot snapshot = new DroneSnapshot(1);

        assertTrue(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 0, heartbeatPayload()), snapshot));
        assertTrue(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 1, sysStatusPayload()), snapshot));
        assertTrue(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 24, gpsRawIntPayload()), snapshot));
        assertTrue(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 30, attitudePayload()), snapshot));
        assertTrue(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 33, globalPositionPayload()), snapshot));
        assertTrue(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 109, radioStatusPayload()), snapshot));

        assertEquals("GUIDED", snapshot.getFlightMode());
        assertTrue(snapshot.getBatteryPercent() != null && snapshot.getBatteryPercent() > 0);
        assertTrue(snapshot.getLatitude() != null && snapshot.getLongitude() != null);
        assertTrue(snapshot.getRoll() != null && snapshot.getPitch() != null);
        assertTrue(snapshot.getRssiPercent() != null && snapshot.getRssiPercent() > 0);
    }

    @Test
    void applySupportedMessageReturnsFalseForUnknownOrInvalidPayloads() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        DroneSnapshot snapshot = new DroneSnapshot(1);

        assertFalse(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 250, new byte[0]), snapshot));
        assertFalse(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 0, new byte[3]), snapshot));
        assertFalse(invokeApplySupportedMessage(service, new MavlinkFrame(1, 1, 1, 1, 109, new byte[0]), snapshot));
    }

    @Test
    void applyFrameRoutesCommandAckToCommandLifecycleService() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        DroneSnapshot snapshot = positionedSnapshot(1, true, Instant.now(), new InetSocketAddress("127.0.0.1", 14559));
        putSnapshot(service, snapshot);

        invokeApplyFrame(
                service,
                new MavlinkFrame(1, 1, 1, 1, 77, commandAckPayload(22, 0)),
                snapshot.getSourceAddress()
        );

        verify(commandLifecycleService).resolveCommandAck("MAVLINK-01", 22, 0);
    }

    @Test
    void applyFrameCreatesSnapshotAndAssociatesSourceAddress() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        InetSocketAddress source = new InetSocketAddress("127.0.0.1", 14560);

        invokeApplyFrame(service, new MavlinkFrame(1, 1, 9, 1, 0, heartbeatPayload()), source);

        DroneSnapshot created = getSnapshots(service).get(9);
        assertTrue(created != null);
        assertEquals(source, created.getSourceAddress());
        assertTrue(created.getLastSeen() != null);
    }

    @Test
    void startAndStopManageUdpSocketLifecycle() throws Exception {
        MavlinkAdapterService service = new MavlinkAdapterService(
                messagingTemplate,
                telemetryService,
                geofenceBreachService,
                commandLifecycleService
        );
        setField(service, "udpPort", 0);

        service.start();
        DatagramSocket socket = (DatagramSocket) getField(service, "socket");
        Thread listenerThread = (Thread) getField(service, "listenerThread");

        assertTrue(socket != null && !socket.isClosed());
        assertTrue(listenerThread != null);

        service.stop();
        assertTrue(socket.isClosed());
    }

    private static DroneSnapshot positionedSnapshot(
            int systemId,
            boolean isArmed,
            Instant lastSeen,
            InetSocketAddress sourceAddress
    ) {
        DroneSnapshot snapshot = new DroneSnapshot(systemId);
        snapshot.setLatitude(37.0 + systemId * 0.01);
        snapshot.setLongitude(23.0 + systemId * 0.01);
        snapshot.setAltitudeMsl(1000.0 + systemId);
        snapshot.setSpeed(80.0);
        snapshot.setHeading(90.0);
        snapshot.setArmed(isArmed);
        snapshot.setFlightMode("GUIDED");
        snapshot.setSourceAddress(sourceAddress);
        snapshot.setLastSeen(lastSeen);
        return snapshot;
    }

    @SuppressWarnings("unchecked")
    private static Map<Integer, DroneSnapshot> getSnapshots(MavlinkAdapterService service) throws Exception {
        Field field = MavlinkAdapterService.class.getDeclaredField("snapshots");
        field.setAccessible(true);
        return (Map<Integer, DroneSnapshot>) field.get(service);
    }

    private static void putSnapshot(MavlinkAdapterService service, DroneSnapshot snapshot) throws Exception {
        getSnapshots(service).put(snapshot.getSystemId(), snapshot);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static Object getField(Object target, String fieldName) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        return field.get(target);
    }

    private static boolean invokeApplySupportedMessage(
            MavlinkAdapterService service,
            MavlinkFrame frame,
            DroneSnapshot snapshot
    ) throws Exception {
        Method method = MavlinkAdapterService.class.getDeclaredMethod("applySupportedMessage", MavlinkFrame.class, DroneSnapshot.class);
        method.setAccessible(true);
        return (boolean) method.invoke(service, frame, snapshot);
    }

    private static void invokeApplyFrame(MavlinkAdapterService service, MavlinkFrame frame, InetSocketAddress source) throws Exception {
        Method method = MavlinkAdapterService.class.getDeclaredMethod("applyFrame", MavlinkFrame.class, InetSocketAddress.class);
        method.setAccessible(true);
        method.invoke(service, frame, source);
    }

    private static byte[] heartbeatPayload() {
        return ByteBuffer.allocate(9)
                .order(ByteOrder.LITTLE_ENDIAN)
                .putInt(4)
                .put((byte) 2)
                .put((byte) 3)
                .put((byte) 0x80)
                .put((byte) 0)
                .put((byte) 3)
                .array();
    }

    private static byte[] commandAckPayload(int command, int result) {
        return ByteBuffer.allocate(3)
                .order(ByteOrder.LITTLE_ENDIAN)
                .putShort((short) command)
                .put((byte) result)
                .array();
    }

    private static byte[] sysStatusPayload() {
        byte[] payload = new byte[19];
        payload[18] = 73;
        return payload;
    }

    private static byte[] gpsRawIntPayload() {
        ByteBuffer buffer = ByteBuffer.allocate(30).order(ByteOrder.LITTLE_ENDIAN);
        buffer.putLong(1L);
        buffer.putInt((int) Math.round(37.9 * 1e7));
        buffer.putInt((int) Math.round(23.7 * 1e7));
        buffer.putInt(1200000);
        buffer.putShort((short) 100);
        buffer.putShort((short) 0);
        buffer.putShort((short) 0);
        buffer.putShort((short) 0);
        buffer.put((byte) 3);
        buffer.put((byte) 12);
        return buffer.array();
    }

    private static byte[] attitudePayload() {
        ByteBuffer buffer = ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);
        buffer.putInt(1);
        buffer.putFloat((float) Math.toRadians(5));
        buffer.putFloat((float) Math.toRadians(-2));
        buffer.putFloat((float) Math.toRadians(15));
        return buffer.array();
    }

    private static byte[] globalPositionPayload() {
        ByteBuffer buffer = ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);
        buffer.putInt(1);
        buffer.putInt((int) Math.round(37.95 * 1e7));
        buffer.putInt((int) Math.round(23.75 * 1e7));
        buffer.putInt(1250000);
        buffer.putInt(95000);
        buffer.putShort((short) 300);
        buffer.putShort((short) 200);
        buffer.putShort((short) 0);
        buffer.putShort((short) 9000);
        return buffer.array();
    }

    private static byte[] radioStatusPayload() {
        return new byte[]{(byte) 200};
    }
}
