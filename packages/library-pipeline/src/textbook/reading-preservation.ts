// packages/library-pipeline/src/textbook/reading-preservation.ts
import { z } from 'zod'
import { precisionRoundSchema } from './parallel-precision'
import { readingTargetSchema } from './academic-reading'

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const text = z.string().trim().min(12)
export const preservationEntrySchema = z.object({
  pair_id: z.string().min(1),
  alignment_id: z.string().min(1),
  source_id: z.string().uuid(),
  source_key: z.string().min(1),
  source_url: z.string().url(),
  source_revision: z.string().min(1),
  source_hash: hash,
  original_work_id: z.string().min(1),
  research_hash: hash,
  research_quote: text,
  source_quote: text,
  rules: z.array(z.object({
    id: z.string().min(1),
    kind: z.enum(['functional_difference', 'scope', 'comparison', 'association']),
    must_preserve: text,
    allowed_changes: text,
  }).strict()).min(1),
}).strict().superRefine((entry, ctx) => {
  if (new Set(entry.rules.map(r => r.id)).size !== entry.rules.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate preservation rule IDs' })
})
export const preservationPackSchema = z.object({
  version: z.literal(1),
  assessment_state: z.literal('observer_judgment'),
  review_hash: hash,
  entries: z.array(preservationEntrySchema).min(1),
}).strict().superRefine((pack, ctx) => {
  if (new Set(pack.entries.map(e => e.source_id)).size !== pack.entries.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate preservation sources' })
})
export const preservationTaskSchema = z.object({
  version: z.literal(1),
  review_hash: hash,
  rules_hash: hash,
  entry: preservationEntrySchema,
}).strict()
export type PreservationTask = z.infer<typeof preservationTaskSchema>
export const preservationChecksSchema = z.array(z.object({
  rule_id: z.string().min(1),
  verdict: z.enum(['preserved', 'changed', 'held']),
  passage_quote: z.string().trim().min(8).nullable(),
  reason: text,
}).strict())

// This checks provenance and review eligibility, not the semantics of must_preserve.
export function validatePreservationPack(value: unknown, review: unknown, reviewHash: string) {
  const pack = preservationPackSchema.parse(value)
  const round = precisionRoundSchema.parse(review)
  if (pack.review_hash !== reviewHash) throw new Error('Precision review hash changed')
  for (const e of pack.entries) {
    const p = round.pairs.find(p => p.id === e.pair_id)
    const a = p?.alignments.find(a => a.id === e.alignment_id)
    if (!p || !a || p.link_review.verdict !== 'verified' || p.research.access !== 'full_text' ||
        p.alignments.some(a => a.verdict !== 'aligned'))
      throw new Error(`${e.pair_id}: not an eligible recorded alignment candidate`)
    if (e.source_id !== p.source.id || e.source_key !== p.source.source_id ||
        e.source_url !== p.source.source_url || e.source_revision !== p.source.source_revision ||
        e.source_hash !== p.source.source_hash || e.original_work_id !== p.relation.doi ||
        e.research_hash !== p.research.hash || e.source_quote !== a.fym_evidence?.quote ||
        e.research_quote !== a.original_evidence?.quote)
      throw new Error(`${e.pair_id}: preservation evidence binding changed`)
  }
  return pack
}

export function validatePreservationChecks(task: PreservationTask | null, value: unknown, passage: string): string | null {
  const parsed = preservationChecksSchema.safeParse(value ?? [])
  if (!parsed.success) return 'invalid preservation checks'
  const checks = parsed.data
  const rules = task?.entry.rules ?? []
  if (checks.length !== rules.length || new Set(checks.map(c => c.rule_id)).size !== checks.length ||
      checks.some(c => !rules.some(r => r.id === c.rule_id))) return 'preservation rule coverage mismatch'
  for (const c of checks) {
    if (c.verdict !== 'preserved') return `preservation ${c.verdict}: ${c.rule_id}`
    if (!c.passage_quote || !passage.includes(c.passage_quote)) return `preservation quote absent: ${c.rule_id}`
  }
  return null
}

const observerReview = z.object({ verdict: z.enum(['preserved', 'changed', 'held']), reason: text }).strict()
export const preservationPilotSchema = z.object({
  version: z.literal(1),
  mode: z.literal('local_observer_pilot'),
  review_hash: hash,
  rules_hash: hash,
  records: z.array(z.object({
    id: z.string().min(1),
    pair_id: z.string().min(1),
    target: readingTargetSchema,
    target_key: z.string().regex(/^[a-f0-9]{24}$/),
    text: text,
    text_hash: hash,
    source_attribution: text,
    checks: preservationChecksSchema,
    focus_question: z.object({
      skill: z.enum(['R4', 'R8']), prompt: text, expected_response: text, evidence: text,
    }).strict(),
    observer_review: observerReview,
  }).strict()).min(1),
  negative_cases: z.array(z.object({
    alignment_id: z.string().min(1),
    kind: z.enum(['scope', 'comparison']),
    changed_claim: text,
    observer_review: observerReview,
  }).strict()).min(1),
}).strict()
