// Route guard for pages that require a signed-in citizen.
// Encodes form draft in sessionStorage so it survives the login redirect.

import { supabase } from '@/lib/supabase'
import { redirect } from '@tanstack/react-router'

export interface RequestDraft {
  from: { id: string; name: string; lat: number; lng: number } | null
  to: { id: string; name: string; lat: number; lng: number } | null
  people: number
  when: string
}

export function saveDraft(draft: RequestDraft) {
  try {
    sessionStorage.setItem('transit-request-draft', JSON.stringify(draft))
  } catch {}
}

export function loadDraft(): RequestDraft | null {
  try {
    const raw = sessionStorage.getItem('transit-request-draft')
    if (!raw) return null
    sessionStorage.removeItem('transit-request-draft')
    return JSON.parse(raw) as RequestDraft
  } catch {
    return null
  }
}

export async function requireUser(redirectTo = '/login') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw redirect({ to: redirectTo })
  }
  return user
}
