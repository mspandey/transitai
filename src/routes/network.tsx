import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/transit/chrome";
import { supabase } from "@/lib/supabase";

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

const DEMO_ZONES_COORDS: Record<string, { x: number, y: number, name: string }> = {
  'A': { x: 22, y: 30, name: 'Riverside' },
  'B': { x: 58, y: 20, name: 'Tech Park' },
  'C': { x: 74, y: 64, name: 'Central Market' },
  'D': { x: 34, y: 72, name: 'North Depot' },
};

function PublicNetwork() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [fleet, setFleet] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [zRes, bRes, rRes] = await Promise.all([
        supabase.from('zones').select('id, current_demand_count'),
        supabase.from('buses').select('id, current_lat, current_lng, current_route_id'),
        supabase.from('routes').select('id, zone_id, eta_minutes, status')
      ]);

      if (zRes.data) setZones(zRes.data);
      if (bRes.data) setFleet(bRes.data);
      if (rRes.data) setRoutes(rRes.data);
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
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* live map */}
          <div className="panel relative min-h-[450px] flex-1 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="label-mono">Service Map</span>
            </div>
            <div className="relative h-full min-h-[400px] grid-field bg-muted/20">
              {zones.map((z) => {
                const coords = DEMO_ZONES_COORDS[z.id] || { x: 50, y: 50, name: 'Unknown' };
                return (
                  <div
                    key={z.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                  >
                    <span className="relative flex items-center gap-2 rounded-sm border border-border bg-background/80 px-2 py-1">
                      <span className="size-1.5 rounded-full bg-signal" />
                      <span className="font-mono text-[11px] tracking-widest">{coords.name}</span>
                    </span>
                  </div>
                );
              })}
              
              {fleet.filter(b => b.current_route_id).map((b) => {
                const x = ((b.current_lng + 122.45) * 1000) % 100;
                const y = ((37.80 - b.current_lat) * 1000) % 100;
                return (
                  <div
                    key={b.id}
                    className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 z-10"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className="size-3 rounded-sm bg-signal" />
                    <span className="text-[9px] font-mono mt-1 opacity-70 bg-background/80 px-1 rounded">Bus on {b.current_route_id}</span>
                  </div>
                );
              })}
            </div>
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
                  <div className="mt-1 text-sm text-muted-foreground">Serving {DEMO_ZONES_COORDS[r.zone_id]?.name || `Zone ${r.zone_id}`}</div>
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
