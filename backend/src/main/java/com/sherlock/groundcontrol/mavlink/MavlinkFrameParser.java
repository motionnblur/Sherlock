package com.sherlock.groundcontrol.mavlink;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.Optional;

/**
 * Stateless utility for parsing raw UDP datagrams into MavlinkFrames and building
 * outgoing MAVLink v1 packets.
 *
 * Supports MAVLink v1 (start byte 0xFE) and v2 (0xFD).
 * CRC validation is performed; frames with invalid CRCs are discarded.
 */
public final class MavlinkFrameParser {

    private static final int MAVLINK_V1_START   = 0xFE;
    private static final int MAVLINK_V2_START   = 0xFD;
    private static final int V1_HEADER_LENGTH   = 6;
    private static final int V2_HEADER_LENGTH   = 10;
    private static final int CRC_LENGTH         = 2;
    private static final int V1_MIN_FRAME_SIZE  = V1_HEADER_LENGTH + CRC_LENGTH; // no payload
    private static final int V2_MIN_FRAME_SIZE  = V2_HEADER_LENGTH + CRC_LENGTH;

    // GCS identity for outbound packets (standard GCS sysid/compid)
    private static final int GCS_SYSTEM_ID    = 255;
    private static final int GCS_COMPONENT_ID = 190;

    // CRC extra bytes per message ID (MAGIC_EXTRA from MAVLink spec)
    private static final int CRCX_COMMAND_LONG = 152;
    private static final int CRCX_SET_POSITION_TARGET_GLOBAL_INT = 5;

    private static final int MAVLINK_MSG_ID_COMMAND_LONG = 76;
    private static final int MAVLINK_MSG_ID_SET_POSITION_TARGET_GLOBAL_INT = 86;

    private MavlinkFrameParser() {}

    /**
     * Attempts to parse a single MAVLink frame from the beginning of the supplied datagram.
     * Returns empty if the datagram is malformed or fails CRC.
     */
    public static Optional<MavlinkFrame> parsePacket(byte[] data, int length) {
        if (length < V1_MIN_FRAME_SIZE) {
            return Optional.empty();
        }
        int startByte = data[0] & 0xFF;
        if (startByte == MAVLINK_V1_START) {
            return parseV1(data, length);
        }
        if (startByte == MAVLINK_V2_START) {
            return parseV2(data, length);
        }
        return Optional.empty();
    }

    private static Optional<MavlinkFrame> parseV1(byte[] data, int length) {
        int payloadLen = data[1] & 0xFF;
        int totalExpected = V1_HEADER_LENGTH + payloadLen + CRC_LENGTH;
        if (length < totalExpected) {
            return Optional.empty();
        }

        int seq     = data[2] & 0xFF;
        int sysId   = data[3] & 0xFF;
        int compId  = data[4] & 0xFF;
        int msgId   = data[5] & 0xFF;

        // CRC covers bytes[1..(5+payloadLen)] then magic extra
        int crcExtra   = crcExtraForMessage(msgId);
        int computedCrc = computeX25Crc(data, 1, V1_HEADER_LENGTH - 1 + payloadLen, crcExtra);
        int receivedCrc = (data[V1_HEADER_LENGTH + payloadLen] & 0xFF)
                        | ((data[V1_HEADER_LENGTH + payloadLen + 1] & 0xFF) << 8);

        if (crcExtra < 0 || computedCrc != receivedCrc) {
            return Optional.empty();
        }

        byte[] payload = Arrays.copyOfRange(data, V1_HEADER_LENGTH, V1_HEADER_LENGTH + payloadLen);
        return Optional.of(new MavlinkFrame(1, seq, sysId, compId, msgId, payload));
    }

