package com.sherlock.groundcontrol.mavlink;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Map;
import java.util.Optional;

/**
 * Decodes MAVLink message payloads into typed records.
 * Only the six message types consumed by Sherlock GCS are implemented.
 *
 * All multi-byte fields use MAVLink's little-endian byte order.
 */
public final class MavlinkMessageDecoder {

    public static final int MSG_HEARTBEAT          = 0;
    public static final int MSG_SYS_STATUS         = 1;
    public static final int MSG_GPS_RAW_INT        = 24;
    public static final int MSG_ATTITUDE           = 30;
    public static final int MSG_GLOBAL_POSITION_INT = 33;
    public static final int MSG_COMMAND_ACK        = 77;
    public static final int MSG_RADIO_STATUS       = 109;

    private static final int MAV_MODE_FLAG_SAFETY_ARMED = 0x80;
    private static final int RSSI_MAX_RAW               = 254;
    private static final int RSSI_UNKNOWN               = 255;
    private static final int SAT_UNKNOWN                = 255;
    private static final int UINT16_MAX                 = 0xFFFF;
    private static final double DEG_E7_FACTOR           = 1e-7;
    private static final double MM_TO_M                 = 1e-3;
    private static final double CM_TO_KMH               = 0.036;    // cm/s → km/h
    private static final double HDOP_SCALE              = 0.01;     // eph is hdop*100
    private static final double HDG_SCALE               = 0.01;     // hdg is deg*100
    private static final double RAD_TO_DEG              = 180.0 / Math.PI;

    // ArduCopter custom_mode → human-readable name
    private static final Map<Integer, String> ARDUCOPTER_MODES = Map.ofEntries(
            Map.entry(0,  "STABILIZE"),
            Map.entry(1,  "ACRO"),
            Map.entry(2,  "ALT_HOLD"),
            Map.entry(3,  "AUTO"),
            Map.entry(4,  "GUIDED"),
            Map.entry(5,  "LOITER"),
            Map.entry(6,  "RTL"),
            Map.entry(7,  "CIRCLE"),
            Map.entry(9,  "LAND"),
            Map.entry(16, "POSHOLD"),
            Map.entry(17, "BRAKE"),
            Map.entry(21, "SMART_RTL")
    );

    private MavlinkMessageDecoder() {}

    // ── Decoded payload records ──────────────────────────────────────────────────

    public record HeartbeatData(boolean isArmed, String flightMode) {}

    public record SysStatusData(double batteryPercent) {}

    public record GpsRawIntData(
            double latitude, double longitude, double altitudeMsl,
            double hdop, int fixType, int satelliteCount
    ) {}

    public record AttitudeData(double roll, double pitch, double yaw) {}

    public record GlobalPositionIntData(
            double latitude, double longitude, double altitudeMsl, double relativeAltitudeMeters,
            double speed, double heading
    ) {}

    public record CommandAckData(int command, int result) {}

    public record RadioStatusData(int rssiPercent) {}

    // ── Decoders ─────────────────────────────────────────────────────────────────

    public static Optional<HeartbeatData> decodeHeartbeat(byte[] payload) {
        if (payload.length < 9) {
            return Optional.empty();
        }
        ByteBuffer buf = le(payload);
        int customMode    = buf.getInt();       // bytes 0-3
        buf.get();                              // type (skip)
        buf.get();                              // autopilot (skip)
        int baseMode      = buf.get() & 0xFF;  // byte 6

        boolean armed     = (baseMode & MAV_MODE_FLAG_SAFETY_ARMED) != 0;
        String modeName   = ARDUCOPTER_MODES.getOrDefault(customMode, "MODE " + customMode);
        return Optional.of(new HeartbeatData(armed, modeName));
    }

