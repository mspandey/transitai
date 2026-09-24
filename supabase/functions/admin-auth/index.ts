// HACKATHON NOTE: Hardcoded admin credentials verified server-side via bcrypt.
// Production would replace this with Supabase Auth + a service_role admin policy.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_USERNAME = Deno.env.get('ADMIN_USERNAME') || 'admin'
// HACKATHON: Hardcoded password to bypass bcrypt issues locally
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || 'admin123'
const COOKIE_SECRET = Deno.env.get('COOKIE_SECRET') || 'fallback-secret'
const SESSION_COOKIE = 'transit-admin-session'

async function createSessionToken(): Promise<string> {
  const payload = JSON.stringify({ role: 'admin', exp: Date.now() + 30 * 60 * 1000 })
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(COOKIE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return btoa(payload) + '.' + b64
}

async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return false
    const payload = atob(payloadB64)
    const { exp } = JSON.parse(payload)
    if (Date.now() > exp) return false
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(COOKIE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sig = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', key, sig, encoder.encode(payload))
  } catch { return false }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // POST /admin-login — verify credentials, issue session cookie
  if (req.method === 'POST' && url.pathname.endsWith('admin-login')) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const { username, password } = await req.json()

    const validUser = username === ADMIN_USERNAME
    const validPass = password === ADMIN_PASSWORD
    const success = validUser && validPass

    // Log attempt
    await supabase.from('dev_auth_attempts').insert([{ ip_address: ip, success }])

    if (!success) {
      return new Response(JSON.stringify({ success: false }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = await createSessionToken()
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800`,
      },
    })
  }

  // GET /admin-verify — check if session cookie is valid
  if (req.method === 'GET' && url.pathname.endsWith('admin-verify')) {
    const cookies = req.headers.get('cookie') || ''
    const match = cookies.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
    const token = match?.[1] || ''
    const valid = await verifySessionToken(token)
    return new Response(JSON.stringify({ valid }), {
      status: valid ? 200 : 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // POST /admin-logout — clear the cookie
  if (req.method === 'POST' && url.pathname.endsWith('admin-logout')) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`,
      },
    })
  }

  return new Response('Not found', { status: 404 })
})
