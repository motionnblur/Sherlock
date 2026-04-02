const BLANK = '---';

function fmt(val, decimals = 2) {
  if (val == null) return BLANK;
  return Number(val).toFixed(decimals);
}

function formatCoord(val, posLabel, negLabel) {
  if (val == null) return BLANK;
  const abs = Math.abs(val).toFixed(6);
  return `${abs}° ${val >= 0 ? posLabel : negLabel}`;
}

function BatteryBar({ value }) {
  const pct = value ?? 0;
  const isLow = pct < 20;
  const isCritical = pct < 10;

  const barColor = isCritical ? 'bg-danger' : isLow ? 'bg-caution' : 'bg-neon';
  const textColor = isCritical ? 'text-danger' : isLow ? 'text-caution' : 'text-neon';

  const filled = Math.round(pct / 10);
  const empty = 10 - filled;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold tracking-widest ${textColor}`}>
          {'▓'.repeat(filled)}
          <span className="text-muted">{'░'.repeat(empty)}</span>
        </span>
        <span className={`text-xs font-bold ${textColor}`}>{fmt(pct, 1)}%</span>
        {isLow && (
          <span className={`text-[9px] font-bold animate-blink ${isCritical ? 'text-danger' : 'text-caution'}`}>
            {isCritical ? '⚠ CRITICAL' : '⚠ LOW'}
          </span>
        )}
      </div>
      <div className="w-full h-0.5 bg-elevated">
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DataRow({ label, value, unit = '', accent = false, critical = false }) {
  const valueColor = critical ? 'text-danger' : accent ? 'text-caution' : 'text-neon';
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-line last:border-0">
      <span className="text-[10px] text-muted tracking-widest uppercase">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${valueColor}`}>
        {value}
        {unit && <span className="text-[10px] text-muted ml-1 font-normal">{unit}</span>}
      </span>
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-2 py-1.5 mb-0.5">
      <span className="text-[9px] text-neon tracking-widest font-bold">{title}</span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

export default function TelemetryPanel({ telemetry: t }) {
  const heading = t?.heading ?? null;
  const headingDir = heading != null ? getCardinal(heading) : '---';

  return (
    <aside className="w-64 bg-panel border-r border-line flex flex-col shrink-0 overflow-y-auto">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-line bg-elevated">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest text-neon uppercase">
            ◈ Telemetry Feed
          </span>
          <span
            className={`text-[9px] font-bold tracking-wider ${
              t ? 'text-neon animate-pulse-fast' : 'text-muted'
            }`}
          >
            {t ? '● LIVE' : '○ WAIT'}
          </span>
        </div>
      </div>

      <div className="px-3 py-2 flex flex-col gap-0.5">
        {/* Position */}
        <SectionHeader title="POSITION" />
        <DataRow label="LATITUDE"  value={formatCoord(t?.latitude,  'N', 'S')} />
        <DataRow label="LONGITUDE" value={formatCoord(t?.longitude, 'E', 'W')} />

        {/* Kinematics */}
        <SectionHeader title="KINEMATICS" />
        <DataRow label="ALTITUDE" value={fmt(t?.altitude, 0)} unit="m ASL" />
        <DataRow label="SPEED"    value={fmt(t?.speed, 1)}    unit="km/h" />
        <DataRow
          label="HEADING"
          value={t?.heading != null ? `${fmt(t.heading, 1)}°` : BLANK}
          unit={headingDir !== '---' ? headingDir : ''}
        />

        {/* Power */}
        <SectionHeader title="POWER" />
        <div className="py-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted tracking-widest uppercase">BATTERY</span>
          </div>
          <BatteryBar value={t?.battery} />
        </div>

        {/* Timestamps */}
        <SectionHeader title="TIMING" />
        <DataRow
          label="LAST PKT"
          value={
            t?.timestamp
              ? new Date(t.timestamp).toISOString().slice(11, 19)
              : BLANK
          }
          unit="UTC"
        />
      </div>

      {/* Platform ID footer */}
      <div className="mt-auto px-3 py-2 border-t border-line">
        <div className="text-[9px] text-muted tracking-widest">
          PLATFORM  <span className="text-neon font-bold">SHERLOCK-01</span>
        </div>
        <div className="text-[9px] text-muted tracking-widest mt-0.5">
          FREQ  <span className="text-neon">2 Hz</span>
        </div>
      </div>
    </aside>
  );
}

function getCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
