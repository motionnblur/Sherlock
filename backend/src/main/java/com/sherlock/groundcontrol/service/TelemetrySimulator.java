package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.dto.TelemetryLiteDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Random;

/**
 * Simulates realistic UAV telemetry data and broadcasts it via STOMP.
 * Generates movement based on heading and speed physics, then persists each data point.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TelemetrySimulator {

    private static final String TELEMETRY_TOPIC = "/topic/telemetry";
    private static final double EARTH_RADIUS_KM = 6371.0;

    private final SimpMessagingTemplate messagingTemplate;
    private final TelemetryService telemetryService;
    private final Random random = new Random();

    // Initial position: Eastern Mediterranean (training airspace)
    private double latitude  = 37.9838;
    private double longitude = 23.7275;
    private double altitude  = 1500.0;   // meters ASL
    private double speed     = 120.0;    // km/h
    private double battery   = 95.0;     // %
    private double heading   = 045.0;    // degrees (0-360, clockwise from North)

    @Scheduled(fixedRate = 500)
    public void broadcastTelemetry() {
        updateState();

        TelemetryDTO dto = TelemetryDTO.builder()
                .latitude(latitude)
                .longitude(longitude)
                .altitude(roundTo(altitude, 1))
                .speed(roundTo(speed, 1))
                .battery(roundTo(battery, 2))
                .heading(roundTo(normalizeHeading(heading), 1))
                .timestamp(Instant.now())
                .build();

        messagingTemplate.convertAndSend(TELEMETRY_TOPIC, dto);

        TelemetryLiteDTO liteDto = TelemetryLiteDTO.builder()
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .altitude(dto.getAltitude())
                .heading(dto.getHeading())
                .timestamp(dto.getTimestamp())
                .build();
        messagingTemplate.convertAndSend(TELEMETRY_TOPIC + "/lite", liteDto);

        telemetryService.persist(dto);

        log.debug("TX [SHERLOCK-01] lat={} lon={} alt={}m spd={}km/h bat={}% hdg={}°",
                String.format("%.6f", latitude),
                String.format("%.6f", longitude),
                String.format("%.1f", altitude),
                String.format("%.1f", speed),
                String.format("%.2f", battery),
                String.format("%.1f", heading));
    }

    private void updateState() {
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

    private double normalizeHeading(double degrees) {
        return ((degrees % 360.0) + 360.0) % 360.0;
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double roundTo(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }
}
