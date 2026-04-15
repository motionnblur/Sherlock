package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.CommandHistoryResponseDTO;
import com.sherlock.groundcontrol.dto.CommandLifecycleDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.service.CommandLifecycleService;
import com.sherlock.groundcontrol.service.OperatorCommandService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes operator command lifecycle endpoints.
 *
 * POST /api/drones/{droneId}/command
 * Body: { "commandType": "RTH" | "ARM" | "DISARM" | "TAKEOFF" | "GOTO",
 *         "latitude"?: number, "longitude"?: number, "altitude"?: number }
 *
 * Valid command payloads always return a lifecycle body (`CommandLifecycleDTO`) and
 * are lifecycle-tracked through PENDING/SENT/ACKED/REJECTED/TIMEOUT/FAILED.
 *
 * GET /api/drones/{droneId}/commands?limit=20 returns recent lifecycle entries
 * for UI bootstrap.
 */
@RestController
@RequestMapping("/api/drones/{droneId}")
@RequiredArgsConstructor
public class DroneCommandController {

    private static final int DEFAULT_COMMAND_HISTORY_LIMIT = 20;
    private final OperatorCommandService operatorCommandService;
    private final CommandLifecycleService commandLifecycleService;

    @PostMapping("/command")
    public ResponseEntity<CommandLifecycleDTO> sendCommand(
            @PathVariable String droneId,
            @RequestBody DroneCommandDTO commandDTO
    ) {
        if (commandDTO.getCommandType() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (commandDTO.getCommandType() == DroneCommandDTO.CommandType.GOTO
                && (commandDTO.getLatitude() == null || commandDTO.getLongitude() == null || commandDTO.getAltitude() == null)) {
            return ResponseEntity.badRequest().build();
        }

        OperatorCommandService.SubmissionResult result = operatorCommandService.submitCommand(droneId, commandDTO);
        HttpStatus status = result.httpStatus();
        return ResponseEntity.status(status).body(result.lifecycle());
    }

    @GetMapping("/commands")
    public ResponseEntity<CommandHistoryResponseDTO> getRecentCommands(
            @PathVariable String droneId,
            @RequestParam(name = "limit", defaultValue = "20") Integer limit
    ) {
        int requestedLimit = limit == null ? DEFAULT_COMMAND_HISTORY_LIMIT : limit;
        return ResponseEntity.ok(
                CommandHistoryResponseDTO.builder()
                        .commands(commandLifecycleService.getRecentCommands(droneId, requestedLimit))
                        .build()
        );
    }
}
