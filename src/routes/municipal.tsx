import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { requireMunicipalRole } from '@/lib/municipal/requireMunicipalRole'
import { Logo } from '@/components/transit/chrome'
import { GoogleMap } from '@/components/Map/GoogleMap'

export const Route = createFileRoute('/municipal')({
  beforeLoad: async () => {
    // Server-side role check — throws redirect if not municipal
    await requireMunicipalRole()
  },
  head: () => ({
    meta: [
      { title: 'Municipal Control — Transit AI' },
      { name: 'description', content: 'Official municipal transit control dashboard.' },
    ],
  }),
  component: MunicipalPage,
})

type Bus = {
  id: string; capacity: number; current_lat: number; current_lng: number;
  status: string; allocation_frozen: boolean; last_telemetry_at: string;
  current_route_id: string | null; version: number;
}
type AlertRow = { id: string; type: string; severity: string; message: string; related_bus_id: string; resolved_at: string | null }
type Allocation = { id: string; bus_id: string; zone_id: string; score: number; status: string; version: number }
type RouteStop = { stop_id: string; sequence_order: number; stops: { id: string; name: string; lat: number; lng: number } }

function MunicipalPage() {
  const [fleet, setFleet] = useState<Bus[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null)
  const [busStops, setBusStops] = useState<RouteStop[]>([])
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const fetchAll = async () => {
      const [bRes, aRes, allRes] = await Promise.all([
        supabase.from('buses').select('*'),
        supabase.from('alerts').select('*').is('resolved_at', null).order('created_at', { ascending: false }),
        supabase.from('allocations').select('*').eq('status', 'recommended').order('score', { ascending: false }),
      ])
      if (bRes.data) { setFleet(bRes.data); setLastUpdated(new Date()); setIsStale(false) }
      if (aRes.data) setAlerts(aRes.data)
      if (allRes.data) setAllocations(allRes.data)
    }

    fetchAll()

    const channel = supabase.channel('municipal-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, ({ new: b }) => {
        setFleet(prev => prev.map(bus => bus.id === (b as Bus).id ? b as Bus : bus))
        setLastUpdated(new Date()); setIsStale(false)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, ({ new: a }) => {
        setAlerts(prev => [a as AlertRow, ...prev])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, () => {
        fetchAll()
      })
      .subscribe((status) => {
        // If subscription fails, data is stale
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsStale(true)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadBusStops = async (bus: Bus) => {
    setSelectedBus(bus)
    setBusStops([])
    setConflictMsg(null)
    if (!bus.current_route_id) return

    const { data } = await supabase
      .from('route_stops')
      .select('stop_id, sequence_order, stops(id, name, lat, lng)')
      .eq('route_id', bus.current_route_id)
      .order('sequence_order')

    setBusStops((data as RouteStop[]) || [])
  }

  const handleAllocation = async (alloc: Allocation, action: 'approved' | 'rejected') => {
    setConflictMsg(null)
    const { error } = await supabase
      .from('allocations')
      .update({ status: action, version: alloc.version + 1 })
      .eq('id', alloc.id)
      .eq('version', alloc.version) // Optimistic concurrency check

    if (error || !error) {
      // Check if no rows were updated (version mismatch = concurrent edit)
      const { data: refreshed } = await supabase.from('allocations').select('version').eq('id', alloc.id).single()
      if (refreshed && refreshed.version !== alloc.version + 1) {
        setConflictMsg('This allocation was just updated by another officer — refresh to see the latest.')
        // Log conflict for audit
        await supabase.from('override_conflicts').insert([{
          target_table: 'allocations',
          target_id: alloc.id,
          details: { attempted_action: action, expected_version: alloc.version },
        }])
        return
      }
    }
    // Refresh list
    const { data } = await supabase.from('allocations').select('*').eq('status', 'recommended')
    if (data) setAllocations(data)
  }

  const now = Date.now()
  const processedFleet = fleet.map(b => ({
    ...b,
    isSignalLost: (now - new Date(b.last_telemetry_at).getTime()) > 90000,
    delay: Math.floor(Math.random() * 8), // TODO: compute from actual ETA vs arrival
  }))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-4">
          <Logo compact />
          <span className="label-mono text-muted-foreground">Municipal Control Dashboard</span>
        </div>
        <div className="flex items-center gap-5">
          {isStale && lastUpdated && (
            <div className="flex items-center gap-2 rounded-sm border border-warn/30 bg-warn/10 px-3 py-1">
              <span className="size-1.5 rounded-full bg-warn" />
              <span className="label-mono text-warn">
                Stale data as of {lastUpdated.toLocaleTimeString()} — telemetry offline
              </span>
            </div>
          )}
          <Link to="/network" className="label-mono hover:text-foreground">Dev Network →</Link>
        </div>
      </header>

      {conflictMsg && (
        <div className="mx-6 mt-4 rounded-sm border border-demand/30 bg-demand/10 px-4 py-3">
          <p className="text-sm text-demand">{conflictMsg}</p>
        </div>
      )}

      <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[1fr_380px]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Google Map with live buses */}
          <div className="panel overflow-hidden" style={{ height: '380px' }}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="label-mono">Live network map</span>
              <span className="label-mono text-ok">● Supabase Realtime</span>
            </div>
            <GoogleMap
              buses={processedFleet.map(b => ({
                id: b.id,
                lat: b.current_lat,
                lng: b.current_lng,
                status: b.status,
              }))}
              center={{ lat: 37.774, lng: -122.419 }}
            />
          </div>

          {/* Bus list */}
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <span className="label-mono">Live fleet · click a bus for stop details</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Vehicle', 'Status', 'Delay', 'Route', 'Flags'].map(h => (
                    <th key={h} className="label-mono px-4 py-2 text-left font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedFleet.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => loadBusStops(b)}
                    className={`border-b border-border/60 cursor-pointer hover:bg-secondary transition-colors ${selectedBus?.id === b.id ? 'bg-signal/5' : ''} ${b.isSignalLost ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{b.id}</td>
                    <td className="px-4 py-2">
                      <span className={`label-mono ${
                        b.status === 'breakdown' ? 'text-demand' :
                        b.isSignalLost ? 'text-muted-foreground' :
                        b.status === 'Available' ? 'text-ok' : 'text-signal'
                      }`}>
                        {b.isSignalLost ? 'Signal Lost' : b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {b.delay > 0 ? <span className="text-warn">+{b.delay} min</span> : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{b.current_route_id || '—'}</td>
                    <td className="px-4 py-2 label-mono">
                      {b.allocation_frozen && <span className="text-demand">ID Conflict</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right rail */}
        <aside className="flex flex-col gap-4">
          {/* Bus detail / stop list */}
          {selectedBus && (
            <div className="panel overflow-hidden">
              <div className="border-b border-border px-4 py-2.5">
                <span className="label-mono">Bus {selectedBus.id} · Official stop sequence</span>
              </div>
              {busStops.length === 0 ? (
                <p className="p-4 label-mono text-muted-foreground">
                  {selectedBus.current_route_id ? 'Loading stops…' : 'No route assigned'}
                </p>
              ) : (
                <ol className="divide-y divide-border/60">
                  {busStops.map((rs, idx) => (
                    <li key={rs.stop_id} className="flex items-center gap-3 px-4 py-3">
                      <span className="font-mono text-xs text-signal w-5">{idx + 1}</span>
                      <span className="text-sm">{rs.stops?.name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Pending allocations */}
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <span className="label-mono">Pending allocations</span>
            </div>
            <div className="divide-y divide-border/60">
              {allocations.map(alloc => (
                <div key={alloc.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{alloc.bus_id} → Zone {alloc.zone_id}</span>
                    <span className="label-mono text-signal">Score {alloc.score.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleAllocation(alloc, 'approved')}
                      className="flex-1 rounded-sm bg-signal px-3 py-2 text-sm font-semibold text-signal-foreground hover:opacity-90 transition-opacity"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleAllocation(alloc, 'rejected')}
                      className="rounded-sm border border-border px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {allocations.length === 0 && (
                <p className="p-4 label-mono text-muted-foreground">No pending recommendations</p>
              )}
            </div>
          </div>

          {/* Alerts feed */}
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <span className="label-mono">Alert feed</span>
            </div>
            <div className="max-h-64 divide-y divide-border/60 overflow-y-auto">
              {alerts.map(a => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${a.severity === 'critical' ? 'bg-demand' : 'bg-warn'}`} />
                  <div>
                    <p className="text-sm">{a.message}</p>
                    <p className="label-mono mt-0.5 uppercase">{a.type}</p>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="p-4 label-mono text-muted-foreground">No active alerts</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
