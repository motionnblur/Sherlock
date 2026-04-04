import { createContext, useState, useCallback, type ReactNode } from 'react';
import type { AuthToken } from '../interfaces/auth';

const SESSION_STORAGE_KEY = 'skytrack_auth';

export interface AuthContextValue {
  authToken: AuthToken | null;
  login: (token: AuthToken) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredToken(): AuthToken | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const stored: AuthToken = JSON.parse(raw);

    // Reject expired tokens on load — don't wait for a 401.
    if (new Date(stored.expiresAt) <= new Date()) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return stored;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authToken, setAuthToken] = useState<AuthToken | null>(loadStoredToken);

  const login = useCallback((token: AuthToken) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(token));
    setAuthToken(token);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setAuthToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
