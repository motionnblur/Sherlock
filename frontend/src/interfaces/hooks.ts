import type { CommandLogEntry } from './command';
import type { GeofenceAlert } from './geofence';
import type { LowBatteryAlert, TelemetryByDrone, TelemetryPoint } from './telemetry';

export interface UseTelemetryResult {
  telemetry: TelemetryPoint | null;
  fleetTelemetry: TelemetryByDrone;
  connected: boolean;
  history: TelemetryPoint[];
  batteryAlerts: LowBatteryAlert[];
  geofenceAlerts: GeofenceAlert[];
  commandLog: CommandLogEntry[];
}
