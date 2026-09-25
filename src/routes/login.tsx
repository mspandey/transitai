import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadDraft } from '@/lib/auth/requireUser'
import { Logo } from '@/components/transit/chrome'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Sign in — Transit AI' },
      { name: 'description', content: 'Sign in to submit transport requests and track your demand contributions.' },
    ],
  }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch<{ redirect?: string }>()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // Restore draft after login
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate({ to: redirect || '/request' })
      }
    })
  }, [navigate, redirect])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    // Navigation handled by onAuthStateChange above
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-md items-center px-5">
          <Logo compact />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your requests go further when they're tied to an account.
        </p>

        <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="label-mono block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border-b border-border bg-transparent pb-3 text-base outline-none placeholder:text-muted-foreground focus:border-signal"
            />
          </div>
          <div>
            <label className="label-mono block mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border-b border-border bg-transparent pb-3 text-base outline-none placeholder:text-muted-foreground focus:border-signal"
            />
          </div>

          {error && (
            <p className="rounded-sm border border-demand/30 bg-demand/10 px-4 py-3 text-sm text-demand">
              {error}
              {error.toLowerCase().includes('email not confirmed') && (
                <button
                  type="button"
                  disabled={resending}
                  onClick={async () => {
                    setResending(true)
                    setResent(false)
                    const result = await supabase.auth.resend({ type: 'signup', email })
                    setResending(false)
                    if (result.error) setError(result.error.message)
                    else setResent(true)
                  }}
                  className="mt-2 block text-signal underline disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Resend confirmation email'}
                </button>
              )}
              {resent && <span className="mt-2 block text-ok">Confirmation email sent.</span>}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-sm bg-signal px-4 py-3 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/signup" className="text-signal hover:underline">
            Sign up
          </Link>
        </p>
      </main>
    </div>
  )
}
