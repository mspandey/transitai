// OSM/Leaflet fallback map — shown when Google Maps fails or quota is exceeded.
// This is the same grid visualization used in network.tsx, now extracted as a component.

interface BusMarker {
  id: string
  lat: number
  lng: number
  status: string
}

interface Props {
  buses: BusMarker[]
  notice?: string
}

const DEMO_ZONES = [
  { x: 22, y: 30, label: 'A · Riverside' },
  { x: 58, y: 20, label: 'B · Tech Park' },
  { x: 74, y: 64, label: 'C · Central Market' },
  { x: 34, y: 72, label: 'D · North Depot' },
]

export function MapFallback({ buses, notice }: Props) {
  return (
    <div className="relative w-full h-full min-h-[340px]">
      {notice && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-background/90 border border-border rounded-sm px-3 py-1.5">
          <span className="label-mono text-muted-foreground">{notice}</span>
        </div>
      )}
      {/* Dot-grid background */}
      <div className="absolute inset-0 grid-field opacity-40" />
      {/* Zone labels */}
      {DEMO_ZONES.map((z) => (
        <div
          key={z.label}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${z.x}%`, top: `${z.y}%` }}
        >
          <span className="label-mono bg-background/80 border border-border px-2 py-1 rounded-sm">
            {z.label}
          </span>
        </div>
      ))}
      {/* Bus dots */}
      {buses.map((b) => {
        const x = ((b.lng + 122.45) * 1000) % 100
        const y = ((37.80 - b.lat) * 1000) % 100
        return (
          <div
            key={b.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div
              className={`size-3 rounded-sm ${
                b.status === 'breakdown' ? 'bg-demand' : 'bg-signal'
              }`}
            />
            <span className="text-[9px] font-mono mt-1 opacity-70">{b.id}</span>
          </div>
        )
      })}
    </div>
  )
}
