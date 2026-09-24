// Haversine nearest-stop computation — runs in the browser against the stops list.
// HACKATHON NOTE: For production use a Postgres ST_DWithin query instead.

export interface Stop {
  id: string
  name: string
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/**
 * Returns up to `maxCount` stops within `radiusKm`, sorted by distance.
 */
export function nearestStops(
  userLat: number,
  userLng: number,
  stops: Stop[],
  radiusKm = 2,
  maxCount = 3,
): Array<Stop & { distanceKm: number }> {
  return stops
    .map((s) => ({ ...s, distanceKm: haversineKm(userLat, userLng, s.lat, s.lng) }))
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxCount)
}
