export interface TelemetryPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  speed?: number;
  battery?: number;
  heading: number;
  timestamp: string;
}

export type DroneId = 'SHERLOCK-01';
