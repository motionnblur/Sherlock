package com.sherlock.groundcontrol.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Aggregates active drone IDs from all telemetry sources.
 * Currently two sources: TelemetrySimulator (always active) and
 * MavlinkAdapterService (conditional — only when app.mavlink.enabled=true).
 *
 * New telemetry sources plug in here without touching existing services.
 */
@Service
@RequiredArgsConstructor
public class DroneRegistryService {

    private final TelemetrySimulator telemetrySimulator;
    private final Optional<MavlinkAdapterService> mavlinkAdapterService;

    /**
     * Returns a stable, sorted list of all currently active drone IDs.
     * Simulated drones are always present; MAVLink drones appear as they connect.
     */
    public List<String> getActiveDroneIds() {
        List<String> ids = new ArrayList<>(telemetrySimulator.getFleetDroneIds());

        mavlinkAdapterService.ifPresent(adapter ->
                ids.addAll(adapter.getActiveDroneIds())
        );

        Collections.sort(ids);
        return Collections.unmodifiableList(ids);
    }
}
