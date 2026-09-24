import { useEffect, useState } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { nearestStops, type Stop } from '@/lib/geo/nearestStops'
import { supabase } from '@/lib/supabase'

interface Props {
  onSelect: (stop: Stop) => void
}

export function NearbyStopsSuggestion({ onSelect }: Props) {
  const geo = useGeolocation()
  const [nearby, setNearby] = useState<Array<Stop & { distanceKm: number }>>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (geo.status !== 'success') return
    ;(async () => {
      const { data: stops } = await supabase.from('stops').select('id, name, lat, lng')
      if (!stops) return
      const results = nearestStops(geo.lat, geo.lng, stops, 2, 3)
      setNearby(results)
      setLoaded(true)
    })()
  }, [geo.status === 'success'])

  // Graceful fallback — don't show anything if denied/unsupported
  if (geo.status === 'denied' || geo.status === 'unsupported') return null

  if (geo.status === 'loading' || geo.status === 'idle') {
    return (
      <p className="label-mono mt-3 animate-pulse">Detecting your location…</p>
    )
  }

  if (loaded && nearby.length === 0) {
    return (
      <div className="mt-4 rounded-sm border border-border p-4">
        <p className="text-sm text-muted-foreground">
          No transit stops found within 2 km. Use the search above to find stops citywide.
        </p>
      </div>
    )
  }

  if (!loaded) return null

  return (
    <div className="mt-4">
      <p className="label-mono mb-2">Nearby stops</p>
      <div className="grid gap-2">
        {nearby.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="flex items-center justify-between rounded-sm border border-border px-4 py-3 text-left text-sm transition-colors hover:border-signal hover:bg-signal/5"
          >
            <span>{s.name}</span>
            <span className="label-mono text-muted-foreground">
              {(s.distanceKm * 1000).toFixed(0)} m
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