    private static Optional<MavlinkFrame> parseV2(byte[] data, int length) {
        if (length < V2_MIN_FRAME_SIZE) {
            return Optional.empty();
        }
        int payloadLen  = data[1] & 0xFF;
        int incompatFlags = data[2] & 0xFF;
        int totalExpected = V2_HEADER_LENGTH + payloadLen + CRC_LENGTH
                          + ((incompatFlags & 0x01) != 0 ? 13 : 0); // optional signature
        if (length < totalExpected) {
            return Optional.empty();
        }

        int seq    = data[4] & 0xFF;
        int sysId  = data[5] & 0xFF;
        int compId = data[6] & 0xFF;
        int msgId  = (data[7] & 0xFF) | ((data[8] & 0xFF) << 8) | ((data[9] & 0xFF) << 16);

        int crcExtra    = crcExtraForMessage(msgId);
        int computedCrc = computeX25Crc(data, 1, V2_HEADER_LENGTH - 1 + payloadLen, crcExtra);
        int receivedCrc = (data[V2_HEADER_LENGTH + payloadLen] & 0xFF)
                        | ((data[V2_HEADER_LENGTH + payloadLen + 1] & 0xFF) << 8);

        if (crcExtra < 0 || computedCrc != receivedCrc) {
            return Optional.empty();
        }

        byte[] payload = Arrays.copyOfRange(data, V2_HEADER_LENGTH, V2_HEADER_LENGTH + payloadLen);
        return Optional.of(new MavlinkFrame(2, seq, sysId, compId, msgId, payload));
    }

    /**
     * Builds a MAVLink v1 COMMAND_LONG packet (message ID 76).
     *
     * @param targetSysId   destination system ID
     * @param command       MAV_CMD value
     * @param params        up to 7 float parameters (missing params default to 0)
     * @param seqNum        packet sequence number (caller manages counter)
     */
    public static byte[] buildCommandLong(int targetSysId, int command, float[] params, int seqNum) {
        // Payload: 7×float + uint16 command + uint8 target_system + uint8 target_component + uint8 confirmation
        final int payloadLen = 33;
        final int totalLen   = V1_HEADER_LENGTH + payloadLen + CRC_LENGTH; // 41 bytes

        byte[] packet = new byte[totalLen];
        packet[0] = (byte) MAVLINK_V1_START;
        packet[1] = (byte) payloadLen;
        packet[2] = (byte) (seqNum & 0xFF);
        packet[3] = (byte) GCS_SYSTEM_ID;
        packet[4] = (byte) GCS_COMPONENT_ID;
        packet[5] = (byte) MAVLINK_MSG_ID_COMMAND_LONG;

        ByteBuffer buf = ByteBuffer.wrap(packet, V1_HEADER_LENGTH, payloadLen)
                                   .order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < 7; i++) {
            buf.putFloat(i < params.length ? params[i] : 0f);
        }
        buf.putShort((short) command);
        buf.put((byte) targetSysId);
        buf.put((byte) 1); // target_component = autopilot
        buf.put((byte) 0); // confirmation

        int crc = computeX25Crc(packet, 1, V1_HEADER_LENGTH - 1 + payloadLen, CRCX_COMMAND_LONG);
        packet[V1_HEADER_LENGTH + payloadLen]     = (byte) (crc & 0xFF);
        packet[V1_HEADER_LENGTH + payloadLen + 1] = (byte) ((crc >> 8) & 0xFF);

