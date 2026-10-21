// packages/library-pipeline/src/textbook/order-lineage.ts
import { createHash } from 'node:crypto'
import { sealProductOrder } from './factory-order'
import { z } from 'zod'

import { canonicalJson } from './review-digest'

const h = z.string().regex(/^[0-9a-f]{64}$/)
const task = z.string().regex(/^[a-z]\.[a-z_]{2,60}$/)
const id = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/)
export const lineageSpecSchema = z
  .object({
    schema: z.literal('vf.factory-lineage-spec/1'),
    definition: z.string().min(1).max(64),
    task,
    role: z.enum([
      'source_analysis',
      'model_explanation',
      'guided_practice',
      'independent_check',
      'transfer',
      'delayed_check',
    ]),
    types: z.array(z.string().regex(/^[A-Za-z0-9_.:#-]{1,200}$/)).max(100),
    keys: z.array(z.string().regex(/^[A-Za-z0-9_.:#-]{1,200}$/)).max(100),
    requires: z.unknown(),
  })
  .strict()
export type LineageSpec = z.infer<typeof lineageSpecSchema>

/** Registry profile: existing canonical serialization is unchanged; unsupported values fail explicitly. */
export function assertRegistryProfile(value: unknown, depth = 0): void {
  if (depth > 24) throw new Error('registry_profile_depth')
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new Error('registry_profile_integer_required')
  if (Array.isArray(value)) value.forEach((v) => assertRegistryProfile(v, depth + 1))
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      // Numeric object keys have special JS enumeration semantics; do not silently reserialize them.
      if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(key) || key === '__proto__')
        throw new Error('registry_profile_ascii_key_required')
      assertRegistryProfile(v, depth + 1)
    }
  }
}
export const lineageHash = (text: string) => createHash('sha256').update(text).digest('hex')
export function canonicalSpec(value: unknown): LineageSpec {
  const spec = lineageSpecSchema.parse(value)
  if (!Object.hasOwn(spec, 'requires')) throw new Error('lineage_requires_required')
  const normalized = {
    ...spec,
    types: [...new Set(spec.types)].sort(),
    keys: [...new Set(spec.keys)].sort(),
  }
  assertRegistryProfile(normalized)
  return normalized
}
/** Build from stored canonicalDemand, not a browser's share key or reported validation state. */
export function specFromDemand(canonical: string, lineNo: number): LineageSpec {
  const demand = JSON.parse(canonical) as {
    v: number
    definitionVersion: string
    lines: Array<Record<string, unknown>>
  }
  if (demand.v !== 2 || !Number.isSafeInteger(lineNo) || lineNo < 0)
    throw new Error('invalid_lineage_demand')
  const line = demand.lines[lineNo]
  if (!line) throw new Error('lineage_line_missing')
  return canonicalSpec({
    schema: 'vf.factory-lineage-spec/1',
    definition: demand.definitionVersion,
    task: line.task,
    role: line.role,
    types: line.types,
    keys: line.keys,
    requires: line.requires,
  })
}

export const registerLineageSchema = z
  .object({
    action: z.literal('register'),
    order: z.unknown(),
    order_hash: h,
    spec: lineageSpecSchema,
    quantity: z.number().int().min(1).max(10000),
    reason: z.string().trim().min(1).max(500),
    request_key: z.string().uuid(),
  })
  .strict()
export const linkLineageSchema = z
  .object({
    action: z.literal('link'),
    order_id: z.string().uuid(),
    product_order_id: id,
    order_revision: z.number().int().positive(),
    order_hash: h,
    demand_signature: h,
    quantity: z.number().int().min(1).max(50),
    reason: z.string().trim().min(1).max(500),
    request_key: z.string().uuid(),
  })
  .strict()
export const withdrawLineageSchema = z
  .object({
    action: z.literal('withdraw'),
    product_order_id: id,
    order_revision: z.number().int().positive(),
    order_hash: h,
    reason: z.string().trim().min(1).max(500),
    request_key: z.string().uuid(),
  })
  .strict()
export const lineageCommandSchema = z.discriminatedUnion('action', [
  registerLineageSchema,
  linkLineageSchema,
  withdrawLineageSchema,
])

const lineageRowSchema = z
  .object({
    id: z.string().uuid(),
    order_id: z.string().uuid(),
    product_order_id: z.string(),
    order_revision: z.number().int().positive(),
    order_hash: h,
    quantity: z.number().int().positive(),
    product_quantity: z.number().int().positive(),
    created_at: z.string(),
    product_current: z.boolean(),
    personal_current: z.boolean(),
    status: z.enum(['current', 'withdrawn', 'superseded', 'personal_order_changed']),
  })
  .strict()
export const lineageReadSchema = z
  .object({
    rows: z.array(lineageRowSchema),
    total: z.number().int().nonnegative(),
    limited: z.boolean(),
  })
  .strict()
export type LineageRead = z.infer<typeof lineageReadSchema>

/** Reuse Factory's strict sealer. Do not reseal with a new timestamp, mutate the order or infer task fit. */
export function prepareLineageRegistration(input: unknown) {
  const cmd = registerLineageSchema.parse(input)
  const sealed = sealProductOrder(cmd.order)
  id.parse(sealed.order.product_order_id)
  assertRegistryProfile(sealed.order)
  if (canonicalJson(cmd.order) !== canonicalJson(sealed.order))
    throw new Error('order_not_exact_canonical_payload')
  if (cmd.order_hash !== sealed.order_hash) throw new Error('order_hash_mismatch')
  if (lineageHash(canonicalJson(sealed.order)) !== sealed.order_hash)
    throw new Error('registry_serialization_mismatch')
  const spec = canonicalSpec(cmd.spec)
  return {
    ...cmd,
    order: sealed.order,
    spec,
    canonical_order: canonicalJson(sealed.order),
    spec_hash: lineageHash(canonicalJson(spec)),
  }
}
