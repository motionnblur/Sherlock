package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.CommandLifecycleDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.service.CommandLifecycleService;
import com.sherlock.groundcontrol.service.OperatorCommandService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;

import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.GOTO;
import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.RTH;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DroneCommandControllerUnitTest {

    @Test
    void sendCommandValidatesPayload() {
        OperatorCommandService operatorCommandService = mock(OperatorCommandService.class);
        CommandLifecycleService commandLifecycleService = mock(CommandLifecycleService.class);
        DroneCommandController controller = new DroneCommandController(operatorCommandService, commandLifecycleService);
        DroneCommandDTO missingType = new DroneCommandDTO();
        DroneCommandDTO invalidGoto = new DroneCommandDTO();
        invalidGoto.setCommandType(GOTO);
        invalidGoto.setLatitude(37.0);

        assertEquals(400, controller.sendCommand("MAVLINK-01", missingType).getStatusCode().value());
        assertEquals(400, controller.sendCommand("MAVLINK-01", invalidGoto).getStatusCode().value());
    }

    @Test
    void sendCommandMapsSubmissionResultToHttpStatusAndBody() {
        OperatorCommandService operatorCommandService = mock(OperatorCommandService.class);
        CommandLifecycleService commandLifecycleService = mock(CommandLifecycleService.class);
        DroneCommandController controller = new DroneCommandController(operatorCommandService, commandLifecycleService);

        DroneCommandDTO command = new DroneCommandDTO();
        command.setCommandType(RTH);

        CommandLifecycleDTO lifecycle = CommandLifecycleDTO.builder()
                .commandId("cmd-1")
                .droneId("MAVLINK-01")
                .commandType(RTH)
                .status(CommandLifecycleDTO.CommandStatus.FAILED)
                .requestedAt(Instant.parse("2026-04-15T00:00:00Z"))
                .updatedAt(Instant.parse("2026-04-15T00:00:01Z"))
                .detail("MAVLINK DISABLED")
                .build();

        when(operatorCommandService.submitCommand("MAVLINK-01", command))
                .thenReturn(new OperatorCommandService.SubmissionResult(HttpStatus.SERVICE_UNAVAILABLE, lifecycle));

        var response = controller.sendCommand("MAVLINK-01", command);
        assertEquals(503, response.getStatusCode().value());
        assertEquals("cmd-1", response.getBody().getCommandId());
    }

    @Test
    void getRecentCommandsReturnsHistoryPayload() {
        OperatorCommandService operatorCommandService = mock(OperatorCommandService.class);
        CommandLifecycleService commandLifecycleService = mock(CommandLifecycleService.class);
        DroneCommandController controller = new DroneCommandController(operatorCommandService, commandLifecycleService);

        when(commandLifecycleService.getRecentCommands("MAVLINK-01", 20))
                .thenReturn(List.of(CommandLifecycleDTO.builder().commandId("cmd-1").build()));

        var response = controller.getRecentCommands("MAVLINK-01", 20);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().getCommands().size());
    }
}
