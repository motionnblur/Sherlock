import type { CommandLogEntry, CommandStatus, CommandType } from '../interfaces/command';
import type { Geofence, GeofenceAlert, GeofencePoint } from '../interfaces/geofence';
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

function isGeofencePoint(value: unknown): value is GeofencePoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<GeofencePoint>;
  return (
    (candidate.id === undefined || candidate.id === null || typeof candidate.id === 'number')
    && typeof candidate.sequence === 'number'
    && isFiniteNumber(candidate.latitude)
    && isFiniteNumber(candidate.longitude)
  );
}

function isGeofence(value: unknown): value is Geofence {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Geofence> & { active?: unknown };
  const isActive = typeof candidate.isActive === 'boolean'
    ? candidate.isActive
    : (typeof candidate.active === 'boolean' ? candidate.active : null);

  if (isActive === null) {
    return false;
  }

  return (
    typeof candidate.id === 'number'
    && typeof candidate.name === 'string'
    && typeof candidate.createdAt === 'string'
    && Array.isArray(candidate.points)
    && candidate.points.every(isGeofencePoint)
  );
}

function normalizeGeofence(raw: unknown): Geofence | null {
  if (!isGeofence(raw)) {
    return null;
  }

  const candidate = raw as Geofence & { active?: unknown };
  const isActive = typeof candidate.isActive === 'boolean' ? candidate.isActive : Boolean(candidate.active);

  return {
    id: candidate.id,
    name: candidate.name,
    isActive,
    createdAt: candidate.createdAt,
    points: candidate.points,
  };
}

export function parseGeofenceListResponse(payload: unknown): Geofence[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map(normalizeGeofence)
    .filter((geofence): geofence is Geofence => geofence !== null);
}

export function parseGeofenceResponse(payload: unknown): Geofence | null {
  return normalizeGeofence(payload);
}

export function parseGeofenceAlertMessage(body: string): GeofenceAlert | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.droneId !== 'string'
      || typeof candidate.geofenceName !== 'string'
      || typeof candidate.eventType !== 'string'
      || typeof candidate.timestamp !== 'string'
      || !isFiniteNumber(candidate.geofenceId)
      || !isFiniteNumber(candidate.latitude)
      || !isFiniteNumber(candidate.longitude)
      || !isFiniteNumber(candidate.altitude)
    ) {
      return null;
    }

    if (candidate.eventType !== 'EXIT' && candidate.eventType !== 'ENTER') {
      return null;
    }

    return {
      droneId: candidate.droneId,
      geofenceId: candidate.geofenceId as number,
      geofenceName: candidate.geofenceName,
      eventType: candidate.eventType,
      latitude: candidate.latitude as number,
      longitude: candidate.longitude as number,
      altitude: candidate.altitude as number,
      timestamp: candidate.timestamp,
    };
  } catch {
    return null;
  }
}

const COMMAND_TYPES: CommandType[] = ['RTH', 'ARM', 'DISARM', 'TAKEOFF', 'GOTO'];
const COMMAND_STATUSES: CommandStatus[] = ['PENDING', 'SENT', 'ACKED', 'REJECTED', 'TIMEOUT', 'FAILED'];

function isCommandType(value: unknown): value is CommandType {
  return typeof value === 'string' && COMMAND_TYPES.includes(value as CommandType);
}

function isCommandStatus(value: unknown): value is CommandStatus {
  return typeof value === 'string' && COMMAND_STATUSES.includes(value as CommandStatus);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function parseCommandLifecycleMessage(body: string): CommandLogEntry | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    return normalizeCommandEntry(parsed);
  } catch {
    return null;
  }
}

export function parseCommandHistoryResponse(payload: unknown): CommandLogEntry[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const candidate = payload as { commands?: unknown };
  if (!Array.isArray(candidate.commands)) {
    return [];
  }
  return candidate.commands
    .map(normalizeCommandEntry)
    .filter((entry): entry is CommandLogEntry => entry !== null);
}

function normalizeCommandEntry(payload: unknown): CommandLogEntry | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.commandId !== 'string'
    || typeof candidate.droneId !== 'string'
    || !isCommandType(candidate.commandType)
    || !isCommandStatus(candidate.status)
    || !isIsoTimestamp(candidate.requestedAt)
    || !isIsoTimestamp(candidate.updatedAt)
    || (candidate.detail !== undefined && candidate.detail !== null && typeof candidate.detail !== 'string')
  ) {
    return null;
  }

  return {
    commandId: candidate.commandId,
    droneId: candidate.droneId,
    commandType: candidate.commandType,
    status: candidate.status,
    requestedAt: candidate.requestedAt,
    updatedAt: candidate.updatedAt,
    detail: (candidate.detail as string | null | undefined) ?? null,
  };
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
