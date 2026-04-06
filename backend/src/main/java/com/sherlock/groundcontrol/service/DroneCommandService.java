package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import com.sherlock.groundcontrol.mavlink.MavlinkFrameParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Translates high-level operator commands (RTH, ARM, DISARM) into MAVLink
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
    private static final int MAV_CMD_COMPONENT_ARM_DISARM    = 400;

    // Force-arm magic parameter (bypasses pre-arm checks — use with care)
    private static final float FORCE_ARM_MAGIC = 21196f;

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
        int seqNum = mavlinkAdapterService.nextSeqNum();
        byte[] packet = buildPacket(sysId, commandType, seqNum);
        boolean sent = mavlinkAdapterService.sendPacket(sysId, packet);
        if (sent) {
            log.info("Sent {} to sysId={}", commandType, sysId);
        }
        return sent;
    }

    private byte[] buildPacket(int sysId, CommandType commandType, int seqNum) {
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
        };
    }
}
