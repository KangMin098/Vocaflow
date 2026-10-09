// packages/library-pipeline/src/textbook/factory-order.ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  AGE_BANDS,
  PRODUCT_FAMILIES,
  READING_SKILLS,
  articleLicenseSchema,
  readingSourceRole,
  readingTargetSchema,
  type ArticleLicense,
  type ReadingTarget,
} from './academic-reading'
import { canonicalJson } from './review-digest'
import type { FactoryState } from './factory-order-stage'
export { FACTORY_STATE_STAGE, FACTORY_STATES } from './factory-order-stage'
export type { FactoryState, FactoryMeasurement, FactoryStageId } from './factory-order-stage'

const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex')
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const id = z.string().trim().min(1)
const nonemptyIds = z.array(id).min(1).refine(v => new Set(v).size === v.length, 'duplicate values')
const difficulty = z.object({
  lexical: z.number().int().min(0).max(11),
  syntax: z.number().int().min(0).max(11),
  information_density: z.number().int().min(0).max(11),
  discourse: z.number().int().min(0).max(11),
  inference: z.number().int().min(0).max(11),
  abstraction: z.number().int().min(0).max(11),
  background_knowledge: z.number().int().min(0).max(11),
}).strict()
const familyIds = Object.keys(PRODUCT_FAMILIES) as [keyof typeof PRODUCT_FAMILIES, ...(keyof typeof PRODUCT_FAMILIES)[]]
const skillIds = Object.keys(READING_SKILLS) as [keyof typeof READING_SKILLS, ...(keyof typeof READING_SKILLS)[]]

export const FACTORY_ORDER_VERSION = 1
export const FACTORY_CAPABILITY_STATES = ['SUPPORTED', 'PARTIAL', 'PLANNED', 'UNSUPPORTED'] as const
export type FactoryCapabilityState = (typeof FACTORY_CAPABILITY_STATES)[number]

const basicItems = ['topic', 'title', 'main_point', 'content_match', 'summary'] as const
const relationItems = ['order', 'insert', 'long_reference'] as const
const inferenceItems = ['implication', 'blank'] as const
const evidenceItems = ['content_match', 'long_match'] as const
const vocabItems = ['vocab_choice', 'long_vocab'] as const

// This matrix describes the current passage/item contract, not a production-ready book.
// Features absent from item and press paths remain PARTIAL/PLANNED, even if a P code exists.
const capability = (
  state: FactoryCapabilityState,
  items: readonly string[],
  activities: readonly string[] = [],
  requirements: readonly string[] = [],
) => ({
  state, direct: state !== 'PLANNED' && state !== 'UNSUPPORTED',
  adaptation: state !== 'PLANNED' && state !== 'UNSUPPORTED', items, activities, requirements,
  multi_passage: requirements.includes('multi_passage'),
  table_or_chart: requirements.includes('table_or_chart'),
  audio: requirements.includes('audio'), timer: requirements.includes('timer'),
  explanation: state !== 'PLANNED' && state !== 'UNSUPPORTED', teacher_note: false,
  layout: requirements.length ? 'requires_new_layout' : 'existing_reading_layout_unverified',
  benchmark: 'grade_relative_required', gold: 'gold_s_required_for_adaptation',
})
export const PRODUCT_CAPABILITIES: Record<keyof typeof PRODUCT_FAMILIES, ReturnType<typeof capability>> = {
  P01: capability('PARTIAL', basicItems),
  P02: capability('PARTIAL', [...basicItems, ...relationItems]),
  P03: capability('PARTIAL', basicItems),
  P04: capability('PARTIAL', basicItems),
  P05: capability('PARTIAL', vocabItems),
  P06: capability('PARTIAL', ['grammar_choice', 'grammar_fix', 'word_order']),
  P07: capability('PARTIAL', ['topic', 'title', 'main_point']),
  P08: capability('PARTIAL', relationItems),
  P09: capability('PARTIAL', relationItems),
  P10: capability('PARTIAL', inferenceItems),
  P11: capability('PARTIAL', evidenceItems),
  P12: capability('PARTIAL', ['claim', 'implication']),
  P13: capability('PLANNED', [], [], ['multi_passage', 'comparative_layout']),
  P14: capability('PLANNED', [], [], ['table_or_chart', 'integrated_render']),
  P15: capability('PARTIAL', [...basicItems, ...evidenceItems]),
  P16: capability('PARTIAL', basicItems),
  P17: capability('PARTIAL', [...basicItems, ...inferenceItems]),
  P18: capability('PLANNED', [...basicItems, ...inferenceItems, ...relationItems], [], ['timer']),
  P19: capability('PARTIAL', [...vocabItems, 'main_point']),
  P20: capability('PLANNED', [], [], ['multi_passage', 'argument_layout']),
}

