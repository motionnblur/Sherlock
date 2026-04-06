export type DroneId = string;
export type NavigationDirection = 'ALL' | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface TelemetryPoint {
  droneId: DroneId;
  latitude: number;
  longitude: number;
  altitude: number;
  speed?: number;
  battery?: number;
  heading: number;
  timestamp: string;

  // Extended fields — present for full-stream drones (not in lite fleet stream)
  roll?: number;           // degrees, negative = left bank
  pitch?: number;          // degrees, negative = nose down
  hdop?: number;           // horizontal dilution of precision
  satelliteCount?: number;
  fixType?: number;        // 0=no fix, 2=2D, 3=3D, 4=DGPS, 5=RTK float, 6=RTK fixed
  rssi?: number;           // 0–100 percent
  isArmed?: boolean;
  flightMode?: string;
}

export type TelemetryByDrone = Record<DroneId, TelemetryPoint>;

export interface LowBatteryAlert {
  droneId: DroneId;
  battery: number;
  isCritical: boolean;
}

export type DriverWaypointStatus = 'queued' | 'active' | 'reached' | 'failed';

export interface DriverWaypoint {
  id: number;
  latitude: number;
  longitude: number;
  altitude: number;
  status: DriverWaypointStatus;
}
