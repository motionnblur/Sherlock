package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.dto.WaypointDTO;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

final class MissionExecutionSupport {

    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    enum WaypointPhase {
        READY_TO_DISPATCH,
        IN_TRANSIT,
        ARRIVAL_CANDIDATE
    }

    record Distances(double horizontalMeters, double verticalMeters) {}

    record DispatchSnapshot(
            double latitude,
            double longitude,
            long telemetryTimestampMillis,
            Distances distanceAtDispatch
    ) {}

    static final class ExecutionState {

        final String droneId;
        final AtomicInteger currentWaypointIndex;
        final AtomicReference<WaypointPhase> phase;
        final AtomicInteger dispatchAttempts;
        final AtomicLong dispatchWallClockMillis;
        final AtomicLong lastDispatchAttemptMillis;
        final AtomicLong arrivalCandidateSinceMillis;
        final AtomicInteger arrivalConfirmationTicks;
        final AtomicLong lastProcessedTelemetryTimestampMillis;
        volatile DispatchSnapshot dispatchSnapshot;

        ExecutionState(String droneId) {
            this.droneId = droneId;
            this.currentWaypointIndex = new AtomicInteger(0);
            this.phase = new AtomicReference<>(WaypointPhase.READY_TO_DISPATCH);
            this.dispatchAttempts = new AtomicInteger(0);
            this.dispatchWallClockMillis = new AtomicLong(0L);
            this.lastDispatchAttemptMillis = new AtomicLong(0L);
            this.arrivalCandidateSinceMillis = new AtomicLong(0L);
            this.arrivalConfirmationTicks = new AtomicInteger(0);
            this.lastProcessedTelemetryTimestampMillis = new AtomicLong(Long.MIN_VALUE);
            this.dispatchSnapshot = null;
        }
    }

    private MissionExecutionSupport() {}

    static boolean hasNewTelemetrySample(ExecutionState state, TelemetryDTO telemetry) {
        long telemetryMillis = telemetry.getTimestamp().toEpochMilli();
        long previousMillis = state.lastProcessedTelemetryTimestampMillis.get();
        if (telemetryMillis <= previousMillis) {
            return false;
        }
        state.lastProcessedTelemetryTimestampMillis.set(telemetryMillis);
        return true;
    }

    static boolean hasProgressEvidence(
            DispatchSnapshot dispatchSnapshot,
            TelemetryDTO telemetry,
            Distances currentDistance,
            double minProgressTowardTargetMeters,
            double minTravelFromDispatchMeters,
            double closeStartHorizontalMeters,
            double closeStartVerticalMeters
    ) {
        double horizontalDistanceGain = dispatchSnapshot.distanceAtDispatch().horizontalMeters() - currentDistance.horizontalMeters();
        double traveledSinceDispatchMeters = haversineDistanceMeters(
                dispatchSnapshot.latitude(),
                dispatchSnapshot.longitude(),
                telemetry.getLatitude(),
                telemetry.getLongitude()
        );
        boolean closeStart = dispatchSnapshot.distanceAtDispatch().horizontalMeters() <= closeStartHorizontalMeters
                && dispatchSnapshot.distanceAtDispatch().verticalMeters() <= closeStartVerticalMeters;
        return horizontalDistanceGain >= minProgressTowardTargetMeters
                || traveledSinceDispatchMeters >= minTravelFromDispatchMeters
                || closeStart;
    }

    static boolean isTelemetryFresh(TelemetryDTO telemetry, long nowMillis, long maxTelemetryAgeMs) {
        if (telemetry.getTimestamp() == null) {
            return false;
        }
        long ageMillis = nowMillis - telemetry.getTimestamp().toEpochMilli();
        return ageMillis >= 0L && ageMillis <= maxTelemetryAgeMs;
    }

    static boolean isWithinArrivalWindow(
            Distances distances,
            double arrivedHorizontalMeters,
            double arrivedVerticalMeters
    ) {
        return distances.horizontalMeters() <= arrivedHorizontalMeters
                && distances.verticalMeters() <= arrivedVerticalMeters;
    }

    static Distances toWaypointDistances(TelemetryDTO telemetry, WaypointDTO waypoint) {
        double horizontalDistance = haversineDistanceMeters(
                telemetry.getLatitude(),
                telemetry.getLongitude(),
                waypoint.getLatitude(),
                waypoint.getLongitude()
        );
        double verticalDistance = Math.abs(telemetry.getAltitude() - waypoint.getAltitude());
        return new Distances(horizontalDistance, verticalDistance);
    }

    static void resetArrivalCandidate(ExecutionState state) {
        state.phase.set(WaypointPhase.IN_TRANSIT);
        state.arrivalConfirmationTicks.set(0);
        state.arrivalCandidateSinceMillis.set(0L);
    }

    static void resetWaypointPhase(ExecutionState state) {
        state.phase.set(WaypointPhase.READY_TO_DISPATCH);
        state.dispatchAttempts.set(0);
        state.arrivalConfirmationTicks.set(0);
        state.dispatchWallClockMillis.set(0L);
        state.lastDispatchAttemptMillis.set(0L);
        state.arrivalCandidateSinceMillis.set(0L);
        state.dispatchSnapshot = null;
    }

    static double haversineDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
