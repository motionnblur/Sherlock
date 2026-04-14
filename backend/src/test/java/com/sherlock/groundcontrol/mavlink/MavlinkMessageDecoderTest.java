package com.sherlock.groundcontrol.mavlink;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MavlinkMessageDecoderTest {

    @Test
    void decodeHeartbeatExtractsArmedStateAndFlightMode() {
        byte[] payload = ByteBuffer.allocate(9)
                .order(ByteOrder.LITTLE_ENDIAN)
                .putInt(4)
                .put((byte) 2)
                .put((byte) 3)
                .put((byte) 0x80)
                .put((byte) 0)
                .put((byte) 3)
                .array();

        var decoded = MavlinkMessageDecoder.decodeHeartbeat(payload);

        assertTrue(decoded.isPresent());
        assertTrue(decoded.get().isArmed());
        assertEquals("GUIDED", decoded.get().flightMode());
    }

    @Test
    void decodeHeartbeatFallsBackToNumericModeName() {
        byte[] payload = ByteBuffer.allocate(9)
                .order(ByteOrder.LITTLE_ENDIAN)
                .putInt(99)
                .put((byte) 2)
                .put((byte) 3)
                .put((byte) 0)
                .put((byte) 0)
                .put((byte) 3)
                .array();

        var decoded = MavlinkMessageDecoder.decodeHeartbeat(payload);

        assertTrue(decoded.isPresent());
        assertEquals("MODE 99", decoded.get().flightMode());
    }

    @Test
    void decodeSysStatusRejectsUnknownBattery() {
        byte[] payload = new byte[19];
        payload[18] = (byte) 0xFF;

        assertTrue(MavlinkMessageDecoder.decodeSysStatus(payload).isEmpty());
    }

    @Test
    void decodeSysStatusParsesBatteryPercent() {
        byte[] payload = new byte[19];
        payload[18] = (byte) 77;

        var decoded = MavlinkMessageDecoder.decodeSysStatus(payload);

        assertTrue(decoded.isPresent());
        assertEquals(77.0, decoded.get().batteryPercent());
    }

    @Test
    void decodeGpsRawIntParsesCoordinatesAndSignalValues() {
        ByteBuffer payload = ByteBuffer.allocate(30).order(ByteOrder.LITTLE_ENDIAN);
        payload.putLong(1L);
        payload.putInt((int) Math.round(37.9838 * 1e7));
        payload.putInt((int) Math.round(23.7275 * 1e7));
        payload.putInt(1234000);
        payload.putShort((short) 150);
        payload.putShort((short) 120);
        payload.putShort((short) 0);
        payload.putShort((short) 0);
        payload.put((byte) 3);
        payload.put((byte) 12);

        var decoded = MavlinkMessageDecoder.decodeGpsRawInt(payload.array());

        assertTrue(decoded.isPresent());
        assertEquals(37.9838, decoded.get().latitude(), 0.000001);
        assertEquals(23.7275, decoded.get().longitude(), 0.000001);
        assertEquals(1234.0, decoded.get().altitudeMsl(), 0.0001);
        assertEquals(1.5, decoded.get().hdop(), 0.0001);
        assertEquals(3, decoded.get().fixType());
        assertEquals(12, decoded.get().satelliteCount());
    }

    @Test
    void decodeGpsRawIntHandlesUnknownHdopAndSatellites() {
        ByteBuffer payload = ByteBuffer.allocate(30).order(ByteOrder.LITTLE_ENDIAN);
        payload.putLong(1L);
        payload.putInt(0);
        payload.putInt(0);
        payload.putInt(0);
        payload.putShort((short) 0xFFFF);
        payload.putShort((short) 0);
        payload.putShort((short) 0);
        payload.putShort((short) 0);
        payload.put((byte) 3);
        payload.put((byte) 0xFF);

        var decoded = MavlinkMessageDecoder.decodeGpsRawInt(payload.array());

        assertTrue(decoded.isPresent());
        assertTrue(Double.isNaN(decoded.get().hdop()));
        assertEquals(-1, decoded.get().satelliteCount());
    }

    @Test
    void decodeAttitudeConvertsRadiansToDegrees() {
        ByteBuffer payload = ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);
        payload.putInt(1);
        payload.putFloat((float) Math.toRadians(10.0));
        payload.putFloat((float) Math.toRadians(-5.0));
        payload.putFloat((float) Math.toRadians(45.0));

        var decoded = MavlinkMessageDecoder.decodeAttitude(payload.array());

        assertTrue(decoded.isPresent());
        assertEquals(10.0, decoded.get().roll(), 0.0001);
        assertEquals(-5.0, decoded.get().pitch(), 0.0001);
        assertEquals(45.0, decoded.get().yaw(), 0.0001);
    }

    @Test
    void decodeGlobalPositionIntParsesSpeedAndHeading() {
        ByteBuffer payload = ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);
        payload.putInt(1);
        payload.putInt((int) Math.round(38.0 * 1e7));
        payload.putInt((int) Math.round(24.0 * 1e7));
        payload.putInt(1000000);
        payload.putInt(500000);
        payload.putShort((short) 300);
        payload.putShort((short) 400);
        payload.putShort((short) 0);
        payload.putShort((short) 9000);

        var decoded = MavlinkMessageDecoder.decodeGlobalPositionInt(payload.array());

        assertTrue(decoded.isPresent());
        assertEquals(38.0, decoded.get().latitude(), 0.000001);
        assertEquals(24.0, decoded.get().longitude(), 0.000001);
        assertEquals(1000.0, decoded.get().altitudeMsl(), 0.0001);
        assertEquals(500.0, decoded.get().relativeAltitudeMeters(), 0.0001);
        assertEquals(18.0, decoded.get().speed(), 0.001);
        assertEquals(90.0, decoded.get().heading(), 0.001);
    }

    @Test
    void decodeGlobalPositionIntTreatsUnknownHeadingAsNaN() {
        ByteBuffer payload = ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);
        payload.putInt(1);
        payload.putInt(0);
        payload.putInt(0);
        payload.putInt(0);
        payload.putInt(0);
        payload.putShort((short) 0);
        payload.putShort((short) 0);
        payload.putShort((short) 0);
        payload.putShort((short) 0xFFFF);

        var decoded = MavlinkMessageDecoder.decodeGlobalPositionInt(payload.array());

        assertTrue(decoded.isPresent());
        assertTrue(Double.isNaN(decoded.get().heading()));
    }

    @Test
    void decodeRadioStatusHandlesUnknownAndUpperBound() {
        assertTrue(MavlinkMessageDecoder.decodeRadioStatus(new byte[]{(byte) 0xFF}).isEmpty());

        var decoded = MavlinkMessageDecoder.decodeRadioStatus(new byte[]{(byte) 254});
        assertTrue(decoded.isPresent());
        assertEquals(100, decoded.get().rssiPercent());
    }

    @Test
    void decodeMethodsRejectShortPayloads() {
        assertTrue(MavlinkMessageDecoder.decodeHeartbeat(new byte[8]).isEmpty());
        assertTrue(MavlinkMessageDecoder.decodeSysStatus(new byte[18]).isEmpty());
        assertTrue(MavlinkMessageDecoder.decodeGpsRawInt(new byte[29]).isEmpty());
        assertTrue(MavlinkMessageDecoder.decodeAttitude(new byte[27]).isEmpty());
        assertTrue(MavlinkMessageDecoder.decodeGlobalPositionInt(new byte[27]).isEmpty());
        assertTrue(MavlinkMessageDecoder.decodeRadioStatus(new byte[0]).isEmpty());
    }
}
