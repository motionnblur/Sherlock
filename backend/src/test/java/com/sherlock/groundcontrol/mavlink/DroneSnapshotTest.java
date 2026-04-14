package com.sherlock.groundcontrol.mavlink;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DroneSnapshotTest {

    @Test
    void hasPositionRequiresLatitudeLongitudeAndAltitude() {
        DroneSnapshot snapshot = new DroneSnapshot(1);

        assertFalse(snapshot.hasPosition());
        snapshot.setLatitude(37.0);
        snapshot.setLongitude(23.0);
        assertFalse(snapshot.hasPosition());
        snapshot.setAltitudeMsl(1000.0);
        assertTrue(snapshot.hasPosition());
    }
}
