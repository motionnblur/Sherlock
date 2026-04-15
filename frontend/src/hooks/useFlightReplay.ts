import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthToken } from '../interfaces/auth';
import type { UseFlightReplayResult } from '../interfaces/hooks';
import { buildFlightReplayCsv, buildFlightReplayFileName } from '../utils/flightReplay';
import { parseTelemetryListPayload } from '../utils/telemetry';
import { useAuth } from './useAuth';

const TELEMETRY_HISTORY_PATH = '/api/telemetry/history';
const PLAYBACK_INTERVAL_MS = 500;
const DEFAULT_REPLAY_WINDOW_HOURS = 1;

function formatLocalDateTimeInput(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultReplayWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - DEFAULT_REPLAY_WINDOW_HOURS * 60 * 60 * 1000);
  return {
    start: formatLocalDateTimeInput(start),
    end: formatLocalDateTimeInput(end),
  };
}

function parseLocalDateToIso(localValue: string): string | null {
  if (!localValue) {
    return null;
  }
  const parsedDate = new Date(localValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  return parsedDate.toISOString();
}

function clampIndex(index: number, maxIndex: number): number {
  if (maxIndex < 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, maxIndex));
}

export function useFlightReplay(selectedDrone: string | null, authToken: AuthToken | null): UseFlightReplayResult {
  const { logout } = useAuth();
  const [rangeStartLocal, setRangeStartLocal] = useState('');
  const [rangeEndLocal, setRangeEndLocal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayPoints, setReplayPoints] = useState<UseFlightReplayResult['replayPoints']>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setReplayPoints([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    setReplayError(null);
    const defaults = getDefaultReplayWindow();
    setRangeStartLocal(defaults.start);
    setRangeEndLocal(defaults.end);
  }, [selectedDrone]);

  useEffect(() => {
    if (!isPlaying || replayPoints.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentIndex((previousIndex) => {
        if (previousIndex >= replayPoints.length - 1) {
          setIsPlaying(false);
          return previousIndex;
        }
        return previousIndex + 1;
      });
    }, PLAYBACK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isPlaying, replayPoints.length]);

  const loadReplay = useCallback(async () => {
    if (!selectedDrone || !authToken) {
      return;
    }

    const startIso = parseLocalDateToIso(rangeStartLocal);
    const endIso = parseLocalDateToIso(rangeEndLocal);
    if (!startIso || !endIso) {
      setReplayError('START AND END TIME REQUIRED');
      return;
    }
    if (Date.parse(startIso) >= Date.parse(endIso)) {
      setReplayError('START MUST BE BEFORE END');
      return;
    }

    setIsLoading(true);
    setReplayError(null);
    setIsPlaying(false);
    try {
      const query = new URLSearchParams({
        droneId: selectedDrone,
        start: startIso,
        end: endIso,
      });
      const response = await fetch(`${TELEMETRY_HISTORY_PATH}?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${authToken.token}`,
        },
      });
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) {
        let errorMessage = `REPLAY LOAD FAILED (${response.status})`;
        try {
          const payload = (await response.json()) as { error?: unknown };
          if (typeof payload.error === 'string' && payload.error.length > 0) {
            errorMessage = payload.error.toUpperCase();
          }
        } catch {
          // no-op
        }
        setReplayPoints([]);
        setCurrentIndex(0);
        setReplayError(errorMessage);
        return;
      }

      const payload = (await response.json()) as unknown;
      const points = parseTelemetryListPayload(payload);
      if (points.length === 0) {
        setReplayPoints([]);
        setCurrentIndex(0);
        setReplayError('NO TELEMETRY IN SELECTED RANGE');
        return;
      }

      setReplayPoints(points);
      setCurrentIndex(0);
      setReplayError(null);
    } catch {
      setReplayPoints([]);
      setCurrentIndex(0);
      setReplayError('NETWORK ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [authToken, logout, rangeEndLocal, rangeStartLocal, selectedDrone]);

  const togglePlayback = useCallback(() => {
    if (replayPoints.length === 0) {
      return;
    }
    setIsPlaying((previous) => !previous);
  }, [replayPoints.length]);

  const seekToIndex = useCallback((index: number) => {
    const maxIndex = replayPoints.length - 1;
    setCurrentIndex(clampIndex(index, maxIndex));
  }, [replayPoints.length]);

  const clearReplay = useCallback(() => {
    setReplayPoints([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    setReplayError(null);
  }, []);

  const exportCsv = useCallback(() => {
    if (!selectedDrone || replayPoints.length === 0) {
      return;
    }
    const startIso = parseLocalDateToIso(rangeStartLocal) ?? new Date().toISOString();
    const endIso = parseLocalDateToIso(rangeEndLocal) ?? new Date().toISOString();
    const csv = buildFlightReplayCsv(replayPoints);
    const fileName = buildFlightReplayFileName(selectedDrone, startIso, endIso);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }, [rangeEndLocal, rangeStartLocal, replayPoints, selectedDrone]);

  const currentPoint = useMemo(() => {
    if (replayPoints.length === 0) {
      return null;
    }
    return replayPoints[clampIndex(currentIndex, replayPoints.length - 1)] ?? null;
  }, [currentIndex, replayPoints]);

  return {
    rangeStartLocal,
    rangeEndLocal,
    setRangeStartLocal,
    setRangeEndLocal,
    isLoading,
    replayError,
    replayPoints,
    currentIndex,
    currentPoint,
    isPlaying,
    loadReplay,
    togglePlayback,
    seekToIndex,
    clearReplay,
    exportCsv,
  };
}
