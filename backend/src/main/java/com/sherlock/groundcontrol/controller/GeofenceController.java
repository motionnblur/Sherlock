package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.GeofenceDTO;
import com.sherlock.groundcontrol.dto.GeofenceRequestDTO;
import com.sherlock.groundcontrol.service.GeofenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/geofences")
@RequiredArgsConstructor
public class GeofenceController {

    private final GeofenceService geofenceService;

    @PostMapping
    public ResponseEntity<GeofenceDTO> createGeofence(@RequestBody GeofenceRequestDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(geofenceService.createGeofence(request));
    }

    @GetMapping
    public ResponseEntity<List<GeofenceDTO>> listGeofences() {
        return ResponseEntity.ok(geofenceService.listGeofences());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GeofenceDTO> getGeofence(@PathVariable Long id) {
        return ResponseEntity.ok(geofenceService.getGeofence(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GeofenceDTO> updateGeofence(@PathVariable Long id, @RequestBody GeofenceRequestDTO request) {
        return ResponseEntity.ok(geofenceService.updateGeofence(id, request));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<GeofenceDTO> activateGeofence(@PathVariable Long id) {
        return ResponseEntity.ok(geofenceService.setActive(id, true));
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<GeofenceDTO> deactivateGeofence(@PathVariable Long id) {
        return ResponseEntity.ok(geofenceService.setActive(id, false));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGeofence(@PathVariable Long id) {
        geofenceService.deleteGeofence(id);
        return ResponseEntity.noContent().build();
    }
}
