package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.StreamUrlDTO;
import com.sherlock.groundcontrol.service.DroneStreamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller exposing the live camera stream URL for a drone.
 * Routes only — business logic lives in {@link DroneStreamService}.
 */
@RestController
@RequestMapping("/api/drones")
@RequiredArgsConstructor
public class DroneStreamController {

    private final DroneStreamService droneStreamService;

    /**
     * Returns the HLS manifest URL for the drone identified by {@code droneId}.
     *
     * <p>GET /api/drones/{droneId}/stream
     */
    @GetMapping("/{droneId}/stream")
    public ResponseEntity<StreamUrlDTO> getStreamUrl(@PathVariable String droneId) {
        return ResponseEntity.ok(droneStreamService.resolveStreamUrl(droneId));
    }
}
