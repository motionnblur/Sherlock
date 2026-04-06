package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.BatteryAlertDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.dto.TelemetryLiteDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Simulates realistic UAV telemetry data and broadcasts it via STOMP.
 * Generates movement based on heading and speed physics, then persists each data point.
 */
@Service
@Slf4j
public class TelemetrySimulator {

    private static final int TELEMETRY_INTERVAL_MS = 500;
    private static final int MIN_DRONE_ID_WIDTH = 2;
    private static final String TELEMETRY_TOPIC_PREFIX = "/topic/telemetry/";
    private static final String FLEET_LITE_TOPIC = "/topic/telemetry/lite/fleet";
    private static final String BATTERY_ALERT_TOPIC = "/topic/alerts/battery";
    private static final double BATTERY_WARN_THRESHOLD = 20.0;
    private static final double BATTERY_CRITICAL_THRESHOLD = 5.0;
    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double BASE_LATITUDE = 37.9838;
    private static final double BASE_LONGITUDE = 23.7275;
    private static final double FLEET_SPACING_DEGREES = 0.02;

    private final SimpMessagingTemplate messagingTemplate;
    private final TelemetryService telemetryService;
    private final List<DroneState> fleet;
    private final int droneIdWidth;
    private final Map<String, BatteryAlertLevel> batteryAlertStates;

    public TelemetrySimulator(
            SimpMessagingTemplate messagingTemplate,
            TelemetryService telemetryService,
            @Value("${app.simulator.fleet-size:5000}") int configuredFleetSize
    ) {
        this.messagingTemplate = messagingTemplate;
        this.telemetryService = telemetryService;
        int fleetSize = Math.max(1, configuredFleetSize);
        this.droneIdWidth = Math.max(MIN_DRONE_ID_WIDTH, String.valueOf(fleetSize).length());
        this.fleet = initializeFleet(fleetSize);
        this.batteryAlertStates = new HashMap<>(fleetSize * 2);
        for (DroneState state : this.fleet) {
            batteryAlertStates.put(state.droneId, BatteryAlertLevel.NORMAL);
        }
    }

    @Scheduled(fixedRate = TELEMETRY_INTERVAL_MS)
    public void broadcastTelemetry() {
        Instant timestamp = Instant.now();
        List<TelemetryDTO> telemetryBatch = new ArrayList<>(fleet.size());
        List<TelemetryLiteDTO> fleetLiteBatch = new ArrayList<>(fleet.size());

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
                    .timestamp(timestamp)
                    .build();

            telemetryBatch.add(dto);
            messagingTemplate.convertAndSend(TELEMETRY_TOPIC_PREFIX + state.droneId, dto);
            emitBatteryAlertIfStateChanged(dto.getDroneId(), dto.getBattery());

            TelemetryLiteDTO liteDto = TelemetryLiteDTO.builder()
                    .droneId(dto.getDroneId())
                    .latitude(dto.getLatitude())
                    .longitude(dto.getLongitude())
                    .altitude(dto.getAltitude())
                    .heading(dto.getHeading())
                    .timestamp(dto.getTimestamp())
                    .build();
            fleetLiteBatch.add(liteDto);

            if (state.droneId.equals(fleet.get(0).droneId)) {
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

        telemetryService.persistBatch(telemetryBatch);
        messagingTemplate.convertAndSend(FLEET_LITE_TOPIC, fleetLiteBatch);
    }

    private List<DroneState> initializeFleet(int fleetSize) {
        List<DroneState> drones = new ArrayList<>(fleetSize);
        int gridSize = (int) Math.ceil(Math.sqrt(fleetSize));
        double centerOffset = (gridSize - 1) / 2.0;

        for (int index = 0; index < fleetSize; index++) {
            int row = index / gridSize;
            int column = index % gridSize;
            DroneState state = new DroneState(formatDroneId(index + 1), index);
            state.latitude = BASE_LATITUDE + ((row - centerOffset) * FLEET_SPACING_DEGREES);
            state.longitude = BASE_LONGITUDE + ((column - centerOffset) * FLEET_SPACING_DEGREES);
            state.altitude = 1200.0 + ((index % 12) * 120.0);
            state.speed = 95.0 + (index % 35);
            state.battery = Math.min(100.0, 88.0 + (index % 13));
            state.heading = (index * 17.0) % 360.0;
            drones.add(state);
        }

        log.info("Initialized telemetry simulator fleet: {} drones", fleetSize);
        return drones;
    }

    private String formatDroneId(int index) {
        return "SHERLOCK-" + String.format("%0" + droneIdWidth + "d", index);
    }

    private double normalizeHeading(double degrees) {
        return ((degrees % 360.0) + 360.0) % 360.0;
    }

    private double roundTo(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    private void emitBatteryAlertIfStateChanged(String droneId, double battery) {
        BatteryAlertLevel current = battery < BATTERY_CRITICAL_THRESHOLD
                ? BatteryAlertLevel.CRITICAL
                : battery < BATTERY_WARN_THRESHOLD
                        ? BatteryAlertLevel.WARN
                        : BatteryAlertLevel.NORMAL;

        BatteryAlertLevel previous = batteryAlertStates.put(droneId, current);
        if (current != previous) {
            messagingTemplate.convertAndSend(BATTERY_ALERT_TOPIC,
                    BatteryAlertDTO.builder()
                            .droneId(droneId)
                            .battery(battery)
                            .build());
        }
    }

    private enum BatteryAlertLevel {
        NORMAL, WARN, CRITICAL
    }

    private static class DroneState {
        private final String droneId;
        private final Random random;
        private double latitude;
        private double longitude;
        private double altitude;
        private double speed;
        private double battery;
        private double heading;

        private DroneState(String droneId, int seedOffset) {
            this.droneId = droneId;
            this.random = new Random(1_000L + seedOffset);
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

        private double clamp(double value, double min, double max) {
            return Math.max(min, Math.min(max, value));
        }
    }
}
