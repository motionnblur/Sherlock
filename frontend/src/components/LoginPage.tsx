import { useState, type FormEvent } from 'react';
import { useLogin } from '../hooks/useLogin';

export default function LoginPage() {
  const { isSubmitting, loginError, submitLogin } = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitLogin({ username: username.trim(), password });
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-surface font-mono select-none">
      <div className="w-80 border border-line bg-panel">

        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 h-10 bg-elevated border-b border-line">
          <span className="text-neon text-xs font-bold tracking-widest">▌▌▌</span>
          <span className="text-neon text-xs font-bold tracking-widest uppercase">
            SHERLOCK GCS
          </span>
          <div className="flex-1" />
          <span className="text-muted text-[9px] tracking-widest uppercase">SHERLOCK</span>
        </div>

        {/* Title */}
        <div className="px-4 pt-5 pb-4 border-b border-line">
          <p className="text-[10px] text-muted tracking-widest uppercase">
            Operator Authentication
          </p>
          <p className="text-[9px] text-muted tracking-wider mt-0.5">
            Authorized personnel only. All access is audited.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="login-username"
              className="text-[9px] text-muted tracking-widest uppercase"
            >
              Operator ID
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              className="
                bg-surface border border-line text-neon text-xs tracking-wider
                px-2 py-1.5 outline-none
                focus:border-neon
                disabled:opacity-50
                placeholder:text-muted
              "
              placeholder="enter operator id"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="login-password"
              className="text-[9px] text-muted tracking-widest uppercase"
            >
              Access Code
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="
                bg-surface border border-line text-neon text-xs tracking-wider
                px-2 py-1.5 outline-none
                focus:border-neon
                disabled:opacity-50
                placeholder:text-muted
              "
              placeholder="••••••••"
            />
          </div>

          {loginError && (
            <p className="text-[10px] text-danger tracking-wider border border-danger px-2 py-1">
              ✕ {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !username || !password}
            className="
              mt-1 w-full text-xs font-bold tracking-widest uppercase
              border border-neon text-neon py-2
              hover:bg-elevated
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors
            "
          >
            {isSubmitting ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-line">
          <p className="text-[9px] text-muted tracking-wider">
            Account access administered by system operator.
          </p>
        </div>
      </div>
    </div>
  );
}
