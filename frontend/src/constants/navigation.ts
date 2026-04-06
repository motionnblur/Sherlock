import type { NavigationDirection } from '../interfaces/telemetry';

const CARDINAL_DIRECTIONS: NavigationDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const NAVIGATION_DIRECTION_ALL: NavigationDirection = 'ALL';
export const NAVIGATION_DIRECTIONS: NavigationDirection[] = [
  NAVIGATION_DIRECTION_ALL,
  ...CARDINAL_DIRECTIONS,
];
export const HEADING_SECTOR_DEGREES = 45;
