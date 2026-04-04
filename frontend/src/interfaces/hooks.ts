import type { TelemetryByDrone, TelemetryPoint } from './telemetry';

export interface UseTelemetryResult {
  telemetry: TelemetryPoint | null;
  fleetTelemetry: TelemetryByDrone;
  connected: boolean;
  history: TelemetryPoint[];
}
