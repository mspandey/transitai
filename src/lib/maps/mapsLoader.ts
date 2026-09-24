// Google Maps JS API loader with quota error detection.
// Falls back to Leaflet/OSM if quota is exceeded or load fails.

import { Loader } from '@googlemaps/js-api-loader'

let loaderInstance: Loader | null = null
let loadState: 'idle' | 'loading' | 'loaded' | 'error' | 'quota' = 'idle'
let loadError: string | null = null

export type MapLoadState = typeof loadState

export function getMapLoadState() {
  return { state: loadState, error: loadError }
}

export async function loadGoogleMaps(): Promise<boolean> {
  if (loadState === 'loaded') return true
  if (loadState === 'error' || loadState === 'quota') return false

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey || apiKey.includes('Placeholder')) {
    loadState = 'error'
    loadError = 'Google Maps API key not configured'
    return false
  }

  try {
    loadState = 'loading'
    loaderInstance = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['maps', 'marker'],
    })
    await loaderInstance.load()
    loadState = 'loaded'
    return true
  } catch (err: any) {
    const msg = err?.message || String(err)
    // Quota errors come back as "ApiProjectMapError" or contain "quota"
    if (msg.toLowerCase().includes('quota') || msg.includes('ApiProjectMapError')) {
      loadState = 'quota'
      loadError = 'Google Maps quota exceeded — falling back to OSM'
    } else {
      loadState = 'error'
      loadError = msg
    }
    console.warn('[Maps]', loadError)
    return false
  }
}
