/**
 * Scroll-driven hero scene.
 *
 * Sequence:
 * City → People → Demand → Data → Hotspots → Fleet → Network
 *
 * The geometry is deterministic so SSR and hydration remain stable.
 */

import { useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Deterministic geometry                                                     */
/* -------------------------------------------------------------------------- */

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
  {
    from: { x: 90, y: 440 },
    to: { x: 700, y: 350 },
  },
  {
    from: { x: 930, y: 90 },
    to: { x: 800, y: 320 },
  },
  {
    from: { x: 480, y: 500 },
    to: { x: 620, y: 150 },
  },
];

const BLOCKS = Array.from({ length: 34 }, (_, i) => ({
  x: 30 + Math.floor(i % 9) * 108 + rand(i + 7) * 20,
  y: 60 + Math.floor(i / 9) * 130 + rand(i + 19) * 20,
  w: 44 + rand(i + 31) * 54,
  h: 30 + rand(i + 43) * 60,
}));

/* -------------------------------------------------------------------------- */
/* Progress helpers                                                           */
/* -------------------------------------------------------------------------- */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const seg = (progress: number, start: number, end: number) =>
  clamp01((progress - start) / (end - start));

/* -------------------------------------------------------------------------- */
/* Hero stages                                                                */
/* -------------------------------------------------------------------------- */

export const STAGES = [
  {
    id: "01",
    title: "The city",
    copy: "Millions of movements, every hour.",
  },
  {
    id: "02",
    title: "The people",
    copy: "Each one needs to be somewhere else.",
  },
  {
    id: "03",
    title: "The demand",
    copy: "They tell us where transport is needed.",
  },
  {
    id: "04",
    title: "The data",
    copy: "Individual requests become a signal.",
  },
  {
    id: "05",
    title: "The hotspots",
    copy: "Pressure points, before they crowd.",
  },
  {
    id: "06",
    title: "The fleet",
    copy: "Buses move toward demand.",
  },
  {
    id: "07",
    title: "The network",
    copy: "Capacity that reshapes itself.",
  },
];

/* -------------------------------------------------------------------------- */
/* Scroll progress                                                            */
/* -------------------------------------------------------------------------- */

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;

      const element = ref.current;

      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();

      /*
       * The hero is intentionally much taller than the viewport.
       * Progress is therefore calculated from:
       *
       * top of hero entering viewport
       *        ↓
       * bottom of hero reaching viewport bottom
       */
      const scrollableDistance = rect.height - window.innerHeight;

      const nextProgress =
        scrollableDistance <= 0
          ? 0
          : clamp01(-rect.top / scrollableDistance);

      setProgress(nextProgress);
    };

    const requestUpdate = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(update);
      }
    };

    update();

    window.addEventListener("scroll", requestUpdate, {
      passive: true,
    });

    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return {
    ref,
    progress,
  };
}

/* -------------------------------------------------------------------------- */
/* Network scene                                                              */
/* -------------------------------------------------------------------------- */

