package com.sherlock.groundcontrol.entity;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.ArrayList;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EntitySmokeTest {

    @Test
    void operatorAndAuditEntitiesRunPrePersistHooks() throws Exception {
        OperatorEntity operator = OperatorEntity.builder()
                .username("operator")
                .passwordHash("hash")
                .enabled(true)
                .failedAttempts(0)
                .build();
        invokePrivate(operator, "onCreate");
        assertNotNull(operator.getCreatedAt());

        AuthAuditLogEntity audit = AuthAuditLogEntity.builder()
                .usernameAttempted("operator")
                .ipAddress("10.0.0.1")
                .userAgent("agent")
                .success(true)
                .build();
        invokePrivate(audit, "onPersist");
        assertNotNull(audit.getAttemptedAt());
    }

    @Test
    void missionWaypointAndGeofenceEntitiesExposeRelationships() {
        MissionEntity mission = MissionEntity.builder()
                .id(1L)
                .name("Mission")
                .status(MissionEntity.MissionStatus.PLANNED)
                .createdAt(Instant.now())
                .waypoints(new ArrayList<>())
                .build();
        WaypointEntity waypoint = WaypointEntity.builder()
                .id(1L)
                .mission(mission)
                .sequence(0)
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1200.0)
                .status(WaypointEntity.WaypointStatus.PENDING)
                .build();
        mission.getWaypoints().add(waypoint);

        GeofenceEntity geofence = GeofenceEntity.builder()
                .id(2L)
                .name("Fence")
                .active(true)
                .createdAt(Instant.now())
                .points(new ArrayList<>())
                .build();
        GeofencePointEntity point = GeofencePointEntity.builder()
                .id(2L)
                .geofence(geofence)
                .sequence(0)
                .latitude(37.0)
                .longitude(23.0)
                .build();
        geofence.getPoints().add(point);

        assertEquals(1, mission.getWaypoints().size());
        assertEquals(1200.0, mission.getWaypoints().get(0).getAltitude());
        assertTrue(geofence.isActive());
        assertEquals(1, geofence.getPoints().size());
    }

    @Test
    void telemetryAndTokenEntitiesExposeFields() {
        TelemetryEntity telemetry = TelemetryEntity.builder()
                .droneId("DR-1")
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1200.0)
                .speed(100.0)
                .battery(80.0)
                .heading(90.0)
                .timestamp(Instant.now())
                .roll(1.0)
                .pitch(2.0)
                .hdop(0.8)
                .satelliteCount(12)
                .fixType(3)
                .rssi(90)
                .armed(true)
                .flightMode("GUIDED")
                .build();

        TokenBlacklistEntity blacklist = TokenBlacklistEntity.builder()
                .id(UUID.randomUUID())
                .jti("jti")
                .expiresAt(Instant.now().plusSeconds(60))
                .revokedAt(Instant.now())
                .build();

        assertEquals("DR-1", telemetry.getDroneId());
        assertTrue(telemetry.getArmed());
        assertEquals("jti", blacklist.getJti());
    }

    private static void invokePrivate(Object target, String methodName) throws Exception {
        Method method = target.getClass().getDeclaredMethod(methodName);
        method.setAccessible(true);
        method.invoke(target);
    }
}
