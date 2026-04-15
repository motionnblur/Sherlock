import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useGeofences } from './useGeofences';
import type { AuthToken } from '../interfaces/auth';

const mockToken: AuthToken = {
  token: 'test-token',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const sampleGeofencePayload = {
  id: 1,
  name: 'ALPHA',
  active: false,
  createdAt: '2026-04-01T00:00:00Z',
  points: [
    { id: 1, sequence: 0, latitude: 37.0, longitude: 23.0 },
    { id: 2, sequence: 1, latitude: 37.5, longitude: 23.0 },
    { id: 3, sequence: 2, latitude: 37.5, longitude: 23.5 },
  ],
};

const geofenceRequest = {
  name: 'ALPHA',
  points: sampleGeofencePayload.points,
};

// Each test needs to account for the initial GET /api/geofences on mount.
// The first mock response is always the mount fetch; subsequent calls are per-test.

describe('useGeofences', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('loads geofences on mount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve([sampleGeofencePayload]),
    }));
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.geofences).toHaveLength(1);
    expect(result.current.geofences[0]?.name).toBe('ALPHA');
  });

  it('normalizes backend active field to isActive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve([{ ...sampleGeofencePayload, active: true }]),
    }));
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.geofences).toHaveLength(1));
    expect(result.current.geofences[0]?.isActive).toBe(true);
  });

  it('starts with empty list when authToken is null', async () => {
    const { result } = renderHook(() => useGeofences(null), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.geofences).toHaveLength(0);
    expect(result.current.geofenceError).toBeNull();
  });

  it('calls logout on 401 response during load', async () => {
    sessionStorage.setItem('skytrack_auth', JSON.stringify(mockToken));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: () => Promise.resolve({}),
    }));
    renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => {
      expect(sessionStorage.getItem('skytrack_auth')).toBeNull();
    });
  });

  it('createGeofence adds geofence to list on success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ status: 201, ok: true, json: () => Promise.resolve(sampleGeofencePayload) }),
    );
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.createGeofence(geofenceRequest);
    });
    expect(result.current.geofences).toHaveLength(1);
    expect(result.current.geofences[0]?.name).toBe('ALPHA');
    expect(result.current.geofenceError).toBeNull();
  });

  it('createGeofence sets INVALID GEOFENCE error on 400', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ status: 400, ok: false, json: () => Promise.resolve({}) }),
    );
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.createGeofence({ name: 'bad', points: [] });
    });
    expect(result.current.geofenceError).toBe('INVALID GEOFENCE');
  });

  it('createGeofence sets GEOFENCE NAME CONFLICT error on 409', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ status: 409, ok: false, json: () => Promise.resolve({}) }),
    );
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.createGeofence(geofenceRequest);
    });
    expect(result.current.geofenceError).toBe('GEOFENCE NAME CONFLICT');
  });

  it('updateGeofence replaces geofence in list on success', async () => {
    const updated = { ...sampleGeofencePayload, name: 'ALPHA-UPDATED' };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([sampleGeofencePayload]) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve(updated) }),
    );
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.geofences).toHaveLength(1));
    await act(async () => {
      await result.current.updateGeofence(1, { name: 'ALPHA-UPDATED', points: geofenceRequest.points });
    });
    expect(result.current.geofences[0]?.name).toBe('ALPHA-UPDATED');
  });

  it('deleteGeofence removes geofence from list on success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([sampleGeofencePayload]) })
      .mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve({}) }),
    );
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.geofences).toHaveLength(1));
    await act(async () => {
      await result.current.deleteGeofence(1);
    });
    expect(result.current.geofences).toHaveLength(0);
  });

  it('deleteGeofence sets GEOFENCE NOT FOUND error on 404', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ status: 404, ok: false, json: () => Promise.resolve({}) }),
    );
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.deleteGeofence(99);
    });
    expect(result.current.geofenceError).toBe('GEOFENCE NOT FOUND');
  });

  it('setGeofenceActive hits the /activate endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([sampleGeofencePayload]) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve({ ...sampleGeofencePayload, active: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.geofences).toHaveLength(1));
    await act(async () => {
      await result.current.setGeofenceActive(1, true);
    });
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain('/activate');
  });

  it('setGeofenceActive hits the /deactivate endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([{ ...sampleGeofencePayload, active: true }]) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve({ ...sampleGeofencePayload, active: false }) });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.geofences).toHaveLength(1));
    await act(async () => {
      await result.current.setGeofenceActive(1, false);
    });
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain('/deactivate');
  });

  it('setGeofenceActive updates the geofence in local list', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve([sampleGeofencePayload]) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: () => Promise.resolve({ ...sampleGeofencePayload, active: true }) }),
    );
    const { result } = renderHook(() => useGeofences(mockToken), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.geofences).toHaveLength(1));
    await act(async () => {
      await result.current.setGeofenceActive(1, true);
    });
    expect(result.current.geofences[0]?.isActive).toBe(true);
  });
});
