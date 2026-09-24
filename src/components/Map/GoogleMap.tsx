// Google Maps component with animated bus markers and route polylines.
// Falls back to MapFallback when API is unavailable (quota or load error).

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/maps/mapsLoader'
import { animateMarker, isValidLatLng, type LatLng } from '@/lib/maps/markerInterpolation'
import { MapFallback } from './MapFallback'

export interface BusMarker {
  id: string
  lat: number
  lng: number
  status: string
}

export interface RoutePolyline {
  routeId: string
  stops: LatLng[]
  isDiversion?: boolean
}

interface Props {
  buses: BusMarker[]
  routes?: RoutePolyline[]
  center?: LatLng
}

const DEFAULT_CENTER = { lat: 37.774, lng: -122.419 }

export function GoogleMap({ buses, routes = [], center = DEFAULT_CENTER }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map())
  const prevPositionsRef = useRef<Map<string, LatLng>>(new Map())
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const cancelAnimsRef = useRef<Map<string, () => void>>(new Map())

  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'fallback'>('loading')

  // Initialize map
  useEffect(() => {
    loadGoogleMaps().then((ok) => {
      if (!ok) { setLoadState('fallback'); return }
      if (!containerRef.current) return
      mapRef.current = new google.maps.Map(containerRef.current, {
        center,
        zoom: 13,
        mapId: 'transit-ai-map',
        disableDefaultUI: false,
        gestureHandling: 'greedy',
      })
      setLoadState('loaded')
    })
  }, [])

  // Update bus markers with interpolated animation
  useEffect(() => {
    if (loadState !== 'loaded' || !mapRef.current) return

    buses.forEach((bus) => {
      if (!isValidLatLng(bus.lat, bus.lng)) {
        console.warn(`[Map] Skipping invalid coords for bus ${bus.id}`, bus.lat, bus.lng)
        return
      }

      const newPos = { lat: bus.lat, lng: bus.lng }
      const prevPos = prevPositionsRef.current.get(bus.id) || newPos

      // Cancel any existing animation for this bus
      cancelAnimsRef.current.get(bus.id)?.()

      // Get or create marker
      let marker = markersRef.current.get(bus.id)
      if (!marker) {
        const el = document.createElement('div')
        el.className = 'w-3 h-3 rounded-sm shadow-md'
        el.style.backgroundColor = bus.status === 'breakdown' ? '#ef4444' : '#22c55e'

        marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current,
          position: prevPos,
          content: el,
          title: bus.id,
        })
        markersRef.current.set(bus.id, marker)
      }

      // Animate to new position over 1 second (matches typical telemetry interval)
      const cancel = animateMarker(prevPos, newPos, 1000, (pos) => {
        if (marker) marker.position = pos
      })
      cancelAnimsRef.current.set(bus.id, cancel)
      prevPositionsRef.current.set(bus.id, newPos)
    })

    // Remove markers for buses no longer in list
    const currentIds = new Set(buses.map((b) => b.id))
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.map = null
        markersRef.current.delete(id)
      }
    })
  }, [buses, loadState])

  // Draw route polylines
  useEffect(() => {
    if (loadState !== 'loaded' || !mapRef.current) return

    // Clear old polylines
    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []

    routes.forEach((route) => {
      const validStops = route.stops.filter((s) => isValidLatLng(s.lat, s.lng))
      if (validStops.length < 2) return
      const polyline = new google.maps.Polyline({
        path: validStops,
        geodesic: true,
        strokeColor: route.isDiversion ? '#f59e0b' : '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: route.isDiversion ? 2 : 3,
        map: mapRef.current,
      })
      polylinesRef.current.push(polyline)
    })
  }, [routes, loadState])

  if (loadState === 'fallback') {
    return <MapFallback buses={buses} notice="Using OSM fallback — Google Maps quota exceeded" />
  }

  return (
    <div className="relative w-full h-full min-h-[340px]">
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <span className="label-mono animate-pulse">Loading map…</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full min-h-[340px]" />
    </div>
  )
}
