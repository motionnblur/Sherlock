package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.StreamUrlDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Resolves the HLS stream URL for a given drone ID.
 *
 * In production the drone identifier maps 1-to-1 to a MediaMTX path.
 * The base URL of the MediaMTX HLS endpoint is injected via the
 * MEDIAMTX_HLS_BASE_URL environment variable so it can be configured
 * per deployment without a code change.
 */
@Service
public class DroneStreamService {

    private static final String HLS_MANIFEST_FILENAME = "index.m3u8";

    private final String mediaMtxHlsBaseUrl;

    public DroneStreamService(
            @Value("${MEDIAMTX_HLS_BASE_URL:http://localhost:8888}") String mediaMtxHlsBaseUrl) {
        this.mediaMtxHlsBaseUrl = mediaMtxHlsBaseUrl;
    }

    /**
     * Returns the HLS manifest URL for {@code droneId}.
     *
     * <p>The MediaMTX path name is derived directly from the drone ID
     * (lowercased and hyphen-separated) to keep the mapping deterministic
     * without a database lookup.
     */
    public StreamUrlDTO resolveStreamUrl(String droneId) {
        String mediaMtxPath = droneId.toLowerCase();
        String streamUrl = String.format("%s/%s/%s",
                mediaMtxHlsBaseUrl, mediaMtxPath, HLS_MANIFEST_FILENAME);
        return StreamUrlDTO.builder().streamUrl(streamUrl).build();
    }
}
