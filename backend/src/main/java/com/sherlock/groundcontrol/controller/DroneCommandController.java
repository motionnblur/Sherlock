package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.service.DroneCommandService;
import com.sherlock.groundcontrol.service.DroneCommandService.DispatchResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * Exposes the C2 command endpoint.
 *
 * POST /api/drones/{droneId}/command
 * Body: { "commandType": "RTH" | "ARM" | "DISARM" | "TAKEOFF" | "GOTO",
 *         "latitude"?: number, "longitude"?: number, "altitude"?: number }
 *
 * Returns 202 Accepted if the packet was dispatched.
 * Returns 409 if TAKEOFF/GOTO is requested before the vehicle became navigation-ready.
 * Returns 503 if MAVLink adapter is not enabled.
 * Returns 422 if the drone is not currently connected.
 */
@RestController
@RequestMapping("/api/drones/{droneId}")
@Slf4j
public class DroneCommandController {

    private final Optional<DroneCommandService> droneCommandService;

    // Optional injection: service may not exist when app.mavlink.enabled=false
    public DroneCommandController(Optional<DroneCommandService> droneCommandService) {
        this.droneCommandService = droneCommandService;
    }

    @PostMapping("/command")
    public ResponseEntity<Void> sendCommand(
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

        return droneCommandService
                .map(service -> {
                    DispatchResult dispatchResult = service.sendCommand(droneId, commandDTO);
                    return switch (dispatchResult) {
                        case DISPATCHED -> ResponseEntity.accepted().<Void>build();
                        case TAKEOFF_NOT_READY, NAVIGATION_NOT_READY -> ResponseEntity.status(HttpStatus.CONFLICT).<Void>build();
                        case DRONE_UNAVAILABLE -> ResponseEntity.unprocessableEntity().<Void>build();
                    };
                })
                .orElseGet(() -> {
                    log.warn("Command request for '{}' rejected — MAVLink adapter not enabled", droneId);
                    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
                });
    }
}
