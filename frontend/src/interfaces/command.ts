import type { DroneId } from './telemetry';

export type CommandType = 'RTH' | 'ARM' | 'DISARM' | 'TAKEOFF' | 'GOTO';

export type CommandStatus = 'PENDING' | 'SENT' | 'ACKED' | 'REJECTED' | 'TIMEOUT' | 'FAILED';

export interface CommandLogEntry {
  commandId: string;
  droneId: DroneId;
  commandType: CommandType;
  status: CommandStatus;
  requestedAt: string;
  updatedAt: string;
  detail?: string | null;
}
