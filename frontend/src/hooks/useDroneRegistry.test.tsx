import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useDroneRegistry } from './useDroneRegistry';
import type { AuthToken } from '../interfaces/auth';

const mockToken: AuthToken = {
  token: 'test-token',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

describe('useDroneRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('fetches drone IDs on mount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ droneIds: ['SHERLOCK-01', 'SHERLOCK-02'] }),
    }));
    const { result } = renderHook(() => useDroneRegistry(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.droneIds).toEqual(['SHERLOCK-01', 'SHERLOCK-02']);
  });

  it('filters out non-string entries from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ droneIds: ['SHERLOCK-01', 42, null, true, 'SHERLOCK-02'] }),
    }));
    const { result } = renderHook(() => useDroneRegistry(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.droneIds).toEqual(['SHERLOCK-01', 'SHERLOCK-02']);
  });

  it('starts with empty droneIds when no authToken', async () => {
    const { result } = renderHook(() => useDroneRegistry(null), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.droneIds).toEqual([]);
  });

  it('calls logout and clears session on 401 response', async () => {
    sessionStorage.setItem('skytrack_auth', JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    renderHook(() => useDroneRegistry(mockToken), { wrapper: AuthProvider });
    await waitFor(() => {
      expect(sessionStorage.getItem('skytrack_auth')).toBeNull();
    });
  });

  it('keeps current droneIds on non-401 HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    const { result } = renderHook(() => useDroneRegistry(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.droneIds).toEqual([]);
  });

  it('includes Authorization header in the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ droneIds: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useDroneRegistry(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });
});
