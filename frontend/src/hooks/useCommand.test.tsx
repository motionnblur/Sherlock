import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useCommand } from './useCommand';
import type { AuthToken } from '../interfaces/auth';

const mockToken: AuthToken = {
  token: 'test-token',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

function mockFetch(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });
}

describe('useCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('returns false immediately when no drone is selected', async () => {
    const { result } = renderHook(() => useCommand(null, mockToken), { wrapper: AuthProvider });
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.sendCommand('RTH');
    });
    expect(returnValue).toBe(false);
  });

  it('returns false immediately when no authToken', async () => {
    const { result } = renderHook(() => useCommand('SHERLOCK-01', null), { wrapper: AuthProvider });
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.sendCommand('ARM');
    });
    expect(returnValue).toBe(false);
  });

  it('returns true and clears error on successful command', async () => {
    vi.stubGlobal('fetch', mockFetch(200));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.sendCommand('RTH');
    });
    expect(returnValue).toBe(true);
    expect(result.current.commandError).toBeNull();
  });

  it('resets isSending to false after command completes', async () => {
    vi.stubGlobal('fetch', mockFetch(200));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('RTH');
    });
    expect(result.current.isSending).toBe(false);
  });

  it('sets commandError to DRONE NOT CONNECTED on 422', async () => {
    vi.stubGlobal('fetch', mockFetch(422));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('RTH');
    });
    expect(result.current.commandError).toBe('DRONE NOT CONNECTED');
  });

  it('sets commandError to VEHICLE NOT READY on 409', async () => {
    vi.stubGlobal('fetch', mockFetch(409));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('ARM');
    });
    expect(result.current.commandError).toBe('VEHICLE NOT READY');
  });

  it('sets commandError to INVALID COMMAND on 400', async () => {
    vi.stubGlobal('fetch', mockFetch(400));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('ARM');
    });
    expect(result.current.commandError).toBe('INVALID COMMAND');
  });

  it('sets commandError to MAVLINK DISABLED on 503', async () => {
    vi.stubGlobal('fetch', mockFetch(503));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('TAKEOFF');
    });
    expect(result.current.commandError).toBe('MAVLINK DISABLED');
  });

  it('sets commandError with status code on unknown HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch(500));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('RTH');
    });
    expect(result.current.commandError).toBe('CMD FAILED (500)');
  });

  it('sets commandError to NETWORK ERROR on fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('RTH');
    });
    expect(result.current.commandError).toBe('NETWORK ERROR');
  });

  it('calls logout and returns false on 401 response', async () => {
    sessionStorage.setItem('skytrack_auth', JSON.stringify(mockToken));
    vi.stubGlobal('fetch', mockFetch(401));
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.sendCommand('RTH');
    });
    expect(returnValue).toBe(false);
    expect(sessionStorage.getItem('skytrack_auth')).toBeNull();
  });

  it('sends GOTO command with coordinate options in request body', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('GOTO', { latitude: 37.1, longitude: 23.1, altitude: 100 });
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.commandType).toBe('GOTO');
    expect(body.latitude).toBe(37.1);
    expect(body.longitude).toBe(23.1);
    expect(body.altitude).toBe(100);
  });

  it('includes Authorization header in every request', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCommand('SHERLOCK-01', mockToken), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.sendCommand('ARM');
    });
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });
});
