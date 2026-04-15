package com.sherlock.groundcontrol.mavlink;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MavlinkFrameParserTest {

    @Test
    void parsePacketRejectsShortAndUnknownStartFrames() {
        assertTrue(MavlinkFrameParser.parsePacket(new byte[]{0x01, 0x02}, 2).isEmpty());
        assertTrue(MavlinkFrameParser.parsePacket(new byte[]{0x12, 0x00, 0x00, 0x00, 0x00, 0x00}, 6).isEmpty());
    }

    @Test
    void buildCommandLongRoundTripsThroughV1Parser() {
        byte[] packet = MavlinkFrameParser.buildCommandLong(1, 20, new float[]{1f, 2f, 3f}, 15);

        Optional<MavlinkFrame> parsed = MavlinkFrameParser.parsePacket(packet, packet.length);

        assertTrue(parsed.isPresent());
        assertEquals(1, parsed.get().version());
        assertEquals(15, parsed.get().sequenceNumber());
        assertEquals(255, parsed.get().systemId());
        assertEquals(190, parsed.get().componentId());
        assertEquals(76, parsed.get().messageId());
        assertEquals(33, parsed.get().payload().length);
    }

    @Test
    void buildSetPositionTargetGlobalIntRoundTripsThroughV1Parser() {
        byte[] packet = MavlinkFrameParser.buildSetPositionTargetGlobalInt(2, 37.5, 23.7, 120.0, 9);

        Optional<MavlinkFrame> parsed = MavlinkFrameParser.parsePacket(packet, packet.length);

        assertTrue(parsed.isPresent());
        assertEquals(86, parsed.get().messageId());
        assertEquals(53, parsed.get().payload().length);
    }

    @Test
    void parsePacketRejectsUnknownMessageIdEvenWithFrameShape() {
        byte[] packet = MavlinkFrameParser.buildCommandLong(1, 20, new float[]{1f}, 1);
        packet[5] = (byte) 200;

        assertTrue(MavlinkFrameParser.parsePacket(packet, packet.length).isEmpty());
    }

    @Test
    void parseV2FrameAcceptsValidPayload() {
        byte[] heartbeatPayload = heartbeatPayload(4, 0x80);
        byte[] frame = buildV2Frame(heartbeatPayload, 0, 7, 5, 1, 0);

        Optional<MavlinkFrame> parsed = MavlinkFrameParser.parsePacket(frame, frame.length);

        assertTrue(parsed.isPresent());
        assertEquals(2, parsed.get().version());
        assertEquals(7, parsed.get().sequenceNumber());
        assertEquals(5, parsed.get().systemId());
        assertEquals(1, parsed.get().componentId());
        assertEquals(0, parsed.get().messageId());
        assertArrayEquals(heartbeatPayload, parsed.get().payload());
    }

    @Test
    void parseV2FrameRejectsSignedFrameWhenSignatureBytesMissing() {
        byte[] heartbeatPayload = heartbeatPayload(4, 0x80);
        byte[] frameWithoutSignature = buildV2Frame(heartbeatPayload, 0, 1, 5, 1, 1);

        assertTrue(MavlinkFrameParser.parsePacket(frameWithoutSignature, frameWithoutSignature.length).isEmpty());

        byte[] withSignatureBytes = new byte[frameWithoutSignature.length + 13];
        System.arraycopy(frameWithoutSignature, 0, withSignatureBytes, 0, frameWithoutSignature.length);

        assertTrue(MavlinkFrameParser.parsePacket(withSignatureBytes, withSignatureBytes.length).isPresent());
    }

    @Test
    void parseV2CommandAckFrameAcceptsKnownCrcExtra() {
        byte[] payload = commandAckPayload(22, 0);
        byte[] frame = buildV2Frame(payload, 77, 2, 5, 1, 0);

        Optional<MavlinkFrame> parsed = MavlinkFrameParser.parsePacket(frame, frame.length);

        assertTrue(parsed.isPresent());
        assertEquals(77, parsed.get().messageId());
    }

    private static byte[] heartbeatPayload(int customMode, int baseMode) {
        ByteBuffer payload = ByteBuffer.allocate(9).order(ByteOrder.LITTLE_ENDIAN);
        payload.putInt(customMode);
        payload.put((byte) 2);
        payload.put((byte) 3);
        payload.put((byte) baseMode);
        payload.put((byte) 0);
        payload.put((byte) 3);
        return payload.array();
    }

    private static byte[] commandAckPayload(int command, int result) {
        ByteBuffer payload = ByteBuffer.allocate(3).order(ByteOrder.LITTLE_ENDIAN);
        payload.putShort((short) command);
        payload.put((byte) result);
        return payload.array();
    }

    private static byte[] buildV2Frame(
            byte[] payload,
            int messageId,
            int sequence,
            int systemId,
            int componentId,
            int incompatFlags
    ) {
        int headerLength = 10;
        int crcLength = 2;
        byte[] frame = new byte[headerLength + payload.length + crcLength];
        frame[0] = (byte) 0xFD;
        frame[1] = (byte) payload.length;
        frame[2] = (byte) incompatFlags;
        frame[3] = 0;
        frame[4] = (byte) sequence;
        frame[5] = (byte) systemId;
        frame[6] = (byte) componentId;
        frame[7] = (byte) (messageId & 0xFF);
        frame[8] = (byte) ((messageId >> 8) & 0xFF);
        frame[9] = (byte) ((messageId >> 16) & 0xFF);

        System.arraycopy(payload, 0, frame, headerLength, payload.length);

        int crcExtra = crcExtraFor(messageId);
        int crc = computeX25(frame, 1, headerLength - 1 + payload.length, crcExtra);
        frame[headerLength + payload.length] = (byte) (crc & 0xFF);
        frame[headerLength + payload.length + 1] = (byte) ((crc >> 8) & 0xFF);
        return frame;
    }

    private static int crcExtraFor(int messageId) {
        return switch (messageId) {
            case 0 -> 50;
            case 1 -> 124;
            case 24 -> 24;
            case 30 -> 39;
            case 33 -> 104;
            case 77 -> 143;
            case 76 -> 152;
            case 86 -> 5;
            case 109 -> 185;
            default -> -1;
        };
    }

    private static int computeX25(byte[] buffer, int start, int length, int magicExtra) {
        int crc = 0xFFFF;
        for (int index = start; index < start + length; index++) {
            crc = x25Accumulate(crc, buffer[index]);
        }
        if (magicExtra >= 0) {
            crc = x25Accumulate(crc, (byte) magicExtra);
        }
        return crc & 0xFFFF;
    }

    private static int x25Accumulate(int crc, byte value) {
        int tmp = (value & 0xFF) ^ (crc & 0xFF);
        tmp ^= (tmp << 4) & 0xFF;
        return ((crc >> 8) & 0xFF) ^ ((tmp << 8) & 0xFFFF) ^ ((tmp << 3) & 0xFFFF) ^ (tmp >> 4);
    }
}
