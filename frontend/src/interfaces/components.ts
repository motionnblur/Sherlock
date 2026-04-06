import type { ReactNode } from 'react';
import type { PerformanceStage } from '../constants/performance';
import type { CommandType } from '../hooks/useCommand';
import type { DroneId, LowBatteryAlert, NavigationDirection, TelemetryByDrone, TelemetryPoint } from './telemetry';

export interface HeaderProps {
  connected: boolean;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  isLiveVideoOpen: boolean;
  showAllAssets: boolean;
  selectedNavigationDirection: NavigationDirection;
  onToggleFreeMode: () => void;
  onDeselect: () => void;
  onToggleLiveVideo: () => void;
  onToggleShowAllAssets: () => void;
  onSelectNavigationDirection: (direction: NavigationDirection) => void;
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
  performanceStage: PerformanceStage;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  showAllAssets: boolean;
  selectedNavigationDirection: NavigationDirection;
  onSelectDrone: (id: DroneId) => void;
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
  onSendCommand: (commandType: CommandType) => Promise<void>;
  isCommandSending: boolean;
  commandError: string | null;
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
