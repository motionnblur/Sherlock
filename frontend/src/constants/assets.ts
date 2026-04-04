import { PRIMARY_DRONE_ID } from './telemetry';

export const AVAILABLE_ASSETS = [
  {
    id: PRIMARY_DRONE_ID,
    label: 'SHERLOCK-01',
    statusLabel: 'LIVE',
  },
] as const;
