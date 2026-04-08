import { useCallback, useEffect, useState } from 'react';
import type { AuthToken } from '../interfaces/auth';
import type { Geofence, GeofenceRequest, UseGeofencesResult } from '../interfaces/geofence';
import { parseGeofenceListResponse } from '../utils/telemetry';
import { useAuth } from './useAuth';

const GEOFENCES_PATH = '/api/geofences';
const GEOFENCE_PATH = (geofenceId: number) => `${GEOFENCES_PATH}/${geofenceId}`;
const GEOFENCE_ACTIVATE_PATH = (geofenceId: number) => `${GEOFENCE_PATH(geofenceId)}/activate`;
const GEOFENCE_DEACTIVATE_PATH = (geofenceId: number) => `${GEOFENCE_PATH(geofenceId)}/deactivate`;

export function useGeofences(authToken: AuthToken | null): UseGeofencesResult {
  const { logout } = useAuth();
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken?.token ?? ''}`,
  }), [authToken]);

  const handleUnauthorized = useCallback(() => logout(), [logout]);

  const refreshGeofences = useCallback(async () => {
    if (!authToken) {
      setGeofences([]);
      setGeofenceError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setGeofenceError(null);
    try {
      const response = await fetch(GEOFENCES_PATH, { headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as unknown;
      setGeofences(parseGeofenceListResponse(payload));
    } catch {
      // Keep the last successful cache on transient failures.
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, authToken, handleUnauthorized]);

  useEffect(() => {
    void refreshGeofences();
  }, [refreshGeofences]);

  const writeGeofence = useCallback(async (
    request: GeofenceRequest,
    path: string,
    method: 'POST' | 'PUT',
  ): Promise<Geofence | null> => {
    if (!authToken) {
      return null;
    }

    setIsLoading(true);
    setGeofenceError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(request),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return null;
      }
      if (response.status === 400) {
        setGeofenceError('INVALID GEOFENCE');
        return null;
      }
      if (response.status === 404) {
        setGeofenceError('GEOFENCE NOT FOUND');
        return null;
      }
      if (response.status === 409) {
        setGeofenceError('GEOFENCE NAME CONFLICT');
        return null;
      }
      if (!response.ok) {
        setGeofenceError(`SAVE FAILED (${response.status})`);
        return null;
      }

      const geofence = (await response.json()) as Geofence;
      setGeofences((current) => {
        const next = current.filter((entry) => entry.id !== geofence.id);
        return [geofence, ...next].sort((a, b) => (
          Date.parse(b.createdAt) - Date.parse(a.createdAt)
        ));
      });
      return geofence;
    } catch {
      setGeofenceError('NETWORK ERROR');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, authToken, handleUnauthorized]);

  const createGeofence = useCallback(async (request: GeofenceRequest) => {
    return writeGeofence(request, GEOFENCES_PATH, 'POST');
  }, [writeGeofence]);

  const updateGeofence = useCallback(async (geofenceId: number, request: GeofenceRequest) => {
    return writeGeofence(request, GEOFENCE_PATH(geofenceId), 'PUT');
  }, [writeGeofence]);

  const setGeofenceActive = useCallback(async (geofenceId: number, isActive: boolean) => {
    if (!authToken) {
      return null;
    }

    setIsLoading(true);
    setGeofenceError(null);
    try {
      const response = await fetch(
        isActive ? GEOFENCE_ACTIVATE_PATH(geofenceId) : GEOFENCE_DEACTIVATE_PATH(geofenceId),
        {
          method: 'POST',
          headers: authHeaders(),
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return null;
      }
      if (response.status === 404) {
        setGeofenceError('GEOFENCE NOT FOUND');
        return null;
      }
      if (!response.ok) {
        setGeofenceError(`UPDATE FAILED (${response.status})`);
        return null;
      }

      const geofence = (await response.json()) as Geofence;
      setGeofences((current) => current.map((entry) => (entry.id === geofence.id ? geofence : entry)));
      return geofence;
    } catch {
      setGeofenceError('NETWORK ERROR');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, authToken, handleUnauthorized]);

  const deleteGeofence = useCallback(async (geofenceId: number) => {
    if (!authToken) {
      return false;
    }

    setIsLoading(true);
    setGeofenceError(null);
    try {
      const response = await fetch(GEOFENCE_PATH(geofenceId), {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return false;
      }
      if (response.status === 404) {
        setGeofenceError('GEOFENCE NOT FOUND');
        return false;
      }
      if (!response.ok) {
        setGeofenceError(`DELETE FAILED (${response.status})`);
        return false;
      }

      setGeofences((current) => current.filter((entry) => entry.id !== geofenceId));
      return true;
    } catch {
      setGeofenceError('NETWORK ERROR');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, authToken, handleUnauthorized]);

  return {
    geofences,
    isLoading,
    geofenceError,
    refreshGeofences,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    setGeofenceActive,
  };
}
