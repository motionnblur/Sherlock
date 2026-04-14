package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.service.DroneCommandService;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.GOTO;
import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.RTH;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DroneCommandControllerUnitTest {

    @Test
    void sendCommandReturnsServiceUnavailableWhenMavlinkDisabled() {
        DroneCommandController controller = new DroneCommandController(Optional.empty());

        DroneCommandDTO command = new DroneCommandDTO();
        command.setCommandType(RTH);

        assertEquals(503, controller.sendCommand("MAVLINK-01", command).getStatusCode().value());
    }

    @Test
    void sendCommandValidatesPayload() {
        DroneCommandController controller = new DroneCommandController(Optional.of(mock(DroneCommandService.class)));
        DroneCommandDTO missingType = new DroneCommandDTO();
        DroneCommandDTO invalidGoto = new DroneCommandDTO();
        invalidGoto.setCommandType(GOTO);
        invalidGoto.setLatitude(37.0);

        assertEquals(400, controller.sendCommand("MAVLINK-01", missingType).getStatusCode().value());
        assertEquals(400, controller.sendCommand("MAVLINK-01", invalidGoto).getStatusCode().value());
    }

    @Test
    void sendCommandMapsDispatchResultsToHttpStatuses() {
        DroneCommandService service = mock(DroneCommandService.class);
        DroneCommandController controller = new DroneCommandController(Optional.of(service));

        DroneCommandDTO command = new DroneCommandDTO();
        command.setCommandType(RTH);

        when(service.sendCommand("MAVLINK-01", command)).thenReturn(DroneCommandService.DispatchResult.DISPATCHED);
        assertEquals(202, controller.sendCommand("MAVLINK-01", command).getStatusCode().value());

        when(service.sendCommand("MAVLINK-01", command)).thenReturn(DroneCommandService.DispatchResult.DRONE_UNAVAILABLE);
        assertEquals(422, controller.sendCommand("MAVLINK-01", command).getStatusCode().value());

        when(service.sendCommand("MAVLINK-01", command)).thenReturn(DroneCommandService.DispatchResult.NAVIGATION_NOT_READY);
        assertEquals(409, controller.sendCommand("MAVLINK-01", command).getStatusCode().value());
    }
}
