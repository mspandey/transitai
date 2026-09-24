import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="relative flex size-6 items-center justify-center">
        <span className="absolute inset-0 rounded-sm border border-signal/60" />
        <span className="size-2 rounded-full bg-signal" />
        <span
          className="absolute inset-0 rounded-sm border border-signal/40"
          style={{ animation: "pulse-ring 2.8s ease-out infinite" }}
        />
      </span>

      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">
          Transit AI
        </span>

        {!compact && (
          <span className="label-mono mt-0.5">
            Demand intelligence
          </span>
        )}
      </span>
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5">
        <Logo />

        <nav className="hidden items-center gap-7 md:flex">
          {[
            ["The problem", "problem"],
            ["Intelligence", "intelligence"],
            ["Command center", "command"],
            ["Impact", "impact"],
          ].map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className="label-mono transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/network"
            className="hidden rounded-sm border border-border px-3 py-1.5 text-xs font-medium tracking-tight text-foreground transition-colors hover:bg-secondary sm:inline-flex"
          >
            View Live Network
          </Link>

          <Link
            to="/request"
            className="rounded-sm bg-signal px-3.5 py-1.5 text-xs font-semibold tracking-tight text-signal-foreground transition-opacity hover:opacity-90"
          >
            Request a Bus
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SectionTag({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-signal">{index}</span>
      <span className="h-px w-8 bg-border" />
      <span className="label-mono">{children}</span>
    </div>
  );
}

export function Stat({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="font-mono text-3xl tracking-tight text-foreground">
        {value}
      </div>

      <div className="mt-2 text-sm text-foreground">
        {label}
      </div>

      {note && (
        <div className="label-mono mt-2">
          {note}
        </div>
      )}
    </div>
  );
}

export function LoopDiagram() {
  const nodes = [
    "People",
    "Demand",
    "Data",
    "Prediction",
    "Optimization",
    "Fleet",
    "Transport",
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="label-mono">Closed feedback loop</span>
        <span className="label-mono text-signal">Always running</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 p-5">
        {nodes.map((n, i) => (
          <span key={n} className="flex items-center gap-2">
            <span className="rounded-sm border border-border bg-surface-raised px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-foreground">
              {n}
            </span>

            <span className="font-mono text-xs text-signal">
              {i === nodes.length - 1 ? "↻" : "→"}
            </span>
          </span>
        ))}

        <span className="label-mono">
          new demand data
        </span>
      </div>
    </div>
  );
}

export function ReasoningCard({
  title,
  verdict,
  rows,
  score,
}: {
  title: string;
  verdict: string;
  rows: [string, string][];
  score?: string;
}) {
  return (
    <div className="panel glow-ring overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-2.5">
        <span className="font-mono text-xs tracking-widest text-signal">
          {title}
        </span>

        <span className="label-mono">
          Input → Reasoning → Recommendation
        </span>
      </div>

      <div className="px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          {verdict}
        </p>

        <p className="label-mono mt-3">
          Because
        </p>

        <dl className="mt-2 divide-y divide-border">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between py-1.5"
            >
              <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {k}
              </dt>

              <dd className="font-mono text-sm text-foreground">
                {v}
              </dd>
            </div>
          ))}
        </dl>

        {score && (
          <div className="mt-3 flex items-center justify-between rounded-sm bg-muted px-3 py-2">
            <span className="label-mono">
              Allocation score
            </span>

            <span className="font-mono text-sm text-signal">
              {score}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Logo compact />

        <p className="label-mono max-w-sm">
          Demand intelligence and dynamic fleet allocation. Demo metrics are simulated.
        </p>
      </div>
    </footer>
  );
}