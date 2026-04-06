import { useCallback, useState } from 'react';
import type { AuthToken } from '../interfaces/auth';
import type { DroneId } from '../interfaces/telemetry';

export type CommandType = 'RTH' | 'ARM' | 'DISARM';

export interface UseCommandReturn {
  sendCommand: (commandType: CommandType) => Promise<void>;
  isSending: boolean;
  commandError: string | null;
}

const COMMAND_PATH = (droneId: string) => `/api/drones/${droneId}/command`;

/**
 * Sends operator commands (RTH / ARM / DISARM) to the backend C2 endpoint.
 * When MAVLink is disabled server-side, the endpoint returns 503 and commandError is set.
 * On 401, callers should invoke logout — this hook does not do so directly to avoid
 * importing auth context (which would violate ISP for non-auth callers).
 */
export function useCommand(
  selectedDrone: DroneId | null,
  authToken: AuthToken | null,
): UseCommandReturn {
  const [isSending, setIsSending] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);

  const sendCommand = useCallback(async (commandType: CommandType) => {
    if (!selectedDrone || !authToken) {
      return;
    }

    setIsSending(true);
    setCommandError(null);

    try {
      const response = await fetch(COMMAND_PATH(selectedDrone), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken.token}`,
        },
        body: JSON.stringify({ commandType }),
      });

      if (!response.ok) {
        const errorText = errorMessageForStatus(response.status);
        setCommandError(errorText);
      }
    } catch {
      setCommandError('NETWORK ERROR');
    } finally {
      setIsSending(false);
    }
  }, [selectedDrone, authToken]);

  return { sendCommand, isSending, commandError };
}

function errorMessageForStatus(status: number): string {
  switch (status) {
    case 422: return 'DRONE NOT CONNECTED';
    case 503: return 'MAVLINK DISABLED';
    default:  return `CMD FAILED (${status})`;
  }
}
