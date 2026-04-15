import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useFlightReplay } from './useFlightReplay';
import type { AuthToken } from '../interfaces/auth';

const mockToken: AuthToken = {
  token: 'test-token',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const SESSION_KEY = 'skytrack_auth';

const samplePoints = [
  {
    droneId: 'SHERLOCK-01',
    latitude: 37.1,
    longitude: 23.1,
    altitude: 1000,
    speed: 120,
    battery: 80,
    heading: 180,
    timestamp: '2026-04-15T00:00:00Z',
  },
  {
    droneId: 'SHERLOCK-01',
    latitude: 37.2,
    longitude: 23.2,
    altitude: 1100,
    speed: 130,
    battery: 75,
    heading: 190,
    timestamp: '2026-04-15T00:00:01Z',
  },
];

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve(body),
  });
}

describe('useFlightReplay — initial state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('initializes with empty replay and default time range', () => {
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    expect(result.current.replayPoints).toHaveLength(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentPoint).toBeNull();
    expect(result.current.rangeStartLocal).not.toBe('');
    expect(result.current.rangeEndLocal).not.toBe('');
  });

  it('resets state when selectedDrone changes', async () => {
    vi.stubGlobal('fetch', mockFetchOk(samplePoints));
    const { result, rerender } = renderHook(
      ({ drone }: { drone: string | null }) => useFlightReplay(drone, mockToken),
      { wrapper: AuthProvider, initialProps: { drone: 'SHERLOCK-01' } },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(result.current.replayPoints).toHaveLength(2);

    rerender({ drone: 'SHERLOCK-02' });
    expect(result.current.replayPoints).toHaveLength(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentIndex).toBe(0);
  });
});

describe('useFlightReplay — loadReplay validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('does nothing when selectedDrone is null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(
      () => useFlightReplay(null, mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when authToken is null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', null),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets START MUST BE BEFORE END error when range is inverted', async () => {
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      result.current.setRangeStartLocal('2026-04-15T10:00');
      result.current.setRangeEndLocal('2026-04-15T09:00');
    });
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(result.current.replayError).toBe('START MUST BE BEFORE END');
  });
});

describe('useFlightReplay — loadReplay fetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('sets replayPoints and clears error on successful fetch', async () => {
    vi.stubGlobal('fetch', mockFetchOk(samplePoints));
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(result.current.replayPoints).toHaveLength(2);
    expect(result.current.replayError).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets NO TELEMETRY error when response returns an empty array', async () => {
    vi.stubGlobal('fetch', mockFetchOk([]));
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(result.current.replayError).toBe('NO TELEMETRY IN SELECTED RANGE');
    expect(result.current.replayPoints).toHaveLength(0);
  });

  it('uses error string from response body on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: () => Promise.resolve({ error: 'Range too large' }),
    }));
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(result.current.replayError).toBe('RANGE TOO LARGE');
  });

  it('falls back to generic error message when response body has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(result.current.replayError).toBe('REPLAY LOAD FAILED (500)');
  });

  it('sets NETWORK ERROR on fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(result.current.replayError).toBe('NETWORK ERROR');
  });

  it('calls logout on 401 response', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await result.current.loadReplay();
    });
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('useFlightReplay — playback controls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  async function loadedHook() {
    vi.stubGlobal('fetch', mockFetchOk(samplePoints));
    const rendered = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    await act(async () => {
      await rendered.result.current.loadReplay();
    });
    return rendered;
  }

  it('togglePlayback starts playback when stopped', async () => {
    const { result } = await loadedHook();
    act(() => result.current.togglePlayback());
    expect(result.current.isPlaying).toBe(true);
  });

  it('togglePlayback stops playback when playing', async () => {
    const { result } = await loadedHook();
    act(() => result.current.togglePlayback());
    act(() => result.current.togglePlayback());
    expect(result.current.isPlaying).toBe(false);
  });

  it('togglePlayback does nothing when no replayPoints exist', () => {
    const { result } = renderHook(
      () => useFlightReplay('SHERLOCK-01', mockToken),
      { wrapper: AuthProvider },
    );
    act(() => result.current.togglePlayback());
    expect(result.current.isPlaying).toBe(false);
  });

  it('seekToIndex clamps above-range index to last point', async () => {
    const { result } = await loadedHook();
    act(() => result.current.seekToIndex(999));
    expect(result.current.currentIndex).toBe(samplePoints.length - 1);
  });

  it('seekToIndex clamps below-range index to 0', async () => {
    const { result } = await loadedHook();
    act(() => result.current.seekToIndex(1));
    act(() => result.current.seekToIndex(-5));
    expect(result.current.currentIndex).toBe(0);
  });

  it('currentPoint reflects the point at currentIndex', async () => {
    const { result } = await loadedHook();
    act(() => result.current.seekToIndex(1));
    expect(result.current.currentPoint?.latitude).toBe(37.2);
    expect(result.current.currentPoint?.altitude).toBe(1100);
  });

  it('clearReplay resets all replay state', async () => {
    const { result } = await loadedHook();
    act(() => result.current.togglePlayback());
    act(() => result.current.clearReplay());
    expect(result.current.replayPoints).toHaveLength(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.replayError).toBeNull();
    expect(result.current.currentPoint).toBeNull();
  });
});
