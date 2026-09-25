import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Logo } from '@/components/transit/chrome'
import { getUserProfile, supabase } from '@/lib/supabase'

const MUNICIPAL_LOGIN_EMAIL = 'username-municipal@transitai.local'

export const Route = createFileRoute('/municipal_/login')({
  head: () => ({ meta: [{ title: 'Municipal Login — Transit AI' }] }),
  component: MunicipalLoginPage,
})

function MunicipalLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    if (username !== 'username-municipal') {
      setError('Invalid municipal credentials.')
      setLoading(false)
      return
    }
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: MUNICIPAL_LOGIN_EMAIL, password })
    if (signInError || !data.user) {
      setError(signInError?.message || 'Unable to sign in.')
      setLoading(false)
      return
    }
    const profile = await getUserProfile(data.user.id)
    if (profile?.role !== 'municipal') {
      await supabase.auth.signOut()
      setError('This account is not authorized for municipal access.')
      setLoading(false)
      return
    }
    navigate({ to: '/municipal' })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border"><div className="mx-auto flex h-14 w-full max-w-md items-center px-5"><Logo compact /></div></header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Municipal sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Authorized municipal access only.</p>
        <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
          <label className="label-mono">Username<input type="text" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username-municipal" className="mt-2 w-full border-b border-border bg-transparent pb-3 text-base outline-none focus:border-signal" /></label>
          <label className="label-mono">Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full border-b border-border bg-transparent pb-3 text-base outline-none focus:border-signal" /></label>
          {error && <p className="rounded-sm border border-demand/30 bg-demand/10 px-4 py-3 text-sm text-demand">{error}</p>}
          <button type="submit" disabled={loading} className="mt-2 rounded-sm bg-signal px-4 py-3 text-sm font-semibold text-signal-foreground disabled:opacity-40">{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">Back to public site</Link>
      </main>
    </div>
  )
}
