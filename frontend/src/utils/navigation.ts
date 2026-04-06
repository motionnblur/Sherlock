import { HEADING_SECTOR_DEGREES, NAVIGATION_DIRECTION_ALL } from '../constants/navigation';
import type { NavigationDirection } from '../interfaces/telemetry';

const FULL_CIRCLE_DEGREES = 360;
const CARDINAL_DIRECTIONS: Exclude<NavigationDirection, 'ALL'>[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function normalizeHeading(heading: number): number {
  return ((heading % FULL_CIRCLE_DEGREES) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
}

export function getNavigationDirectionByHeading(heading: number): Exclude<NavigationDirection, 'ALL'> {
  const normalizedHeading = normalizeHeading(heading);
  const directionIndex = Math.round(normalizedHeading / HEADING_SECTOR_DEGREES) % CARDINAL_DIRECTIONS.length;
  return CARDINAL_DIRECTIONS[directionIndex];
}

export function matchesNavigationDirection(heading: number, selectedDirection: NavigationDirection): boolean {
  if (selectedDirection === NAVIGATION_DIRECTION_ALL) {
    return true;
  }
  return getNavigationDirectionByHeading(heading) === selectedDirection;
}
