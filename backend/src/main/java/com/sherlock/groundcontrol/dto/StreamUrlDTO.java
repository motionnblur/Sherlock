package com.sherlock.groundcontrol.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * Wire object returned by GET /api/drones/{droneId}/stream.
 * Carries the HLS manifest URL the frontend should load into hls.js.
 */
@Getter
@Builder
public class StreamUrlDTO {

    /** Fully qualified HLS manifest URL for the drone's live camera feed. */
    private final String streamUrl;
}
