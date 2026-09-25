import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/transit/chrome'
import { supabase } from '@/lib/supabase'
import { saveDraft, loadDraft } from '@/lib/auth/requireUser'
import { StopSearch } from '@/components/Request/StopSearch'
import { NearbyStopsSuggestion } from '@/components/Request/NearbyStopsSuggestion'

type SelectedStop = { id: string; name: string; lat: number; lng: number }

export const Route = createFileRoute('/request')({
  head: () => ({
    meta: [
      { title: 'Request transport — Transit AI' },
      { name: 'description', content: 'Tell Transit AI where transport is needed. Your demand enters the live allocation engine.' },
      { property: 'og:title', content: 'Request transport — Transit AI' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: RequestPage,
})

const FEEDBACK = [
  { t: 'Your demand has been received.', d: 'Request logged in zone C.' },
  { t: '27 people are requesting transport from this area.', d: 'Live count, last 15 min.' },
  { t: 'Demand threshold reached.', d: 'Zone C crossed 250 requests.' },
  { t: 'Bus allocation recommended.', d: '4 buses proposed to the operator.' },
  { t: 'Bus assigned.', d: 'Bus 12 · arriving in 8 min.' },
]

function RequestPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [step, setStep] = useState(0)
  const [fromStop, setFromStop] = useState<SelectedStop | null>(null)
  const [toStop, setToStop] = useState<SelectedStop | null>(null)
  const [people, setPeople] = useState(1)
  const [when, setWhen] = useState('Now')

  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stage, setStage] = useState(0)

  const total = 4

  // Check auth state on mount; restore draft if returning from login
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthLoading(false)

      // Restore any form state that was saved before redirecting to login
      const draft = loadDraft()
      if (draft) {
        if (draft.from) setFromStop(draft.from)
        if (draft.to) setToStop(draft.to)
        if (draft.people) setPeople(draft.people)
        if (draft.when) setWhen(draft.when)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Auto-advance feedback
  useEffect(() => {
    if (!submitted) return
    if (stage >= FEEDBACK.length - 1) return
    const t = setTimeout(() => setStage((s) => s + 1), 1600)
    return () => clearTimeout(t)
  }, [submitted, stage])

  const handleSubmit = async () => {
    if (!user) {
      // Save draft before redirecting to login
      saveDraft({
        from: fromStop,
        to: toStop,
        people,
        when,
      })
      navigate({ to: '/login', search: { redirect: '/request' } })
      return
    }

    setSubmitError(null)
    if (!fromStop || !toStop) {
      setSubmitError('Select both an origin and destination stop.')
      return
    }
    try {
      // Server-side rate-limit enforced inside the Postgres RPC
      const { data, error } = await supabase.rpc('submit_drt_request', {
        p_user_id: user.id,
        p_origin_lat: fromStop.lat,
        p_origin_lng: fromStop.lng,
        p_dest_lat: toStop.lat,
        p_dest_lng: toStop.lng,
        p_party_size: people,
        p_zone_id: 'C',
        p_origin_query: fromStop?.name || '',
        p_dest_query: toStop?.name || '',
      })

      if (error) {
        // Rate limit errors surface here with Postgres RAISE EXCEPTION message
        setSubmitError(error.message)
        return
      }
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please try again.')
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="label-mono animate-pulse">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-5">
          <Logo compact />
          <div className="flex items-center gap-4">
            {user ? (
              <span className="label-mono text-ok">● Signed in</span>
            ) : (
              <Link to="/login" className="label-mono hover:text-foreground">Sign in</Link>
            )}
            <Link to="/network" className="label-mono hover:text-foreground">Operator</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10">
        {!submitted ? (
          <>
            {/* Progress bar */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={`h-0.5 flex-1 rounded-full ${i <= step ? 'bg-signal' : 'bg-border'}`}
                />
              ))}
            </div>
            <p className="label-mono mt-4">Step {step + 1} of {total}</p>

            {/* Step 0: From stop with fuzzy search + geolocation */}
            {step === 0 && (
              <div>
                <NearbyStopsSuggestion onSelect={(s) => setFromStop(s)} />
                <StopSearch
                  label="Where are you?"
                  placeholder="e.g. Riverside Gate 2"
                  value={fromStop?.name || ''}
                  onSelect={(s) => setFromStop(s)}
                />
              </div>
            )}

            {/* Step 1: To stop with fuzzy search */}
            {step === 1 && (
              <StopSearch
                label="Where are you going?"
                placeholder="e.g. Central Market"
                value={toStop?.name || ''}
                onSelect={(s) => setToStop(s)}
              />
            )}

            {/* Step 2: Party size */}
            {step === 2 && (
              <div className="mt-6">
                <h1 className="text-3xl font-semibold tracking-tight">How many people?</h1>
                <div className="mt-8 flex items-center justify-between">
                  <RoundButton label="Remove one person" onClick={() => setPeople((p) => Math.max(1, p - 1))}>−</RoundButton>
                  <span className="font-mono text-6xl text-signal">{people}</span>
                  <RoundButton label="Add one person" onClick={() => setPeople((p) => Math.min(60, p + 1))}>+</RoundButton>
                </div>
              </div>
            )}

            {/* Step 3: When */}
            {step === 3 && (
              <div className="mt-6">
                <h1 className="text-3xl font-semibold tracking-tight">When?</h1>
                <div className="mt-6 grid gap-2">
                  {['Now', 'In 15 minutes', 'In 30 minutes', 'In 1 hour'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setWhen(opt)}
                      className={`rounded-sm border px-4 py-3 text-left text-sm transition-colors ${
                        when === opt
                          ? 'border-signal bg-signal/10 text-foreground'
                          : 'border-border hover:bg-secondary'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {submitError && (
              <div className="mt-4 rounded-sm border border-demand/30 bg-demand/10 px-4 py-3">
                <p className="text-sm text-demand">{submitError}</p>
                {submitError.includes('request limit') && (
                  <p className="mt-1 label-mono text-muted-foreground">Try again in 15 minutes.</p>
                )}
              </div>
            )}

            <div className="mt-auto pt-10">
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-sm border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={step === total - 1 ? handleSubmit : () => setStep(step + 1)}
                  disabled={
                    (step === 0 && !fromStop) ||
                    (step === 1 && !toStop)
                  }
                  className="flex-1 rounded-sm bg-signal px-4 py-3 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
                >
                  {step === total - 1
                    ? user ? 'Request Transport' : 'Sign in to request'
                    : 'Continue'}
                </button>
              </div>
              <p className="label-mono mt-4">
                {user
                  ? 'Your request becomes a live demand signal, not a ticket in a queue.'
                  : "You'll sign in before your request is submitted — form state is saved."}
              </p>
            </div>
          </>
        ) : (
          /* Success / tracking screen */
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2 items-center justify-center">
                <span className="size-2 rounded-full bg-ok" />
                <span className="absolute size-2 rounded-full bg-ok" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
              </span>
              <span className="label-mono">Live status</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">You are part of the signal.</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {fromStop?.name || 'Your location'} → {toStop?.name || 'Destination'} · {people} {people === 1 ? 'person' : 'people'} · {when}
            </p>

            <ol className="mt-8 space-y-3">
              {FEEDBACK.map((f, i) => {
                const reached = i <= stage
                return (
                  <li
                    key={f.t}
                    className={`panel flex items-start gap-3 px-4 py-3 transition-opacity ${reached ? 'opacity-100' : 'opacity-35'}`}
                    style={reached ? { animation: 'tick-in 0.45s ease-out both' } : undefined}
                  >
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${i < stage ? 'bg-ok' : reached ? 'bg-signal' : 'bg-border'}`} />
                    <span>
                      <span className="block text-sm font-medium">{f.t}</span>
                      <span className="label-mono mt-0.5 block">{f.d}</span>
                    </span>
                  </li>
                )
              })}
            </ol>

            {stage === FEEDBACK.length - 1 && (
              <div className="panel glow-ring mt-6 p-5">
                <span className="label-mono">Assigned vehicle</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl">BUS 12</span>
                  <span className="font-mono text-2xl text-signal">8 min</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Capacity 46 · 2.4 km away · route compatibility 92%
                </p>
              </div>
            )}

            <div className="mt-8 flex gap-2">
              <button
                onClick={() => { setSubmitted(false); setStage(0); setStep(0); setFromStop(null); setToStop(null) }}
                className="rounded-sm border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                New request
              </button>
              <Link to="/network" className="rounded-sm bg-signal px-4 py-2.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90">
                See it in the network
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function RoundButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full border border-border text-xl transition-colors hover:bg-secondary"
    >
      {children}
    </button>
  )
}
