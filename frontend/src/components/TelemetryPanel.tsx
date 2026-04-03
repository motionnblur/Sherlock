import type {
  BatteryBarProps,
  TelemetryDataRowProps,
  TelemetryPanelProps,
} from '../interfaces/components';
import { PACKET_RATE_LABEL, PRIMARY_DRONE_ID } from '../constants/telemetry';
import SectionHeader from './SectionHeader';
import {
  BLANK_VALUE,
  clamp,
  formatFixed,
  formatHemisphereCoordinate,
  formatUtcTime,
  getCardinalDirection,
} from '../utils/formatters';

function BatteryBar({ value }: BatteryBarProps) {
  const clampedPct = clamp(value ?? 0, 0, 100);
  const isLow = clampedPct < 20;
  const isCritical = clampedPct < 10;

  const barColor = isCritical ? 'bg-danger' : isLow ? 'bg-caution' : 'bg-neon';
  const textColor = isCritical ? 'text-danger' : isLow ? 'text-caution' : 'text-neon';

  const filled = clamp(Math.round(clampedPct / 10), 0, 10);
  const empty = 10 - filled;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold tracking-widest ${textColor}`}>
          {'▓'.repeat(filled)}
          <span className="text-muted">{'░'.repeat(empty)}</span>
        </span>
        <span className={`text-xs font-bold ${textColor}`}>{formatFixed(clampedPct, 1)}%</span>
        {isLow && (
          <span className={`text-[9px] font-bold animate-blink ${isCritical ? 'text-danger' : 'text-caution'}`}>
            {isCritical ? '⚠ CRITICAL' : '⚠ LOW'}
          </span>
        )}
      </div>
      <div className="w-full h-0.5 bg-elevated">
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
}

function DataRow({ label, value, unit = '', accent = false, critical = false }: TelemetryDataRowProps) {
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

export default function TelemetryPanel({ telemetry: t }: TelemetryPanelProps) {
  const heading = t?.heading ?? null;
  const headingDir = heading != null ? getCardinalDirection(heading) : BLANK_VALUE;

  return (
    <aside className="w-64 bg-panel border-r border-line flex flex-col shrink-0 overflow-y-auto">
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
        <SectionHeader title="POSITION" />
        <DataRow label="LATITUDE" value={formatHemisphereCoordinate(t?.latitude, 'N', 'S')} />
        <DataRow label="LONGITUDE" value={formatHemisphereCoordinate(t?.longitude, 'E', 'W')} />

        <SectionHeader title="KINEMATICS" />
        <DataRow label="ALTITUDE" value={formatFixed(t?.altitude, 0)} unit="m ASL" />
        <DataRow label="SPEED" value={formatFixed(t?.speed, 1)} unit="km/h" />
        <DataRow
          label="HEADING"
          value={t?.heading != null ? `${formatFixed(t.heading, 1)}°` : BLANK_VALUE}
          unit={headingDir !== BLANK_VALUE ? headingDir : ''}
        />

        <SectionHeader title="POWER" />
        <div className="py-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted tracking-widest uppercase">BATTERY</span>
          </div>
          <BatteryBar value={t?.battery} />
        </div>

        <SectionHeader title="TIMING" />
        <DataRow
          label="LAST PKT"
          value={formatUtcTime(t?.timestamp)}
          unit="UTC"
        />
      </div>

      <div className="mt-auto px-3 py-2 border-t border-line">
        <div className="text-[9px] text-muted tracking-widest">PLATFORM <span className="text-neon font-bold">{PRIMARY_DRONE_ID}</span></div>
        <div className="text-[9px] text-muted tracking-widest mt-0.5">
          FREQ <span className="text-neon">{PACKET_RATE_LABEL}</span>
        </div>
      </div>
    </aside>
  );
}
