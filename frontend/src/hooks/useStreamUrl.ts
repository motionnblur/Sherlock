import { useState, useCallback } from 'react';
import type { DroneId } from '../interfaces/telemetry';

interface StreamUrlResponse {
  streamUrl: string;
}

interface UseStreamUrlResult {
  streamUrl: string | null;
  isFetching: boolean;
  fetchError: string | null;
  fetchStreamUrl: (droneId: DroneId) => Promise<void>;
  clearStreamUrl: () => void;
}

const STREAM_API_PATH = '/api/drones';
const STREAM_API_SUFFIX = '/stream';

/**
 * Fetches the HLS stream URL for a given drone from the backend.
 *
 * The URL is stored locally and cleared when the drone is deselected.
 * All error states are surfaced via fetchError — nothing is swallowed silently.
 */
export function useStreamUrl(): UseStreamUrlResult {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchStreamUrl = useCallback(async (droneId: DroneId) => {
    setIsFetching(true);
    setFetchError(null);

    try {
      const response = await fetch(`${STREAM_API_PATH}/${droneId}${STREAM_API_SUFFIX}`);

      if (!response.ok) {
        throw new Error(`Stream endpoint returned HTTP ${response.status}`);
      }

      const data: StreamUrlResponse = await response.json();
      setStreamUrl(data.streamUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error fetching stream URL';
      setFetchError(message);
      setStreamUrl(null);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const clearStreamUrl = useCallback(() => {
    setStreamUrl(null);
    setFetchError(null);
  }, []);

  return { streamUrl, isFetching, fetchError, fetchStreamUrl, clearStreamUrl };
}
