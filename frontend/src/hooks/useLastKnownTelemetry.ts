import { useEffect, useState } from 'react';
import type { DroneId, TelemetryByDrone } from '../interfaces/telemetry';
import { parseLastKnownTelemetryMap } from '../utils/telemetry';
import { useAuth } from './useAuth';

const BULK_LAST_KNOWN_PATH = '/api/telemetry/last-known';

export function useLastKnownTelemetry(droneIds: DroneId[], enabled: boolean): TelemetryByDrone {
  const { authToken, logout } = useAuth();
  const [lastKnownTelemetry, setLastKnownTelemetry] = useState<TelemetryByDrone>({});

  useEffect(() => {
    if (!authToken || !enabled || droneIds.length === 0) {
      setLastKnownTelemetry({});
      return;
    }

    const abortController = new AbortController();

    const fetchLastKnownTelemetry = async () => {
      try {
        const response = await fetch(BULK_LAST_KNOWN_PATH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken.token}`,
          },
          body: JSON.stringify({ droneIds }),
          signal: abortController.signal,
        });

        if (response.status === 401) {
          logout();
          return;
        }

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as unknown;
        if (!abortController.signal.aborted) {
          setLastKnownTelemetry(parseLastKnownTelemetryMap(payload));
        }
      } catch {
        if (!abortController.signal.aborted) {
          setLastKnownTelemetry({});
        }
      }
    };

    void fetchLastKnownTelemetry();

    return () => abortController.abort();
  }, [authToken, droneIds, enabled, logout]);

  return lastKnownTelemetry;
}
