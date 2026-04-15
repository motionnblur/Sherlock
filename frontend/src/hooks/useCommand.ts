import { useCallback, useState } from 'react';
import type { AuthToken } from '../interfaces/auth';
import type { CommandType } from '../interfaces/command';
import type { DroneId } from '../interfaces/telemetry';
import { useAuth } from './useAuth';

export type { CommandType };

export interface CommandOptions {
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export interface UseCommandReturn {
  sendCommand: (commandType: CommandType, options?: CommandOptions) => Promise<boolean>;
  isSending: boolean;
  commandError: string | null;
}

const COMMAND_PATH = (droneId: string) => `/api/drones/${droneId}/command`;

/**
 * Sends operator commands (RTH / ARM / DISARM / TAKEOFF / GOTO) to the backend C2 endpoint.
 * When MAVLink is disabled server-side, the endpoint returns 503 and commandError is set.
 * A 401 response forces logout so the operator is returned to LoginPage.
 */
export function useCommand(
  selectedDrone: DroneId | null,
  authToken: AuthToken | null,
): UseCommandReturn {
  const { logout } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);

  const sendCommand = useCallback(async (commandType: CommandType, options?: CommandOptions): Promise<boolean> => {
    if (!selectedDrone || !authToken) {
      return false;
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
        body: JSON.stringify({
          commandType,
          ...(options ?? {}),
        }),
      });

      if (response.status === 401) {
        logout();
        return false;
      }

      if (!response.ok) {
        const errorText = errorMessageForStatus(response.status);
        setCommandError(errorText);
        return false;
      }
      return true;
    } catch {
      setCommandError('NETWORK ERROR');
      return false;
    } finally {
      setIsSending(false);
    }
  }, [selectedDrone, authToken, logout]);

  return { sendCommand, isSending, commandError };
}

function errorMessageForStatus(status: number): string {
  switch (status) {
    case 422: return 'DRONE NOT CONNECTED';
    case 409: return 'VEHICLE NOT READY';
    case 400: return 'INVALID COMMAND';
    case 503: return 'MAVLINK DISABLED';
    default:  return `CMD FAILED (${status})`;
  }
}
