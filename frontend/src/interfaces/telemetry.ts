export type DroneId = string;

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

export type TelemetryByDrone = Record<DroneId, TelemetryPoint>;

export interface LowBatteryAlert {
  droneId: DroneId;
  battery: number;
  isCritical: boolean;
}
