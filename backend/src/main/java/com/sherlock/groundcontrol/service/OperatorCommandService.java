package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.CommandLifecycleDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OperatorCommandService {

    private static final int MAV_CMD_NAV_RETURN_TO_LAUNCH = 20;
    private static final int MAV_CMD_NAV_TAKEOFF = 22;
    private static final int MAV_CMD_COMPONENT_ARM_DISARM = 400;
    private static final String SIMULATOR_ID_PREFIX = "SHERLOCK-";
    private final Optional<DroneCommandService> droneCommandService;
    private final CommandLifecycleService commandLifecycleService;

    public record SubmissionResult(HttpStatus httpStatus, CommandLifecycleDTO lifecycle) {}

    public SubmissionResult submitCommand(String droneId, DroneCommandDTO commandDTO) {
        CommandLifecycleDTO pending = commandLifecycleService.createPending(
                droneId,
                commandDTO.getCommandType(),
                "Command queued"
        );

        if (isSimulatorDrone(droneId)) {
            CommandLifecycleDTO acked = markSimulatorAcknowledged(pending);
            return new SubmissionResult(HttpStatus.ACCEPTED, acked);
        }

        if (droneCommandService.isEmpty()) {
            return fail(pending, HttpStatus.SERVICE_UNAVAILABLE, "MAVLINK DISABLED");
        }

        DroneCommandService.DispatchResult dispatchResult = droneCommandService.get().sendCommand(droneId, commandDTO);
        return switch (dispatchResult) {
            case DISPATCHED -> handleDispatched(pending, commandDTO.getCommandType());
            case TAKEOFF_NOT_READY, NAVIGATION_NOT_READY -> fail(pending, HttpStatus.CONFLICT, "VEHICLE NOT READY");
            case DRONE_UNAVAILABLE -> fail(pending, HttpStatus.UNPROCESSABLE_ENTITY, "DRONE NOT CONNECTED");
        };
    }

    private SubmissionResult handleDispatched(CommandLifecycleDTO pending, CommandType commandType) {
        CommandLifecycleDTO sent = commandLifecycleService.markSent(
                pending.getCommandId(),
                "Command packet dispatched"
        ).orElse(pending);

        if (commandType == CommandType.GOTO) {
            CommandLifecycleDTO acked = commandLifecycleService.markAcked(
                    pending.getCommandId(),
                    "Position target dispatched (synthetic ACK)"
            ).orElse(sent);
            return new SubmissionResult(HttpStatus.ACCEPTED, acked);
        }

        mavCommandIdFor(commandType).ifPresent(mavCommandId ->
                commandLifecycleService.registerAwaitingAck(pending.getCommandId(), mavCommandId)
        );
        return new SubmissionResult(HttpStatus.ACCEPTED, sent);
    }

    private SubmissionResult fail(CommandLifecycleDTO pending, HttpStatus status, String detail) {
        CommandLifecycleDTO failed = commandLifecycleService.markFailed(pending.getCommandId(), detail).orElse(pending);
        return new SubmissionResult(status, failed);
    }

    private CommandLifecycleDTO markSimulatorAcknowledged(CommandLifecycleDTO pending) {
        CommandLifecycleDTO sent = commandLifecycleService.markSent(
                pending.getCommandId(),
                "Simulator command dispatched"
        ).orElse(pending);

        return commandLifecycleService.markAcked(
                pending.getCommandId(),
                "Simulator fake ACK"
        ).orElse(sent);
    }

    private static Optional<Integer> mavCommandIdFor(CommandType commandType) {
        return switch (commandType) {
            case RTH -> Optional.of(MAV_CMD_NAV_RETURN_TO_LAUNCH);
            case ARM, DISARM -> Optional.of(MAV_CMD_COMPONENT_ARM_DISARM);
            case TAKEOFF -> Optional.of(MAV_CMD_NAV_TAKEOFF);
            case GOTO -> Optional.empty();
        };
    }

    private static boolean isSimulatorDrone(String droneId) {
        return droneId != null && droneId.startsWith(SIMULATOR_ID_PREFIX);
    }
}
