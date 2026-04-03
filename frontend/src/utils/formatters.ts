export const BLANK_VALUE = '---';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatFixed(
  value: number | null | undefined,
  decimals = 2,
  fallback = BLANK_VALUE,
): string {
  if (value == null) {
    return fallback;
  }

  return value.toFixed(decimals);
}

export function formatHemisphereCoordinate(
  value: number | null | undefined,
  positiveLabel: string,
  negativeLabel: string,
  decimals = 6,
): string {
  if (value == null) {
    return BLANK_VALUE;
  }

  const hemisphere = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(decimals)}°${hemisphere}`;
}

export function formatCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  decimals = 4,
): string {
  if (latitude == null || longitude == null) {
    return BLANK_VALUE;
  }

  const formattedLatitude = formatHemisphereCoordinate(latitude, 'N', 'S', decimals);
  const formattedLongitude = formatHemisphereCoordinate(longitude, 'E', 'W', decimals);

  return `${formattedLatitude}, ${formattedLongitude}`;
}

export function formatUtcTime(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return BLANK_VALUE;
  }

  return new Date(timestamp).toISOString().slice(11, 19);
}

export function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % directions.length];
}
