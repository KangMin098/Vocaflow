// apps/web/src/app/admin/pending-words/actions.ts
// Server Actions — pending_words 상태 전환 (admin role 만)

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export type PendingWordStatus =
  | 'pending'
  | 'reviewing'
  | 'auto-classify'
  | 'rejected'
  | 'added'

interface ActionResult {
  ok: boolean
  error?: string
}

export async function transitionPendingWord(
  id: string,
  status: PendingWordStatus,
  adminNote?: string,
): Promise<ActionResult> {
  const client = (await createClient()) as unknown as SupabaseClient

  const { error } = await client.rpc('update_pending_word_status', {
    p_id: id,
    p_status: status,
    p_admin_note: adminNote ?? null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/pending-words')
  return { ok: true }
}
