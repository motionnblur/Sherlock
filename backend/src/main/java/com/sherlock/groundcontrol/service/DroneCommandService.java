package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import com.sherlock.groundcontrol.mavlink.MavlinkFrameParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Translates high-level operator commands (RTH, ARM, DISARM, TAKEOFF) into MAVLink
 * COMMAND_LONG packets and dispatches them via MavlinkAdapterService.
 *
 * Activated only when app.mavlink.enabled=true (same condition as the adapter).
 */
@Service
@ConditionalOnProperty(name = "app.mavlink.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class DroneCommandService {

    // MAVLink command IDs (MAV_CMD enum)
    private static final int MAV_CMD_NAV_RETURN_TO_LAUNCH    = 20;
    private static final int MAV_CMD_NAV_TAKEOFF             = 22;
    private static final int MAV_CMD_DO_SET_MODE             = 176;
    private static final int MAV_CMD_COMPONENT_ARM_DISARM    = 400;

    // Force-arm magic parameter (bypasses pre-arm checks — use with care)
    private static final float FORCE_ARM_MAGIC = 21196f;
    private static final float TAKEOFF_ALTITUDE_METERS = 20f;
    private static final float MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1f;
    private static final float ARDUCOPTER_MODE_GUIDED = 4f;

    private static final long COMMAND_SEQUENCE_DELAY_MS = 500L;
    private static final long TAKEOFF_RETRY_DELAY_MS = 1500L;
    private static final int TAKEOFF_MAX_ATTEMPTS = 4;

    private final MavlinkAdapterService mavlinkAdapterService;

    /**
     * Sends a command to the specified drone.
     *
     * @param droneId     the GCS-side drone ID (e.g. "MAVLINK-01")
     * @param commandType the command to send
     * @return true if the packet was dispatched; false if the drone is not connected
     */
    public boolean sendCommand(String droneId, CommandType commandType) {
        return mavlinkAdapterService.resolveSystemId(droneId)
                .map(sysId -> dispatch(sysId, commandType))
                .orElseGet(() -> {
                    log.warn("sendCommand: drone '{}' not found in active MAVLink connections", droneId);
                    return false;
                });
    }

    private boolean dispatch(int sysId, CommandType commandType) {
        return switch (commandType) {
            case TAKEOFF -> dispatchTakeoff(sysId);
            case RTH, ARM, DISARM -> dispatchSingle(sysId, commandType);
        };
    }

    private boolean dispatchSingle(int sysId, CommandType commandType) {
        boolean sent = sendPacket(sysId, buildSingleCommandPacket(sysId, commandType));
        if (sent) {
            log.info("Sent {} to sysId={}", commandType, sysId);
        }
        return sent;
    }

    private boolean dispatchTakeoff(int sysId) {
        for (int attempt = 1; attempt <= TAKEOFF_MAX_ATTEMPTS; attempt++) {
            boolean sent = sendTakeoffAttempt(sysId);
            if (!sent) {
                return false;
            }

            if (waitForArmedState(sysId)) {
                log.info(
                        "Sent TAKEOFF sequence to sysId={} (attempt {}/{}, mode=GUIDED, climb={}m)",
                        sysId, attempt, TAKEOFF_MAX_ATTEMPTS, TAKEOFF_ALTITUDE_METERS
                );
                return true;
            }

            if (attempt < TAKEOFF_MAX_ATTEMPTS && !waitDelay(TAKEOFF_RETRY_DELAY_MS)) {
                return false;
            }
        }

        log.info(
                "Sent TAKEOFF sequence to sysId={} but armed state is not confirmed yet; vehicle may still transition once EKF/home is ready",
                sysId
        );
        return true;
    }

    private boolean sendTakeoffAttempt(int sysId) {
        if (!sendPacket(sysId, buildGuidedModePacket(sysId)) || !waitDelay(COMMAND_SEQUENCE_DELAY_MS)) {
            return false;
        }
        if (!sendPacket(sysId, buildSingleCommandPacket(sysId, CommandType.ARM)) || !waitDelay(COMMAND_SEQUENCE_DELAY_MS)) {
            return false;
        }
        return sendPacket(sysId, buildTakeoffPacket(sysId));
    }

    private boolean waitForArmedState(int sysId) {
        if (!waitDelay(COMMAND_SEQUENCE_DELAY_MS)) {
            return false;
        }
        return mavlinkAdapterService.isDroneArmed(sysId);
    }

    private boolean waitDelay(long delayMs) {
        try {
            Thread.sleep(delayMs);
            return true;
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted while sending MAVLink command sequence");
            return false;
        }
    }

    private boolean sendPacket(int sysId, byte[] packet) {
        return mavlinkAdapterService.sendPacket(sysId, packet);
    }

    private byte[] buildSingleCommandPacket(int sysId, CommandType commandType) {
        int seqNum = mavlinkAdapterService.nextSeqNum();
        return switch (commandType) {
            case RTH -> MavlinkFrameParser.buildCommandLong(
                    sysId,
                    MAV_CMD_NAV_RETURN_TO_LAUNCH,
                    new float[]{0, 0, 0, 0, 0, 0, 0},
                    seqNum
            );
            case ARM -> MavlinkFrameParser.buildCommandLong(
                    sysId,
                    MAV_CMD_COMPONENT_ARM_DISARM,
                    new float[]{1f, FORCE_ARM_MAGIC, 0, 0, 0, 0, 0},
                    seqNum
            );
            case DISARM -> MavlinkFrameParser.buildCommandLong(
                    sysId,
                    MAV_CMD_COMPONENT_ARM_DISARM,
                    new float[]{0, 0, 0, 0, 0, 0, 0},
                    seqNum
            );
            case TAKEOFF -> throw new IllegalArgumentException("TAKEOFF must use buildTakeoffPacket()");
        };
    }

    private byte[] buildGuidedModePacket(int sysId) {
        int seqNum = mavlinkAdapterService.nextSeqNum();
        return MavlinkFrameParser.buildCommandLong(
                sysId,
                MAV_CMD_DO_SET_MODE,
                new float[]{MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, ARDUCOPTER_MODE_GUIDED, 0, 0, 0, 0, 0},
                seqNum
        );
    }

    private byte[] buildTakeoffPacket(int sysId) {
        int seqNum = mavlinkAdapterService.nextSeqNum();
        return MavlinkFrameParser.buildCommandLong(
                sysId,
                MAV_CMD_NAV_TAKEOFF,
                new float[]{0, 0, 0, 0, 0, 0, TAKEOFF_ALTITUDE_METERS},
                seqNum
        );
    }
}
