import type { DroneId } from '../interfaces/telemetry';

const DEFAULT_FLEET_SIZE = 5000;
const MIN_DRONE_ID_WIDTH = 2;

export const TOTAL_DRONE_COUNT = DEFAULT_FLEET_SIZE;
export const FLEET_LITE_TOPIC = '/topic/telemetry/lite/fleet';

function formatDroneId(index: number, fleetSize: number): DroneId {
  const idWidth = Math.max(MIN_DRONE_ID_WIDTH, String(fleetSize).length);
  return `SHERLOCK-${String(index).padStart(idWidth, '0')}`;
}

export const DRONE_IDS: DroneId[] = Array.from(
  { length: TOTAL_DRONE_COUNT },
  (_, index) => formatDroneId(index + 1, TOTAL_DRONE_COUNT),
);

export const PACKET_RATE_LABEL = '2 Hz';
export const TELEMETRY_HISTORY_LIMIT = 150;
export const FLIGHT_PATH_POINT_LIMIT = 200;
export const FREE_MODE_ASSET_LIST_HEIGHT_PX = 208;
export const SELECTION_ASSET_LIST_HEIGHT_PX = 384;
export const ASSET_LIST_ROW_HEIGHT_PX = 68;
export const ASSET_LIST_OVERSCAN_ROWS = 8;
