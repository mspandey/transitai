// Smooth marker interpolation between two known GPS positions.
// Prevents the "snap" effect when telemetry updates arrive.

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Linearly interpolate between two positions.
 * @param from  previous known position
 * @param to    new position from telemetry
 * @param t     progress 0..1
 */
export function interpolate(from: LatLng, to: LatLng, t: number): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  }
}

/**
 * Creates a step-based animation from one position to another over `durationMs`.
 * Returns a cleanup function to cancel it.
 */
export function animateMarker(
  from: LatLng,
  to: LatLng,
  durationMs: number,
  onFrame: (pos: LatLng) => void,
): () => void {
  let cancelled = false
  const start = performance.now()

  function frame(now: number) {
    if (cancelled) return
    const elapsed = now - start
    const t = Math.min(elapsed / durationMs, 1)
    onFrame(interpolate(from, to, t))
    if (t < 1) requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
  return () => { cancelled = true }
}

/**
 * Validate that a lat/lng pair is usable.
 */
export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  )
}
