import { useEffect, useRef, useState } from 'react';
import type {
  AltitudeTrendProps,
  CompassRoseProps,
  LogEntryProps,
  MissionClockProps,
  SystemPanelProps,
  SystemSectionHeaderProps,
} from '../interfaces/components';

const BLANK = '---';

function MissionClock({ started }: MissionClockProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (started && !startRef.current) {
      startRef.current = Date.now();
    }
  }, [started]);

  useEffect(() => {
    if (!startRef.current) return;

    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [started]);

  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');

  return (
    <span className="text-neon font-bold tabular-nums tracking-widest">
      {h}:{m}:{s}
    </span>
  );
}

function AltitudeTrend({ history }: AltitudeTrendProps) {
  if (history.length < 2) return <span className="text-muted">─</span>;

  const last = history[history.length - 1]?.altitude ?? 0;
  const prev = history[history.length - 2]?.altitude ?? 0;
  const delta = last - prev;

  if (delta > 0.5) return <span className="text-neon">↑</span>;
  if (delta < -0.5) return <span className="text-caution">↓</span>;
  return <span className="text-muted">→</span>;
}

function CompassRose({ heading }: CompassRoseProps) {
  if (heading == null) return null;

  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const active = dirs[Math.round(heading / 45) % 8];

  return (
    <div className="grid grid-cols-3 gap-0.5 w-16 text-center text-[9px] font-bold">
      {['NW', 'N', 'NE', 'W', '·', 'E', 'SW', 'S', 'SE'].map((d) => (
        <span
          key={d}
          className={d === active ? 'text-neon' : d === '·' ? 'text-line' : 'text-muted'}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

function SectionHeader({ title }: SystemSectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[9px] text-neon tracking-widest font-bold">{title}</span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

function LogEntry({ entry, index }: LogEntryProps) {
  const time = entry.timestamp
    ? new Date(entry.timestamp).toISOString().slice(11, 19)
    : BLANK;

  return (
    <div
      className={`flex items-center justify-between py-0.5 text-[9px] border-b border-line last:border-0 ${
        index === 0 ? 'text-neon' : 'text-muted'
      }`}
    >
      <span className="tabular-nums">{time}</span>
      <span className="tabular-nums">{entry.altitude?.toFixed(0) ?? BLANK}m</span>
      <span className="tabular-nums">{entry.speed?.toFixed(0) ?? BLANK}km/h</span>
    </div>
  );
}

export default function SystemPanel({ telemetry: t, history, connected }: SystemPanelProps) {
  const recentLog = [...history].reverse().slice(0, 8);

  return (
    <aside className="w-52 bg-panel border-l border-line flex flex-col shrink-0 overflow-y-auto">
      <div className="px-3 py-2 border-b border-line bg-elevated">
        <span className="text-[10px] font-bold tracking-widest text-neon uppercase">
          ◈ System Status
        </span>
      </div>

      <div className="px-3 py-2 flex flex-col gap-0.5">
        <SectionHeader title="MISSION CLOCK" />
        <div className="py-1 text-sm">
          <MissionClock started={connected && !!t} />
        </div>

        <SectionHeader title="HEADING" />
        <div className="flex items-center gap-3 py-1">
          <CompassRose heading={t?.heading} />
          <div>
            <div className="text-sm font-bold text-neon tabular-nums">
              {t?.heading != null ? `${t.heading.toFixed(1)}°` : BLANK}
            </div>
          </div>
        </div>

        <SectionHeader title="ALT TREND" />
        <div className="flex items-center gap-2 py-1">
          <span className="text-xl">
            <AltitudeTrend history={history} />
          </span>
          <div className="text-xs text-neon font-bold tabular-nums">
            {t?.altitude?.toFixed(0) ?? BLANK}
            <span className="text-[9px] text-muted ml-0.5">m</span>
          </div>
        </div>

        <SectionHeader title="DATALINK" />
        <div className="py-1 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">STATUS</span>
            <span className={`font-bold text-[10px] ${connected ? 'text-neon' : 'text-danger animate-blink'}`}>
              {connected ? '● NOMINAL' : '○ LOST'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">PROTOCOL</span>
            <span className="text-neon text-[10px]">STOMP/WS</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">UPLINK</span>
            <span className="text-neon text-[10px]">2.4 GHz</span>
          </div>
        </div>

        <SectionHeader title="FLIGHT LOG" />
        <div className="py-0.5">
          <div className="flex items-center justify-between text-[8px] text-muted pb-0.5 border-b border-line mb-0.5">
            <span>TIME (UTC)</span>
            <span>ALT</span>
            <span>SPD</span>
          </div>
          {recentLog.length > 0
            ? recentLog.map((entry, index) => <LogEntry key={index} entry={entry} index={index} />)
            : <span className="text-[9px] text-muted">AWAITING DATA...</span>
          }
        </div>
      </div>
    </aside>
  );
}
