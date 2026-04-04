import { DRONE_IDS } from './telemetry';

export const AVAILABLE_ASSETS = DRONE_IDS.map(id => ({
  id,
  label: id,
  statusLabel: 'LIVE',
}));
