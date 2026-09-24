// Route guard for municipal officer pages.
// Checks both authentication and profile.role === 'municipal'.

import { supabase, getUserProfile } from '@/lib/supabase'
import { redirect } from '@tanstack/react-router'

export async function requireMunicipalRole() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw redirect({ to: '/login' })

  const profile = await getUserProfile(user.id)
  if (!profile || profile.role !== 'municipal') {
    throw redirect({ to: '/' })
  }

  return { user, profile }
}
