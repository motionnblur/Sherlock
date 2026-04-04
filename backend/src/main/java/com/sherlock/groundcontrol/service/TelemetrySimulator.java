package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.dto.TelemetryLiteDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Simulates realistic UAV telemetry data and broadcasts it via STOMP.
 * Generates movement based on heading and speed physics, then persists each data point.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TelemetrySimulator {

    private static final String TELEMETRY_TOPIC_PREFIX = "/topic/telemetry";
    private static final double EARTH_RADIUS_KM = 6371.0;

    private final SimpMessagingTemplate messagingTemplate;
    private final TelemetryService telemetryService;

    private final List<DroneState> fleet = initializeFleet();

    private List<DroneState> initializeFleet() {
        List<DroneState> drones = new ArrayList<>();
        // Initial center position: Eastern Mediterranean
        double baseLat  = 37.9838;
        double baseLon = 23.7275;

        for (int i = 1; i <= 5; i++) {
            String droneId = String.format("SHERLOCK-%02d", i);
            DroneState state = new DroneState(droneId);
            // Stagger starting positions slightly
            state.latitude = baseLat + (i * 0.05) - 0.15;
            state.longitude = baseLon + (i * 0.05) - 0.15;
            state.altitude = 1500.0 + (i * 100);
            state.speed = 120.0 + (i * 5);
            state.battery = 95.0 + i;
            state.heading = i * 60.0;
            drones.add(state);
        }
        return drones;
    }

    @Scheduled(fixedRate = 500)
    public void broadcastTelemetry() {
        for (DroneState state : fleet) {
            state.updateState();

            TelemetryDTO dto = TelemetryDTO.builder()
                    .droneId(state.droneId)
                    .latitude(state.latitude)
                    .longitude(state.longitude)
                    .altitude(roundTo(state.altitude, 1))
                    .speed(roundTo(state.speed, 1))
                    .battery(roundTo(state.battery, 2))
                    .heading(roundTo(normalizeHeading(state.heading), 1))
                    .timestamp(Instant.now())
                    .build();

            String fullTopic = TELEMETRY_TOPIC_PREFIX + "/" + state.droneId;
            messagingTemplate.convertAndSend(fullTopic, dto);

            TelemetryLiteDTO liteDto = TelemetryLiteDTO.builder()
                    .droneId(dto.getDroneId())
                    .latitude(dto.getLatitude())
                    .longitude(dto.getLongitude())
                    .altitude(dto.getAltitude())
                    .heading(dto.getHeading())
                    .timestamp(dto.getTimestamp())
                    .build();
            String liteTopic = fullTopic + "/lite";
            messagingTemplate.convertAndSend(liteTopic, liteDto);

            telemetryService.persist(dto);

            if (state.droneId.equals("SHERLOCK-01")) {
                log.debug("TX [{}] lat={} lon={} alt={}m spd={}km/h bat={}% hdg={}°",
                        state.droneId,
                        String.format("%.6f", state.latitude),
                        String.format("%.6f", state.longitude),
                        String.format("%.1f", state.altitude),
                        String.format("%.1f", state.speed),
                        String.format("%.2f", state.battery),
                        String.format("%.1f", state.heading));
            }
        }
    }

    private double normalizeHeading(double degrees) {
        return ((degrees % 360.0) + 360.0) % 360.0;
    }

    private double roundTo(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    private class DroneState {
        String droneId;
        double latitude;
        double longitude;
        double altitude;
        double speed;
        double battery;
        double heading;
        Random random = new Random();

        DroneState(String droneId) {
            this.droneId = droneId;
        }

        void updateState() {
            // Gradual heading drift to simulate waypoint navigation
            heading += (random.nextDouble() - 0.5) * 6.0;

            // Convert speed (km/h) and 500ms tick to distance (km)
            double distanceKm = (speed / 3600.0) * 0.5;
            double headingRad = Math.toRadians(heading);

            // Approximate lat/lon delta for small distances
            double latDelta = (distanceKm / EARTH_RADIUS_KM) * Math.cos(headingRad) * (180.0 / Math.PI);
            double lonDelta = (distanceKm / EARTH_RADIUS_KM) * Math.sin(headingRad)
                    * (180.0 / Math.PI) / Math.cos(Math.toRadians(latitude));

            latitude  += latDelta + (random.nextDouble() - 0.5) * 0.00005;
            longitude += lonDelta + (random.nextDouble() - 0.5) * 0.00005;

            // Altitude: gradual oscillation within an operational band
            altitude += (random.nextDouble() - 0.5) * 12.0;
            altitude  = clamp(altitude, 800.0, 3500.0);

            // Speed: small perturbations around cruise
            speed += (random.nextDouble() - 0.5) * 4.0;
            speed  = clamp(speed, 85.0, 195.0);

            // Battery: realistic drain rate (~0.025% per 500ms ≈ 3%/min)
            battery -= 0.025 + random.nextDouble() * 0.005;
            battery  = Math.max(0.0, battery);
        }

        private double clamp(double value, double min, double max) {
            return Math.max(min, Math.min(max, value));
        }
    }
}
