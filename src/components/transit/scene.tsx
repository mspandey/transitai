/**
 * Scroll-driven hero scene.
 * One SVG "city" whose layers are driven by a single scroll progress value:
 * City -> People -> Crowd -> Demand -> Data -> Hotspots -> Buses -> Network.
 * Deterministic geometry (no Math.random) so SSR and hydration match.
 */
import { useEffect, useRef, useState } from "react";

const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const PEOPLE = Array.from({ length: 90 }, (_, i) => ({
  x: 40 + rand(i + 1) * 920,
  y: 40 + rand(i + 51) * 460,
  d: rand(i + 101),
}));

const HOTSPOTS = [
  { x: 240, y: 170, r: 52, label: "ZONE A", count: 12 },
  { x: 610, y: 120, r: 70, label: "ZONE B", count: 37 },
  { x: 760, y: 360, r: 96, label: "ZONE C", count: 184 },
  { x: 330, y: 400, r: 44, label: "ZONE D", count: 26 },
];

const BUSES = [
  { from: { x: 90, y: 440 }, to: { x: 700, y: 350 } },
  { from: { x: 930, y: 90 }, to: { x: 800, y: 320 } },
  { from: { x: 480, y: 500 }, to: { x: 620, y: 150 } },
];

const BLOCKS = Array.from({ length: 34 }, (_, i) => ({
  x: 30 + Math.floor(i % 9) * 108 + rand(i + 7) * 20,
  y: 60 + Math.floor(i / 9) * 130 + rand(i + 19) * 20,
  w: 44 + rand(i + 31) * 54,
  h: 30 + rand(i + 43) * 60,
}));

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export const STAGES = [
  { id: "01", title: "The city", copy: "Millions of movements, every hour." },
  { id: "02", title: "The people", copy: "Each one needs to be somewhere else." },
  { id: "03", title: "The demand", copy: "They tell us where transport is needed." },
  { id: "04", title: "The data", copy: "Individual requests become a signal." },
  { id: "05", title: "The hotspots", copy: "Pressure points, before they crowd." },
  { id: "06", title: "The fleet", copy: "Buses move toward demand." },
  { id: "07", title: "The network", copy: "Capacity that reshapes itself." },
];

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      setProgress(total <= 0 ? 0 : clamp01(-rect.top / total));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { ref, progress };
}

export function NetworkScene({ progress }: { progress: number }) {
  const city = seg(progress, 0, 0.12);
  const people = seg(progress, 0.1, 0.28);
  const demand = seg(progress, 0.26, 0.44);
  const data = seg(progress, 0.4, 0.58);
  const hotspot = seg(progress, 0.52, 0.72);
  const fleet = seg(progress, 0.68, 0.88);
  const network = seg(progress, 0.84, 1);

  return (
    <svg
      viewBox="0 0 1000 560"
      className="h-full w-full"
      role="img"
      aria-label="Demand across a city resolving into dynamically allocated buses"
    >
      {/* street grid */}
      <g opacity={0.35 + city * 0.35}>
        {Array.from({ length: 11 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 100}
            y1={0}
            x2={i * 100}
            y2={560}
            stroke="var(--color-grid)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 93}
            x2={1000}
            y2={i * 93}
            stroke="var(--color-grid)"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* city blocks */}
      <g>
        {BLOCKS.map((b, i) => {
          const local = clamp01(city * 1.6 - (i / BLOCKS.length) * 0.6);
          return (
            <rect
              key={i}
              x={b.x}
              y={b.y + (1 - local) * 14}
              width={b.w}
              height={b.h}
              rx={2}
              fill="var(--color-surface-raised)"
              opacity={local * 0.85}
            />
          );
        })}
      </g>

      {/* people */}
      <g>
        {PEOPLE.map((p, i) => {
          const local = clamp01(people * 1.5 - p.d * 0.5);
          const target = HOTSPOTS[i % HOTSPOTS.length];
          const x = p.x + (target.x - p.x) * demand * 0.75;
          const y = p.y + (target.y - p.y) * demand * 0.75;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.6 + local * 1.4}
              fill={demand > 0.4 ? "var(--color-signal)" : "var(--color-accent)"}
              opacity={local * (1 - network * 0.55)}
            />
          );
        })}
      </g>

      {/* data links between zones */}
      <g opacity={data}>
        {HOTSPOTS.map((h, i) => {
          const n = HOTSPOTS[(i + 1) % HOTSPOTS.length];
          return (
            <line
              key={i}
              x1={h.x}
              y1={h.y}
              x2={n.x}
              y2={n.y}
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="4 8"
              opacity={0.5}
              style={{ animation: "flow-dash 6s linear infinite" }}
            />
          );
        })}
      </g>

      {/* hotspots */}
      <g>
        {HOTSPOTS.map((h, i) => {
          const local = clamp01(hotspot * 1.4 - i * 0.12);
          const r = h.r * local;
          return (
            <g key={h.label} opacity={local}>
              <circle cx={h.x} cy={h.y} r={r} fill="var(--color-demand)" opacity={0.14} />
              <circle
                cx={h.x}
                cy={h.y}
                r={r * 0.55}
                fill="var(--color-demand)"
                opacity={0.22}
              />
              <circle cx={h.x} cy={h.y} r={3.5} fill="var(--color-demand)" />
              <text
                x={h.x + r * 0.6 + 8}
                y={h.y - 4}
                className="font-mono"
                fontSize={11}
                fill="var(--color-muted-foreground)"
                letterSpacing={1.4}
              >
                {h.label}
              </text>
              <text
                x={h.x + r * 0.6 + 8}
                y={h.y + 12}
                className="font-mono"
                fontSize={13}
                fill="var(--color-foreground)"
              >
                {Math.round(h.count * local)} req
              </text>
            </g>
          );
        })}
      </g>

      {/* fleet */}
      <g>
        {BUSES.map((b, i) => {
          const local = clamp01(fleet * 1.3 - i * 0.14);
          const x = b.from.x + (b.to.x - b.from.x) * local;
          const y = b.from.y + (b.to.y - b.from.y) * local;
          return (
            <g key={i} opacity={clamp01(fleet * 2)}>
              <line
                x1={b.from.x}
                y1={b.from.y}
                x2={x}
                y2={y}
                stroke="var(--color-signal)"
                strokeWidth={1.5}
                opacity={0.5}
              />
              <rect
                x={x - 9}
                y={y - 5}
                width={18}
                height={10}
                rx={2}
                fill="var(--color-signal)"
              />
            </g>
          );
        })}
      </g>

      {/* optimized network */}
      <g opacity={network}>
        {HOTSPOTS.map((h, i) =>
          HOTSPOTS.slice(i + 1).map((n) => (
            <line
              key={`${h.label}-${n.label}`}
              x1={h.x}
              y1={h.y}
              x2={n.x}
              y2={n.y}
              stroke="var(--color-signal)"
              strokeWidth={1}
              opacity={0.3}
            />
          )),
        )}
      </g>
    </svg>
  );
}
