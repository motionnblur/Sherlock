export interface TelemetryPoint {
  droneId: DroneId;
  latitude: number;
  longitude: number;
  altitude: number;
  speed?: number;
  battery?: number;
  heading: number;
  timestamp: string;
}

export type DroneId = 'SHERLOCK-01' | 'SHERLOCK-02' | 'SHERLOCK-03' | 'SHERLOCK-04' | 'SHERLOCK-05';