export const productOrderSchema = z.object({
  schema: z.literal('textbook-product-order/1'),
  planning_hash: hash.optional(),
  product_order_id: id,
  order_revision: z.number().int().positive(),
  series_id: id,
  edition_id: id,
  product_family: z.enum(familyIds),
  product_variant: id,
  target: readingTargetSchema,
  grade_target: z.enum(AGE_BANDS),
  grade_detail_target: z.enum(['elementary_5', 'elementary_6']).optional(),
  reading_skill_targets: z.array(z.enum(skillIds)).min(1),
  purposes: nonemptyIds,
  exam_alignment: z.array(id),
  domain_mix: z.record(z.number().min(0).max(100)),
  genre_mix: z.record(z.number().min(0).max(100)),
  source_policy_version: id,
  source_policy_hash: hash,
  rights_policy_version: id,
  rights_policy_hash: hash,
  adaptation_policy_version: id,
  adaptation_policy_hash: hash,
  item_types: nonemptyIds,
  activity_types: z.array(id),
  passage_difficulty_profile: difficulty,
  item_difficulty_profile: z.object({ reasoning: z.number().int().min(0).max(11) }).strict(),
  unit_spec_version: id,
  chapter_spec_version: id,
  volume_spec_version: id,
  layout_profile: id,
  benchmark_contract_version: id,
  benchmark_contract_hash: hash,
  evidence_policy_version: id,
  evidence_policy_hash: hash,
  trust_policy_version: id,
  trust_policy_hash: hash,
  created_at: z.string().datetime({ offset: true }),
  sealed_at: z.string().datetime({ offset: true }),
}).strict().superRefine((order, ctx) => {
  const cap = PRODUCT_CAPABILITIES[order.product_family]
  if (order.product_family !== order.target.family || order.grade_target !== order.target.age_band)
    ctx.addIssue({ code: 'custom', message: 'order target and family mismatch' })
  if (order.grade_detail_target && order.grade_target !== 'upper_elementary')
    ctx.addIssue({ code: 'custom', message: 'elementary grade detail requires upper_elementary target' })
  if (canonicalJson([...order.reading_skill_targets].sort()) !== canonicalJson([...order.target.skills].sort()))
    ctx.addIssue({ code: 'custom', message: 'order and target skills mismatch' })
  if (order.target.exam === 'none' ? order.exam_alignment.length !== 0 : !order.exam_alignment.includes(order.target.exam))
    ctx.addIssue({ code: 'custom', message: 'exam alignment differs from target' })
  if (cap.state === 'UNSUPPORTED' || cap.state === 'PLANNED')
    ctx.addIssue({ code: 'custom', message: `product ${order.product_family} is ${cap.state}` })
  for (const item of order.item_types)
    if (!cap.items.includes(item)) ctx.addIssue({ code: 'custom', message: `unsupported item: ${item}` })
  for (const activity of order.activity_types)
    if (!cap.activities.includes(activity)) ctx.addIssue({ code: 'custom', message: `unsupported activity: ${activity}` })
  for (const [label, mix] of [['domain_mix', order.domain_mix], ['genre_mix', order.genre_mix]] as const)
    if (!Object.keys(mix).length || Math.abs(Object.values(mix).reduce((sum, value) => sum + value, 0) - 100) > 0.000001)
      ctx.addIssue({ code: 'custom', message: `${label} must sum to 100` })
  if (Date.parse(order.sealed_at) < Date.parse(order.created_at))
    ctx.addIssue({ code: 'custom', message: 'sealed_at precedes created_at' })
})
export type ProductOrder = z.infer<typeof productOrderSchema>
export function sealProductOrder(value: unknown) {
  const order = productOrderSchema.parse(value)
  return { order, order_hash: digest(order), capability_state: PRODUCT_CAPABILITIES[order.product_family].state }
}

