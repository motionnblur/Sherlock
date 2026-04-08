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

import static com.sherlock.groundcontrol.service.MissionExecutionSupport.DispatchSnapshot;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.Distances;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.ExecutionState;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.WaypointPhase;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.hasNewTelemetrySample;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.hasProgressEvidence;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.isTelemetryFresh;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.isWithinArrivalWindow;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.resetArrivalCandidate;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.resetWaypointPhase;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.toWaypointDistances;

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

    private static final double ARRIVED_HORIZONTAL_METERS = 5.0;
    private static final double ARRIVED_VERTICAL_METERS = 6.0;
    private static final int REQUIRED_ARRIVAL_CONFIRMATION_TICKS = 3;
    private static final long MIN_ARRIVAL_DWELL_MS = 1000L;
    private static final long MIN_POST_DISPATCH_CHECK_DELAY_MS = 1500L;
    private static final double MIN_PROGRESS_TOWARD_TARGET_METERS = 3.0;
    private static final double MIN_TRAVEL_FROM_DISPATCH_METERS = 3.0;
    private static final double CLOSE_START_HORIZONTAL_METERS = 2.0;
    private static final double CLOSE_START_VERTICAL_METERS = 2.0;
    private static final long MAX_TELEMETRY_AGE_MS = 2500L;
    private static final long WAYPOINT_PROGRESS_TIMEOUT_MS = 120_000L;
    private static final long DISPATCH_RETRY_BACKOFF_MS = 1500L;
    private static final int MAX_DISPATCH_ATTEMPTS_PER_WAYPOINT = 12;
    private static final int TELEMETRY_TICK_MS = 500;
    private static final String PROGRESS_TOPIC_PREFIX = "/topic/missions/";
    private static final String PROGRESS_TOPIC_SUFFIX = "/progress";

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
        ExecutionState state = new ExecutionState(droneId);
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
        long nowMillis = System.currentTimeMillis();
        Optional<TelemetryDTO> maybeTelemetry = telemetryService.getLastKnown(state.droneId);
        if (maybeTelemetry.isEmpty()) {
            return;
        }
        TelemetryDTO telemetry = maybeTelemetry.get();
        if (!isTelemetryFresh(telemetry, nowMillis, MAX_TELEMETRY_AGE_MS)) {
            return;
        }

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

        WaypointPhase phase = state.phase.get();
        if (phase == WaypointPhase.READY_TO_DISPATCH) {
            dispatchGoto(missionId, state, currentWaypoint, telemetry, nowMillis);
            return;
        }

        evaluateWaypointProgress(
                missionId,
                state,
                telemetry,
                currentWaypoint,
                nowMillis,
                phase == WaypointPhase.ARRIVAL_CANDIDATE
        );
    }

    private void evaluateWaypointProgress(
            Long missionId,
            ExecutionState state,
            TelemetryDTO telemetry,
            com.sherlock.groundcontrol.dto.WaypointDTO waypoint,
            long nowMillis,
            boolean isArrivalCandidatePhase
    ) {
        DispatchSnapshot dispatchSnapshot = state.dispatchSnapshot;
        if (dispatchSnapshot == null) {
            resetWaypointPhase(state);
            return;
        }

        if (hasWaypointTimedOut(state, nowMillis)) {
            handleWaypointTimeout(missionId, state, nowMillis);
            return;
        }

        if (!isPastPostDispatchDelay(state, nowMillis)) {
            return;
        }

        if (!hasNewTelemetrySample(state, telemetry)) {
            return;
        }

        Distances distances = toWaypointDistances(telemetry, waypoint);
        if (!isWithinArrivalWindow(distances, ARRIVED_HORIZONTAL_METERS, ARRIVED_VERTICAL_METERS)) {
            resetArrivalCandidate(state);
            return;
        }

        boolean hasProgressEvidence = hasProgressEvidence(
                dispatchSnapshot,
                telemetry,
                distances,
                MIN_PROGRESS_TOWARD_TARGET_METERS,
                MIN_TRAVEL_FROM_DISPATCH_METERS,
                CLOSE_START_HORIZONTAL_METERS,
                CLOSE_START_VERTICAL_METERS
        );
        if (!hasProgressEvidence) {
            resetArrivalCandidate(state);
            return;
        }

        boolean telemetryAdvancedSinceDispatch = telemetry.getTimestamp().toEpochMilli() > dispatchSnapshot.telemetryTimestampMillis();
        if (!telemetryAdvancedSinceDispatch) {
            return;
        }

        if (!isArrivalCandidatePhase) {
            state.phase.set(WaypointPhase.ARRIVAL_CANDIDATE);
            state.arrivalConfirmationTicks.set(1);
            state.arrivalCandidateSinceMillis.set(nowMillis);
            return;
        }

        int confirmationTicks = state.arrivalConfirmationTicks.incrementAndGet();
        long dwellMillis = nowMillis - state.arrivalCandidateSinceMillis.get();
        if (confirmationTicks < REQUIRED_ARRIVAL_CONFIRMATION_TICKS || dwellMillis < MIN_ARRIVAL_DWELL_MS) {
            return;
        }

        markWaypointReached(missionId, state);
    }

    private void dispatchGoto(
            Long missionId,
            ExecutionState state,
            com.sherlock.groundcontrol.dto.WaypointDTO waypoint,
            TelemetryDTO telemetry,
            long nowMillis
    ) {
        if (droneCommandService.isEmpty()) {
            return;
        }
        if (isDispatchBackoffActive(state, nowMillis)) {
            return;
        }

        state.lastDispatchAttemptMillis.set(nowMillis);

        DroneCommandDTO command = new DroneCommandDTO();
        command.setCommandType(CommandType.GOTO);
        command.setLatitude(waypoint.getLatitude());
        command.setLongitude(waypoint.getLongitude());
        command.setAltitude(waypoint.getAltitude());

        DroneCommandService.DispatchResult result = droneCommandService.get().sendCommand(state.droneId, command);
        if (result == DroneCommandService.DispatchResult.DISPATCHED) {
            Distances distanceAtDispatch = toWaypointDistances(telemetry, waypoint);
            state.dispatchSnapshot = new DispatchSnapshot(
                    telemetry.getLatitude(),
                    telemetry.getLongitude(),
                    telemetry.getTimestamp().toEpochMilli(),
                    distanceAtDispatch
            );
            state.dispatchWallClockMillis.set(nowMillis);
            state.phase.set(WaypointPhase.IN_TRANSIT);
            state.arrivalCandidateSinceMillis.set(0L);
            state.arrivalConfirmationTicks.set(0);
            state.dispatchAttempts.incrementAndGet();
            state.lastProcessedTelemetryTimestampMillis.set(telemetry.getTimestamp().toEpochMilli());
            log.info(
                    "Mission {} WP{} GOTO dispatched to '{}' (attempt {}, dist={}m)",
                    missionId,
                    state.currentWaypointIndex.get(),
                    state.droneId,
                    state.dispatchAttempts.get(),
                    String.format("%.1f", distanceAtDispatch.horizontalMeters())
            );
            return;
        }

        int attempts = state.dispatchAttempts.incrementAndGet();
        if (attempts >= MAX_DISPATCH_ATTEMPTS_PER_WAYPOINT) {
            failMission(
                    missionId,
                    String.format(
                            "GOTO dispatch failed %d times for waypoint %d (%s)",
                            attempts,
                            state.currentWaypointIndex.get(),
                            result
                    )
            );
            return;
        }
        log.warn(
                "Mission {} WP{} dispatch attempt {}/{} failed: {}",
                missionId,
                state.currentWaypointIndex.get(),
                attempts,
                MAX_DISPATCH_ATTEMPTS_PER_WAYPOINT,
                result
        );
    }

    private void markWaypointReached(Long missionId, ExecutionState state) {
        int reachedWaypointIndex = state.currentWaypointIndex.get();
        missionService.markWaypointReached(missionId, reachedWaypointIndex).ifPresent(updated -> {
            publishProgress(updated);
            if (updated.getStatus() == MissionEntity.MissionStatus.COMPLETED) {
                activeMissions.remove(missionId);
                return;
            }
            state.currentWaypointIndex.incrementAndGet();
            resetWaypointPhase(state);
        });
    }

    private void handleWaypointTimeout(Long missionId, ExecutionState state, long nowMillis) {
        if (state.dispatchAttempts.get() >= MAX_DISPATCH_ATTEMPTS_PER_WAYPOINT) {
            failMission(
                    missionId,
                    String.format(
                            "Waypoint %d timeout after %d dispatch attempts",
                            state.currentWaypointIndex.get(),
                            state.dispatchAttempts.get()
                    )
            );
            return;
        }

        state.phase.set(WaypointPhase.READY_TO_DISPATCH);
        state.dispatchSnapshot = null;
        state.arrivalCandidateSinceMillis.set(0L);
        state.arrivalConfirmationTicks.set(0);
        state.dispatchWallClockMillis.set(nowMillis);
        log.warn(
                "Mission {} WP{} timed out waiting for arrival — re-dispatching",
                missionId,
                state.currentWaypointIndex.get()
        );
    }

    private boolean hasWaypointTimedOut(ExecutionState state, long nowMillis) {
        long dispatchMillis = state.dispatchWallClockMillis.get();
        if (dispatchMillis <= 0L) {
            return false;
        }
        return nowMillis - dispatchMillis > WAYPOINT_PROGRESS_TIMEOUT_MS;
    }

    private boolean isPastPostDispatchDelay(ExecutionState state, long nowMillis) {
        long dispatchMillis = state.dispatchWallClockMillis.get();
        if (dispatchMillis <= 0L) {
            return false;
        }
        return nowMillis - dispatchMillis >= MIN_POST_DISPATCH_CHECK_DELAY_MS;
    }

    private boolean isDispatchBackoffActive(ExecutionState state, long nowMillis) {
        long lastAttemptMillis = state.lastDispatchAttemptMillis.get();
        return lastAttemptMillis > 0L && nowMillis - lastAttemptMillis < DISPATCH_RETRY_BACKOFF_MS;
    }

    private void failMission(Long missionId, String reason) {
        activeMissions.remove(missionId);
        missionService.abortMission(missionId).ifPresentOrElse(mission -> {
            publishProgress(mission);
            log.error("Mission id={} aborted by executor fail-safe: {}", missionId, reason);
        }, () -> log.error("Mission id={} fail-safe triggered but mission could not be aborted: {}", missionId, reason));
    }

    private void publishProgress(MissionEntity mission) {
        MissionDTO dto = missionService.toDTO(mission);
        messagingTemplate.convertAndSend(PROGRESS_TOPIC_PREFIX + mission.getId() + PROGRESS_TOPIC_SUFFIX, dto);
    }

    private void publishProgress(MissionDTO dto) {
        messagingTemplate.convertAndSend(PROGRESS_TOPIC_PREFIX + dto.getId() + PROGRESS_TOPIC_SUFFIX, dto);
    }
}
