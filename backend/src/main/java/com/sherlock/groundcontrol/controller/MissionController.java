package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.CreateMissionDTO;
import com.sherlock.groundcontrol.dto.MissionDTO;
import com.sherlock.groundcontrol.service.MissionExecutorService;
import com.sherlock.groundcontrol.service.MissionExecutorService.ExecuteResult;
import com.sherlock.groundcontrol.service.MissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST interface for mission planning and execution.
 *
 * POST   /api/missions                            — create a new PLANNED mission
 * GET    /api/missions                            — list all missions
 * GET    /api/missions/{id}                       — get mission detail (used for progress polling)
 * DELETE /api/missions/{id}                       — delete (only PLANNED/COMPLETED/ABORTED)
 * POST   /api/missions/{id}/execute?droneId=X     — start server-side execution
 * POST   /api/missions/{id}/abort                 — abort active mission
 */
@RestController
@RequestMapping("/api/missions")
@RequiredArgsConstructor
@Slf4j
public class MissionController {

    private final MissionService         missionService;
    private final MissionExecutorService missionExecutorService;

    @PostMapping
    public ResponseEntity<MissionDTO> createMission(@RequestBody CreateMissionDTO request) {
        try {
            MissionDTO created = missionService.createMission(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException exception) {
            log.warn("Mission creation rejected: {}", exception.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping
    public ResponseEntity<List<MissionDTO>> listMissions() {
        return ResponseEntity.ok(missionService.listMissions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<MissionDTO> getMission(@PathVariable Long id) {
        return missionService.getMission(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMission(@PathVariable Long id) {
        boolean deleted = missionService.deleteMission(id);
        return deleted
                ? ResponseEntity.noContent().build()
                : ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @PostMapping("/{id}/execute")
    public ResponseEntity<MissionDTO> executeMission(
            @PathVariable Long id,
            @RequestParam String droneId
    ) {
        if (droneId == null || droneId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        ExecuteResult result = missionExecutorService.startExecution(id, droneId);
        return switch (result) {
            case STARTED -> missionService.getMission(id)
                    .map(dto -> ResponseEntity.accepted().body(dto))
                    .orElseGet(() -> ResponseEntity.notFound().build());
            case MISSION_NOT_FOUND    -> ResponseEntity.notFound().build();
            case MISSION_NOT_PLANNED  -> ResponseEntity.status(HttpStatus.CONFLICT).build();
            case MAVLINK_UNAVAILABLE  -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        };
    }

    @PostMapping("/{id}/abort")
    public ResponseEntity<MissionDTO> abortMission(@PathVariable Long id) {
        boolean aborted = missionExecutorService.abortExecution(id);
        if (!aborted) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        return missionService.getMission(id)
                .map(dto -> ResponseEntity.ok(dto))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
