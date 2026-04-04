export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  token: string;
  username: string;
  expiresAt: string; // ISO-8601 UTC
}
