import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/transit/chrome";
import { supabase } from "@/lib/supabase";
import { LeafletMap, type LeafletStop } from "@/components/Map/LeafletMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import { nearestStops } from "@/lib/geo/nearestStops";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Live Network — Transit AI" },
      { name: "description", content: "Public live transit network view." },
    ],
  }),
  component: PublicNetwork,
});

type Zone = { id: string; current_demand_count: number; };
type Bus = { id: string; current_lat: number; current_lng: number; current_route_id: string | null; };
type RouteData = { id: string; zone_id: string; eta_minutes: number; status: string; };

function PublicNetwork() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [fleet, setFleet] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [stops, setStops] = useState<LeafletStop[]>([]);
  const [locating, setLocating] = useState(false);
  const geo = useGeolocation(locating);
  const nearest = geo.status === 'success' ? nearestStops(geo.lat, geo.lng, stops, 1, 1)[0] : null;

  useEffect(() => {
    const fetchData = async () => {
      const [zRes, bRes, rRes, sRes] = await Promise.all([
        supabase.from('zones').select('id, current_demand_count'),
        supabase.from('buses').select('id, current_lat, current_lng, current_route_id'),
        supabase.from('routes').select('id, zone_id, eta_minutes, status'),
        supabase.from('stops').select('id, name, lat, lng'),
      ]);

      if (zRes.data) setZones(zRes.data);
      if (bRes.data) setFleet(bRes.data);
      if (rRes.data) setRoutes(rRes.data);
      if (sRes.data) setStops(sRes.data);
    };
    
    fetchData();

    const channel = supabase.channel('public-network')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, () => {
        supabase.from('routes').select('id, zone_id, eta_minutes, status').then(res => res.data && setRoutes(res.data));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, () => {
        supabase.from('buses').select('id, current_lat, current_lng, current_route_id').then(res => res.data && setFleet(res.data));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeRoutes = routes.filter(r => r.status !== 'inactive');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-6">
          <Logo compact />
          <span className="label-mono text-muted-foreground hidden sm:inline-block">Public Network</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-ok" />
            <span className="label-mono">Live</span>
          </span>
          <Link to="/request" className="rounded-sm bg-signal px-3.5 py-1.5 text-xs font-semibold tracking-tight text-signal-foreground transition-opacity hover:opacity-90">
            Request a Bus
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 flex flex-col gap-6 p-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Live Network</h1>
          <p className="mt-2 text-sm text-muted-foreground">View current transit routes and active buses.</p>
          <button type="button" onClick={() => setLocating(true)} disabled={locating} className="mt-4 rounded-sm border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">Find Nearest Bus Stand</button>
          {geo.status === 'success' && nearest && <p className="mt-3 text-sm text-ok">Nearest bus stand: {nearest.name} · {(nearest.distanceKm * 1000).toFixed(0)} m away.</p>}
          {geo.status === 'denied' && <p className="mt-3 text-sm text-demand">Location permission denied. You can still browse the network.</p>}
          {geo.status === 'error' && <p className="mt-3 text-sm text-demand">Unable to determine your location. Try again from your browser settings.</p>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* live map */}
          <div className="panel relative min-h-[450px] flex-1 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="label-mono">Service Map</span>
            </div>
            <LeafletMap
              stops={stops}
              userLocation={geo.status === 'success' ? { lat: geo.lat, lng: geo.lng } : null}
              nearestStopId={nearest?.id ?? null}
              buses={fleet.map((bus) => ({ id: bus.id, lat: bus.current_lat, lng: bus.current_lng, status: bus.current_route_id ? 'active' : 'idle' }))}
            />
          </div>

          {/* Routes list */}
          <div className="panel overflow-hidden h-fit">
            <div className="border-b border-border px-4 py-2.5">
              <span className="label-mono">Active Routes</span>
            </div>
            <div className="divide-y divide-border/60">
              {activeRoutes.map((r) => (
                <div key={r.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-foreground">{r.id}</span>
                    <span className="label-mono text-signal">{r.eta_minutes} min ETA</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">Serving Zone {r.zone_id}</div>
                </div>
              ))}
              {activeRoutes.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground label-mono">No active routes at the moment.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
