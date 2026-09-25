import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/admin/auditLog'
import { Logo } from '@/components/transit/chrome'

export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: 'Admin Panel — Transit AI' }] }),
  component: AdminPage,
})

// HACKATHON NOTE: Session gate checks for a cookie set by /api/admin-login.
// Production would use Supabase Auth with a real admin role.
function AdminPage() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState<boolean | null>(null)

  const [buses, setBuses] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [authAttempts, setAuthAttempts] = useState<any[]>([])
  const [resolvingAlert, setResolvingAlert] = useState<string | null>(null)
  const [alertError, setAlertError] = useState<string | null>(null)

  const [tab, setTab] = useState<'fleet' | 'zones' | 'alerts' | 'audit' | 'security'>('fleet')

  // Verify admin session cookie on mount
  useEffect(() => {
    fetch('/api/admin-verify', { credentials: 'include' }).then((r) => {
      if (r.ok) {
        setAuthed(true)
        fetchData()
      } else {
        setAuthed(false)
        window.location.assign('/admin/login')
      }
    }).catch(() => {
      setAuthed(false)
      window.location.assign('/admin/login')
    })
  }, [])

  const fetchData = async () => {
    const [bRes, zRes, aRes, logRes, attRes] = await Promise.all([
      supabase.from('buses').select('*'),
      supabase.from('zones').select('*'),
      supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('dev_action_log').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('dev_auth_attempts').select('*').order('attempted_at', { ascending: false }).limit(10),
    ])
    if (bRes.data) setBuses(bRes.data)
    if (zRes.data) setZones(zRes.data)
    if (aRes.data) setAlerts(aRes.data)
    if (logRes.data) setAuditLog(logRes.data)
    if (attRes.data) setAuthAttempts(attRes.data)
  }

  const resolveAlert = async (id: string) => {
    setResolvingAlert(id)
    setAlertError(null)
    try {
      const response = await fetch('/api/admin-resolve-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to resolve alert.')
      await logAdminAction('resolve_alert', 'alerts', id)
      await fetchData()
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'Unable to resolve alert.')
    } finally {
      setResolvingAlert(null)
    }
  }

  const resetBusStatus = async (busId: string) => {
    await logAdminAction('reset_bus_status', 'buses', busId, { new_status: 'Available' })
    await supabase.from('buses').update({ status: 'Available', allocation_frozen: false }).eq('id', busId)
    fetchData()
  }

  const updateDemand = async (zoneId: string, count: number) => {
    await logAdminAction('set_demand', 'zones', zoneId, { count })
    await supabase.from('zones').update({ current_demand_count: count }).eq('id', zoneId)
    fetchData()
  }

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="label-mono animate-pulse">Verifying session…</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-4">
          <Logo compact />
          <span className="rounded-sm border border-signal/30 bg-signal/5 px-2 py-0.5 font-mono text-[10px] tracking-widest text-signal uppercase">
            Dev Admin — Hackathon Only
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/network" className="label-mono hover:text-foreground">Network →</Link>
          <button
            onClick={() => { fetch('/api/admin-logout', { method: 'POST', credentials: 'include' }).then(() => navigate({ to: '/admin/login' })) }}
            className="label-mono text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border px-6 pt-2">
        {(['fleet', 'zones', 'alerts', 'audit', 'security'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 font-mono text-[11px] uppercase tracking-widest capitalize transition-colors ${
              tab === t ? 'border-b-2 border-signal text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Fleet tab */}
        {tab === 'fleet' && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Fleet Management</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  {['ID', 'Status', 'Capacity', 'Route', 'Telemetry', 'Actions'].map((h) => (
                    <th key={h} className="label-mono px-4 py-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-mono text-xs">{b.id} {b.allocation_frozen && '⚠'}</td>
                    <td className="px-4 py-2">
                      <span className={`label-mono ${b.status === 'breakdown' ? 'text-demand' : b.status === 'Available' ? 'text-ok' : 'text-signal'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{b.capacity}</td>
                    <td className="px-4 py-2 font-mono text-xs">{b.current_route_id || '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {b.suspected_frozen_tracker && <span className="text-warn">Stuck GPS</span>}
                      {b.onboard_count_confidence === 'low_confidence' && <span className="text-warn">Low confidence</span>}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => resetBusStatus(b.id)}
                        className="text-[10px] border border-border px-2 py-1 rounded hover:bg-secondary transition-colors"
                      >
                        Reset status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Zones tab */}
        {tab === 'zones' && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Zone Demand Control</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {zones.map((z) => (
                <div key={z.id} className="panel p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold">Zone {z.id}</span>
                    <span className={`label-mono ${z.predicted_trend === 'rising' ? 'text-signal' : ''}`}>{z.predicted_trend}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="label-mono">Demand count</label>
                      <input
                        type="number"
                        defaultValue={z.current_demand_count}
                        min={0}
                        max={9999}
                        onBlur={(e) => updateDemand(z.id, parseInt(e.target.value))}
                        className="mt-1 w-full border-b border-border bg-transparent pb-1 font-mono text-sm outline-none focus:border-signal"
                      />
                    </div>
                    <div className="text-right">
                      <span className="label-mono">Threshold</span>
                      <div className="font-mono text-sm">{z.threshold}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts tab */}
        {tab === 'alerts' && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Active Alerts</h2>
            {alertError && <p className="mb-4 rounded-sm border border-demand/30 bg-demand/10 px-4 py-3 text-sm text-demand">{alertError}</p>}
            <div className="divide-y divide-border rounded-sm border border-border">
              {alerts.filter(a => !a.resolved_at).map((a) => (
                <div key={a.id} className="flex items-start gap-4 p-4">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.severity === 'critical' ? 'bg-demand' : 'bg-warn'}`} />
                  <div className="flex-1">
                    <p className="text-sm">{a.message}</p>
                    <p className="label-mono mt-0.5">{a.type} · {new Date(a.created_at).toLocaleTimeString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={resolvingAlert === a.id}
                    onClick={() => resolveAlert(a.id)}
                    className="text-[10px] border border-border px-2 py-1 rounded hover:bg-secondary disabled:cursor-wait disabled:opacity-50"
                  >
                    {resolvingAlert === a.id ? 'Resolving…' : 'Resolve'}
                  </button>
                </div>
              ))}
              {alerts.filter(a => !a.resolved_at).length === 0 && (
                <p className="p-4 label-mono text-muted-foreground">No active alerts</p>
              )}
            </div>
          </div>
        )}

        {/* Audit log tab */}
        {tab === 'audit' && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Audit Log</h2>
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div key={entry.id} className="panel flex items-center gap-4 px-4 py-3">
                  <span className="font-mono text-xs text-signal">{entry.action}</span>
                  <span className="label-mono">{entry.target_table} · {entry.target_id}</span>
                  <span className="ml-auto label-mono text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
              {auditLog.length === 0 && (
                <p className="label-mono text-muted-foreground">No admin actions yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Security tab */}
        {tab === 'security' && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Auth Attempts</h2>
            <div className="divide-y divide-border rounded-sm border border-border">
              {authAttempts.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-4 py-3">
                  <span className={`size-2 rounded-full ${a.success ? 'bg-ok' : 'bg-demand'}`} />
                  <span className="label-mono">{a.ip_address || 'Unknown IP'}</span>
                  <span className="label-mono">{a.success ? 'Success' : 'Failed'}</span>
                  <span className="ml-auto label-mono text-muted-foreground">
                    {new Date(a.attempted_at).toLocaleString()}
                  </span>
                </div>
              ))}
              {authAttempts.length === 0 && (
                <p className="p-4 label-mono text-muted-foreground">No auth attempts recorded.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
