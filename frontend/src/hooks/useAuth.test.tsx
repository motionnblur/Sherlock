import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('returns context value when inside AuthProvider', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.authToken).toBeNull();
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
  });

  it('throws when called outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be called inside <AuthProvider>',
    );
  });
});
