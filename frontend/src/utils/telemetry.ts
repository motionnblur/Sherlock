import type { TelemetryByDrone, TelemetryPoint } from '../interfaces/telemetry';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isTelemetryPoint(value: unknown): value is TelemetryPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TelemetryPoint>;

  return (
    typeof candidate.droneId === 'string'
    && isFiniteNumber(candidate.latitude)
    && isFiniteNumber(candidate.longitude)
    && isFiniteNumber(candidate.altitude)
    && (candidate.speed === undefined || isFiniteNumber(candidate.speed))
    && (candidate.battery === undefined || isFiniteNumber(candidate.battery))
    && isFiniteNumber(candidate.heading)
    && typeof candidate.timestamp === 'string'
    // Extended fields are optional — allow any value including null/undefined
    && (candidate.roll === undefined || candidate.roll === null || isFiniteNumber(candidate.roll))
    && (candidate.pitch === undefined || candidate.pitch === null || isFiniteNumber(candidate.pitch))
    && (candidate.hdop === undefined || candidate.hdop === null || isFiniteNumber(candidate.hdop))
    && (candidate.satelliteCount === undefined || candidate.satelliteCount === null || typeof candidate.satelliteCount === 'number')
    && (candidate.fixType === undefined || candidate.fixType === null || typeof candidate.fixType === 'number')
    && (candidate.rssi === undefined || candidate.rssi === null || typeof candidate.rssi === 'number')
    && (candidate.isArmed === undefined || candidate.isArmed === null || typeof candidate.isArmed === 'boolean')
    && (candidate.flightMode === undefined || candidate.flightMode === null || typeof candidate.flightMode === 'string')
  );
}

export function parseTelemetryMessage(messageBody: string): TelemetryPoint | null {
  try {
    const parsed = JSON.parse(messageBody) as unknown;
    return isTelemetryPoint(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseTelemetryListMessage(messageBody: string): TelemetryPoint[] {
  try {
    const parsed = JSON.parse(messageBody) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTelemetryPoint);
  } catch {
    return [];
  }
}

export function parseBatteryAlertMessage(body: string): { droneId: string; battery: number } | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.droneId !== 'string' || !isFiniteNumber(candidate.battery)) {
      return null;
    }
    return { droneId: candidate.droneId, battery: candidate.battery as number };
  } catch {
    return null;
  }
}

export function parseLastKnownTelemetryMap(payload: unknown): TelemetryByDrone {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const response = payload as { telemetry?: unknown };
  if (!Array.isArray(response.telemetry)) {
    return {};
  }

  return response.telemetry.reduce<TelemetryByDrone>((accumulator, entry) => {
    if (isTelemetryPoint(entry)) {
      accumulator[entry.droneId] = entry;
    }
    return accumulator;
  }, {});
}
