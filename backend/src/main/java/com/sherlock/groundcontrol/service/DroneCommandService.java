package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.DroneCommandDTO;
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

    public enum DispatchResult {
        DISPATCHED,
        DRONE_UNAVAILABLE,
        TAKEOFF_NOT_READY,
        NAVIGATION_NOT_READY
    }

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
    private static final int TAKEOFF_MAX_ATTEMPTS = 8;
    private static final int GOTO_GUIDED_RETRIES = 3;
    private static final long GOTO_GUIDED_RETRY_DELAY_MS = 500L;

    private final MavlinkAdapterService mavlinkAdapterService;

    /**
     * Sends a command to the specified drone.
     *
     * @param droneId     the GCS-side drone ID (e.g. "MAVLINK-01")
     * @param commandDTO the command payload to send
     * @return dispatch result for API status mapping
     */
    public DispatchResult sendCommand(String droneId, DroneCommandDTO commandDTO) {
        CommandType commandType = commandDTO.getCommandType();
        return mavlinkAdapterService.resolveSystemId(droneId)
                .map(sysId -> dispatchResultFor(commandType, dispatch(sysId, commandDTO)))
                .orElseGet(() -> {
                    log.warn("sendCommand: drone '{}' not found in active MAVLink connections", droneId);
                    return DispatchResult.DRONE_UNAVAILABLE;
                });
    }

    private DispatchResult dispatchResultFor(CommandType commandType, boolean dispatched) {
        if (dispatched) {
            return DispatchResult.DISPATCHED;
        }
        return switch (commandType) {
            case TAKEOFF -> DispatchResult.TAKEOFF_NOT_READY;
            case GOTO -> DispatchResult.NAVIGATION_NOT_READY;
            case RTH, ARM, DISARM -> DispatchResult.DRONE_UNAVAILABLE;
        };
    }

    private boolean dispatch(int sysId, DroneCommandDTO commandDTO) {
        return switch (commandDTO.getCommandType()) {
            case TAKEOFF -> dispatchTakeoff(sysId);
            case GOTO -> dispatchGoto(sysId, commandDTO);
            case RTH, ARM, DISARM -> dispatchSingle(sysId, commandDTO.getCommandType());
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

        log.warn(
                "TAKEOFF sequence failed for sysId={} after {} attempts; vehicle is likely not ready (EKF/GPS/home)",
                sysId, TAKEOFF_MAX_ATTEMPTS
        );
        return false;
    }

    private boolean dispatchGoto(int sysId, DroneCommandDTO commandDTO) {
        if (!isGotoPayloadValid(commandDTO)) {
            log.warn("GOTO rejected: invalid payload lat={}, lon={}, alt={}",
                    commandDTO.getLatitude(), commandDTO.getLongitude(), commandDTO.getAltitude());
            return false;
        }
        if (!mavlinkAdapterService.isDroneArmed(sysId)) {
            log.info("GOTO deferred for sysId={} because vehicle is not armed yet", sysId);
            return false;
        }

        if (!ensureGuidedMode(sysId)) {
            return false;
        }

        Double targetRelativeAltitudeMeters = resolveRelativeAltitudeMetersForGoto(sysId, commandDTO.getAltitude());
        if (targetRelativeAltitudeMeters == null) {
            log.info("GOTO deferred for sysId={} because altitude reference is not available yet", sysId);
            return false;
        }

        byte[] packet = MavlinkFrameParser.buildSetPositionTargetGlobalInt(
                sysId,
                commandDTO.getLatitude(),
                commandDTO.getLongitude(),
                targetRelativeAltitudeMeters,
                mavlinkAdapterService.nextSeqNum()
        );
        boolean sent = sendPacket(sysId, packet);
        if (sent) {
            log.info(
                    "Sent GOTO to sysId={} lat={}, lon={}, targetAltMsl={}m, targetAltRel={}m",
                    sysId,
                    commandDTO.getLatitude(),
                    commandDTO.getLongitude(),
                    commandDTO.getAltitude(),
                    targetRelativeAltitudeMeters
            );
        }
        return sent;
    }

    private static boolean isGotoPayloadValid(DroneCommandDTO commandDTO) {
        if (commandDTO.getLatitude() == null || commandDTO.getLongitude() == null || commandDTO.getAltitude() == null) {
            return false;
        }
        double latitude = commandDTO.getLatitude();
        double longitude = commandDTO.getLongitude();
        double altitude = commandDTO.getAltitude();
        return Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && Double.isFinite(altitude)
                && latitude >= -90d && latitude <= 90d
                && longitude >= -180d && longitude <= 180d
                && altitude >= -500d && altitude <= 20000d;
    }

    private Double resolveRelativeAltitudeMetersForGoto(int sysId, double targetAltitudeMsl) {
        return mavlinkAdapterService.getAltitudeReference(sysId)
                .map(altitudeReference -> {
                    // Home AMSL = current AMSL - current relative altitude.
                    double homeAltitudeMsl = altitudeReference.altitudeMsl() - altitudeReference.relativeAltitudeMeters();
                    double targetRelativeAltitude = targetAltitudeMsl - homeAltitudeMsl;
                    if (!Double.isFinite(targetRelativeAltitude)
                            || targetRelativeAltitude < -500d
                            || targetRelativeAltitude > 20000d) {
                        return null;
                    }
                    return targetRelativeAltitude;
                })
                .orElse(null);
    }

    private boolean ensureGuidedMode(int sysId) {
        for (int attempt = 1; attempt <= GOTO_GUIDED_RETRIES; attempt++) {
            boolean modeSent = sendPacket(sysId, buildGuidedModePacket(sysId));
            if (!modeSent) {
                return false;
            }
            if (waitDelay(COMMAND_SEQUENCE_DELAY_MS)) {
                return true;
            }
            if (attempt < GOTO_GUIDED_RETRIES && !waitDelay(GOTO_GUIDED_RETRY_DELAY_MS)) {
                return false;
            }
        }
        return false;
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
            case GOTO -> throw new IllegalArgumentException("GOTO must use buildSetPositionTargetGlobalInt()");
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
