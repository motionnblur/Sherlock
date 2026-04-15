import SectionHeader from './SectionHeader';
import { BLANK_VALUE } from '../utils/formatters';
import type { PreflightChecklistProps } from '../interfaces/components';
import {
  BATTERY_WARN_THRESHOLD,
  PREFLIGHT_TELEMETRY_STALE_MS,
  PREFLIGHT_GPS_FIX_MIN,
  PREFLIGHT_SATELLITE_MIN,
  PREFLIGHT_RSSI_MIN,
} from '../constants/telemetry';

function CheckRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 border-b border-line">
      <span className="text-[10px] text-muted tracking-widest uppercase">
        {label}
      </span>
      <span
        className={`text-[10px] font-bold ${
          pass ? 'text-neon' : 'text-danger animate-blink'
        }`}
      >
        {pass ? '●' : '○'}
      </span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 border-b border-line last:border-0">
      <span className="text-[10px] text-muted tracking-widest uppercase">
        {label}
      </span>
      <span className={`text-[10px] font-bold ${colorClass}`}>{value}</span>
    </div>
  );
}

export default function PreflightChecklist({
  connected,
  telemetry: t,
  selectedDroneId,
  hasActiveGeofence,
  activeGeofenceCount,
}: PreflightChecklistProps) {
  const telemetryAgeMs = t
    ? Date.now() - new Date(t.timestamp).getTime()
    : Infinity;

  const checks = {
    dataLink: connected,
    telemetry: telemetryAgeMs <= PREFLIGHT_TELEMETRY_STALE_MS,
    gpsFix: (t?.fixType ?? 0) >= PREFLIGHT_GPS_FIX_MIN,
    satellites: (t?.satelliteCount ?? 0) >= PREFLIGHT_SATELLITE_MIN,
    battery: (t?.battery ?? 0) > BATTERY_WARN_THRESHOLD,
    rfLink: (t?.rssi ?? 0) >= PREFLIGHT_RSSI_MIN,
    // 0,0 dead zone: some MAVLink firmware reports null fix as exact 0,0
    positionLock:
      t != null &&
      t.latitude != null &&
      t.longitude != null &&
      (Math.abs(t.latitude) > 0.0001 || Math.abs(t.longitude) > 0.0001),
  };
  const isGo = Object.values(checks).every(Boolean);

  const armLabel =
    t?.isArmed === true ? '⚠ ARMED' : t?.isArmed === false ? 'SAFE' : null;
  const armColor =
    t?.isArmed === true
      ? 'text-danger animate-blink'
      : t?.isArmed === false
        ? 'text-neon'
        : 'text-muted';

  const modeLabel = t?.flightMode ?? null;

  const droneTypeLabel = selectedDroneId?.startsWith('MAVLINK-')
    ? 'REAL DRONE'
    : selectedDroneId?.startsWith('SHERLOCK-')
      ? 'SIMULATED'
      : null;
  const droneTypeColor = selectedDroneId?.startsWith('MAVLINK-')
    ? 'text-caution'
    : 'text-muted';

  const geofenceLabel = hasActiveGeofence
    ? `ACTIVE (${activeGeofenceCount})`
    : 'NONE';
  const geofenceColor = hasActiveGeofence ? 'text-caution' : 'text-muted';

  return (
    <div className="mb-1">
      <SectionHeader title="PREFLIGHT" />

      <div
        className={`w-full py-1.5 text-center text-[10px] font-bold tracking-widest border mb-1 ${
          isGo
            ? 'border-neon text-neon bg-elevated'
            : 'border-danger text-danger bg-elevated animate-blink'
        }`}
      >
        {isGo ? '◈ GO' : '○ NO GO'}
      </div>

      <CheckRow label="DATA LINK" pass={checks.dataLink} />
      <CheckRow label="TELEMETRY" pass={checks.telemetry} />
      <CheckRow label="GPS FIX" pass={checks.gpsFix} />
      <CheckRow label="SATELLITES" pass={checks.satellites} />
      <CheckRow label="BATTERY" pass={checks.battery} />
      <CheckRow label="RF LINK" pass={checks.rfLink} />
      <CheckRow label="POSITION" pass={checks.positionLock} />

      <div className="border-t border-line mt-0.5 pt-0.5">
        <InfoRow
          label="ARM STATE"
          value={armLabel ?? BLANK_VALUE}
          colorClass={armColor}
        />
        <InfoRow
          label="FLIGHT MODE"
          value={modeLabel ?? BLANK_VALUE}
          colorClass={modeLabel ? 'text-neon' : 'text-muted'}
        />
        <InfoRow
          label="MAVLINK"
          value={droneTypeLabel ?? BLANK_VALUE}
          colorClass={droneTypeColor}
        />
        <InfoRow
          label="GEOFENCE"
          value={geofenceLabel}
          colorClass={geofenceColor}
        />
      </div>
    </div>
  );
}
