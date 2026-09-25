import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/transit/chrome'
import { Eye, EyeOff } from 'lucide-react'

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
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const passwordRequirements = [
    [password.length >= 8, 'at least 8 characters'],
    [/[A-Z]/.test(password), 'one uppercase letter'],
    [/[a-z]/.test(password), 'one lowercase letter'],
    [/[0-9]/.test(password), 'one number'],
    [/[^A-Za-z0-9]/.test(password), 'one special character'],
  ] as const
  const passwordValid = passwordRequirements.every(([valid]) => valid)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!passwordValid) {
      setError(`Password must contain ${passwordRequirements.filter(([valid]) => !valid).map(([, text]) => text).join(', ')}.`)
      setLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const response = await fetch('/api/citizen-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    })
    const result = await response.json() as { user?: { id: string } | null; error?: string }
    const data = { user: result.user }
    const signUpError = response.ok ? null : new Error(result.error || 'Unable to create account.')

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
            <div className="flex items-center border-b border-border focus-within:border-signal">
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setError(passwordValid ? null : 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.')} placeholder="Min 8 characters" className="w-full bg-transparent pb-3 text-base outline-none placeholder:text-muted-foreground" />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="pb-3 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Use 8+ characters with uppercase, lowercase, number, and special character.</p>
          </div>
          <div>
            <label className="label-mono block mb-2">Confirm password</label>
            <div className="flex items-center border-b border-border focus-within:border-signal">
              <input type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onBlur={() => setError(confirmPassword && password !== confirmPassword ? 'Passwords do not match.' : null)} placeholder="Repeat your password" className="w-full bg-transparent pb-3 text-base outline-none placeholder:text-muted-foreground" />
              <button type="button" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} onClick={() => setShowConfirmPassword((visible) => !visible)} className="pb-3 text-muted-foreground hover:text-foreground">
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
