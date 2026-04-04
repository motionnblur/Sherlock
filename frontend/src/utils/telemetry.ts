import type { TelemetryPoint } from '../interfaces/telemetry';

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

export function getLastTelemetryPoint(payload: unknown): TelemetryPoint | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  for (let index = payload.length - 1; index >= 0; index -= 1) {
    const entry = payload[index];
    if (isTelemetryPoint(entry)) {
      return entry;
    }
  }

  return null;
}
