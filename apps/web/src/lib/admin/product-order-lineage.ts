// apps/web/src/lib/admin/product-order-lineage.ts
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  lineageCommandSchema,
  lineageReadSchema,
  prepareLineageRegistration,
  type LineageRead,
} from '@/lib/csat/map/v62/factory-bridge/order-lineage'

export type ProductOrderLineage =
  | { status: 'not_installed' | 'error' }
  | ({ status: 'installed' } & LineageRead)

/** A missing function is distinct from auth errors, malformed data and network failures. */
const notInstalled = (error: { code?: string } | null) => error?.code === 'PGRST202'
export async function readProductOrderLineage(
  db: SupabaseClient,
  actor: string,
  user: string,
  workspace: string
): Promise<ProductOrderLineage> {
  try {
    const { data, error } = await db.rpc('factory_lineage_read', {
      p_actor: actor,
      p_user: user,
      p_workspace: workspace,
    })
    if (notInstalled(error)) return { status: 'not_installed' }
    if (error) return { status: 'error' }
    const parsed = lineageReadSchema.safeParse(data)
    if (
      !parsed.success ||
      parsed.data.rows.length !== Math.min(parsed.data.total, 100) ||
      parsed.data.limited !== parsed.data.total > 100
    )
      return { status: 'error' }
    return { status: 'installed', ...parsed.data }
  } catch {
    return { status: 'error' }
  }
}

/** Call only after requireAdminApi + role===admin. db is the trusted server client, never a browser client. */
export async function executeProductOrderLineage(
  db: SupabaseClient,
  actor: string,
  value: unknown
) {
  const cmd = lineageCommandSchema.parse(value)
  if (cmd.action === 'register') {
    const body = prepareLineageRegistration(cmd)
    return db.rpc('factory_product_order_register', {
      p_actor: actor,
      p_canonical: body.canonical_order,
      p_hash: body.order_hash,
      p_spec: body.spec,
      p_quantity: body.quantity,
      p_reason: body.reason,
      p_request: body.request_key,
    })
  }
  if (cmd.action === 'withdraw')
    return db.rpc('factory_product_order_withdraw', {
      p_actor: actor,
      p_id: cmd.product_order_id,
      p_revision: cmd.order_revision,
      p_hash: cmd.order_hash,
      p_reason: cmd.reason,
      p_request: cmd.request_key,
    })
  return db.rpc('factory_order_link_product', {
    p_actor: actor,
    p_order: cmd.order_id,
    p_id: cmd.product_order_id,
    p_revision: cmd.order_revision,
    p_hash: cmd.order_hash,
    p_signature: cmd.demand_signature,
    p_quantity: cmd.quantity,
    p_reason: cmd.reason,
    p_request: cmd.request_key,
  })
}
