package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.GeofenceDTO;
import com.sherlock.groundcontrol.dto.GeofenceAlertDTO;
import com.sherlock.groundcontrol.dto.GeofencePointDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GeofenceBreachServiceTest {

    private GeofenceService geofenceService;
    private SimpMessagingTemplate messagingTemplate;
    private GeofenceBreachService breachService;

    @BeforeEach
    void setUp() {
        geofenceService = mock(GeofenceService.class);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        breachService = new GeofenceBreachService(geofenceService, messagingTemplate);
    }

    @Test
    void firstSampleInitializesStateWithoutAlert() {
        GeofenceDTO geofence = geofence(1L, "TEST-FENCE");
        when(geofenceService.getActiveGeofencesSnapshot()).thenReturn(List.of(geofence));

        breachService.evaluateTelemetry(telemetry(37.25, 23.25));

        verify(messagingTemplate, never()).convertAndSend(eq("/topic/alerts/geofence"), any(GeofenceAlertDTO.class));
    }

    @Test
    void insideToOutsideEmitsExitAlertOnce() {
        GeofenceDTO geofence = geofence(1L, "TEST-FENCE");
        when(geofenceService.getActiveGeofencesSnapshot()).thenReturn(List.of(geofence));

        breachService.evaluateTelemetry(telemetry(37.25, 23.25));
        breachService.evaluateTelemetry(telemetry(38.5, 24.5));
        breachService.evaluateTelemetry(telemetry(38.5, 24.5));

        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/alerts/geofence"), any(GeofenceAlertDTO.class));
    }

    @Test
    void outsideToInsideEmitsEnterAlert() {
        GeofenceDTO geofence = geofence(1L, "TEST-FENCE");
        when(geofenceService.getActiveGeofencesSnapshot()).thenReturn(List.of(geofence));

        breachService.evaluateTelemetry(telemetry(38.5, 24.5));
        breachService.evaluateTelemetry(telemetry(37.25, 23.25));

        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/alerts/geofence"), any(GeofenceAlertDTO.class));
    }

    private static GeofenceDTO geofence(Long id, String name) {
        return GeofenceDTO.builder()
                .id(id)
                .name(name)
                .isActive(true)
                .createdAt(Instant.parse("2026-04-08T00:00:00Z"))
                .points(List.of(
                        point(0, 37.0, 23.0),
                        point(1, 37.0, 24.0),
                        point(2, 38.0, 24.0),
                        point(3, 38.0, 23.0)
                ))
                .build();
    }

    private static GeofencePointDTO point(int sequence, double latitude, double longitude) {
        return GeofencePointDTO.builder()
                .sequence(sequence)
                .latitude(latitude)
                .longitude(longitude)
                .build();
    }

    private static TelemetryDTO telemetry(double latitude, double longitude) {
        return TelemetryDTO.builder()
                .droneId("SHERLOCK-01")
                .latitude(latitude)
                .longitude(longitude)
                .altitude(1200.0)
                .heading(90.0)
                .timestamp(Instant.parse("2026-04-08T00:00:00Z"))
                .build();
    }
}
