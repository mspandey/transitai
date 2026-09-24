import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Logo } from '@/components/transit/chrome'

export const Route = createFileRoute('/admin/login')({
  head: () => ({ meta: [{ title: 'Admin Login — Transit AI' }] }),
  component: AdminLoginPage,
})

// HACKATHON NOTE: Hardcoded admin login; production replaces with Supabase Auth + real admin role.
function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Calls an Edge Function to verify credentials server-side (bcrypt compare)
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError('Invalid credentials')
        setLoading(false)
        return
      }

      navigate({ to: '/admin' })
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-md items-center px-5">
          <Logo compact />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Admin sign in</h1>

        <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="label-mono block mb-2">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
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
            <p className="rounded-sm border border-demand/30 bg-demand/10 px-4 py-3 text-sm text-demand">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-sm bg-signal px-4 py-3 text-sm font-semibold text-signal-foreground disabled:opacity-40 hover:opacity-90"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  )
}
