import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/transit/chrome'

export const Route = createFileRoute('/signup')({
  head: () => ({
    meta: [
      { title: 'Create account — Transit AI' },
      { name: 'description', content: 'Create a Transit AI account to submit demand-responsive transport requests.' },
    ],
  }),
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })

    if (signUpError) {
      // HACKATHON NOTE: Supabase returns a generic error for duplicate emails.
      // We surface the message as-is; production would normalize this.
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Create profile row (role defaults to 'citizen')
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName,
        role: 'citizen',
      })
    }

    setLoading(false)
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="max-w-sm text-center">
          <span className="text-4xl">✓</span>
          <h2 className="mt-4 text-2xl font-semibold">Check your email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it, then{' '}
            <Link to="/login" className="text-signal hover:underline">sign in</Link>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-md items-center px-5">
          <Logo compact />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your demand signals improve routes for everyone.
        </p>

        <form onSubmit={handleSignup} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="label-mono block mb-2">Display name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex Chen"
              className="w-full border-b border-border bg-transparent pb-3 text-base outline-none placeholder:text-muted-foreground focus:border-signal"
            />
          </div>
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full border-b border-border bg-transparent pb-3 text-base outline-none placeholder:text-muted-foreground focus:border-signal"
            />
          </div>

          {error && (
            <p className="rounded-sm border border-demand/30 bg-demand/10 px-4 py-3 text-sm text-demand">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-sm bg-signal px-4 py-3 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-signal hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  )
}
