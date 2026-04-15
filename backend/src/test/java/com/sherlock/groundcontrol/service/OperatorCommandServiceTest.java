package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.CommandLifecycleDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OperatorCommandServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private DroneCommandService droneCommandService;

    private CommandLifecycleService lifecycleService;

    @BeforeEach
    void setUp() throws Exception {
        lifecycleService = new CommandLifecycleService(messagingTemplate);
        setField(lifecycleService, "perDroneLimit", 20);
        setField(lifecycleService, "ackTimeoutMs", 5000L);
    }

    @Test
    void simulatorCommandIsImmediatelyAcked() {
        OperatorCommandService service = new OperatorCommandService(Optional.of(droneCommandService), lifecycleService);
        DroneCommandDTO command = command(CommandType.RTH);

        OperatorCommandService.SubmissionResult result = service.submitCommand("SHERLOCK-01", command);

        assertEquals(HttpStatus.ACCEPTED, result.httpStatus());
        assertEquals(CommandLifecycleDTO.CommandStatus.ACKED, result.lifecycle().getStatus());
        assertTrue(result.lifecycle().getDetail().contains("Simulator"));
    }

    @Test
    void mavlinkDisabledReturnsServiceUnavailableAndFailedLifecycle() {
        OperatorCommandService service = new OperatorCommandService(Optional.empty(), lifecycleService);
        DroneCommandDTO command = command(CommandType.RTH);

        OperatorCommandService.SubmissionResult result = service.submitCommand("MAVLINK-01", command);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, result.httpStatus());
        assertEquals(CommandLifecycleDTO.CommandStatus.FAILED, result.lifecycle().getStatus());
    }

    @Test
    void gotoDispatchIsSyntheticAcked() {
        OperatorCommandService service = new OperatorCommandService(Optional.of(droneCommandService), lifecycleService);
        DroneCommandDTO command = command(CommandType.GOTO);
        command.setLatitude(37.98);
        command.setLongitude(23.72);
        command.setAltitude(1200.0);
        when(droneCommandService.sendCommand("MAVLINK-01", command))
                .thenReturn(DroneCommandService.DispatchResult.DISPATCHED);

        OperatorCommandService.SubmissionResult result = service.submitCommand("MAVLINK-01", command);

        assertEquals(HttpStatus.ACCEPTED, result.httpStatus());
        assertEquals(CommandLifecycleDTO.CommandStatus.ACKED, result.lifecycle().getStatus());
        assertTrue(result.lifecycle().getDetail().contains("synthetic ACK"));
    }

    @Test
    void armDispatchWaitsForAckAndCanBeResolvedLater() {
        OperatorCommandService service = new OperatorCommandService(Optional.of(droneCommandService), lifecycleService);
        DroneCommandDTO command = command(CommandType.ARM);
        when(droneCommandService.sendCommand("MAVLINK-01", command))
                .thenReturn(DroneCommandService.DispatchResult.DISPATCHED);

        OperatorCommandService.SubmissionResult result = service.submitCommand("MAVLINK-01", command);

        assertEquals(CommandLifecycleDTO.CommandStatus.SENT, result.lifecycle().getStatus());
        CommandLifecycleDTO resolved = lifecycleService.resolveCommandAck("MAVLINK-01", 400, 0).orElseThrow();
        assertEquals(CommandLifecycleDTO.CommandStatus.ACKED, resolved.getStatus());
    }

    @Test
    void navigationNotReadyMapsToConflictAndFailedStatus() {
        OperatorCommandService service = new OperatorCommandService(Optional.of(droneCommandService), lifecycleService);
        DroneCommandDTO command = command(CommandType.TAKEOFF);
        when(droneCommandService.sendCommand("MAVLINK-01", command))
                .thenReturn(DroneCommandService.DispatchResult.TAKEOFF_NOT_READY);

        OperatorCommandService.SubmissionResult result = service.submitCommand("MAVLINK-01", command);

        assertEquals(HttpStatus.CONFLICT, result.httpStatus());
        assertEquals(CommandLifecycleDTO.CommandStatus.FAILED, result.lifecycle().getStatus());
        assertEquals("VEHICLE NOT READY", result.lifecycle().getDetail());
    }

    private static DroneCommandDTO command(CommandType commandType) {
        DroneCommandDTO command = new DroneCommandDTO();
        command.setCommandType(commandType);
        return command;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
