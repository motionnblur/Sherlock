package com.sherlock.groundcontrol.mavlink;

import lombok.Getter;
import lombok.Setter;

import java.net.InetSocketAddress;
import java.time.Instant;

/**
 * Mutable, merged state for one MAVLink drone (identified by system ID).
 * Updated incrementally as different message types arrive; not every field
 * is populated after the first frame — callers must null-check.
 *
 * Thread-safety: MavlinkAdapterService updates snapshots on a single listener
 * thread and reads them on the @Scheduled publish thread. Fields are written
 * via volatile to ensure visibility without full synchronization overhead.
 */
@Getter
@Setter
public class DroneSnapshot {

    private final int systemId;

    // Set once from the source of the first UDP packet and updated on reconnect
    private volatile InetSocketAddress sourceAddress;

    // From GLOBAL_POSITION_INT
    private volatile Double latitude;
    private volatile Double longitude;
    private volatile Double altitudeMsl;
    private volatile Double relativeAltitudeMeters;
    private volatile Double speed;
    private volatile Double heading;

    // From ATTITUDE
    private volatile Double roll;
    private volatile Double pitch;

    // From GPS_RAW_INT
    private volatile Integer fixType;
    private volatile Double hdop;
    private volatile Integer satelliteCount;

    // From HEARTBEAT
    private volatile Boolean armed;
    private volatile String flightMode;

    // From SYS_STATUS
    private volatile Double batteryPercent;

    // From RADIO_STATUS
    private volatile Integer rssiPercent;

    // Metadata
    private volatile Instant lastSeen;

    public DroneSnapshot(int systemId) {
        this.systemId = systemId;
        this.lastSeen = Instant.now();
    }

    /** Returns true if position data has been received — minimum to emit a telemetry frame. */
    public boolean hasPosition() {
        return latitude != null && longitude != null && altitudeMsl != null;
    }
}