export const SOURCE_ROUTE = [
  'DIRECT_USE', 'ADAPT_REQUIRED', 'ADAPT_OPTIONAL', 'REFERENCE_ONLY', 'DISCOVERY_ONLY', 'REJECT',
] as const
export type SourceRoute = (typeof SOURCE_ROUTE)[number]
export function routeFactorySource(input: {
  rights: ArticleLicense
  original_fit: 'fits' | 'requires_adaptation' | 'unknown'
  age_suitable: boolean | null
  source_quality: 'pass' | 'fail' | 'unknown'
  target: ReadingTarget
}): { route: SourceRoute; reasons: string[] } {
  const { rights, target } = input
  articleLicenseSchema.parse(rights)
  readingTargetSchema.parse(target)
  const role = readingSourceRole(rights.canonical_source)
  if (role === 'discovery') return { route: 'DISCOVERY_ONLY', reasons: ['source is a discovery index'] }
  if (role === 'benchmark') return { route: 'REFERENCE_ONLY', reasons: ['source is a benchmark'] }
  if (role === 'restricted') return { route: 'REJECT', reasons: ['source role is restricted'] }
  if (!rights.commercial_use || rights.third_party_text || rights.ai_processing !== 'allowed')
    return { route: 'REFERENCE_ONLY', reasons: ['commercial text or AI rights are not cleared'] }
  if (rights.share_alike && !target.share_alike)
    return { route: 'REFERENCE_ONLY', reasons: ['share-alike delivery is missing'] }
  if (input.source_quality === 'fail') return { route: 'REJECT', reasons: ['source quality failed'] }
  if (input.source_quality === 'unknown' || input.age_suitable === null || input.original_fit === 'unknown')
    return { route: 'REFERENCE_ONLY', reasons: ['source or target fit is unmeasured'] }
  if (input.original_fit === 'fits' && input.age_suitable)
    return { route: 'DIRECT_USE', reasons: ['current original fits the target'] }
  if (!rights.derivative_use) return { route: 'REFERENCE_ONLY', reasons: ['adaptation rights are absent'] }
  return {
    route: input.original_fit === 'requires_adaptation' || !input.age_suitable ? 'ADAPT_REQUIRED' : 'ADAPT_OPTIONAL',
    reasons: ['target fit requires reviewed adaptation'],
  }
}

