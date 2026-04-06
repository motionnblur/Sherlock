const EARTH_RADIUS_METERS = 6_371_000;

export function horizontalDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const latitudeARadians = toRadians(latitudeA);
  const latitudeBRadians = toRadians(latitudeB);
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeARadians) * Math.cos(latitudeBRadians) * Math.sin(deltaLongitude / 2) ** 2;

  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_METERS * angularDistance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
