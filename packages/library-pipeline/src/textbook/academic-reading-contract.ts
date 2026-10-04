// packages/library-pipeline/src/textbook/academic-reading-contract.ts
import { z } from 'zod'
import {
  articleLicenseSchema,
  readingLicenseBlockers,
  readingTargetSchema,
  READING_ENGINE_VERSION,
  SOURCE_SCORE_WEIGHTS,
  type ReadingTarget,
} from './academic-reading'

const level = z.number().int().min(0).max(11)
const evidence = z.string().trim().min(8)
const axis = z.object({ level, evidence }).strict()
// 0–11은 이 명세의 독립 서열척도다. V-Level 측정치로 대체하지 않는다.
export const readingProfileSchema = z
  .object({
    lexical_level: axis,
    syntax_level: axis,
    abstraction_level: axis,
    information_density: axis,
    discourse_level: axis,
    inference_level: axis,
    background_knowledge: axis,
    age_appropriateness: z.object({ appropriate: z.boolean(), evidence }).strict(),
    exam_level: z
      .object({
        exam: z.enum(['none', 'psat_8_9', 'sat', 'act', 'toefl', 'csat', 'lsat']),
        evidence,
      })
      .strict(),
    overall_level: axis,
  })
  .strict()
export const readingItemPlanSchema = z
  .object({
    skill: z.enum([
      'R0',
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
      'R6',
      'R7',
      'R8',
      'R9',
      'R10',
      'R11',
      'R12',
      'R13',
    ]),
    kind: z.enum(['activity', 'question']),
    item_reasoning_level: level,
    item_difficulty: level,
    difficulty_evidence: evidence,
    prompt: z.string().trim().min(8),
    expected_response: z.string().trim().min(8),
    evidence: z.array(z.string().trim().min(8)).min(1),
    resource_evidence: z
      .array(z.object({ resource_index: z.number().int().nonnegative(), quote: evidence }).strict())
      .default([]),
    time_limit_seconds: z.number().int().positive().nullable(),
  })
  .strict()
const scoreShape = Object.fromEntries(
  Object.entries(SOURCE_SCORE_WEIGHTS).map(([key, max]) => [key, z.number().min(0).max(max)])
)
export const readingAnalysisSchema = z
  .object({
    source_profile: readingProfileSchema,
    passage_profile: readingProfileSchema,
    source_claims: z.array(z.object({ claim: evidence, quote: evidence }).strict()).min(1),
    discourse: z.array(z.object({ relation: evidence, quote: evidence }).strict()).min(1),
    preserved_claims: z
      .array(z.object({ source_quote: evidence, passage_quote: evidence }).strict())
      .min(1),
    added_background: z.array(
      z.object({ text: evidence, canonical_url: z.string().url() }).strict()
    ),
    item_plan: z.array(readingItemPlanSchema).min(1),
    source_score: z.object(scoreShape).strict().optional(),
    parallel_pair: z
      .object({
        original_work_id: z.string().min(1),
        research_url: z.string().url(),
        student_url: z.string().url(),
        evidence,
      })
      .strict()
      .nullable(),
  })
  .strict()
export type ReadingAnalysis = z.infer<typeof readingAnalysisSchema>
export const readingItemMetadataSchema = z
  .object({
    version: z.literal(READING_ENGINE_VERSION),
    target: readingTargetSchema,
    skill: z.enum([
      'R0',
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
      'R6',
      'R7',
      'R8',
      'R9',
      'R10',
      'R11',
      'R12',
      'R13',
    ]),
    passage_level: level,
    item_reasoning_level: level,
    item_difficulty: level,
    difficulty_evidence: evidence,
    evidence: z.array(evidence).min(1),
  })
  .strict()

/** 실제 제시문은 원본 그대로거나 유형이 요구한 한 구간 치환이어야 한다. */
export function validateReadingPresentation(
  row: { passage?: string; passage_edited?: string; swapped?: { from?: string; to?: string } },
  original: string,
  type: string
): string | null {
  const shown = (row.passage_edited ?? row.passage ?? '').trim()
  const source = original.trim()
  if (shown === source)
    return type === 'blank' || type === 'long_vocab'
      ? 'required passage transformation is missing'
      : null
  if (type === 'blank') {
    const parts = shown.split(/_{2,}/)
    if (
      parts.length === 2 &&
      source.startsWith(parts[0]!) &&
      source.endsWith(parts[1]!) &&
      source.length > parts[0]!.length + parts[1]!.length
    )
      return null
  }
  if (
    type === 'long_vocab' &&
    row.swapped?.from &&
    row.swapped.to &&
    row.swapped.from !== row.swapped.to
  ) {
    let at = source.indexOf(row.swapped.from)
    while (at >= 0) {
      if (
        source.slice(0, at) + row.swapped.to + source.slice(at + row.swapped.from.length) ===
        shown
      )
        return null
      at = source.indexOf(row.swapped.from, at + 1)
    }
  }
  return 'presented passage differs from the exported source beyond the required transformation'
}

