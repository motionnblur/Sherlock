import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { LoginCredentials } from '../interfaces/auth';

const AUTH_LOGIN_PATH = '/api/auth/login';

interface LoginResponse {
  token: string;
  username: string;
  expiresAt: string;
}

export interface UseLoginResult {
  isSubmitting: boolean;
  loginError: string | null;
  submitLogin: (credentials: LoginCredentials) => Promise<void>;
}

export function useLogin(): UseLoginResult {
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const submitLogin = useCallback(async (credentials: LoginCredentials) => {
    setIsSubmitting(true);
    setLoginError(null);

    try {
      const response = await fetch(AUTH_LOGIN_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Authentication failed');
      }

      const data: LoginResponse = await response.json();
      login({ token: data.token, username: data.username, expiresAt: data.expiresAt });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [login]);

  return { isSubmitting, loginError, submitLogin };
}
