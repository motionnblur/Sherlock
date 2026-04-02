import { useState, useEffect } from 'react';

function UtcClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums">{time}</span>;
}

export default function Header({ connected }) {
  return (
    <header className="flex items-center justify-between px-4 h-11 bg-panel border-b border-line shrink-0">
      {/* Left: Branding */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-neon text-xs font-bold tracking-widest">▌▌▌</span>
          <span className="text-neon text-sm font-bold tracking-widest uppercase">
            SHERLOCK GCS
          </span>
        </div>
        <div className="w-px h-5 bg-line" />
        <span className="text-muted text-xs tracking-wider uppercase">
          SKYTRACK Ground Control System
        </span>
      </div>

      {/* Center: Classification */}
      <div className="text-caution text-xs font-bold tracking-widest uppercase animate-blink">
        ◈ TRAINING MODE ◈
      </div>

      {/* Right: Status indicators */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted tracking-wider">UTC</span>
          <span className="text-neon font-bold tabular-nums tracking-wider">
            <UtcClock />
          </span>
        </div>

        <div className="w-px h-5 bg-line" />

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-neon animate-pulse-fast' : 'bg-danger animate-blink'
            }`}
          />
          <span className={`font-bold tracking-wider ${connected ? 'text-neon' : 'text-danger'}`}>
            {connected ? 'LINK ACTIVE' : 'NO SIGNAL'}
          </span>
        </div>

        <div className="w-px h-5 bg-line" />

        <div className="text-xs text-muted tracking-wider">
          SHERLOCK<span className="text-neon">-01</span>
        </div>
      </div>
    </header>
  );
}