const typeSkills: Record<string, readonly string[]> = {
  vocab_choice: ['R1'],
  word_order: ['R2'],
  grammar_choice: ['R2'],
  grammar_fix: ['R2'],
  blank_word: ['R1', 'R2'],
  topic: ['R4'],
  title: ['R4'],
  main_point: ['R4'],
  content_match: ['R2', 'R9'],
  long_match: ['R2', 'R9'],
  purpose: ['R5'],
  claim: ['R10'],
  implication: ['R7', 'R8'],
  blank: ['R7', 'R8'],
  summary: ['R4', 'R7'],
  order: ['R3', 'R6'],
  insert: ['R3', 'R5', 'R6'],
  irrelevant: ['R5', 'R6'],
  long_order: ['R3', 'R6'],
  long_reference: ['R3'],
  long_title: ['R4'],
  long_vocab: ['R1'],
}
export function readingSkillsForType(type: string, target: ReadingTarget): string[] {
  return target.skills.filter((s) => (typeSkills[type] ?? []).includes(s))
}
export function validateReadingItem(
  value: unknown,
  target: ReadingTarget,
  type: string,
  passage: string,
  passageLevel: number
): string | null {
  const result = readingItemMetadataSchema.safeParse(value)
  if (!result.success) return 'reading item metadata incomplete'
  const m = result.data
  // 구조 비교는 값별로 한다. JSONB의 키 순서는 의미가 없다.
  const same = (a: unknown, b: unknown): boolean => {
    if (a === b) return true
    if (Array.isArray(a) && Array.isArray(b))
      return a.length === b.length && a.every((v, i) => same(v, b[i]))
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const x = a as Record<string, unknown>,
        y = b as Record<string, unknown>
      return (
        Object.keys(x).length === Object.keys(y).length &&
        Object.keys(x).every((k) => k in y && same(x[k], y[k]))
      )
    }
    return false
  }
  if (!same(m.target, target)) return 'reading item target mismatch'
  if (!readingSkillsForType(type, target).includes(m.skill))
    return 'item type does not support requested reading skill'
  if (m.passage_level !== passageLevel) return 'passage level differs from the adapted profile'
  if (m.evidence.some((q) => !passage.includes(q)))
    return 'item evidence is absent from exported passage'
  return null
}

export function validateReadingAnalysis(
  target: ReadingTarget,
  value: unknown,
  sourceText: string,
  passage: string
): { ok: true; analysis: ReadingAnalysis } | { ok: false; reason: string } {
  const parsed = readingAnalysisSchema.safeParse(value)
  if (!parsed.success)
    return {
      ok: false,
      reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    }
  const a = parsed.data
  if (!a.passage_profile.age_appropriateness.appropriate)
    return { ok: false, reason: 'age suitability failed' }
  if (a.passage_profile.exam_level.exam !== target.exam)
    return { ok: false, reason: 'exam target mismatch' }
  if (
    a.source_claims.some((c) => !sourceText.includes(c.quote)) ||
    a.discourse.some((c) => !sourceText.includes(c.quote))
  )
    return { ok: false, reason: 'source analysis quote is absent from source' }
  if (
    a.preserved_claims.some(
      (c) => !sourceText.includes(c.source_quote) || !passage.includes(c.passage_quote)
    )
  )
    return { ok: false, reason: 'claim alignment quote is absent' }
  for (const skill of target.skills) {
    if (!a.item_plan.some((i) => i.skill === skill))
      return { ok: false, reason: `item plan missing ${skill}` }
  }
  for (const i of a.item_plan) {
    if (!target.skills.includes(i.skill))
      return { ok: false, reason: `unrequested skill ${i.skill}` }
    if (i.evidence.some((q) => !passage.includes(q)))
      return { ok: false, reason: 'item evidence is absent from adapted passage' }
    if (
      i.resource_evidence.some(
        (q) => !target.resources[q.resource_index]?.content.includes(q.quote)
      )
    )
      return { ok: false, reason: 'resource evidence is absent' }
    if (
      i.skill === 'R11' &&
      !i.resource_evidence.some((q) => target.resources[q.resource_index]?.kind === 'text')
    )
      return { ok: false, reason: 'multi-text evidence is missing' }
    if (
      i.skill === 'R12' &&
      !i.resource_evidence.some((q) => target.resources[q.resource_index]?.kind === 'data')
    )
      return { ok: false, reason: 'data evidence is missing' }
    if (i.skill === 'R13' && !i.time_limit_seconds)
      return { ok: false, reason: 'timed judgment requires a time limit' }
    if (i.skill === 'R0' && i.kind !== 'activity')
      return { ok: false, reason: 'fluency requires a reading activity' }
  }
  return { ok: true, analysis: a }
}
export function validateReadingLicense(
  target: ReadingTarget,
  value: unknown
): { ok: true; rights: z.infer<typeof articleLicenseSchema> } | { ok: false; reason: string } {
  const result = articleLicenseSchema.safeParse(value)
  if (!result.success) return { ok: false, reason: 'article-level license evidence is incomplete' }
  const blockers = readingLicenseBlockers(result.data, target)
  return blockers.length
    ? { ok: false, reason: blockers.join('; ') }
    : { ok: true, rights: result.data }
}
