import type { TelemetryPoint } from './telemetry';

export interface UseTelemetryResult {
  telemetry: TelemetryPoint | null;
  connected: boolean;
  history: TelemetryPoint[];
}
