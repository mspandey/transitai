import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LoopDiagram,
  ReasoningCard,
  SectionTag,
  SiteFooter,
  SiteNav,
  Stat,
} from "@/components/transit/chrome";
import { NetworkScene, STAGES, useScrollProgress } from "@/components/transit/scene";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transit AI — Buses should follow demand" },
      {
        name: "description",
        content:
          "Transit AI turns real-time passenger demand into intelligent fleet decisions: collect demand, predict pressure points, allocate buses dynamically.",
      },
      { property: "og:title", content: "Transit AI — Buses should follow demand" },
      {
        property: "og:description",
        content:
          "A demand intelligence and dynamic fleet allocation platform. Transport that responds to people, not just schedules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const activeStage = Math.min(
    STAGES.length - 1,
    Math.floor(progress * STAGES.length * 0.999),
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      {/* ---------- Cinematic hero: scroll-driven sequence ---------- */}
      <div ref={ref} className="relative h-[420vh]">
  <div className="fixed right-4 top-20 z-[9999] rounded bg-black px-3 py-2 font-mono text-xs text-white">
    progress: {progress.toFixed(3)}
  </div>

  <div className="sticky top-0 flex h-screen flex-col overflow-hidden pt-14">
          <div className="absolute inset-0 grid-field opacity-40" />

          <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-5">
            <div className="flex flex-1 flex-col justify-center pt-6 lg:grid lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-10">
              <div>
                <SectionTag index="00">Demand intelligence platform</SectionTag>
                <h1 className="mt-5 text-5xl font-semibold leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
                  Buses should
                  <br />
                  <span className="text-signal-gradient">follow demand.</span>
                </h1>
                <p className="mt-5 max-w-md text-base text-muted-foreground">
                  Turn real-time passenger demand into intelligent fleet decisions.
                  People say where transport is needed — the platform predicts pressure
                  points and allocates buses to them.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    to="/request"
                    className="rounded-sm bg-signal px-5 py-2.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
                  >
                    Request a Bus
                  </Link>
                  <Link
                    to="/network"
                    className="rounded-sm border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    View Live Network
                  </Link>
                </div>
                <p className="label-mono mt-7">
                  Route → Bus → Passengers
                  <span className="mx-2 text-signal">is now</span>
                  People → Demand → Intelligence → Bus → Route
                </p>
              </div>

              <div className="relative mt-8 lg:mt-0">
                <div className="panel relative aspect-[16/9] w-full overflow-hidden">
                  <NetworkScene progress={progress} />
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-signal" />
                    <span className="label-mono">Scroll to explore ↓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* stage ticker */}
            <div className="relative pb-8">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-4 lg:grid-cols-7">
                {STAGES.map((s, i) => (
                  <div
                    key={s.id}
                    className={
                      i === activeStage
                        ? "border-t-2 border-signal pt-2"
                        : "border-t-2 border-transparent pt-2 opacity-45"
                    }
                  >
                    <div className="font-mono text-[10px] tracking-widest text-signal">
                      {s.id}
                    </div>
                    <div className="mt-1 text-sm font-medium">{s.title}</div>
                    <div className="mt-0.5 hidden text-xs text-muted-foreground lg:block">
                      {s.copy}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 01 The problem ---------- */}
      <section id="problem" className="border-t border-border">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <SectionTag index="01">The problem</SectionTag>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Fixed routes don't understand changing demand.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                t: "Low demand",
                d: "Buses run near-empty. Fuel, driver-hours and capacity are spent on routes nobody is using right now.",
                bars: [8, 12, 6, 10, 5],
              },
              {
                t: "High demand",
                d: "Passengers are left behind. Reliability collapses, and nothing can react until the next scheduling cycle.",
                bars: [76, 92, 88, 97, 84],
              },
              {
                t: "Irregular demand",
                d: "Events, emergencies, school timings, rural gaps — invisible to a static timetable until it is already a crisis.",
                bars: [14, 88, 22, 71, 9],
              },
            ].map((c) => (
              <div key={c.t} className="panel p-5">
                <div className="flex h-24 items-end gap-1.5">
                  {c.bars.map((b, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-signal/70"
                      style={{ height: `${b}%` }}
                    />
                  ))}
                </div>
                <h3 className="mt-5 text-lg font-medium">{c.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
            The root cause: operators have no real-time signal of where people actually
            want to go right now — only historical averages baked into a schedule that
            gets more wrong every day after it was written.
          </p>
        </div>
      </section>

      {/* ---------- 02 The human input ---------- */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionTag index="02">The human input</SectionTag>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Tell us where transportation is needed.
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Four questions, a few seconds. Every submission is a real signal entering
              the allocation engine — not a booking in a queue.
            </p>
            <Link
              to="/request"
              className="mt-6 inline-flex rounded-sm border border-signal/50 px-4 py-2 text-sm font-medium text-signal transition-colors hover:bg-signal/10"
            >
              Open passenger request →
            </Link>
          </div>
          <div className="panel divide-y divide-border">
            {[
              ["Location A — Riverside", 12],
              ["Location B — Tech Park", 37],
              ["Location C — Central Market", 184],
            ].map(([place, n], i) => (
              <div
                key={place as string}
                className="flex items-center justify-between px-5 py-4"
                style={{ animation: `tick-in 0.6s ease-out ${i * 0.15}s both` }}
              >
                <div>
                  <div className="label-mono">Incoming demand</div>
                  <div className="mt-1 text-sm font-medium">{place}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl text-signal">{n as number}</div>
                  <div className="label-mono">people</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 03 The intelligence ---------- */}
      <section id="intelligence" className="border-t border-border">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <SectionTag index="03">The intelligence</SectionTag>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Individual requests become a transportation signal.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Requests", "Raw demand events with origin, destination, party size, time."],
              ["Clusters", "Geohash grid bucketing with a density threshold per zone."],
              ["Hotspots", "Zones crossing the threshold surface as pressure points."],
              ["Prediction", "Short-window linear trend on request rate per zone."],
            ].map(([t, d], i) => (
              <div key={t} className="panel relative p-5">
                <span className="font-mono text-xs text-signal">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-base font-medium">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <LoopDiagram />
          </div>
        </div>
      </section>

      {/* ---------- 04 The decision ---------- */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionTag index="04">The decision</SectionTag>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Now the fleet responds.
            </h2>
            <dl className="mt-8 divide-y divide-border border-y border-border">
              {[
                ["Zone", "C — Central Market"],
                ["Demand", "284 people"],
                ["Required capacity", "300"],
                ["Available buses", "7"],
                ["Recommended allocation", "4 buses"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3">
                  <dt className="label-mono">{k}</dt>
                  <dd className="font-mono text-sm">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-sm text-muted-foreground">
              Every number on screen comes from an inspectable calculation. Nothing says
              "AI recommends" without showing the arithmetic.
            </p>
          </div>
          <ReasoningCard
            title="BUS 12 RECOMMENDED"
            verdict="Assign Bus 12 to Zone C — highest weighted score of 7 candidates."
            rows={[
              ["Demand", "HIGH"],
              ["Distance", "2.4 km"],
              ["Available capacity", "46"],
              ["Estimated arrival", "8 min"],
              ["Route compatibility", "92%"],
            ]}
            score="0.87"
          />
        </div>
      </section>

      {/* ---------- 05 Command center ---------- */}
      <section id="command" className="border-t border-border">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <SectionTag index="05">The command center</SectionTag>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a dispatcher needs, on one screen.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Where is demand increasing?",
              "How large is the demand?",
              "Which buses are available?",
              "Which buses are assigned?",
              "What does the system recommend?",
              "Why is it recommending it?",
              "What happens if I accept?",
              "What needs attention now?",
            ].map((q, i) => (
              <div key={q} className="panel px-4 py-3">
                <span className="font-mono text-[10px] tracking-widest text-signal">
                  Q{i + 1}
                </span>
                <p className="mt-1.5 text-sm">{q}</p>
              </div>
            ))}
          </div>
          <Link
            to="/network"
            className="mt-8 inline-flex rounded-sm bg-signal px-5 py-2.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
          >
            Open the command center →
          </Link>
        </div>
      </section>

      {/* ---------- 06 Impact ---------- */}
      <section id="impact" className="border-t border-border bg-surface/40">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <SectionTag index="06">The impact</SectionTag>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Measurable outcomes, honestly labeled.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value="-38%" label="Average passenger wait" note="Simulated demo data" />
            <Stat value="+27%" label="Fleet utilization" note="Simulated demo data" />
            <Stat value="-61%" label="Unserved requests" note="Simulated demo data" />
            <Stat value="4.2 min" label="Spike response time" note="Live demo metric" />
          </div>
        </div>
      </section>

      {/* ---------- 07 Social impact ---------- */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <SectionTag index="07">Social impact mode</SectionTag>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            The same loop, reconfigured.
          </h2>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            Not a separate product — a configuration of the same demand intake and
            allocation engine.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Disaster response", "Redirect capacity toward an evacuation zone."],
              ["Medical camps", "Move people to a camp for the hours it runs."],
              ["Rural mobility", "Serve demand too sparse for a fixed timetable."],
              ["School transport", "Absorb predictable, sharply-peaked demand."],
              ["Large events", "Surge in, surge out, without a new schedule."],
              ["Emergency transport", "Prioritised allocation on a declared zone."],
            ].map(([t, d]) => (
              <div key={t} className="panel p-5">
                <h3 className="text-base font-medium">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Close ---------- */}
      <section className="border-t border-border bg-surface/60">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            The city moves. Now your buses can move with it.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/request"
              className="rounded-sm bg-signal px-5 py-2.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
            >
              Request a Bus
            </Link>
            <Link
              to="/network"
              className="rounded-sm border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              View Live Network
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
