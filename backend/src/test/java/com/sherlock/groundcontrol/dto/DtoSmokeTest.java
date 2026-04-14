package com.sherlock.groundcontrol.dto;

import com.sherlock.groundcontrol.entity.MissionEntity.MissionStatus;
import com.sherlock.groundcontrol.entity.WaypointEntity.WaypointStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DtoSmokeTest {

    @Test
    void telemetryAndLastKnownDtosRoundTripAllFields() {
        Instant timestamp = Instant.parse("2026-04-10T00:00:00Z");

        TelemetryDTO telemetry = TelemetryDTO.builder()
                .droneId("DR-1")
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1200.0)
                .speed(100.0)
                .battery(80.0)
                .heading(90.0)
                .timestamp(timestamp)
                .roll(1.0)
                .pitch(2.0)
                .hdop(0.8)
                .satelliteCount(12)
                .fixType(3)
                .rssi(90)
                .isArmed(true)
                .flightMode("GUIDED")
                .build();

        LastKnownTelemetryDTO lastKnown = LastKnownTelemetryDTO.builder()
                .droneId(telemetry.getDroneId())
                .latitude(telemetry.getLatitude())
                .longitude(telemetry.getLongitude())
                .altitude(telemetry.getAltitude())
                .speed(telemetry.getSpeed())
                .battery(telemetry.getBattery())
                .heading(telemetry.getHeading())
                .timestamp(telemetry.getTimestamp())
                .roll(telemetry.getRoll())
                .pitch(telemetry.getPitch())
                .hdop(telemetry.getHdop())
                .satelliteCount(telemetry.getSatelliteCount())
                .fixType(telemetry.getFixType())
                .rssi(telemetry.getRssi())
                .isArmed(telemetry.getIsArmed())
                .flightMode(telemetry.getFlightMode())
                .build();

        assertEquals("DR-1", lastKnown.getDroneId());
        assertEquals(12, lastKnown.getSatelliteCount());
        assertTrue(lastKnown.getIsArmed());
    }

    @Test
    void missionAndWaypointDtosExposeMutableFields() {
        WaypointDTO waypoint = WaypointDTO.builder()
                .id(1L)
                .sequence(0)
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1200.0)
                .label("WP-1")
                .status(WaypointStatus.ACTIVE)
                .build();

        MissionDTO mission = MissionDTO.builder()
                .id(10L)
                .name("Mission")
                .droneId("MAVLINK-01")
                .status(MissionStatus.ACTIVE)
                .createdAt(Instant.now())
                .waypoints(List.of(waypoint))
                .build();
        mission.setName("Mission-Updated");

        assertEquals("Mission-Updated", mission.getName());
        assertEquals(WaypointStatus.ACTIVE, mission.getWaypoints().get(0).getStatus());
    }

    @Test
    void geofenceAndBulkDtosExposeBuildersAndSetters() {
        GeofencePointDTO point = GeofencePointDTO.builder()
                .id(1L)
                .sequence(0)
                .latitude(37.0)
                .longitude(23.0)
                .build();

        GeofenceDTO geofence = GeofenceDTO.builder()
                .id(5L)
                .name("Fence")
                .isActive(true)
                .createdAt(Instant.now())
                .points(List.of(point))
                .build();

        GeofenceRequestDTO request = GeofenceRequestDTO.builder()
                .name(geofence.getName())
                .isActive(geofence.isActive())
                .points(geofence.getPoints())
                .build();

        BulkLastKnownRequestDTO bulkRequest = BulkLastKnownRequestDTO.builder()
                .droneIds(List.of("DR-1"))
                .build();
        BulkLastKnownResponseDTO bulkResponse = BulkLastKnownResponseDTO.builder()
                .telemetry(List.of(LastKnownTelemetryDTO.builder().droneId("DR-1").build()))
                .build();

        assertEquals("Fence", request.getName());
        assertEquals("DR-1", bulkRequest.getDroneIds().get(0));
        assertEquals("DR-1", bulkResponse.getTelemetry().get(0).getDroneId());
    }

    @Test
    void authAndStreamDtosExposeExpectedValues() {
        LoginRequestDTO loginRequest = new LoginRequestDTO();
        loginRequest.setUsername("operator");
        loginRequest.setPassword("secret");

        LoginResponseDTO loginResponse = LoginResponseDTO.builder()
                .token("jwt")
                .username("operator")
                .expiresAt(Instant.now())
                .build();

        DroneRegistryDTO registryDTO = DroneRegistryDTO.builder().droneIds(List.of("A", "B")).build();
        StreamUrlDTO streamUrlDTO = StreamUrlDTO.builder().streamUrl("http://localhost/hls/index.m3u8").build();
        BatteryAlertDTO batteryAlertDTO = BatteryAlertDTO.builder().droneId("DR-1").battery(12.5).build();
        GeofenceAlertDTO geofenceAlertDTO = GeofenceAlertDTO.builder().droneId("DR-1").eventType("ENTER").build();
        TelemetryLiteDTO liteDTO = TelemetryLiteDTO.builder().droneId("DR-1").latitude(1.0).build();

        DroneCommandDTO commandDTO = new DroneCommandDTO();
        commandDTO.setCommandType(DroneCommandDTO.CommandType.TAKEOFF);
        commandDTO.setAltitude(20.0);

        CreateMissionDTO createMissionDTO = new CreateMissionDTO("Mission", List.of());

        assertEquals("operator", loginRequest.getUsername());
        assertEquals("jwt", loginResponse.getToken());
        assertEquals(2, registryDTO.getDroneIds().size());
        assertEquals("http://localhost/hls/index.m3u8", streamUrlDTO.getStreamUrl());
        assertEquals(12.5, batteryAlertDTO.getBattery());
        assertEquals("ENTER", geofenceAlertDTO.getEventType());
        assertEquals("DR-1", liteDTO.getDroneId());
        assertEquals(DroneCommandDTO.CommandType.TAKEOFF, commandDTO.getCommandType());
        assertEquals("Mission", createMissionDTO.getName());
    }

    @Test
    void allArgsConstructorsExposeExpectedValues() {
        Instant timestamp = Instant.parse("2026-04-10T00:00:00Z");

        LastKnownTelemetryDTO lastKnown = new LastKnownTelemetryDTO(
                "DR-2",
                37.2,
                23.2,
                900.0,
                70.0,
                50.0,
                125.0,
                timestamp,
                1.2,
                -0.3,
                0.7,
                10,
                3,
                75,
                true,
                "AUTO"
        );
        GeofenceAlertDTO geofenceAlert = new GeofenceAlertDTO(
                "DR-2",
                11L,
                "Fence-11",
                "EXIT",
                37.2,
                23.2,
                905.0,
                timestamp
        );
        TelemetryLiteDTO telemetryLite = new TelemetryLiteDTO("DR-2", 37.2, 23.2, 905.0, 123.0, timestamp);

        assertEquals("DR-2", lastKnown.getDroneId());
        assertEquals("AUTO", lastKnown.getFlightMode());
        assertEquals("Fence-11", geofenceAlert.getGeofenceName());
        assertEquals("EXIT", geofenceAlert.getEventType());
        assertEquals(123.0, telemetryLite.getHeading());
    }
}
