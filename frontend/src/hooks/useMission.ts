import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthToken } from '../interfaces/auth';
import type { Mission, PlanningWaypoint, UseMissionResult } from '../interfaces/mission';
import { useAuth } from './useAuth';

const MISSIONS_PATH              = '/api/missions';
const MISSION_PATH               = (id: number) => `/api/missions/${id}`;
const MISSION_EXECUTE_PATH       = (id: number, droneId: string) => `/api/missions/${id}/execute?droneId=${encodeURIComponent(droneId)}`;
const MISSION_ABORT_PATH         = (id: number) => `/api/missions/${id}/abort`;
const ACTIVE_POLL_INTERVAL_MS    = 1000;

/**
 * Manages mission CRUD and execution state.
 * Polls GET /api/missions/{id} every second while a mission is ACTIVE
 * so the UI receives live waypoint-progress updates without a second STOMP client.
 */
export function useMission(authToken: AuthToken | null): UseMissionResult {
  const { logout } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken?.token ?? ''}`,
  }), [authToken]);

  const handleUnauthorized = useCallback(() => logout(), [logout]);

  const refreshMissions = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch(MISSIONS_PATH, { headers: authHeaders() });
      if (response.status === 401) { handleUnauthorized(); return; }
      if (!response.ok) return;
      const data: Mission[] = await response.json();
      setMissions(data);
    } catch {
      // Network errors are silent on background refresh
    }
  }, [authToken, authHeaders, handleUnauthorized]);

  const pollActiveMission = useCallback(async (missionId: number) => {
    if (!authToken) return;
    try {
      const response = await fetch(MISSION_PATH(missionId), { headers: authHeaders() });
      if (response.status === 401) { handleUnauthorized(); return; }
      if (!response.ok) return;
      const updated: Mission = await response.json();
      setActiveMission(updated);
      setMissions((current) =>
        current.map((m) => (m.id === updated.id ? updated : m)),
      );
      if (updated.status !== 'ACTIVE') {
        stopPolling();
      }
    } catch {
      // Silent — polling will retry next tick
    }
  }, [authToken, authHeaders, handleUnauthorized]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((missionId: number) => {
    stopPolling();
    pollIntervalRef.current = setInterval(() => void pollActiveMission(missionId), ACTIVE_POLL_INTERVAL_MS);
  }, [pollActiveMission, stopPolling]);

  useEffect(() => {
    void refreshMissions();
  }, [refreshMissions]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const createMission = useCallback(async (name: string, waypoints: PlanningWaypoint[]): Promise<Mission | null> => {
    if (!authToken) return null;
    setIsLoading(true);
    setMissionError(null);
    try {
      const body = {
        name,
        waypoints: waypoints.map((wp, index) => ({
          sequence: index,
          latitude: wp.latitude,
          longitude: wp.longitude,
          altitude: wp.altitude,
          label: wp.label,
        })),
      };
      const response = await fetch(MISSIONS_PATH, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (response.status === 401) { handleUnauthorized(); return null; }
      if (!response.ok) { setMissionError('SAVE FAILED'); return null; }
      const created: Mission = await response.json();
      setMissions((current) => [created, ...current]);
      return created;
    } catch {
      setMissionError('NETWORK ERROR');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authToken, authHeaders, handleUnauthorized]);

  const updateMission = useCallback(async (
    missionId: number,
    name: string,
    waypoints: PlanningWaypoint[],
  ): Promise<Mission | null> => {
    if (!authToken) return null;
    setIsLoading(true);
    setMissionError(null);
    try {
      const body = {
        name,
        waypoints: waypoints.map((wp, index) => ({
          sequence: index,
          latitude: wp.latitude,
          longitude: wp.longitude,
          altitude: wp.altitude,
          label: wp.label,
        })),
      };
      const response = await fetch(MISSION_PATH(missionId), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (response.status === 401) { handleUnauthorized(); return null; }
      if (response.status === 404) { setMissionError('MISSION NOT FOUND'); return null; }
      if (response.status === 409) { setMissionError('MISSION NOT PLANNED'); return null; }
      if (!response.ok) { setMissionError(`UPDATE FAILED (${response.status})`); return null; }

      const updated: Mission = await response.json();
      setMissions((current) => current.map((mission) => (mission.id === updated.id ? updated : mission)));
      return updated;
    } catch {
      setMissionError('NETWORK ERROR');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authToken, authHeaders, handleUnauthorized]);

  const executeMission = useCallback(async (missionId: number, droneId: string): Promise<boolean> => {
    if (!authToken) return false;
    setIsLoading(true);
    setMissionError(null);
    try {
      const response = await fetch(MISSION_EXECUTE_PATH(missionId, droneId), {
        method: 'POST',
        headers: authHeaders(),
      });
      if (response.status === 401) { handleUnauthorized(); return false; }
      if (response.status === 503) { setMissionError('MAVLINK DISABLED'); return false; }
      if (response.status === 409) { setMissionError('MISSION NOT PLANNED'); return false; }
      if (!response.ok) { setMissionError(`EXECUTE FAILED (${response.status})`); return false; }
      const executing: Mission = await response.json();
      setActiveMission(executing);
      setMissions((current) =>
        current.map((m) => (m.id === executing.id ? executing : m)),
      );
      startPolling(missionId);
      return true;
    } catch {
      setMissionError('NETWORK ERROR');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authToken, authHeaders, handleUnauthorized, startPolling]);

  const abortMission = useCallback(async (missionId: number): Promise<boolean> => {
    if (!authToken) return false;
    setIsLoading(true);
    setMissionError(null);
    try {
      const response = await fetch(MISSION_ABORT_PATH(missionId), {
        method: 'POST',
        headers: authHeaders(),
      });
      if (response.status === 401) { handleUnauthorized(); return false; }
      if (!response.ok) { setMissionError('ABORT FAILED'); return false; }
      const aborted: Mission = await response.json();
      stopPolling();
      setActiveMission(null);
      setMissions((current) =>
        current.map((m) => (m.id === aborted.id ? aborted : m)),
      );
      return true;
    } catch {
      setMissionError('NETWORK ERROR');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authToken, authHeaders, handleUnauthorized, stopPolling]);

  const deleteMission = useCallback(async (missionId: number): Promise<boolean> => {
    if (!authToken) return false;
    setMissionError(null);
    try {
      const response = await fetch(MISSION_PATH(missionId), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (response.status === 401) { handleUnauthorized(); return false; }
      if (!response.ok) { setMissionError('DELETE FAILED'); return false; }
      setMissions((current) => current.filter((m) => m.id !== missionId));
      if (activeMission?.id === missionId) {
        setActiveMission(null);
      }
      return true;
    } catch {
      setMissionError('NETWORK ERROR');
      return false;
    }
  }, [authToken, authHeaders, handleUnauthorized, activeMission]);

  return {
    missions,
    activeMission,
    isLoading,
    missionError,
    createMission,
    updateMission,
    executeMission,
    abortMission,
    deleteMission,
    refreshMissions,
  };
}
