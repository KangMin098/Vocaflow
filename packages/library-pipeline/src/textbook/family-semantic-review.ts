// packages/library-pipeline/src/textbook/family-semantic-review.ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PRODUCT_FAMILIES } from './academic-reading'
import { canonicalJson } from './review-digest'

/**
 * Family-specific semantic gate for an order-production run. The structural adapters only prove
 * grounding (exact spans, sealed resources, time budgets). Whether a unit actually teaches what
 * its product promises is an LLM judgment, done as a drain: export → an agent reviews each unit
 * against its family criteria and quotes the passage → import. A run is complete only when every
 * unit passes every criterion of its family plus the common criteria.
 */
const COMMON = [
  ['answer_unique', '정답이 하나로 정해지고 다른 선지는 본문으로 배제된다.'],
  ['evidence_supports', '해설과 인용 근거가 정답을 실제로 지지한다.'],
  ['grade_fit', '어휘·문장·배경지식 부담이 대상 학년에 맞다.'],
] as const

export const FAMILY_CRITERIA: Record<keyof typeof PRODUCT_FAMILIES, ReadonlyArray<readonly [string, string]>> = {
  P01: [['level_preserves_claims', '수준을 맞추면서 원문의 핵심 명제를 바꾸지 않았다.'], ['level_signal', '언어 수준이 대상 학년 단계로 조정돼 있다.']],
  P02: [['narrative_elements', '인물·사건·시간 순서가 분명하다.'], ['cause_effect_item', '문항이 사건의 순서나 원인·결과를 묻는다.']],
  P03: [['informational_text', '정보를 설명하는 글이다.'], ['comprehension_summary', '문항이 정보 이해나 요약을 묻는다.']],
  P04: [['subject_concept', '교과 개념을 영어로 읽게 한다.'], ['no_expert_test', '전문지식 시험이 아니라 본문으로 풀린다.']],
  P05: [['focus_in_context', '초점 낱말의 의미가 문맥으로 결정된다.'], ['meaning_item', '문항이 문맥상 의미나 대체 표현을 묻는다.']],
  P06: [['complex_structure', '긴 주어·명사화·관계절·분사·삽입·병렬 중 하나가 초점 문장에 있다.'], ['structure_to_meaning', '문항이 구조를 의미 이해로 연결한다.']],
  P07: [['central_claim', '중심 명제가 하나로 드러난다.'], ['support_distinction', '문항이 중심 명제와 지지 정보를 구분하게 한다.']],
  P08: [['discourse_structure', '글 전개(문장 기능·단락 흐름)가 분명하다.'], ['structure_item', '문항이 문장 기능이나 전개를 묻는다.']],
  P09: [['explicit_relation', '두 근거 사이 관계(인과·대조·예시 등)가 본문에 있다.'], ['relation_item', '문항이 그 관계를 묻는다.']],
  P10: [['warranted_inference', '정답 추론이 본문 근거로 성립한다.'], ['speculation_excluded', '오답이 근거 없는 추측으로 구분된다.']],
  P11: [['evidence_required', '정답을 고르려면 본문 근거를 찾아야 한다.'], ['evidence_cited', '해설이 그 근거를 명시한다.']],
  P12: [['argument_parts', '주장·근거(가정·반론·결론 중 일부)가 드러난다.'], ['argument_item', '문항이 논증 구성 요소를 분석하게 한다.']],
  P13: [['two_texts_compared', '제공된 두 글을 실제로 비교한다.'], ['text_b_not_invented', '두 번째 글 내용을 지어내지 않았다.']],
  P14: [['data_integrated', '표·그래프의 실제 수치와 본문을 함께 써야 풀린다.'], ['values_accurate', '인용한 수치가 자료와 같다.']],
  P15: [['fact_opinion', '사실과 의견을 구분할 수 있다.'], ['time_anchored', '정보의 시점이 유지된다.']],
  P16: [['background_explicit', '배경 설명이 명시돼 있다.'], ['added_fact_sourced', '원문 밖 사실은 출처가 있거나 없다.']],
  P17: [['exam_skill_shape', '시험 능력 구조(재진술·추론·근거)를 연습한다.'], ['original_material', '시험 원문·문제를 복제하지 않았다.']],
  P18: [['compressed_discourse', '짧고 압축된 학술 담화다.'], ['time_budget_fit', '인쇄된 제한 시간이 문항 부담에 맞다.']],
  P19: [['reduced_load', '어려운 언어 요소를 줄였다.'], ['single_skill', '한 번에 한 능력만 연습한다.']],
  P20: [['dense_argument', '고밀도 논증을 다룬다.'], ['comparative_inference', '두 글 사이 비교 추론을 요구한다.']],
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex')

type ReviewRun = {
  volumeInput: { units: Array<{ unit_id: string; grade: string; day: number; primary_skill: string; passage: string; unit_html: string }>
    orders: Array<{ grade: string; order: { product_family: string } }> }
  gatedItems: Array<{ unit_id: string; items: unknown[] }>
  output: { receipt: { receipt_hash: string } }
}

export function exportFamilyReview(run: ReviewRun) {
  const family = run.volumeInput.orders[0]!.order.product_family as keyof typeof PRODUCT_FAMILIES
  const criteria = [...FAMILY_CRITERIA[family], ...COMMON].map(([id, text]) => ({ id, text }))
  const units = [...run.volumeInput.units].sort((a, b) => a.day - b.day || a.grade.localeCompare(b.grade)).map(unit => ({
    unit_id: unit.unit_id, unit_hash: sha(unit.unit_html), grade: unit.grade, day: unit.day,
    primary_skill: unit.primary_skill, passage: unit.passage,
    items: run.gatedItems.find(entry => entry.unit_id === unit.unit_id)?.items ?? [] }))
  const body = { schema: 'textbook-family-review-drain/1', family, family_name: PRODUCT_FAMILIES[family].name,
    family_instruction: PRODUCT_FAMILIES[family].instruction, run_receipt_hash: run.output.receipt.receipt_hash,
    criteria, units,
    fill_contract: 'Write review.out.json: { reviewer_id, units: [{ unit_id, unit_hash, verdict: "pass"|"fail", criteria: { <id>: true|false }, quote, rationale }] }. quote must be an exact substring of the passage that the rationale relies on; any false criterion means verdict fail.' }
  return { ...body, review_hash: sha(canonicalJson(body)) }
}

const reviewSchema = z.object({
  reviewer_id: z.string().trim().min(3),
  units: z.array(z.object({
    unit_id: z.string().min(1), unit_hash: z.string().regex(/^[a-f0-9]{64}$/),
    verdict: z.enum(['pass', 'fail']), criteria: z.record(z.boolean()),
    quote: z.string().trim().min(8), rationale: z.string().trim().min(10),
  }).strict()),
}).strict()

export type FamilyReviewBlocker = { unit_id?: string; reason: string }

/** Imports a family review against the current run. Any missing, stale, unsupported or failing unit blocks. */
export function importFamilyReview(run: ReviewRun, reviewInput: unknown) {
  const drain = exportFamilyReview(run)
  const parsed = reviewSchema.safeParse(reviewInput)
  if (!parsed.success) return { status: 'blocked' as const, blockers: [{ reason: 'FAMILY_REVIEW_SHAPE_INVALID' }] }
  const byId = new Map(parsed.data.units.map(unit => [unit.unit_id, unit]))
  const blockers: FamilyReviewBlocker[] = []
  if (byId.size !== parsed.data.units.length) blockers.push({ reason: 'FAMILY_REVIEW_UNIT_DUPLICATE' })
  for (const id of byId.keys()) if (!drain.units.some(unit => unit.unit_id === id))
    blockers.push({ unit_id: id, reason: 'FAMILY_REVIEW_UNIT_FOREIGN' })
  for (const unit of drain.units) {
    const review = byId.get(unit.unit_id)
    if (!review) { blockers.push({ unit_id: unit.unit_id, reason: 'FAMILY_REVIEW_UNIT_MISSING' }); continue }
    if (review.unit_hash !== unit.unit_hash) { blockers.push({ unit_id: unit.unit_id, reason: 'FAMILY_REVIEW_UNIT_STALE' }); continue }
    if (!unit.passage.includes(review.quote)) { blockers.push({ unit_id: unit.unit_id, reason: 'FAMILY_REVIEW_QUOTE_NOT_IN_PASSAGE' }); continue }
    const missing = drain.criteria.filter(criterion => typeof review.criteria[criterion.id] !== 'boolean')
    if (missing.length || Object.keys(review.criteria).some(id => !drain.criteria.some(criterion => criterion.id === id))) {
      blockers.push({ unit_id: unit.unit_id, reason: 'FAMILY_REVIEW_CRITERIA_MISMATCH' }); continue
    }
    const failed = drain.criteria.filter(criterion => !review.criteria[criterion.id]).map(criterion => criterion.id)
    if (failed.length && review.verdict === 'pass') { blockers.push({ unit_id: unit.unit_id, reason: 'FAMILY_REVIEW_VERDICT_INCONSISTENT' }); continue }
    if (review.verdict === 'fail') blockers.push({ unit_id: unit.unit_id, reason: `FAMILY_REVIEW_FAILED:${failed.join(',') || 'verdict'}` })
  }
  if (blockers.length) return { status: 'blocked' as const, blockers }
  const receipt = { schema: 'textbook-family-review-receipt/1', family: drain.family, review_hash: drain.review_hash,
    run_receipt_hash: drain.run_receipt_hash, reviewer_id: parsed.data.reviewer_id, unit_count: drain.units.length,
    reviews_hash: sha(canonicalJson(parsed.data)) }
  return { status: 'passed' as const, receipt: { ...receipt, receipt_hash: sha(canonicalJson(receipt)) } }
}
