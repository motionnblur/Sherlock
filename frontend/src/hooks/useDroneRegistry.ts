import { useCallback, useEffect, useState } from 'react';
import type { AuthToken } from '../interfaces/auth';
import type { DroneId } from '../interfaces/telemetry';

export interface UseDroneRegistryReturn {
  droneIds: DroneId[];
  isLoading: boolean;
}

const DRONE_REGISTRY_PATH = '/api/drones';
const POLL_INTERVAL_MS    = 30_000;

/**
 * Fetches and periodically refreshes the list of active drone IDs from the backend.
 * Replaces the hardcoded DRONE_IDS constant — the list now includes both simulated
 * drones (SHERLOCK-*) and any live MAVLink drones (MAVLINK-*) that are connected.
 *
 * Polls every 30 s so newly connected drones appear without a page reload.
 * On 401 the caller's auth layer will handle logout — this hook does not.
 */
export function useDroneRegistry(authToken: AuthToken | null): UseDroneRegistryReturn {
  const [droneIds, setDroneIds] = useState<DroneId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRegistry = useCallback(async (signal: AbortSignal) => {
    if (!authToken) {
      setDroneIds([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(DRONE_REGISTRY_PATH, {
        headers: { Authorization: `Bearer ${authToken.token}` },
        signal,
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { droneIds?: unknown };
      if (Array.isArray(data.droneIds)) {
        const validated = data.droneIds.filter((id): id is string => typeof id === 'string');
        if (!signal.aborted) {
          setDroneIds(validated);
        }
      }
    } catch {
      // Aborted requests and network errors — keep the current list
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [authToken]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void fetchRegistry(controller.signal);

    const intervalId = setInterval(
      () => void fetchRegistry(controller.signal),
      POLL_INTERVAL_MS,
    );

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [fetchRegistry]);

  return { droneIds, isLoading };
}
