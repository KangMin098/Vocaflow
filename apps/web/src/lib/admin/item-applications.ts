// apps/web/src/lib/admin/item-applications.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ITEM_TASKS } from '@/lib/knowledge/item-tasks'
import { itemTaskRef } from '@/lib/knowledge/product-server'

export interface AdminItemApplication { id: string; surface_ref: string; version: number; status: string }
export type AdminItemApplications = { state: 'loaded'; rows: AdminItemApplication[] } | { state: 'error'; rows: [] }

/** All registered task kinds and statuses, including paused/history; never infer a knowledge slug. */
export async function loadAdminItemApplications(db: SupabaseClient, itemId: string): Promise<AdminItemApplications> {
  try {
  const refs = ITEM_TASKS.map(task => itemTaskRef(task.key, itemId))
  const { data, error } = await db.from('knowledge_applications')
    .select('id, surface_ref, version, status')
    .eq('surface', 'csat_item_task').in('surface_ref', refs)
    .order('version', { ascending: false }).limit(101)
  if (error || data === null || data.length > 100) return { state: 'error', rows: [] }
  return { state: 'loaded', rows: data as AdminItemApplication[] }
  } catch {
    return { state: 'error', rows: [] }
  }
}
