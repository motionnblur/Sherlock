package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import com.sherlock.groundcontrol.dto.MissionDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.dto.WaypointDTO;
import com.sherlock.groundcontrol.entity.MissionEntity;
import com.sherlock.groundcontrol.entity.MissionEntity.MissionStatus;
import com.sherlock.groundcontrol.entity.WaypointEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.sherlock.groundcontrol.service.MissionExecutionSupport.DispatchSnapshot;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.Distances;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.ExecutionState;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.WaypointPhase;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MissionExecutorServiceTest {

    @Mock
    private MissionService missionService;

    @Mock
    private TelemetryService telemetryService;

    @Mock
    private DroneCommandService droneCommandService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    void startExecutionReturnsUnavailableWhenMavlinkDisabled() {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.empty(),
                messagingTemplate
        );

        MissionExecutorService.ExecuteResult result = service.startExecution(1L, "MAVLINK-01");

        assertEquals(MissionExecutorService.ExecuteResult.MAVLINK_UNAVAILABLE, result);
    }

    @Test
    void startExecutionMapsNotFoundAndNotPlanned() {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );

        when(missionService.activateMission(1L, "MAVLINK-01")).thenReturn(Optional.empty());
        when(missionService.getMission(1L)).thenReturn(Optional.empty());
        assertEquals(MissionExecutorService.ExecuteResult.MISSION_NOT_FOUND, service.startExecution(1L, "MAVLINK-01"));

        when(missionService.activateMission(2L, "MAVLINK-01")).thenReturn(Optional.empty());
        when(missionService.getMission(2L)).thenReturn(Optional.of(MissionDTO.builder().id(2L).build()));
        assertEquals(MissionExecutorService.ExecuteResult.MISSION_NOT_PLANNED, service.startExecution(2L, "MAVLINK-01"));
    }

    @Test
    void startExecutionStoresStateAndPublishesProgress() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );

        MissionEntity mission = missionEntity(3L, MissionStatus.ACTIVE);
        when(missionService.activateMission(3L, "MAVLINK-01")).thenReturn(Optional.of(mission));
        when(missionService.toDTO(mission)).thenReturn(MissionDTO.builder().id(3L).build());

        MissionExecutorService.ExecuteResult result = service.startExecution(3L, "MAVLINK-01");

        assertEquals(MissionExecutorService.ExecuteResult.STARTED, result);
        assertTrue(getActiveMissions(service).containsKey(3L));
        verify(messagingTemplate).convertAndSend(eq("/topic/missions/3/progress"), any(MissionDTO.class));
    }

    @Test
    void abortExecutionHandlesBothOutcomes() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );

        getActiveMissions(service).put(4L, new ExecutionState("MAVLINK-01"));
        MissionEntity abortedMission = missionEntity(4L, MissionStatus.ABORTED);
        when(missionService.abortMission(4L)).thenReturn(Optional.of(abortedMission));
        when(missionService.toDTO(abortedMission)).thenReturn(MissionDTO.builder().id(4L).build());

        assertTrue(service.abortExecution(4L));
        verify(messagingTemplate).convertAndSend(eq("/topic/missions/4/progress"), any(MissionDTO.class));

        when(missionService.abortMission(5L)).thenReturn(Optional.empty());
        assertFalse(service.abortExecution(5L));
    }

    @Test
    void tickRemovesMissionWhenMissionOrStateIsInvalid() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );

        ExecutionState state = new ExecutionState("MAVLINK-01");
        getActiveMissions(service).put(10L, state);

        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(freshTelemetry()));
        when(missionService.getMission(10L)).thenReturn(Optional.empty());

        service.tick();

        assertFalse(getActiveMissions(service).containsKey(10L));

        getActiveMissions(service).put(11L, new ExecutionState("MAVLINK-01"));
        when(missionService.getMission(11L)).thenReturn(Optional.of(activeMissionDto(11L, MissionStatus.COMPLETED)));

        service.tick();
        assertFalse(getActiveMissions(service).containsKey(11L));
    }

    @Test
    void tickDispatchesGotoWhenReadyToDispatch() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );

        ExecutionState state = new ExecutionState("MAVLINK-01");
        getActiveMissions(service).put(20L, state);

        TelemetryDTO telemetry = freshTelemetry();
        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(telemetry));
        when(missionService.getMission(20L)).thenReturn(Optional.of(activeMissionDto(20L, MissionStatus.ACTIVE)));
        when(droneCommandService.sendCommand(eq("MAVLINK-01"), any(DroneCommandDTO.class)))
                .thenReturn(DroneCommandService.DispatchResult.DISPATCHED);

        service.tick();

        assertEquals(WaypointPhase.IN_TRANSIT, state.phase.get());
        assertNotNull(state.dispatchSnapshot);
        assertEquals(1, state.dispatchAttempts.get());
    }

    @Test
    void tickSkipsWhenTelemetryMissingOrStale() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );

        getActiveMissions(service).put(30L, new ExecutionState("MAVLINK-01"));

        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.empty());
        service.tick();
        verify(missionService, never()).getMission(30L);

        TelemetryDTO stale = TelemetryDTO.builder()
                .droneId("MAVLINK-01")
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1200.0)
                .timestamp(Instant.now().minusSeconds(10))
                .build();
        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(stale));

        service.tick();
        verify(missionService, never()).getMission(30L);
    }

    @Test
    void evaluateWaypointProgressResetsWaypointPhaseWhenDispatchSnapshotIsMissing() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.dispatchAttempts.set(3);
        state.arrivalConfirmationTicks.set(2);

        invokeEvaluateWaypointProgress(
                service,
                40L,
                state,
                freshTelemetry(),
                waypoint(37.0001, 23.0001, 1200.0),
                System.currentTimeMillis(),
                false
        );

        assertEquals(WaypointPhase.READY_TO_DISPATCH, state.phase.get());
        assertEquals(0, state.dispatchAttempts.get());
        assertEquals(0, state.arrivalConfirmationTicks.get());
    }

    @Test
    void evaluateWaypointProgressTimesOutAndTriggersFailSafeAtMaxAttempts() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.dispatchSnapshot = new DispatchSnapshot(37.0, 23.0, Instant.now().minusSeconds(20).toEpochMilli(), new Distances(20.0, 2.0));
        state.dispatchWallClockMillis.set(System.currentTimeMillis() - 130_000L);
        state.dispatchAttempts.set(12);
        getActiveMissions(service).put(41L, state);

        MissionEntity aborted = missionEntity(41L, MissionStatus.ABORTED);
        when(missionService.abortMission(41L)).thenReturn(Optional.of(aborted));
        when(missionService.toDTO(aborted)).thenReturn(MissionDTO.builder().id(41L).build());

        invokeEvaluateWaypointProgress(
                service,
                41L,
                state,
                freshTelemetry(),
                waypoint(37.0002, 23.0002, 1200.0),
                System.currentTimeMillis(),
                false
        );

        assertFalse(getActiveMissions(service).containsKey(41L));
        verify(missionService).abortMission(41L);
    }

    @Test
    void evaluateWaypointProgressTransitionsToArrivalCandidateAndThenMarksReached() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        state.phase.set(WaypointPhase.IN_TRANSIT);
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = freshTelemetryAt(nowMillis);
        state.dispatchSnapshot = new DispatchSnapshot(
                telemetry.getLatitude() - 0.001,
                telemetry.getLongitude() - 0.001,
                telemetry.getTimestamp().minusSeconds(2).toEpochMilli(),
                new Distances(20.0, 3.0)
        );
        state.dispatchWallClockMillis.set(nowMillis - 3_000L);

        WaypointDTO target = waypoint(telemetry.getLatitude(), telemetry.getLongitude(), telemetry.getAltitude());
        invokeEvaluateWaypointProgress(service, 42L, state, telemetry, target, nowMillis, false);

        assertEquals(WaypointPhase.ARRIVAL_CANDIDATE, state.phase.get());
        assertEquals(1, state.arrivalConfirmationTicks.get());

        MissionEntity progressed = missionEntity(42L, MissionStatus.ACTIVE);
        when(missionService.markWaypointReached(42L, 0)).thenReturn(Optional.of(progressed));
        when(missionService.toDTO(progressed)).thenReturn(MissionDTO.builder().id(42L).build());
        state.phase.set(WaypointPhase.ARRIVAL_CANDIDATE);
        state.arrivalCandidateSinceMillis.set(nowMillis - 2_000L);
        state.arrivalConfirmationTicks.set(2);

        invokeEvaluateWaypointProgress(service, 42L, state, freshTelemetryAt(nowMillis + 500L), target, nowMillis + 500L, true);

        assertEquals(1, state.currentWaypointIndex.get());
        assertEquals(WaypointPhase.READY_TO_DISPATCH, state.phase.get());
    }

    @Test
    void evaluateWaypointProgressRemovesMissionOnCompletion() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = freshTelemetryAt(nowMillis);
        state.phase.set(WaypointPhase.ARRIVAL_CANDIDATE);
        state.dispatchSnapshot = new DispatchSnapshot(
                telemetry.getLatitude() - 0.001,
                telemetry.getLongitude() - 0.001,
                telemetry.getTimestamp().minusSeconds(2).toEpochMilli(),
                new Distances(15.0, 2.0)
        );
        state.dispatchWallClockMillis.set(nowMillis - 3_000L);
        state.arrivalCandidateSinceMillis.set(nowMillis - 2_000L);
        state.arrivalConfirmationTicks.set(2);
        getActiveMissions(service).put(43L, state);

        MissionEntity completed = missionEntity(43L, MissionStatus.COMPLETED);
        when(missionService.markWaypointReached(43L, 0)).thenReturn(Optional.of(completed));
        when(missionService.toDTO(completed)).thenReturn(MissionDTO.builder().id(43L).build());

        WaypointDTO target = waypoint(telemetry.getLatitude(), telemetry.getLongitude(), telemetry.getAltitude());
        invokeEvaluateWaypointProgress(service, 43L, state, telemetry, target, nowMillis, true);

        assertFalse(getActiveMissions(service).containsKey(43L));
    }

    @Test
    void evaluateWaypointProgressResetsArrivalCandidateWhenNoProgressEvidence() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = freshTelemetryAt(nowMillis);
        state.phase.set(WaypointPhase.ARRIVAL_CANDIDATE);
        state.dispatchSnapshot = new DispatchSnapshot(
                telemetry.getLatitude(),
                telemetry.getLongitude(),
                telemetry.getTimestamp().minusSeconds(1).toEpochMilli(),
                new Distances(4.0, 1.0)
        );
        state.dispatchWallClockMillis.set(nowMillis - 3_000L);

        WaypointDTO almostAtTarget = waypoint(telemetry.getLatitude() + 0.000036, telemetry.getLongitude(), telemetry.getAltitude() + 1.0);
        invokeEvaluateWaypointProgress(service, 44L, state, telemetry, almostAtTarget, nowMillis, true);

        assertEquals(WaypointPhase.IN_TRANSIT, state.phase.get());
        assertEquals(0, state.arrivalConfirmationTicks.get());
    }

    @Test
    void evaluateWaypointProgressReturnsWhenTelemetryDidNotAdvanceSinceDispatch() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = freshTelemetryAt(nowMillis);
        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.dispatchSnapshot = new DispatchSnapshot(
                telemetry.getLatitude() - 0.001,
                telemetry.getLongitude() - 0.001,
                telemetry.getTimestamp().toEpochMilli(),
                new Distances(20.0, 2.0)
        );
        state.dispatchWallClockMillis.set(nowMillis - 3_000L);

        WaypointDTO target = waypoint(telemetry.getLatitude(), telemetry.getLongitude(), telemetry.getAltitude());
        invokeEvaluateWaypointProgress(service, 45L, state, telemetry, target, nowMillis, false);

        assertEquals(WaypointPhase.IN_TRANSIT, state.phase.get());
        assertEquals(0, state.arrivalConfirmationTicks.get());
    }

    private static MissionEntity missionEntity(Long id, MissionStatus status) {
        MissionEntity mission = MissionEntity.builder()
                .id(id)
                .name("Mission")
                .status(status)
                .createdAt(Instant.now())
                .waypoints(List.of(
                        WaypointEntity.builder()
                                .sequence(0)
                                .latitude(37.0)
                                .longitude(23.0)
                                .altitude(1200.0)
                                .status(WaypointEntity.WaypointStatus.ACTIVE)
                                .build()
                ))
                .build();
        mission.getWaypoints().forEach(waypoint -> waypoint.setMission(mission));
        return mission;
    }

    private static MissionDTO activeMissionDto(Long id, MissionStatus status) {
        return MissionDTO.builder()
                .id(id)
                .status(status)
                .waypoints(List.of(WaypointDTO.builder()
                        .sequence(0)
                        .latitude(37.0002)
                        .longitude(23.0002)
                        .altitude(1200.0)
                        .build()))
                .build();
    }

    private static TelemetryDTO freshTelemetry() {
        return TelemetryDTO.builder()
                .droneId("MAVLINK-01")
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1200.0)
                .timestamp(Instant.now())
                .build();
    }

    private static TelemetryDTO freshTelemetryAt(long epochMillis) {
        return TelemetryDTO.builder()
                .droneId("MAVLINK-01")
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1200.0)
                .timestamp(Instant.ofEpochMilli(epochMillis))
                .build();
    }

    private static WaypointDTO waypoint(double latitude, double longitude, double altitude) {
        return WaypointDTO.builder()
                .sequence(0)
                .latitude(latitude)
                .longitude(longitude)
                .altitude(altitude)
                .build();
    }

    private static void invokeEvaluateWaypointProgress(
            MissionExecutorService service,
            Long missionId,
            ExecutionState state,
            TelemetryDTO telemetry,
            WaypointDTO waypoint,
            long nowMillis,
            boolean isArrivalCandidatePhase
    ) throws Exception {
        Method method = MissionExecutorService.class.getDeclaredMethod(
                "evaluateWaypointProgress",
                Long.class,
                ExecutionState.class,
                TelemetryDTO.class,
                WaypointDTO.class,
                long.class,
                boolean.class
        );
        method.setAccessible(true);
        method.invoke(service, missionId, state, telemetry, waypoint, nowMillis, isArrivalCandidatePhase);
    }

    @SuppressWarnings("unchecked")
    private static Map<Long, ExecutionState> getActiveMissions(MissionExecutorService service) throws Exception {
        Field field = MissionExecutorService.class.getDeclaredField("activeMissions");
        field.setAccessible(true);
        return (Map<Long, ExecutionState>) field.get(service);
    }
}