export const factoryEvidenceSchema = z.object({
  source_id: id,
  source_route: z.enum(SOURCE_ROUTE),
  source_hash: hash,
  rights_hash: hash,
  trust_policy_hash: hash,
  evidence_policy_hash: hash,
  product_order_id: id,
  order_revision: z.number().int().positive(),
  order_hash: hash,
  capability_hash: hash,
  target_hash: hash,
  adaptation_hash: hash.nullable(),
  benchmark_version: id.nullable(),
  benchmark_snapshot_hash: hash.nullable(),
  certificate_hash: hash.nullable(),
}).strict()
export type FactoryEvidence = z.infer<typeof factoryEvidenceSchema>
export function bindFactoryEvidence(order: ProductOrder, current: Omit<FactoryEvidence, 'product_order_id' | 'order_revision' | 'order_hash' | 'capability_hash' | 'target_hash'>) {
  const sealed = sealProductOrder(order)
  if (order.trust_policy_hash !== current.trust_policy_hash || order.evidence_policy_hash !== current.evidence_policy_hash)
    throw new Error('order and evidence policy hashes differ')
  const evidence = factoryEvidenceSchema.parse({
    ...current,
    product_order_id: order.product_order_id,
    order_revision: order.order_revision,
    order_hash: sealed.order_hash,
    capability_hash: digest(PRODUCT_CAPABILITIES[order.product_family]),
    target_hash: digest(order.target),
  })
  return { evidence, evidence_hash: digest(evidence) }
}
export function assessFactoryEvidence(recorded: FactoryEvidence, current: FactoryEvidence, rightsAllowed = true) {
  if (!rightsAllowed) return { state: 'invalidated' as const, reason: 'rights revoked' }
  const old = factoryEvidenceSchema.parse(recorded)
  const now = factoryEvidenceSchema.parse(current)
  const changed = (Object.keys(old) as (keyof FactoryEvidence)[]).find(key => old[key] !== now[key])
  return changed ? { state: 'stale' as const, reason: `${changed} changed` } : { state: 'current' as const, reason: null }
}

const next: Partial<Record<FactoryState, readonly FactoryState[]>> = {
  source_candidate: ['direct_use_reviewed', 'adaptation_candidate'],
  direct_use_reviewed: ['benchmark_pending'],
  adaptation_candidate: ['adaptation_reviewed'], adaptation_reviewed: ['benchmark_pending'],
  benchmark_pending: ['benchmark_validated'], benchmark_validated: ['gold_candidate', 'ready'],
  gold_candidate: ['gold_review_ready'], gold_review_ready: ['gold_certified'],
  gold_certified: ['seed_eligible'], seed_eligible: ['queued'],
  queued: ['promotion_ready'], promotion_ready: ['ready'], ready: ['item_ready'],
  item_ready: ['explanation_ready'], explanation_ready: ['editorial_ready'],
  editorial_ready: ['unit_ready'], unit_ready: ['volume_ready'], volume_ready: ['rendered'],
  rendered: ['published'], published: ['retired'],
}
const transitionGate: Partial<Record<FactoryState, string>> = {
  direct_use_reviewed: 'content_review', adaptation_candidate: 'adaptation_draft',
  adaptation_reviewed: 'content_review', benchmark_pending: 'benchmark_request',
  benchmark_validated: 'benchmark_verification', gold_candidate: 'benchmark_decision',
  gold_review_ready: 'owner_review', gold_certified: 'signed_gold_s_issuance',
  seed_eligible: 'signed_seed_authorization', queued: 'db_seed',
  promotion_ready: 'promotion_preflight', ready: 'db_promotion_or_existing_direct_article',
  item_ready: 'item_import', explanation_ready: 'explanation_import',
  editorial_ready: 'editorial_review', unit_ready: 'unit_assembly',
  volume_ready: 'volume_assembly', rendered: 'render_validation',
  published: 'publication_approval', retired: 'retirement_approval',
}
// A plan is never an authorization or a new current state. Each gate must be verified by its owner.
export function planFactoryTransition(from: FactoryState, to: FactoryState, recorded: FactoryEvidence, current: FactoryEvidence, rightsAllowed = true) {
  const assessment = assessFactoryEvidence(recorded, current, rightsAllowed)
  if (assessment.state !== 'current') throw new Error(`evidence ${assessment.state}: ${assessment.reason}`)
  if (!['DIRECT_USE', 'ADAPT_REQUIRED', 'ADAPT_OPTIONAL'].includes(current.source_route))
    throw new Error(`source route cannot enter production: ${current.source_route}`)
  if (!next[from]?.includes(to)) throw new Error(`invalid factory transition: ${from} → ${to}`)
  const direct = current.source_route === 'DIRECT_USE'
  if (direct && ['adaptation_candidate', 'adaptation_reviewed', 'gold_candidate', 'gold_review_ready', 'gold_certified', 'seed_eligible', 'queued', 'promotion_ready'].includes(from))
    throw new Error('direct-use route cannot reuse adaptation states')
  if (!direct && from === 'direct_use_reviewed') throw new Error('adaptation route cannot reuse direct-use state')
  if (to === 'direct_use_reviewed' && !direct) throw new Error('direct-use route required')
  if (to === 'adaptation_candidate' && !['ADAPT_REQUIRED', 'ADAPT_OPTIONAL'].includes(current.source_route))
    throw new Error('adaptation route required')
  if (to === 'ready' && from === 'benchmark_validated' && !direct)
    throw new Error('existing direct-use article required')
  if (to === 'gold_candidate' && direct) throw new Error('direct-use route has no adaptation Gold-S')
  return { from, proposed_state: to, required_gate: transitionGate[to]!, evidence_hash: digest(current), authorized: false as const }
}

