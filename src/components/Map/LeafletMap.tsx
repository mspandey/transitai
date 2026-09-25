import { useEffect, useRef } from "react";
import type { LatLngExpression, Map as LeafletMapInstance } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LeafletStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface LeafletBus {
  id: string;
  lat: number;
  lng: number;
  status: string;
}

export interface LeafletRoute {
  id: string;
  stops: LeafletStop[];
}

interface Props {
  stops?: LeafletStop[];
  buses?: LeafletBus[];
  routes?: LeafletRoute[];
  center?: LatLngExpression;
  userLocation?: { lat: number; lng: number } | null;
  nearestStopId?: string | null;
  onNearestStop?: (stop: LeafletStop) => void;
}

const DEFAULT_CENTER: LatLngExpression = [37.774, -122.419];

export function LeafletMap({
  stops = [],
  buses = [],
  routes = [],
  center = DEFAULT_CENTER,
  userLocation = null,
  nearestStopId = null,
  onNearestStop,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const layersRef = useRef<ReturnType<typeof import("leaflet").layerGroup> | null>(null);

  useEffect(() => {
    let disposed = false;

    import("leaflet").then((L) => {
      if (disposed || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true }).setView(center, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || !layersRef.current) return;
      const map = mapRef.current;
      const layers = layersRef.current;
      layers.clearLayers();

      routes.forEach((route) => {
        const points = route.stops
          .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
          .map((stop) => [stop.lat, stop.lng] as LatLngExpression);
        if (points.length > 1) {
          L.polyline(points, { color: "#f59e0b", weight: 3, opacity: 0.75 }).addTo(layers);
        }
      });

      stops.forEach((stop) => {
        if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) return;
        const marker = L.circleMarker([stop.lat, stop.lng], {
          radius: stop.id === nearestStopId ? 9 : 6,
          color: stop.id === nearestStopId ? "#22c55e" : "#f59e0b",
          fillColor: stop.id === nearestStopId ? "#22c55e" : "#f59e0b",
          fillOpacity: 0.9,
          weight: 2,
        }).bindPopup(stop.name);
        marker.on("click", () => onNearestStop?.(stop));
        marker.addTo(layers);
      });

      buses.forEach((bus) => {
        if (!Number.isFinite(bus.lat) || !Number.isFinite(bus.lng)) return;
        L.circleMarker([bus.lat, bus.lng], {
          radius: 7,
          color: bus.status === "breakdown" ? "#ef4444" : "#0ea5e9",
          fillColor: bus.status === "breakdown" ? "#ef4444" : "#0ea5e9",
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip(bus.id).addTo(layers);
      });

      if (userLocation) {
        L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 8,
          color: "#38bdf8",
          fillColor: "#38bdf8",
          fillOpacity: 0.85,
          weight: 3,
        }).bindPopup("Your location").addTo(layers);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [buses, nearestStopId, onNearestStop, routes, stops, userLocation]);

  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 14);
    }
  }, [userLocation]);

  return <div ref={containerRef} className="h-full min-h-[400px] w-full" />;
}
