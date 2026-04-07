export type MissionStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';
export type WaypointStatus = 'PENDING' | 'ACTIVE' | 'REACHED' | 'SKIPPED';
export type MissionGizmoAxis = 'X' | 'Y' | 'Z';

export interface MissionWaypointPosition {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface MissionWaypoint {
  localId?: number;      // present only for editable in-memory waypoints
  id: number | null;     // null for in-memory planning waypoints not yet saved
  sequence: number;
  latitude: number;
  longitude: number;
  altitude: number;
  label?: string;
  status: WaypointStatus;
}

export interface Mission {
  id: number;
  name: string;
  droneId: string | null;
  status: MissionStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  waypoints: MissionWaypoint[];
}

/** In-memory waypoint being drawn on the map before the mission is saved. */
export interface PlanningWaypoint {
  localId: number;
  latitude: number;
  longitude: number;
  altitude: number;
  label?: string;
}

export interface UseMissionResult {
  missions: Mission[];
  activeMission: Mission | null;
  isLoading: boolean;
  missionError: string | null;
  createMission: (name: string, waypoints: PlanningWaypoint[]) => Promise<Mission | null>;
  updateMission: (missionId: number, name: string, waypoints: PlanningWaypoint[]) => Promise<Mission | null>;
  executeMission: (missionId: number, droneId: string) => Promise<boolean>;
  abortMission: (missionId: number) => Promise<boolean>;
  deleteMission: (missionId: number) => Promise<boolean>;
  refreshMissions: () => Promise<void>;
}
