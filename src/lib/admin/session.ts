// HACKATHON NOTE: Admin session uses a signed JWT cookie instead of real auth.
// Production would replace this with Supabase Auth + a proper admin role.

import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'transit-admin-session'
const SECRET = new TextEncoder().encode(
  import.meta.env.COOKIE_SECRET || 'transit-ai-hackathon-cookie-secret-32chars'
)
const SESSION_DURATION_MINUTES = 30

export async function createAdminSession(): Promise<string> {
  // Issue a 30-minute signed JWT
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_MINUTES}m`)
    .sign(SECRET)
  return token
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET)
    return true
  } catch {
    return false
  }
}

export function getAdminCookieName() {
  return COOKIE_NAME
}