        return packet;
    }

    /**
     * Builds a MAVLink v1 SET_POSITION_TARGET_GLOBAL_INT packet (message ID 86)
     * configured for position-only control.
     *
     * @param targetSysId destination system ID
     * @param latitudeDeg target latitude in decimal degrees
     * @param longitudeDeg target longitude in decimal degrees
     * @param altitudeRelativeMeters target altitude relative to home in meters
     * @param seqNum packet sequence number (caller manages counter)
     */
    public static byte[] buildSetPositionTargetGlobalInt(
            int targetSysId,
            double latitudeDeg,
            double longitudeDeg,
            double altitudeRelativeMeters,
            int seqNum
    ) {
        // Payload fields (53 bytes):
        // time_boot_ms, lat_int, lon_int, alt, vx, vy, vz, afx, afy, afz, yaw, yaw_rate,
        // type_mask, target_system, target_component, coordinate_frame
        final int payloadLen = 53;
        final int totalLen = V1_HEADER_LENGTH + payloadLen + CRC_LENGTH;
        final int typeMaskPositionOnly = (1 << 3) | (1 << 4) | (1 << 5)
                | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 10) | (1 << 11);
        final int mavFrameGlobalRelativeAltInt = 6;

        int latitudeInt = (int) Math.round(latitudeDeg * 1e7);
        int longitudeInt = (int) Math.round(longitudeDeg * 1e7);

        byte[] packet = new byte[totalLen];
        packet[0] = (byte) MAVLINK_V1_START;
        packet[1] = (byte) payloadLen;
        packet[2] = (byte) (seqNum & 0xFF);
        packet[3] = (byte) GCS_SYSTEM_ID;
        packet[4] = (byte) GCS_COMPONENT_ID;
        packet[5] = (byte) MAVLINK_MSG_ID_SET_POSITION_TARGET_GLOBAL_INT;

        ByteBuffer buf = ByteBuffer.wrap(packet, V1_HEADER_LENGTH, payloadLen)
                .order(ByteOrder.LITTLE_ENDIAN);
        buf.putInt(0); // time_boot_ms optional
        buf.putInt(latitudeInt);
        buf.putInt(longitudeInt);
        buf.putFloat((float) altitudeRelativeMeters);
        buf.putFloat(0f); // vx
        buf.putFloat(0f); // vy
        buf.putFloat(0f); // vz
        buf.putFloat(0f); // afx
        buf.putFloat(0f); // afy
        buf.putFloat(0f); // afz
        buf.putFloat(0f); // yaw
        buf.putFloat(0f); // yaw_rate
        buf.putShort((short) typeMaskPositionOnly);
        buf.put((byte) targetSysId);
        buf.put((byte) 1); // target_component = autopilot
        buf.put((byte) mavFrameGlobalRelativeAltInt);

        int crc = computeX25Crc(packet, 1, V1_HEADER_LENGTH - 1 + payloadLen, CRCX_SET_POSITION_TARGET_GLOBAL_INT);
        packet[V1_HEADER_LENGTH + payloadLen] = (byte) (crc & 0xFF);
        packet[V1_HEADER_LENGTH + payloadLen + 1] = (byte) ((crc >> 8) & 0xFF);
        return packet;
    }

    // ── CRC helpers ─────────────────────────────────────────────────────────────

    private static int computeX25Crc(byte[] buf, int start, int length, int magicExtra) {
        int crc = 0xFFFF;
        for (int i = start; i < start + length; i++) {
            crc = x25Accumulate(crc, buf[i]);
        }
        if (magicExtra >= 0) {
            crc = x25Accumulate(crc, (byte) magicExtra);
        }
        return crc & 0xFFFF;
    }

    private static int x25Accumulate(int crc, byte b) {
        int tmp = (b & 0xFF) ^ (crc & 0xFF);
        tmp ^= (tmp << 4) & 0xFF;
        return ((crc >> 8) & 0xFF) ^ ((tmp << 8) & 0xFFFF) ^ ((tmp << 3) & 0xFFFF) ^ (tmp >> 4);
    }

    /**
     * Returns the CRC extra byte (MAGIC_EXTRA) for known message IDs.
     * Returns -1 for unknown IDs, which marks the frame unsupported.
     */
    private static int crcExtraForMessage(int msgId) {
        return switch (msgId) {
            case 0   -> 50;   // HEARTBEAT
            case 1   -> 124;  // SYS_STATUS
            case 24  -> 24;   // GPS_RAW_INT
            case 30  -> 39;   // ATTITUDE
            case 33  -> 104;  // GLOBAL_POSITION_INT
            case 76  -> 152;  // COMMAND_LONG
            case 86  -> 5;    // SET_POSITION_TARGET_GLOBAL_INT
            case 109 -> 185;  // RADIO_STATUS
            default  -> -1;   // unknown — unsupported
        };
    }
}
