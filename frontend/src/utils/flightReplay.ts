import type { TelemetryPoint } from '../interfaces/telemetry';

const CSV_COLUMNS = [
  'timestamp',
  'droneId',
  'latitude',
  'longitude',
  'altitude',
  'speed',
  'battery',
  'heading',
  'roll',
  'pitch',
  'hdop',
  'satelliteCount',
  'fixType',
  'rssi',
  'isArmed',
  'flightMode',
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

const CSV_VALUE_GETTERS: Record<CsvColumn, (point: TelemetryPoint) => unknown> = {
  timestamp: (point) => point.timestamp,
  droneId: (point) => point.droneId,
  latitude: (point) => point.latitude,
  longitude: (point) => point.longitude,
  altitude: (point) => point.altitude,
  speed: (point) => point.speed,
  battery: (point) => point.battery,
  heading: (point) => point.heading,
  roll: (point) => point.roll,
  pitch: (point) => point.pitch,
  hdop: (point) => point.hdop,
  satelliteCount: (point) => point.satelliteCount,
  fixType: (point) => point.fixType,
  rssi: (point) => point.rssi,
  isArmed: (point) => point.isArmed,
  flightMode: (point) => point.flightMode,
};

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const valueText = String(value);
  if (!/[",\n]/.test(valueText)) {
    return valueText;
  }
  return `"${valueText.replace(/"/g, '""')}"`;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

export function buildFlightReplayCsv(points: TelemetryPoint[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = points.map((point) => {
    return CSV_COLUMNS.map((column) => toCsvCell(CSV_VALUE_GETTERS[column](point))).join(',');
  });
  return [header, ...rows].join('\n');
}

export function buildFlightReplayFileName(droneId: string, startIso: string, endIso: string): string {
  const safeDroneId = sanitizeFilePart(droneId);
  const safeStart = sanitizeFilePart(startIso);
  const safeEnd = sanitizeFilePart(endIso);
  return `flight-replay-${safeDroneId}-${safeStart}-${safeEnd}.csv`;
}