export const factoryArtifactSchema = z.object({
  artifact_id: id,
  kind: z.enum(['source', 'passage', 'item', 'explanation', 'unit', 'volume', 'render', 'publication']),
  product_order_id: id.nullable(),
  order_revision: z.number().int().positive().nullable(),
  evidence_hash: hash,
  depends_on: z.array(id),
}).strict()
export type FactoryArtifact = z.infer<typeof factoryArtifactSchema>

/** Read-only impact plan; callers must reverify current rights/evidence and persist state separately. */
export function planFactoryImpact(artifacts: FactoryArtifact[], changedIds: string[], cause: 'changed' | 'rights_revoked') {
  const rows = artifacts.map(row => factoryArtifactSchema.parse(row))
  const byId = new Map(rows.map(row => [row.artifact_id, row]))
  if (byId.size !== rows.length) throw new Error('duplicate artifact ID')
  for (const row of rows) {
    if ((row.product_order_id === null) !== (row.order_revision === null)) throw new Error('partial order identity')
    if (row.kind !== 'source' && row.product_order_id === null) throw new Error('non-source artifact needs an order')
    if (row.kind !== 'source' && !row.depends_on.length) throw new Error('non-source artifact needs a source-rooted dependency')
    if (row.kind === 'source' && (row.product_order_id !== null || row.depends_on.length)) throw new Error('source must be an order-independent root')
    if (row.kind === 'publication' && !row.depends_on.some(parentId => byId.get(parentId)?.kind === 'render'))
      throw new Error('publication must depend on a render from the same order revision')
    for (const parentId of row.depends_on) {
      const parent = byId.get(parentId)
      if (!parent) throw new Error(`missing dependency: ${parentId}`)
      if (parent.kind !== 'source' && (parent.product_order_id !== row.product_order_id || parent.order_revision !== row.order_revision))
        throw new Error('cross-order dependency')
    }
  }
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (artifactId: string) => {
    if (visiting.has(artifactId)) throw new Error('artifact dependency cycle')
    if (visited.has(artifactId)) return
    visiting.add(artifactId)
    for (const parentId of byId.get(artifactId)!.depends_on) visit(parentId)
    visiting.delete(artifactId)
    visited.add(artifactId)
  }
  for (const row of rows) visit(row.artifact_id)
  for (const changedId of changedIds) if (!byId.has(changedId)) throw new Error(`unknown changed artifact: ${changedId}`)
  const affected = new Set(changedIds)
  let previous = -1
  while (previous !== affected.size) {
    previous = affected.size
    for (const row of rows) if (row.depends_on.some(parent => affected.has(parent))) affected.add(row.artifact_id)
  }
  return rows.filter(row => affected.has(row.artifact_id)).map(row => ({
    artifact_id: row.artifact_id,
    proposed_state: cause === 'rights_revoked' ? 'invalidated' as const : 'stale' as const,
    authorized: false as const,
  }))
}
