// Every admin action writes here for full auditability.
// HACKATHON NOTE: No retention/rotation policy — fine at this scale.

import { supabase } from '@/lib/supabase'

export async function logAdminAction(
  action: string,
  targetTable: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  try {
    await supabase.from('dev_action_log').insert([{
      action,
      target_table: targetTable,
      target_id: targetId,
      details,
    }])
  } catch (err) {
    console.error('[AuditLog] Failed to write admin log entry:', err)
  }
}
