// apps/web/src/lib/methodology/server.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertBundle } from './core'

/** Call only after requireAdmin/requireAdminApi. Never replace DB failures with seed data. */
export async function readMethodologySnapshot(id?: string) {
  const client = createAdminClient() as unknown as SupabaseClient
  const { data, error } = await client.rpc('methodology_read', { p_id: id ?? null })
  if (error) throw new Error(`Methodology storage unavailable (${error.code ?? 'unknown'})`)
  if (data === null) return null
  if (!data || typeof data !== 'object' || typeof data.id !== 'string' || typeof data.importedAt !== 'string') throw new Error('Invalid methodology snapshot envelope')
  assertBundle(data.bundle)
  return { id: data.id as string, importedAt: data.importedAt as string, bundle: data.bundle }
}
