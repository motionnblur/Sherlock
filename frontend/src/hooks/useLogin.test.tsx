import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useLogin } from './useLogin';

const SESSION_KEY = 'skytrack_auth';

const tokenPayload = {
  token: 'jwt-abc',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

describe('useLogin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('initializes with isSubmitting false and no error', () => {
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.loginError).toBeNull();
  });

  it('stores token in sessionStorage and clears error on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tokenPayload),
    }));
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.submitLogin({ username: 'operator1', password: 'pass' });
    });
    expect(result.current.loginError).toBeNull();
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY)!);
    expect(stored.token).toBe('jwt-abc');
  });

  it('resets isSubmitting to false after successful login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tokenPayload),
    }));
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.submitLogin({ username: 'operator1', password: 'pass' });
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('sets loginError from response body error field on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Account locked' }),
    }));
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.submitLogin({ username: 'op', password: 'pass' });
    });
    expect(result.current.loginError).toBe('Account locked');
  });

  it('falls back to Authentication failed when response body has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }));
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.submitLogin({ username: 'op', password: 'pass' });
    });
    expect(result.current.loginError).toBe('Authentication failed');
  });

  it('sets loginError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.submitLogin({ username: 'op', password: 'pass' });
    });
    expect(result.current.loginError).toBe('Network offline');
  });

  it('clears loginError at the start of a new submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Bad credentials' }),
    }));
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.submitLogin({ username: 'op', password: 'wrong' });
    });
    expect(result.current.loginError).toBe('Bad credentials');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tokenPayload),
    }));
    await act(async () => {
      await result.current.submitLogin({ username: 'op', password: 'correct' });
    });
    expect(result.current.loginError).toBeNull();
  });

  it('sends credentials as JSON in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tokenPayload),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLogin(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.submitLogin({ username: 'operator1', password: 'secret' });
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.username).toBe('operator1');
    expect(body.password).toBe('secret');
  });
});
