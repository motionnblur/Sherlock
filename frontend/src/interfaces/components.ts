import type { ReactNode } from 'react';
import type { PerformanceStage } from '../constants/performance';
import type { CommandType } from '../hooks/useCommand';
import type { Geofence, GeofenceAlert, GeofencePointInput } from './geofence';
import type { DriverWaypoint, DroneId, LowBatteryAlert, NavigationDirection, TelemetryByDrone, TelemetryPoint } from './telemetry';
import type {
  Mission,
  MissionGizmoAxis,
  MissionWaypoint,
  MissionWaypointPosition,
  PlanningWaypoint,
  UseMissionResult,
} from './mission';

export interface HeaderProps {
  connected: boolean;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  isLiveVideoOpen: boolean;
  showAllAssets: boolean;
  selectedNavigationDirection: NavigationDirection;
  isMissionModeEnabled: boolean;
  isGeofenceModeEnabled: boolean;
  onToggleFreeMode: () => void;
  onDeselect: () => void;
  onToggleLiveVideo: () => void;
  onToggleShowAllAssets: () => void;
  onSelectNavigationDirection: (direction: NavigationDirection) => void;
  onToggleMissionMode: () => void;
  onToggleGeofenceMode: () => void;
  onLogout: () => void;
}

export interface LiveVideoWindowProps {
  streamUrl: string | null;
  isFetching: boolean;
  fetchError: string | null;
  onClose: () => void;
}

export interface MapSettingsConfig {
  darkenPercent?: number;
}

export interface MapComponentProps {
  droneIds: DroneId[];
  telemetry: TelemetryPoint | null;
  fleetTelemetry: TelemetryByDrone;
  lastKnownTelemetry: TelemetryByDrone;
  geofences: Geofence[];
  performanceStage: PerformanceStage;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  showAllAssets: boolean;
  selectedNavigationDirection: NavigationDirection;
  isDriverModeEnabled: boolean;
  isGeofenceModeEnabled: boolean;
  driverWaypoints: DriverWaypoint[];
  onAddDriverWaypoint: (latitude: number, longitude: number) => void;
  onSelectDrone: (id: DroneId) => void;
  isMissionModeEnabled: boolean;
  geofenceDraftName: string;
  geofenceDraftPoints: GeofencePointInput[];
  isGeofenceSaving: boolean;
  geofenceError: string | null;
  onAddGeofenceVertex: (latitude: number, longitude: number) => void;
  onUpdateGeofenceDraftName: (name: string) => void;
  onCompleteGeofenceDrawing: () => Promise<void>;
  onCancelGeofenceDrawing: () => void;
  /** Planning waypoints (in-memory, not yet saved) OR active mission waypoints */
  missionWaypoints: MissionWaypoint[];
  isMissionWaypointEditingEnabled: boolean;
  selectedMissionWaypointLocalId: number | null;
  onAddMissionWaypoint: (latitude: number, longitude: number) => void;
  onSelectMissionWaypoint: (localId: number | null) => void;
  onMoveMissionWaypoint: (localId: number, position: MissionWaypointPosition) => void;
}

export interface MissionPlanningPanelProps {
  selectedDrone: DroneId | null;
  selectedMissionWaypointLocalId: number | null;
  planningWaypoints: PlanningWaypoint[];
  editingMissionId: number | null;
  editingMissionName: string;
  editingWaypoints: PlanningWaypoint[];
  activeMission: Mission | null;
  missions: UseMissionResult['missions'];
  isLoading: boolean;
  missionError: string | null;
  onSelectMissionWaypoint: (localId: number | null) => void;
  onRemovePlanningWaypoint: (localId: number) => void;
  onClearPlanningWaypoints: () => void;
  onSaveMission: (name: string) => Promise<void>;
  onStartEditMission: (missionId: number) => void;
  onCancelEditMission: () => void;
  onUpdateEditingMissionName: (name: string) => void;
  onSaveEditedMission: () => Promise<void>;
  onRemoveEditingWaypoint: (localId: number) => void;
  onNudgeMissionWaypoint: (axis: MissionGizmoAxis, distanceMeters: number) => void;
  onExecuteMission: (missionId: number) => Promise<void>;
  onAbortMission: (missionId: number) => Promise<void>;
  onDeleteMission: (missionId: number) => Promise<void>;
}

export interface AssetWindowProps {
  droneIds: DroneId[];
  selectedDrone: DroneId | null;
  onActivateDrone: (id: DroneId) => void;
}

export interface StatusBarProps {
  telemetry: TelemetryPoint | null;
  connected: boolean;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  performanceStage: PerformanceStage;
  onCyclePerformanceStage: () => void;
}

export interface SystemPanelProps {
  telemetry: TelemetryPoint | null;
  history: TelemetryPoint[];
  connected: boolean;
  onSendCommand: (commandType: CommandType) => Promise<boolean>;
  isCommandSending: boolean;
  commandError: string | null;
  isDriverModeEnabled: boolean;
  isDriverModeAvailable: boolean;
  onToggleDriverMode: () => void;
  driverWaypointCount: number;
}

export interface AttitudeIndicatorProps {
  roll?: number;
  pitch?: number;
  size?: number;
}

export interface MissionClockProps {
  started: boolean;
}

export interface AltitudeTrendProps {
  history: TelemetryPoint[];
}

export interface CompassRoseProps {
  heading: number | null | undefined;
}

export interface LogEntryProps {
  entry: TelemetryPoint;
  index: number;
}

export interface SectionHeaderProps {
  title: string;
}

export interface TelemetryPanelProps {
  telemetry: TelemetryPoint | null;
}

export interface BatteryBarProps {
  value: number | null | undefined;
}

export interface TelemetryDataRowProps {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: boolean;
  critical?: boolean;
}

export interface LowBatteryWindowProps {
  alerts: LowBatteryAlert[];
}

export interface GeofenceAlertWindowProps {
  alerts: GeofenceAlert[];
}

export interface GeofenceDrawToolbarProps {
  isEnabled: boolean;
  vertexCount: number;
  draftName: string;
  isSaving: boolean;
  error: string | null;
  onUpdateDraftName: (name: string) => void;
  onFinish: () => Promise<void>;
  onCancel: () => void;
}
