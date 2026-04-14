package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.dto.WaypointDTO;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static com.sherlock.groundcontrol.service.MissionExecutionSupport.DispatchSnapshot;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.Distances;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.ExecutionState;
import static com.sherlock.groundcontrol.service.MissionExecutionSupport.WaypointPhase;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MissionExecutionSupportTest {

    @Test
    void hasNewTelemetrySampleAcceptsStrictlyIncreasingTimestamps() {
        ExecutionState state = new ExecutionState("MAVLINK-01");

        boolean first = MissionExecutionSupport.hasNewTelemetrySample(state, telemetry("2026-04-10T00:00:01Z", 37.0, 23.0, 1000.0));
        boolean duplicate = MissionExecutionSupport.hasNewTelemetrySample(state, telemetry("2026-04-10T00:00:01Z", 37.0, 23.0, 1000.0));
        boolean newer = MissionExecutionSupport.hasNewTelemetrySample(state, telemetry("2026-04-10T00:00:02Z", 37.0, 23.0, 1000.0));

        assertTrue(first);
        assertFalse(duplicate);
        assertTrue(newer);
    }

    @Test
    void hasProgressEvidenceSupportsGainTravelAndCloseStartCases() {
        DispatchSnapshot dispatch = new DispatchSnapshot(37.0, 23.0, 1000L, new Distances(100.0, 10.0));

        boolean byDistanceGain = MissionExecutionSupport.hasProgressEvidence(
                dispatch,
                telemetry("2026-04-10T00:00:05Z", 37.00001, 23.00001, 1000.0),
                new Distances(95.0, 10.0),
                3.0,
                3.0,
                2.0,
                2.0
        );

        boolean byTravel = MissionExecutionSupport.hasProgressEvidence(
                dispatch,
                telemetry("2026-04-10T00:00:05Z", 37.00005, 23.00005, 1000.0),
                new Distances(99.9, 10.0),
                3.0,
                3.0,
                2.0,
                2.0
        );

        DispatchSnapshot closeStartDispatch = new DispatchSnapshot(37.0, 23.0, 1000L, new Distances(1.0, 1.0));
        boolean byCloseStart = MissionExecutionSupport.hasProgressEvidence(
                closeStartDispatch,
                telemetry("2026-04-10T00:00:05Z", 37.0, 23.0, 1000.0),
                new Distances(1.0, 1.0),
                3.0,
                3.0,
                2.0,
                2.0
        );

        assertTrue(byDistanceGain);
        assertTrue(byTravel);
        assertTrue(byCloseStart);
    }

    @Test
    void hasProgressEvidenceReturnsFalseWhenNoSignal() {
        DispatchSnapshot dispatch = new DispatchSnapshot(37.0, 23.0, 1000L, new Distances(50.0, 10.0));

        boolean result = MissionExecutionSupport.hasProgressEvidence(
                dispatch,
                telemetry("2026-04-10T00:00:05Z", 37.0, 23.0, 1000.0),
                new Distances(49.5, 10.0),
                3.0,
                3.0,
                2.0,
                2.0
        );

        assertFalse(result);
    }

    @Test
    void telemetryFreshnessAndArrivalWindowChecks() {
        long now = Instant.parse("2026-04-10T00:00:10Z").toEpochMilli();

        assertTrue(MissionExecutionSupport.isTelemetryFresh(telemetry("2026-04-10T00:00:09Z", 37.0, 23.0, 1000.0), now, 2500));
        assertFalse(MissionExecutionSupport.isTelemetryFresh(telemetry("2026-04-10T00:00:04Z", 37.0, 23.0, 1000.0), now, 2500));

        TelemetryDTO noTimestamp = telemetry("2026-04-10T00:00:09Z", 37.0, 23.0, 1000.0);
        noTimestamp.setTimestamp(null);
        assertFalse(MissionExecutionSupport.isTelemetryFresh(noTimestamp, now, 2500));

        assertTrue(MissionExecutionSupport.isWithinArrivalWindow(new Distances(5.0, 6.0), 5.0, 6.0));
        assertFalse(MissionExecutionSupport.isWithinArrivalWindow(new Distances(5.1, 6.0), 5.0, 6.0));
    }

    @Test
    void waypointDistanceAndResetHelpersUpdateState() {
        WaypointDTO waypoint = WaypointDTO.builder()
                .latitude(37.001)
                .longitude(23.001)
                .altitude(1100.0)
                .build();
        TelemetryDTO telemetry = telemetry("2026-04-10T00:00:01Z", 37.0, 23.0, 1000.0);

        Distances distances = MissionExecutionSupport.toWaypointDistances(telemetry, waypoint);
        assertTrue(distances.horizontalMeters() > 0);
        assertEquals(100.0, distances.verticalMeters());

        ExecutionState state = new ExecutionState("MAVLINK-01");
        state.phase.set(WaypointPhase.ARRIVAL_CANDIDATE);
        state.arrivalConfirmationTicks.set(2);
        state.arrivalCandidateSinceMillis.set(100L);
        MissionExecutionSupport.resetArrivalCandidate(state);
        assertEquals(WaypointPhase.IN_TRANSIT, state.phase.get());
        assertEquals(0, state.arrivalConfirmationTicks.get());

        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.dispatchAttempts.set(5);
        state.arrivalConfirmationTicks.set(3);
        state.dispatchWallClockMillis.set(5L);
        state.lastDispatchAttemptMillis.set(6L);
        state.arrivalCandidateSinceMillis.set(7L);
        state.dispatchSnapshot = new DispatchSnapshot(37.0, 23.0, 1L, new Distances(10.0, 2.0));

        MissionExecutionSupport.resetWaypointPhase(state);
        assertEquals(WaypointPhase.READY_TO_DISPATCH, state.phase.get());
        assertEquals(0, state.dispatchAttempts.get());
        assertEquals(0L, state.dispatchWallClockMillis.get());
        assertEquals(0L, state.lastDispatchAttemptMillis.get());
        assertEquals(0L, state.arrivalCandidateSinceMillis.get());
        assertEquals(null, state.dispatchSnapshot);
    }

    @Test
    void haversineDistanceReturnsZeroForSamePoint() {
        assertEquals(0.0, MissionExecutionSupport.haversineDistanceMeters(37.0, 23.0, 37.0, 23.0));
    }

    private static TelemetryDTO telemetry(String timestamp, double latitude, double longitude, double altitude) {
        return TelemetryDTO.builder()
                .timestamp(Instant.parse(timestamp))
                .latitude(latitude)
                .longitude(longitude)
                .altitude(altitude)
                .build();
    }
}
