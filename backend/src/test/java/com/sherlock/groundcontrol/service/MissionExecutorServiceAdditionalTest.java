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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MissionExecutorServiceAdditionalTest {

    @Mock
    private MissionService missionService;

    @Mock
    private TelemetryService telemetryService;

    @Mock
    private DroneCommandService droneCommandService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    void tickReturnsImmediatelyWhenNoMissionsAreActive() {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );

        service.tick();

        verifyNoInteractions(missionService, telemetryService, droneCommandService, messagingTemplate);
    }

    @Test
    void tickRemovesMissionWhenCurrentWaypointIndexIsOutOfBounds() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        state.currentWaypointIndex.set(5);
        getActiveMissions(service).put(61L, state);

        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(freshTelemetry()));
        when(missionService.getMission(61L)).thenReturn(Optional.of(activeMissionDto(61L)));

        service.tick();

        assertFalse(getActiveMissions(service).containsKey(61L));
    }

    @Test
    void evaluateWaypointProgressReturnsWhenPostDispatchDelayIsNotElapsed() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = telemetryAt(nowMillis);
        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.dispatchSnapshot = new DispatchSnapshot(37.0, 23.0, telemetry.getTimestamp().minusSeconds(2).toEpochMilli(), new Distances(25.0, 4.0));
        state.dispatchWallClockMillis.set(nowMillis - 500L);

        invokeEvaluateWaypointProgress(service, 62L, state, telemetry, waypoint(37.0, 23.0, 1200.0), nowMillis, false);

        assertEquals(WaypointPhase.IN_TRANSIT, state.phase.get());
        assertEquals(0, state.arrivalConfirmationTicks.get());
    }

    @Test
    void evaluateWaypointProgressReturnsWhenTelemetrySampleIsNotNew() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = telemetryAt(nowMillis);
        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.dispatchSnapshot = new DispatchSnapshot(37.0, 23.0, telemetry.getTimestamp().minusSeconds(2).toEpochMilli(), new Distances(10.0, 1.0));
        state.dispatchWallClockMillis.set(nowMillis - 3_000L);
        state.lastProcessedTelemetryTimestampMillis.set(telemetry.getTimestamp().toEpochMilli());

        invokeEvaluateWaypointProgress(service, 63L, state, telemetry, waypoint(37.0, 23.0, 1200.0), nowMillis, false);

        assertEquals(WaypointPhase.IN_TRANSIT, state.phase.get());
        assertEquals(0, state.arrivalConfirmationTicks.get());
    }

    @Test
    void evaluateWaypointProgressResetsArrivalCandidateWhenOutsideArrivalWindow() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = telemetryAt(nowMillis);
        state.phase.set(WaypointPhase.ARRIVAL_CANDIDATE);
        state.arrivalConfirmationTicks.set(2);
        state.arrivalCandidateSinceMillis.set(nowMillis - 2_000L);
        state.dispatchSnapshot = new DispatchSnapshot(36.99, 22.99, telemetry.getTimestamp().minusSeconds(2).toEpochMilli(), new Distances(30.0, 8.0));
        state.dispatchWallClockMillis.set(nowMillis - 3_000L);

        invokeEvaluateWaypointProgress(service, 64L, state, telemetry, waypoint(37.02, 23.02, 1300.0), nowMillis, true);

        assertEquals(WaypointPhase.IN_TRANSIT, state.phase.get());
        assertEquals(0, state.arrivalConfirmationTicks.get());
        assertEquals(0L, state.arrivalCandidateSinceMillis.get());
    }

    @Test
    void tickSkipsDispatchWhenCommandServiceIsMissing() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.empty(),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        getActiveMissions(service).put(65L, state);

        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(freshTelemetry()));
        when(missionService.getMission(65L)).thenReturn(Optional.of(activeMissionDto(65L)));

        service.tick();

        assertEquals(WaypointPhase.READY_TO_DISPATCH, state.phase.get());
        assertEquals(0, state.dispatchAttempts.get());
    }

    @Test
    void tickSkipsDispatchWhenBackoffWindowIsActive() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        state.lastDispatchAttemptMillis.set(System.currentTimeMillis());
        getActiveMissions(service).put(66L, state);

        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(freshTelemetry()));
        when(missionService.getMission(66L)).thenReturn(Optional.of(activeMissionDto(66L)));

        service.tick();

        verify(droneCommandService, never()).sendCommand(eq("MAVLINK-01"), any(DroneCommandDTO.class));
        assertEquals(WaypointPhase.READY_TO_DISPATCH, state.phase.get());
    }

    @Test
    void tickDispatchFailureIncrementsAttemptsWithoutFailingMission() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        getActiveMissions(service).put(67L, state);

        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(freshTelemetry()));
        when(missionService.getMission(67L)).thenReturn(Optional.of(activeMissionDto(67L)));
        when(droneCommandService.sendCommand(eq("MAVLINK-01"), any(DroneCommandDTO.class)))
                .thenReturn(DroneCommandService.DispatchResult.NAVIGATION_NOT_READY);

        service.tick();

        assertEquals(1, state.dispatchAttempts.get());
        assertTrue(getActiveMissions(service).containsKey(67L));
    }

    @Test
    void tickDispatchFailureAtMaxAttemptsTriggersFailSafeAbort() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        state.dispatchAttempts.set(11);
        getActiveMissions(service).put(68L, state);

        when(telemetryService.getLastKnown("MAVLINK-01")).thenReturn(Optional.of(freshTelemetry()));
        when(missionService.getMission(68L)).thenReturn(Optional.of(activeMissionDto(68L)));
        when(droneCommandService.sendCommand(eq("MAVLINK-01"), any(DroneCommandDTO.class)))
                .thenReturn(DroneCommandService.DispatchResult.NAVIGATION_NOT_READY);

        MissionEntity aborted = missionEntity(68L, MissionStatus.ABORTED);
        when(missionService.abortMission(68L)).thenReturn(Optional.of(aborted));
        when(missionService.toDTO(aborted)).thenReturn(MissionDTO.builder().id(68L).build());

        service.tick();

        assertFalse(getActiveMissions(service).containsKey(68L));
        verify(missionService).abortMission(68L);
    }

    @Test
    void evaluateWaypointProgressTimeoutBeforeMaxAttemptsResetsForRedispatch() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        ExecutionState state = new ExecutionState("MAVLINK-01");
        long nowMillis = System.currentTimeMillis();
        TelemetryDTO telemetry = telemetryAt(nowMillis);
        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.dispatchAttempts.set(3);
        state.dispatchSnapshot = new DispatchSnapshot(37.0, 23.0, telemetry.getTimestamp().minusSeconds(3).toEpochMilli(), new Distances(40.0, 6.0));
        state.dispatchWallClockMillis.set(nowMillis - 130_000L);

        invokeEvaluateWaypointProgress(service, 69L, state, telemetry, waypoint(37.01, 23.01, 1200.0), nowMillis, false);

        assertEquals(WaypointPhase.READY_TO_DISPATCH, state.phase.get());
        assertNull(state.dispatchSnapshot);
        assertEquals(0, state.arrivalConfirmationTicks.get());
    }

    @Test
    void publishProgressWithDtoSendsMissionTopicMessage() throws Exception {
        MissionExecutorService service = new MissionExecutorService(
                missionService,
                telemetryService,
                Optional.of(droneCommandService),
                messagingTemplate
        );
        MissionDTO dto = MissionDTO.builder().id(77L).build();

        Method method = MissionExecutorService.class.getDeclaredMethod("publishProgress", MissionDTO.class);
        method.setAccessible(true);
        method.invoke(service, dto);

        verify(messagingTemplate).convertAndSend("/topic/missions/77/progress", dto);
    }

    private static MissionDTO activeMissionDto(Long id) {
        return MissionDTO.builder()
                .id(id)
                .status(MissionStatus.ACTIVE)
                .waypoints(List.of(waypoint(37.0002, 23.0002, 1200.0)))
                .build();
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

    private static TelemetryDTO freshTelemetry() {
        return telemetryAt(System.currentTimeMillis());
    }

    private static TelemetryDTO telemetryAt(long epochMillis) {
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
