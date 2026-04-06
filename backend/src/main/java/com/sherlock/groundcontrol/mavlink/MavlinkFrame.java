package com.sherlock.groundcontrol.mavlink;

/**
 * A successfully parsed MAVLink frame (v1 or v2).
 * Payload bytes are raw — use MavlinkMessageDecoder to extract typed values.
 */
public record MavlinkFrame(
        int version,
        int sequenceNumber,
        int systemId,
        int componentId,
        int messageId,
        byte[] payload
) {}
