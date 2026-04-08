package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.GeofenceAlertDTO;
import com.sherlock.groundcontrol.dto.GeofenceDTO;
import com.sherlock.groundcontrol.dto.GeofencePointDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeofenceBreachService {

    private static final String GEOFENCE_ALERT_TOPIC = "/topic/alerts/geofence";

    private final GeofenceService geofenceService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Map<GeofenceStateKey, Boolean> lastKnownStateByKey = new ConcurrentHashMap<>();

    public void evaluateTelemetry(TelemetryDTO telemetry) {
        if (telemetry == null
                || telemetry.getDroneId() == null
                || telemetry.getLatitude() == null
                || telemetry.getLongitude() == null
                || telemetry.getAltitude() == null) {
            return;
        }

        List<GeofenceDTO> geofences = geofenceService.getActiveGeofencesSnapshot();
        if (geofences.isEmpty()) {
            return;
        }

        for (GeofenceDTO geofence : geofences) {
            try {
                evaluateGeofence(telemetry, geofence);
            } catch (RuntimeException exception) {
                log.warn(
                        "Skipping malformed geofence id={} name='{}': {}",
                        geofence.getId(),
                        geofence.getName(),
                        exception.getMessage()
                );
            }
        }
    }

    @EventListener
    public void handleGeofenceTopologyChanged(GeofenceTopologyChangedEvent event) {
        if (event == null || event.geofenceId() == null) {
            return;
        }
        lastKnownStateByKey.keySet().removeIf(key -> event.geofenceId().equals(key.geofenceId()));
    }

    private void evaluateGeofence(TelemetryDTO telemetry, GeofenceDTO geofence) {
        List<GeofencePointDTO> points = geofence.getPoints();
        boolean inside = GeofenceGeometry.containsPoint(points, telemetry.getLatitude(), telemetry.getLongitude());
        GeofenceStateKey key = new GeofenceStateKey(telemetry.getDroneId(), geofence.getId());
        Boolean previous = lastKnownStateByKey.put(key, inside);

        if (previous == null || previous.equals(inside)) {
            return;
        }

        String eventType = inside ? "ENTER" : "EXIT";
        messagingTemplate.convertAndSend(GEOFENCE_ALERT_TOPIC, GeofenceAlertDTO.builder()
                .droneId(telemetry.getDroneId())
                .geofenceId(geofence.getId())
                .geofenceName(geofence.getName())
                .eventType(eventType)
                .latitude(telemetry.getLatitude())
                .longitude(telemetry.getLongitude())
                .altitude(telemetry.getAltitude())
                .timestamp(telemetry.getTimestamp() != null ? telemetry.getTimestamp() : Instant.now())
                .build());
    }

    private record GeofenceStateKey(String droneId, Long geofenceId) {}
}
