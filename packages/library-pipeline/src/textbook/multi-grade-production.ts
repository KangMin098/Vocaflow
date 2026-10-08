// packages/library-pipeline/src/textbook/multi-grade-production.ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { bindMultiGradeEvidence, planMultiGradeVolume, sealMultiGradeProductOrder } from './multi-grade-order'
import { canonicalJson, reviewDigest } from './review-digest'
import { renderVolumeDocument, type VolumeDocumentInput } from './volume-document'

const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
const digest = (value: unknown) => sha(canonicalJson(value))
export const MULTI_GRADE_DRY_RUN_MARKER = '<!-- SYNTHETIC DRY RUN: CALLER-SUPPLIED EVIDENCE; NOT APPROVED FOR PUBLICATION -->'
const hex = z.string().regex(/^[a-f0-9]{64}$/)
const id = z.string().trim().min(1)
const lineageSchema = z.object({
  product_order_id: id, order_revision: z.number().int().positive(), order_hash: hex,
  source_hash: hex, adaptation_hash: hex.nullable(), rights_hash: hex, benchmark_snapshot_hash: hex,
  promotion_request_hash: hex, evidence_hash: hex, certificate_hash: hex, eligibility_hash: hex,
  trust_policy_hash: hex,
}).passthrough()
const itemSchema = z.object({ id, ref_id: id, payload: z.record(z.unknown()), answer_key: z.object({ answer: z.number().int() }).passthrough() }).strict()
const stageSchema = z.object({
  grade: id, article_id: id, passage: z.string().min(1), lineage: lineageSchema,
  items: z.array(itemSchema).min(1),
  explanations: z.array(z.object({ item_id: id, text: z.string().min(1), item_digest: hex, factory_lineage: lineageSchema }).strict()),
  reviews: z.array(z.object({ item_id: id, decision: z.literal('approved'), item_digest: hex,
    explanation_hash: hex, factory_lineage: lineageSchema }).strict()),
  activities: z.array(z.unknown()), analysis: z.unknown(),
  unit: z.object({ unit_id: id, html: z.string().min(1) }).strict(),
}).strict()
const renderSchema = z.object({
  colophon: z.object({ title: id, ladder: z.string(), edition: z.string(), issued: id,
    sourcePolicy: z.string(), review: z.string() }).strict(),
  step: z.number().int().nullable(), schoolBand: z.string().nullable(), vLevel: z.number().int().nonnegative(),
  totalSteps: z.number().int().positive(), totalMinutes: z.number().nonnegative(),
  autoPassed: z.number().int().nonnegative(), autoTotal: z.number().int().nonnegative(),
  passageChip: z.string(), answerBias: z.object({ chi2: z.number().nonnegative(),
    cramersV: z.number().min(0).max(1), biased: z.boolean() }).strict().nullable(),
  proof: z.object({ passages: z.number().int().nonnegative(), defective: z.number().int().nonnegative() }).strict(),
  coverBrand: z.string().optional(), accent: z.string().optional(),
}).strict().superRefine((render, ctx) => {
  if (render.autoPassed > render.autoTotal || render.proof.defective > render.proof.passages)
    ctx.addIssue({ code: 'custom', message: 'render counts inconsistent' })
})

