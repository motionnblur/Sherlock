import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { AuthContext, AuthProvider } from './AuthContext';
import type { AuthToken } from '../interfaces/auth';

const SESSION_KEY = 'skytrack_auth';

const validToken: AuthToken = {
  token: 'jwt-abc',
  username: 'operator1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const expiredToken: AuthToken = {
  token: 'old-token',
  username: 'operator1',
  expiresAt: new Date(Date.now() - 1000).toISOString(),
};

function TestConsumer() {
  const ctx = useContext(AuthContext);
  if (!ctx) return <div>no context</div>;
  return (
    <div>
      <span data-testid="token">{ctx.authToken?.token ?? 'null'}</span>
      <span data-testid="username">{ctx.authToken?.username ?? 'null'}</span>
      <button onClick={() => ctx.login(validToken)}>login</button>
      <button onClick={() => ctx.logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('renders children', () => {
    render(
      <AuthProvider>
        <div>child content</div>
      </AuthProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('starts with null authToken when sessionStorage is empty', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('loads a valid stored token from sessionStorage on mount', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validToken));
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('token').textContent).toBe('jwt-abc');
    expect(screen.getByTestId('username').textContent).toBe('operator1');
  });

  it('evicts an expired token from sessionStorage on mount', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(expiredToken));
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('handles malformed sessionStorage JSON gracefully', () => {
    sessionStorage.setItem(SESSION_KEY, 'not-valid-json');
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('sets authToken and persists to sessionStorage after login', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await act(async () => {
      screen.getByText('login').click();
    });
    expect(screen.getByTestId('token').textContent).toBe('jwt-abc');
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY)!);
    expect(stored.token).toBe('jwt-abc');
  });

  it('clears authToken and sessionStorage after logout', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validToken));
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('token').textContent).toBe('jwt-abc');
    await act(async () => {
      screen.getByText('logout').click();
    });
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('exposes login and logout as functions', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByText('login')).toBeInTheDocument();
    expect(screen.getByText('logout')).toBeInTheDocument();
  });
});
