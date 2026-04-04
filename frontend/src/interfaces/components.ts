import type { ReactNode } from 'react';
import type * as Cesium from 'cesium';
import type { DroneId, TelemetryPoint } from './telemetry';

export interface HeaderProps {
  connected: boolean;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  onToggleFreeMode: () => void;
  onDeselect: () => void;
}

export interface MapSettingsConfig {
  darkenPercent?: number;
}

export interface MapComponentProps {
  telemetry: TelemetryPoint | null;
  lowPerf: boolean;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  onSelectDrone: (id: DroneId) => void;
}

export interface DroneProps {
  viewer: Cesium.Viewer | null;
  telemetry: TelemetryPoint | null;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  lastKnown: TelemetryPoint | null;
  onLastKnownChange: (point: TelemetryPoint | null) => void;
}

export interface StatusBarProps {
  telemetry: TelemetryPoint | null;
  connected: boolean;
  selectedDrone: DroneId | null;
  freeMode: boolean;
  lowPerf: boolean;
  onToggleLowPerf: () => void;
}

export interface SystemPanelProps {
  telemetry: TelemetryPoint | null;
  history: TelemetryPoint[];
  connected: boolean;
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