export function runMultiGradeFactoryDryRun(input: {
  group: unknown
  evidence: unknown
  currentEvidence: unknown
  currentLineages: unknown
  stages: unknown
  render: Omit<VolumeDocumentInput, 'unitsHtml' | 'answers' | 'unitCount' | 'itemCount'>
}) {
  const sealed = sealMultiGradeProductOrder(input.group)
  const recorded = bindMultiGradeEvidence(sealed.group, input.evidence)
  const current = bindMultiGradeEvidence(sealed.group, input.currentEvidence)
  if (recorded.evidence_hash !== current.evidence_hash) throw Error('MULTI_GRADE_PRODUCTION_STALE')
  const stages = z.array(stageSchema).length(sealed.group.orders.length).parse(input.stages)
  const currentLineages = z.array(z.object({ grade: id, article_id: id, source_id: id, lineage: lineageSchema }).strict())
    .length(sealed.group.orders.length).parse(input.currentLineages)
  if (new Set(currentLineages.map(value => value.article_id)).size !== currentLineages.length)
    throw Error('MULTI_GRADE_READING_CHILD_REUSED')
  const units = []
  const itemEvidence = []
  const answers: VolumeDocumentInput['answers'] = []
  const seenItems = new Set<string>()
  for (const [index, stage] of stages.entries()) {
    const child = sealed.group.orders[index]!
    const variant = recorded.evidence.variants[index]!
    const currentLineage = currentLineages[index]!
    if (currentLineage.grade !== stage.grade || currentLineage.article_id !== stage.article_id ||
      currentLineage.source_id !== recorded.evidence.source_id ||
      digest(currentLineage.lineage) !== digest(stage.lineage)) throw Error('MULTI_GRADE_PROMOTION_STALE_OR_MIXED')
    if (stage.grade !== child.grade || stage.lineage.product_order_id !== child.order.product_order_id ||
      stage.lineage.order_revision !== child.order.order_revision || stage.lineage.order_hash !== sealed.child_order_hashes[child.grade] ||
      stage.lineage.source_hash !== recorded.evidence.source_hash || stage.lineage.rights_hash !== recorded.evidence.rights_hash ||
      stage.lineage.adaptation_hash !== variant.passage_hash || stage.lineage.benchmark_snapshot_hash !== variant.benchmark_snapshot_hash ||
      sha(stage.passage) !== variant.passage_hash ||
      (variant.adaptation_hash !== null && digest(stage.passage.trim()) !== variant.adaptation_hash))
      throw Error('MULTI_GRADE_READY_LINEAGE_STALE_OR_MIXED')
    if (new Set(stage.items.map(item => item.id)).size !== stage.items.length ||
      stage.explanations.length !== stage.items.length || stage.reviews.length !== stage.items.length)
      throw Error('MULTI_GRADE_ITEM_COUNT_MISMATCH')
    const byExplanation = new Map(stage.explanations.map(value => [value.item_id, value]))
    const byReview = new Map(stage.reviews.map(value => [value.item_id, value]))
    if (byExplanation.size !== stage.items.length || byReview.size !== stage.items.length) throw Error('MULTI_GRADE_EDITORIAL_DUPLICATE')
    const itemDigests = []
    for (const item of stage.items) {
      if (seenItems.has(item.id)) throw Error('MULTI_GRADE_ITEM_DUPLICATE')
      seenItems.add(item.id)
      if (item.ref_id !== stage.article_id || item.payload.passage !== stage.passage ||
        digest(item.payload.factory_lineage) !== digest(stage.lineage))
        throw Error('MULTI_GRADE_ITEM_LINEAGE_STALE_OR_MIXED')
      const itemDigest = reviewDigest(item.payload, item.answer_key)
      const explanation = byExplanation.get(item.id)
      const review = byReview.get(item.id)
      if (!explanation || !review || explanation.item_digest !== itemDigest || review.item_digest !== itemDigest ||
        digest(explanation.factory_lineage) !== digest(stage.lineage) ||
        digest(review.factory_lineage) !== digest(stage.lineage) || review.explanation_hash !== sha(explanation.text))
        throw Error('MULTI_GRADE_EDITORIAL_STALE_OR_MIXED')
      itemDigests.push([item.id, itemDigest])
      itemEvidence.push({ grade: stage.grade, item_id: item.id, item_digest: itemDigest,
        explanation_hash: review.explanation_hash, promotion_request_hash: stage.lineage.promotion_request_hash })
      answers.push({ no: answers.length + 1, answer: item.answer_key.answer,
        explanation: { text: explanation.text, from: 'batch' } })
    }
    if (digest(itemDigests) !== variant.item_set_hash ||
      (stage.activities.length ? digest(stage.activities) : null) !== variant.activity_hash ||
      digest(stage.analysis) !== variant.analysis_hash) throw Error('MULTI_GRADE_STAGE_EVIDENCE_STALE')
    units.push({ unit_id: stage.unit.unit_id, grade: stage.grade, product_order_id: variant.product_order_id,
      order_revision: variant.order_revision, order_hash: variant.order_hash,
      source_id: recorded.evidence.source_id, source_hash: recorded.evidence.source_hash,
      rights_hash: recorded.evidence.rights_hash, passage_hash: variant.passage_hash,
      adaptation_hash: variant.adaptation_hash, item_set_hash: variant.item_set_hash,
      activity_hash: variant.activity_hash, benchmark_snapshot_hash: variant.benchmark_snapshot_hash,
      unit_content_hash: sha(stage.unit.html) })
  }
  const plan = planMultiGradeVolume(sealed.group, recorded.evidence, units)
  const render = renderSchema.parse(input.render)
  if (render.proof.passages !== units.length) throw Error('MULTI_GRADE_RENDER_PROOF_MISMATCH')
  const rendered = renderVolumeDocument({ ...render, unitCount: units.length, itemCount: answers.length,
    unitsHtml: stages.map(stage => stage.unit.html).join('\n'), answers })
  const html = MULTI_GRADE_DRY_RUN_MARKER + '\n' + rendered
  const manifest = { schema: 'textbook-multi-grade-factory-dry-run/1', evidence_level: 'caller_supplied_unverified',
    render_eligible: false, seed_eligible: false, group_id: sealed.group.group_id,
    group_hash: sealed.group_hash, evidence_hash: recorded.evidence_hash, plan_hash: plan.plan_hash,
    html_sha256: sha(html), units, item_evidence: itemEvidence }
  return { html, manifest: { ...manifest, manifest_hash: digest(manifest) } }
}
