package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import com.sherlock.groundcontrol.dto.MissionDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.entity.MissionEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Server-side mission execution engine.
 *
 * Manages all active missions in memory (missionId → ExecutionState).
 * Every 500 ms the scheduler tick checks whether the drone has reached the
 * current waypoint and, if so, advances to the next one or completes the mission.
 *
 * Available regardless of app.mavlink.enabled — missions can be created and
 * stored when MAVLink is off; execution returns MAVLINK_UNAVAILABLE in that case.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MissionExecutorService {

    private static final double  ARRIVED_HORIZONTAL_METERS = 30.0;
    private static final double  ARRIVED_VERTICAL_METERS   = 15.0;
    private static final int     TELEMETRY_TICK_MS          = 500;
    private static final String  PROGRESS_TOPIC_PREFIX      = "/topic/missions/";
    private static final String  PROGRESS_TOPIC_SUFFIX      = "/progress";

    public enum ExecuteResult {
        STARTED,
        MISSION_NOT_FOUND,
        MISSION_NOT_PLANNED,
        MAVLINK_UNAVAILABLE
    }

    private final MissionService             missionService;
    private final TelemetryService           telemetryService;
    private final Optional<DroneCommandService> droneCommandService;
    private final SimpMessagingTemplate      messagingTemplate;

    private final Map<Long, ExecutionState> activeMissions = new ConcurrentHashMap<>();

    // ── Public API ────────────────────────────────────────────────────────────────

    public ExecuteResult startExecution(Long missionId, String droneId) {
        if (droneCommandService.isEmpty()) {
            log.warn("Mission {} execution rejected — MAVLink adapter not enabled", missionId);
            return ExecuteResult.MAVLINK_UNAVAILABLE;
        }

        Optional<MissionEntity> activated = missionService.activateMission(missionId, droneId);
        if (activated.isEmpty()) {
            // findById returned empty → not found
            boolean exists = missionService.getMission(missionId).isPresent();
            return exists ? ExecuteResult.MISSION_NOT_PLANNED : ExecuteResult.MISSION_NOT_FOUND;
        }

        MissionEntity mission = activated.get();
        ExecutionState state = new ExecutionState(droneId, mission.getWaypoints().size());
        activeMissions.put(missionId, state);

        publishProgress(mission);
        log.info("Mission id={} '{}' STARTED on drone '{}'", missionId, mission.getName(), droneId);
        return ExecuteResult.STARTED;
    }

    public boolean abortExecution(Long missionId) {
        activeMissions.remove(missionId);
        Optional<MissionEntity> aborted = missionService.abortMission(missionId);
        aborted.ifPresent(mission -> {
            publishProgress(mission);
            log.info("Mission id={} aborted by operator", missionId);
        });
        return aborted.isPresent();
    }

    // ── Scheduler ─────────────────────────────────────────────────────────────────

    @Scheduled(fixedRate = TELEMETRY_TICK_MS)
    public void tick() {
        if (activeMissions.isEmpty()) {
            return;
        }
        for (Map.Entry<Long, ExecutionState> entry : activeMissions.entrySet()) {
            advanceMission(entry.getKey(), entry.getValue());
        }
    }

    // ── Execution logic ───────────────────────────────────────────────────────────

    private void advanceMission(Long missionId, ExecutionState state) {
        Optional<TelemetryDTO> maybeTelemetry = telemetryService.getLastKnown(state.droneId);
        if (maybeTelemetry.isEmpty()) {
            return;
        }
        TelemetryDTO telemetry = maybeTelemetry.get();

        Optional<MissionDTO> maybeMission = missionService.getMission(missionId);
        if (maybeMission.isEmpty()) {
            activeMissions.remove(missionId);
            return;
        }
        MissionDTO mission = maybeMission.get();

        if (mission.getStatus() != MissionEntity.MissionStatus.ACTIVE) {
            activeMissions.remove(missionId);
            return;
        }

        int currentIndex = state.currentWaypointIndex.get();
        if (currentIndex >= mission.getWaypoints().size()) {
            activeMissions.remove(missionId);
            return;
        }

        var currentWaypoint = mission.getWaypoints().get(currentIndex);

        if (state.gotoDispatched.get()) {
            boolean arrived = hasArrived(telemetry, currentWaypoint);
            if (!arrived) {
                return;
            }
            // Drone reached the waypoint — advance
            missionService.markWaypointReached(missionId, currentIndex).ifPresent(updated -> {
                publishProgress(updated);
                if (updated.getStatus() == MissionEntity.MissionStatus.COMPLETED) {
                    activeMissions.remove(missionId);
                } else {
                    state.currentWaypointIndex.incrementAndGet();
                    state.gotoDispatched.set(false);
                }
            });
        } else {
            dispatchGoto(missionId, state, currentWaypoint);
        }
    }

    private void dispatchGoto(Long missionId, ExecutionState state, com.sherlock.groundcontrol.dto.WaypointDTO waypoint) {
        if (droneCommandService.isEmpty()) {
            return;
        }

        DroneCommandDTO command = new DroneCommandDTO();
        command.setCommandType(CommandType.GOTO);
        command.setLatitude(waypoint.getLatitude());
        command.setLongitude(waypoint.getLongitude());
        command.setAltitude(waypoint.getAltitude());

        DroneCommandService.DispatchResult result = droneCommandService.get().sendCommand(state.droneId, command);
        if (result == DroneCommandService.DispatchResult.DISPATCHED) {
            state.gotoDispatched.set(true);
            log.debug("Mission {} WP{} GOTO dispatched to '{}'",
                    missionId, state.currentWaypointIndex.get(), state.droneId);
        } else {
            log.warn("Mission {} WP{} GOTO dispatch failed: {} — will retry next tick",
                    missionId, state.currentWaypointIndex.get(), result);
        }
    }

    private static boolean hasArrived(TelemetryDTO telemetry, com.sherlock.groundcontrol.dto.WaypointDTO waypoint) {
        double horizontalDistance = haversineDistanceMeters(
                telemetry.getLatitude(), telemetry.getLongitude(),
                waypoint.getLatitude(), waypoint.getLongitude()
        );
        double verticalDistance = Math.abs(telemetry.getAltitude() - waypoint.getAltitude());
        return horizontalDistance <= ARRIVED_HORIZONTAL_METERS && verticalDistance <= ARRIVED_VERTICAL_METERS;
    }

    private static double haversineDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        final double earthRadiusMeters = 6_371_000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                 * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private void publishProgress(MissionEntity mission) {
        MissionDTO dto = missionService.toDTO(mission);
        messagingTemplate.convertAndSend(PROGRESS_TOPIC_PREFIX + mission.getId() + PROGRESS_TOPIC_SUFFIX, dto);
    }

    private void publishProgress(MissionDTO dto) {
        messagingTemplate.convertAndSend(PROGRESS_TOPIC_PREFIX + dto.getId() + PROGRESS_TOPIC_SUFFIX, dto);
    }

    // ── Inner state ───────────────────────────────────────────────────────────────

    private static final class ExecutionState {

        final String        droneId;
        final int           totalWaypoints;
        final AtomicInteger currentWaypointIndex;
        final AtomicBoolean gotoDispatched;

        ExecutionState(String droneId, int totalWaypoints) {
            this.droneId              = droneId;
            this.totalWaypoints       = totalWaypoints;
            this.currentWaypointIndex = new AtomicInteger(0);
            this.gotoDispatched       = new AtomicBoolean(false);
        }
    }
}
