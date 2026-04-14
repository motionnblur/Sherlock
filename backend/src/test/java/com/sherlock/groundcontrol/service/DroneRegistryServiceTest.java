package com.sherlock.groundcontrol.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DroneRegistryServiceTest {

    @Test
    void getActiveDroneIdsMergesSortsAndReturnsUnmodifiableList() {
        TelemetrySimulator telemetrySimulator = mock(TelemetrySimulator.class);
        MavlinkAdapterService mavlinkAdapterService = mock(MavlinkAdapterService.class);
        when(telemetrySimulator.getFleetDroneIds()).thenReturn(List.of("SHERLOCK-02", "SHERLOCK-01"));
        when(mavlinkAdapterService.getActiveDroneIds()).thenReturn(List.of("MAVLINK-03", "MAVLINK-01"));

        DroneRegistryService service = new DroneRegistryService(telemetrySimulator, Optional.of(mavlinkAdapterService));
        List<String> ids = service.getActiveDroneIds();

        assertEquals(List.of("MAVLINK-01", "MAVLINK-03", "SHERLOCK-01", "SHERLOCK-02"), ids);
        assertThrows(UnsupportedOperationException.class, () -> ids.add("NEW"));
    }

    @Test
    void getActiveDroneIdsUsesSimulatorOnlyWhenMavlinkDisabled() {
        TelemetrySimulator telemetrySimulator = mock(TelemetrySimulator.class);
        when(telemetrySimulator.getFleetDroneIds()).thenReturn(List.of("SHERLOCK-09"));

        DroneRegistryService service = new DroneRegistryService(telemetrySimulator, Optional.empty());

        assertEquals(List.of("SHERLOCK-09"), service.getActiveDroneIds());
    }
}
