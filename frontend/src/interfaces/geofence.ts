export type GeofenceEventType = 'EXIT' | 'ENTER';

export interface GeofencePointInput {
  sequence: number;
  latitude: number;
  longitude: number;
}

export interface GeofencePoint extends GeofencePointInput {
  id?: number | null;
}

export interface Geofence {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  points: GeofencePoint[];
}

export interface GeofenceRequest {
  name: string;
  isActive?: boolean;
  points: GeofencePointInput[];
}

export interface GeofenceAlert {
  droneId: string;
  geofenceId: number;
  geofenceName: string;
  eventType: GeofenceEventType;
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: string;
}

export interface UseGeofencesResult {
  geofences: Geofence[];
  isLoading: boolean;
  geofenceError: string | null;
  refreshGeofences: () => Promise<void>;
  createGeofence: (request: GeofenceRequest) => Promise<Geofence | null>;
  updateGeofence: (geofenceId: number, request: GeofenceRequest) => Promise<Geofence | null>;
  deleteGeofence: (geofenceId: number) => Promise<boolean>;
  setGeofenceActive: (geofenceId: number, isActive: boolean) => Promise<Geofence | null>;
}