export function NetworkScene({
  progress,
}: {
  progress: number;
}) {
  /*
   * Each layer has its own section of the scroll timeline.
   *
   * The first city layer starts slightly before scroll begins so the
   * hero is never visually empty at progress = 0.
   */
  const city = seg(progress, 0, 0.16);

  const people = seg(progress, 0.08, 0.30);

  const demand = seg(progress, 0.22, 0.46);

  const data = seg(progress, 0.38, 0.60);

  const hotspot = seg(progress, 0.52, 0.74);

  const fleet = seg(progress, 0.66, 0.88);

  const network = seg(progress, 0.82, 1);

  return (
    <svg
      viewBox="0 0 1000 560"
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Demand across a city resolving into dynamically allocated buses"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Street grid                                                        */}
      {/* ------------------------------------------------------------------ */}

      <g opacity={0.42 + city * 0.30}>
        {Array.from({ length: 11 }, (_, i) => (
          <line
            key={`vertical-${i}`}
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
            key={`horizontal-${i}`}
            x1={0}
            y1={i * 93}
            x2={1000}
            y2={i * 93}
            stroke="var(--color-grid)"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* City blocks                                                        */}
      {/* ------------------------------------------------------------------ */}

      <g>
        {BLOCKS.map((block, index) => {
          /*
           * Important:
           * The old implementation had opacity = 0 for every block when
           * progress was 0. That made the hero look completely empty.
           *
           * A small base value keeps the city visible immediately.
           */
          const local = clamp01(
            0.35 +
              city * 1.15 -
              (index / BLOCKS.length) * 0.45,
          );

          const yOffset = (1 - local) * 14;

          return (
            <rect
              key={`block-${index}`}
              x={block.x}
              y={block.y + yOffset}
              width={block.w}
              height={block.h}
              rx={2}
              fill="var(--color-surface-raised)"
              opacity={local * 0.9}
            />
          );
        })}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* People                                                             */}
      {/* ------------------------------------------------------------------ */}

      <g>
        {PEOPLE.map((person, index) => {
          /*
           * A small initial visibility value means the city already contains
           * people before the demand sequence begins.
           */
          const local = clamp01(
            0.18 +
              people * 1.35 -
              person.d * 0.45,
          );

          const target = HOTSPOTS[index % HOTSPOTS.length];

          /*
           * People gradually move toward demand zones.
           */
          const x =
            person.x +
            (target.x - person.x) *
              demand *
              0.75;

          const y =
            person.y +
            (target.y - person.y) *
              demand *
              0.75;

          return (
            <circle
              key={`person-${index}`}
              cx={x}
              cy={y}
              r={1.6 + local * 1.4}
              fill={
                demand > 0.4
                  ? "var(--color-signal)"
                  : "var(--color-accent)"
              }
              opacity={
                local *
                (1 - network * 0.55)
              }
            />
          );
        })}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* Demand points                                                      */}
      {/* ------------------------------------------------------------------ */}

      <g opacity={demand}>
        {HOTSPOTS.map((hotspotPoint) => (
          <circle
            key={`demand-${hotspotPoint.label}`}
            cx={hotspotPoint.x}
            cy={hotspotPoint.y}
            r={4}
            fill="var(--color-signal)"
            opacity={0.9}
          />
        ))}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* Data links                                                         */}
      {/* ------------------------------------------------------------------ */}

      <g opacity={data}>
        {HOTSPOTS.map((hotspotPoint, index) => {
          const next =
            HOTSPOTS[
              (index + 1) %
                HOTSPOTS.length
            ];

          return (
            <line
              key={`data-link-${index}`}
              x1={hotspotPoint.x}
              y1={hotspotPoint.y}
              x2={next.x}
              y2={next.y}
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="4 8"
              opacity={0.6}
              style={{
                animation:
                  "flow-dash 6s linear infinite",
              }}
            />
          );
        })}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* Hotspots                                                           */}
      {/* ------------------------------------------------------------------ */}

      <g>
        {HOTSPOTS.map((hotspotPoint, index) => {
          const local = clamp01(
            hotspot * 1.4 -
              index * 0.12,
          );

          const radius =
            hotspotPoint.r * local;

          return (
            <g
              key={`hotspot-${hotspotPoint.label}`}
              opacity={local}
            >
              {/* outer demand field */}
              <circle
                cx={hotspotPoint.x}
                cy={hotspotPoint.y}
                r={radius}
                fill="var(--color-demand)"
                opacity={0.14}
              />

              {/* inner demand field */}
              <circle
                cx={hotspotPoint.x}
                cy={hotspotPoint.y}
                r={radius * 0.55}
                fill="var(--color-demand)"
                opacity={0.22}
              />

              {/* center */}
              <circle
                cx={hotspotPoint.x}
                cy={hotspotPoint.y}
                r={3.5}
                fill="var(--color-demand)"
              />

              {/* zone label */}
              <text
                x={
                  hotspotPoint.x +
                  radius * 0.6 +
                  8
                }
                y={hotspotPoint.y - 4}
                className="font-mono"
                fontSize={11}
                fill="var(--color-muted-foreground)"
                letterSpacing={1.4}
              >
                {hotspotPoint.label}
              </text>

              {/* request count */}
              <text
                x={
                  hotspotPoint.x +
                  radius * 0.6 +
                  8
                }
                y={hotspotPoint.y + 12}
                className="font-mono"
                fontSize={13}
                fill="var(--color-foreground)"
              >
                {Math.round(
                  hotspotPoint.count *
                    local,
                )}{" "}
                req
              </text>
            </g>
          );
        })}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* Fleet                                                              */}
      {/* ------------------------------------------------------------------ */}

      <g>
        {BUSES.map((bus, index) => {
          const local = clamp01(
            fleet * 1.3 -
              index * 0.14,
          );

          const x =
            bus.from.x +
            (bus.to.x - bus.from.x) *
              local;

          const y =
            bus.from.y +
            (bus.to.y - bus.from.y) *
              local;

          const visibility = clamp01(
            fleet * 2,
          );

          return (
            <g
              key={`bus-${index}`}
              opacity={visibility}
            >
              {/* route trail */}
              <line
                x1={bus.from.x}
                y1={bus.from.y}
                x2={x}
                y2={y}
                stroke="var(--color-signal)"
                strokeWidth={1.5}
                opacity={0.5}
              />

              {/* bus */}
              <rect
                x={x - 9}
                y={y - 5}
                width={18}
                height={10}
                rx={2}
                fill="var(--color-signal)"
              />

              {/* bus window */}
              <rect
                x={x - 4}
                y={y - 3}
                width={5}
                height={3}
                rx={0.5}
                fill="var(--color-signal-foreground)"
                opacity={0.65}
              />
            </g>
          );
        })}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* Optimized network                                                  */}
      {/* ------------------------------------------------------------------ */}

      <g opacity={network}>
        {HOTSPOTS.map(
          (hotspotPoint, index) =>
            HOTSPOTS
              .slice(index + 1)
              .map((next) => (
                <line
                  key={`network-${hotspotPoint.label}-${next.label}`}
                  x1={hotspotPoint.x}
                  y1={hotspotPoint.y}
                  x2={next.x}
                  y2={next.y}
                  stroke="var(--color-signal)"
                  strokeWidth={1}
                  opacity={0.35}
                />
              )),
        )}
      </g>

      {/* ------------------------------------------------------------------ */}
      {/* Final network nodes                                                */}
      {/* ------------------------------------------------------------------ */}

      <g opacity={network}>
        {HOTSPOTS.map((hotspotPoint) => (
          <circle
            key={`network-node-${hotspotPoint.label}`}
            cx={hotspotPoint.x}
            cy={hotspotPoint.y}
            r={4}
            fill="var(--color-signal)"
          />
        ))}
      </g>
    </svg>
  );
}