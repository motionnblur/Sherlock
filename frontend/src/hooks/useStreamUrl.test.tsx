import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useStreamUrl } from './useStreamUrl';
import type { AuthToken } from '../interfaces/auth';

// useStreamUrl reads authToken from useAuth(), so inject it via sessionStorage
// before the AuthProvider mounts.

const mockToken: AuthToken = {
  token: 'test-token',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const SESSION_KEY = 'skytrack_auth';
const STREAM_URL = 'http://mediamtx/hls/SHERLOCK-01/index.m3u8';

describe('useStreamUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('initializes with null streamUrl, not fetching, no error', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    expect(result.current.streamUrl).toBeNull();
    expect(result.current.isFetching).toBe(false);
    expect(result.current.fetchError).toBeNull();
  });

  it('sets streamUrl on successful fetch', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ streamUrl: STREAM_URL }),
    }));
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.fetchStreamUrl('SHERLOCK-01');
    });
    expect(result.current.streamUrl).toBe(STREAM_URL);
    expect(result.current.fetchError).toBeNull();
  });

  it('resets isFetching to false after successful fetch', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ streamUrl: STREAM_URL }),
    }));
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.fetchStreamUrl('SHERLOCK-01');
    });
    expect(result.current.isFetching).toBe(false);
  });

  it('sets fetchError and clears streamUrl on HTTP error', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.fetchStreamUrl('SHERLOCK-01');
    });
    expect(result.current.streamUrl).toBeNull();
    expect(result.current.fetchError).toContain('404');
  });

  it('calls logout and returns on 401 response', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.fetchStreamUrl('SHERLOCK-01');
    });
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('clearStreamUrl resets streamUrl and fetchError to null', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ streamUrl: STREAM_URL }),
    }));
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.fetchStreamUrl('SHERLOCK-01');
    });
    expect(result.current.streamUrl).not.toBeNull();
    act(() => {
      result.current.clearStreamUrl();
    });
    expect(result.current.streamUrl).toBeNull();
    expect(result.current.fetchError).toBeNull();
  });

  it('includes Authorization header in the fetch request', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ streamUrl: STREAM_URL }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.fetchStreamUrl('SHERLOCK-01');
    });
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });

  it('calls the correct stream endpoint URL', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockToken));
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ streamUrl: STREAM_URL }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useStreamUrl(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.fetchStreamUrl('SHERLOCK-01');
    });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/drones/SHERLOCK-01/stream');
  });
});
