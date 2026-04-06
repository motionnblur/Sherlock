package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.DroneRegistryDTO;
import com.sherlock.groundcontrol.service.DroneRegistryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes the active drone registry to the frontend.
 *
 * GET /api/drones
 * Response: { "droneIds": ["SHERLOCK-01", "SHERLOCK-02", "MAVLINK-01"] }
 *
 * The frontend polls this endpoint to discover drones dynamically instead of
 * relying on a hardcoded list. Simulated and real MAVLink drones appear here.
 */
@RestController
@RequestMapping("/api/drones")
@RequiredArgsConstructor
public class DroneRegistryController {

    private final DroneRegistryService droneRegistryService;

    @GetMapping
    public ResponseEntity<DroneRegistryDTO> getActiveDrones() {
        return ResponseEntity.ok(
                DroneRegistryDTO.builder()
                        .droneIds(droneRegistryService.getActiveDroneIds())
                        .build()
        );
    }
}