    public static Optional<SysStatusData> decodeSysStatus(byte[] payload) {
        if (payload.length < 19) {
            return Optional.empty();
        }
        ByteBuffer buf = le(payload);
        buf.position(18);                          // skip to battery_remaining
        int remaining = buf.get() & 0xFF;          // -1 (0xFF) = unknown
        if (remaining == 0xFF) {
            return Optional.empty();
        }
        return Optional.of(new SysStatusData(remaining));
    }

    public static Optional<GpsRawIntData> decodeGpsRawInt(byte[] payload) {
        if (payload.length < 30) {
            return Optional.empty();
        }
        ByteBuffer buf  = le(payload);
        buf.getLong();                             // time_usec — skip
        double lat      = buf.getInt() * DEG_E7_FACTOR;
        double lon      = buf.getInt() * DEG_E7_FACTOR;
        double alt      = buf.getInt() * MM_TO_M;
        int ephRaw      = buf.getShort() & 0xFFFF;
        buf.getShort();                            // epv — skip
        buf.getShort();                            // vel — skip
        buf.getShort();                            // cog — skip
        int fixType     = buf.get() & 0xFF;
        int sats        = buf.get() & 0xFF;

        double hdop     = (ephRaw == UINT16_MAX) ? Double.NaN : ephRaw * HDOP_SCALE;
        int satellites  = (sats == SAT_UNKNOWN) ? -1 : sats;
        return Optional.of(new GpsRawIntData(lat, lon, alt, hdop, fixType, satellites));
    }

    public static Optional<AttitudeData> decodeAttitude(byte[] payload) {
        if (payload.length < 28) {
            return Optional.empty();
        }
        ByteBuffer buf = le(payload);
        buf.getInt();                              // time_boot_ms — skip
        double roll  = buf.getFloat() * RAD_TO_DEG;
        double pitch = buf.getFloat() * RAD_TO_DEG;
        double yaw   = buf.getFloat() * RAD_TO_DEG;
        return Optional.of(new AttitudeData(roll, pitch, yaw));
    }

    public static Optional<GlobalPositionIntData> decodeGlobalPositionInt(byte[] payload) {
        if (payload.length < 28) {
            return Optional.empty();
        }
        ByteBuffer buf = le(payload);
        buf.getInt();                              // time_boot_ms — skip
        double lat      = buf.getInt() * DEG_E7_FACTOR;
        double lon      = buf.getInt() * DEG_E7_FACTOR;
        double alt      = buf.getInt() * MM_TO_M;
        double relativeAlt = buf.getInt() * MM_TO_M;
        double vx       = buf.getShort();
        double vy       = buf.getShort();
        buf.getShort();                            // vz — skip
        int hdgRaw      = buf.getShort() & 0xFFFF;

        double speed    = Math.sqrt(vx * vx + vy * vy) * CM_TO_KMH;
        double heading  = (hdgRaw == UINT16_MAX) ? Double.NaN : hdgRaw * HDG_SCALE;
        return Optional.of(new GlobalPositionIntData(lat, lon, alt, relativeAlt, speed, heading));
    }

    public static Optional<RadioStatusData> decodeRadioStatus(byte[] payload) {
        if (payload.length < 1) {
            return Optional.empty();
        }
        int rssiRaw = payload[0] & 0xFF;
        if (rssiRaw == RSSI_UNKNOWN) {
            return Optional.empty();
        }
        int rssiPercent = (int) Math.round((rssiRaw / (double) RSSI_MAX_RAW) * 100.0);
        return Optional.of(new RadioStatusData(Math.min(100, rssiPercent)));
    }

    public static Optional<CommandAckData> decodeCommandAck(byte[] payload) {
        if (payload.length < 3) {
            return Optional.empty();
        }
        ByteBuffer buffer = le(payload);
        int command = buffer.getShort() & 0xFFFF;
        int result = buffer.get() & 0xFF;
        return Optional.of(new CommandAckData(command, result));
    }

    // ── Helper ───────────────────────────────────────────────────────────────────

    private static ByteBuffer le(byte[] data) {
        return ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
    }
}
