import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useLastKnownTelemetry } from './useLastKnownTelemetry';
import type { AuthToken } from '../interfaces/auth';

const mockToken: AuthToken = {
  token: 'test-token',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const SESSION_KEY = 'skytrack_auth';

const samplePoint = {
  droneId: 'SHERLOCK-01',
  latitude: 37.1,
  longitude: 23.1,
  altitude: 1000,
  speed: 120,
  battery: 80,
  heading: 180,
  timestamp: '2026-04-15T00:00:00Z',
};

// Stable references — never pass inline array literals to renderHook because
// a new array on every render causes the droneIds dependency to change on
// every tick, triggering an infinite re-render cycle.
const SINGLE_DRONE_IDS = ['SHERLOCK-01'];
const TWO_DRONE_IDS = ['SHERLOCK-01', 'SHERLOCK-02'];
const EMPTY_DRONE_IDS: string[] = [];

describe('useLastKnownTelemetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('returns empty map and does not fetch when disabled', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(
      () => useLastKnownTelemetry(SINGLE_DRONE_IDS, false),
      { wrapper: AuthProvider },
    );
    // Allow effects to settle
    await waitFor(() => {
      expect(result.current).toEqual({});
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns empty map and does not fetch when droneIds is empty', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(
      () => useLastKnownTelemetry(EMPTY_DRONE_IDS, true),
      { wrapper: AuthProvider },
    );
    await waitFor(() => {
      expect(result.current).toEqual({});
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns empty map when authToken is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(
      () => useLastKnownTelemetry(SINGLE_DRONE_IDS, true),
      { wrapper: AuthProvider },
    );
    await waitFor(() => {
      expect(result.current).toEqual({});
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and maps telemetry keyed by droneId when enabled', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ telemetry: [samplePoint] }),
    }));
    const { result } = renderHook(
      () => useLastKnownTelemetry(SINGLE_DRONE_IDS, true),
      { wrapper: AuthProvider },
    );
    await waitFor(() => {
      expect(result.current['SHERLOCK-01']).toBeDefined();
    });
    expect(result.current['SHERLOCK-01']?.altitude).toBe(1000);
    expect(result.current['SHERLOCK-01']?.latitude).toBe(37.1);
  });

  it('calls logout on 401 response', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    renderHook(
      () => useLastKnownTelemetry(SINGLE_DRONE_IDS, true),
      { wrapper: AuthProvider },
    );
    await waitFor(() => {
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });
  });

  it('sends droneIds in the POST request body', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ telemetry: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(
      () => useLastKnownTelemetry(TWO_DRONE_IDS, true),
      { wrapper: AuthProvider },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.droneIds).toEqual(['SHERLOCK-01', 'SHERLOCK-02']);
  });

  it('includes Authorization header in the POST request', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ telemetry: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(
      () => useLastKnownTelemetry(SINGLE_DRONE_IDS, true),
      { wrapper: AuthProvider },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });
});
