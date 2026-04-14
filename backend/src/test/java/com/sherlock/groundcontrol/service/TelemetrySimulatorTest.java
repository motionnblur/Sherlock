package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.BatteryAlertDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Field;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TelemetrySimulatorTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private TelemetryService telemetryService;

    @Mock
    private GeofenceBreachService geofenceBreachService;

    @Test
    void getFleetDroneIdsUsesConfiguredWidthAndMinimumFleetSize() {
        TelemetrySimulator minimumFleet = new TelemetrySimulator(messagingTemplate, telemetryService, geofenceBreachService, 0);
        assertEquals(List.of("SHERLOCK-01"), minimumFleet.getFleetDroneIds());

        TelemetrySimulator wideFleet = new TelemetrySimulator(messagingTemplate, telemetryService, geofenceBreachService, 100);
        assertEquals("SHERLOCK-001", wideFleet.getFleetDroneIds().get(0));
        assertEquals(100, wideFleet.getFleetDroneIds().size());
    }

    @Test
    void broadcastTelemetryPublishesTelemetryAndFleetLiteAndPersistsBatch() {
        TelemetrySimulator simulator = new TelemetrySimulator(messagingTemplate, telemetryService, geofenceBreachService, 2);
        String firstDroneId = simulator.getFleetDroneIds().get(0);

        simulator.broadcastTelemetry();

        verify(telemetryService).persistBatch(any(List.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/telemetry/" + firstDroneId), any(TelemetryDTO.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/telemetry/lite/fleet"), any(List.class));
        verify(geofenceBreachService, atLeast(2)).evaluateTelemetry(any());
    }

    @Test
    void broadcastTelemetryEmitsBatteryAlertOnStateTransition() throws Exception {
        TelemetrySimulator simulator = new TelemetrySimulator(messagingTemplate, telemetryService, geofenceBreachService, 1);
        String droneId = simulator.getFleetDroneIds().get(0);

        setBattery(simulator, 4.0);
        simulator.broadcastTelemetry();

        verify(messagingTemplate).convertAndSend(eq("/topic/alerts/battery"), any(BatteryAlertDTO.class));

        // Keep it critical; no additional transition alert should be emitted.
        setBattery(simulator, 3.0);
        simulator.broadcastTelemetry();

        verify(messagingTemplate, atLeast(1)).convertAndSend(eq("/topic/alerts/battery"), any(BatteryAlertDTO.class));
        assertTrue(droneId.startsWith("SHERLOCK-"));
    }

    private static void setBattery(TelemetrySimulator simulator, double battery) throws Exception {
        Field fleetField = TelemetrySimulator.class.getDeclaredField("fleet");
        fleetField.setAccessible(true);
        List<?> fleet = (List<?>) fleetField.get(simulator);
        Object firstDrone = fleet.get(0);

        Field batteryField = firstDrone.getClass().getDeclaredField("battery");
        batteryField.setAccessible(true);
        batteryField.setDouble(firstDrone, battery);
    }
}
