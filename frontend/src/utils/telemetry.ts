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
