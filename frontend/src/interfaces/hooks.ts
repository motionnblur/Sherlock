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

export interface UseFlightReplayResult {
  rangeStartLocal: string;
  rangeEndLocal: string;
  setRangeStartLocal: (value: string) => void;
  setRangeEndLocal: (value: string) => void;
  isLoading: boolean;
  replayError: string | null;
  replayPoints: TelemetryPoint[];
  currentIndex: number;
  currentPoint: TelemetryPoint | null;
  isPlaying: boolean;
  loadReplay: () => Promise<void>;
  togglePlayback: () => void;
  seekToIndex: (index: number) => void;
  clearReplay: () => void;
  exportCsv: () => void;
}
