// packages/library-pipeline/src/textbook/parallel-precision.ts
import { z } from 'zod'
import { frymStudentDoi, normalizeResearchDoi, researchBodyHash } from '../ingest-article/research-origin'

const reason = z.string().trim().min(12)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
export const precisionConfidenceSchema = z.object({
  grade: z.enum(['high', 'medium', 'low']).nullable(),
  assessment_state: z.enum(['observer_judgment', 'unassessed']),
  basis: reason,
}).strict().superRefine((value, ctx) => {
  if ((value.assessment_state === 'unassessed') !== (value.grade === null))
    ctx.addIssue({ code: 'custom', message: 'Unassessed confidence must be null' })
})
const span = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), section: z.string().min(1) }).strict()
const anchor = span.extend({ quote: z.string().min(8) }).strict()
export const transformationTypes = [
  'plain_language', 'explicit_definition', 'analogy', 'sentence_decomposition',
  'method_compression', 'numeric_compression', 'qualifier_weakening', 'causal_overstatement',
  'scope_generalization', 'conceptual_reordering', 'background_addition',
] as const
export const precisionAlignmentSchema = z.object({
  id: z.string().min(1),
  verdict: z.enum(['aligned', 'partial', 'contradicted', 'held']),
  reason,
  selection_basis: reason,
  original_claim: reason.nullable(),
  original_evidence: anchor.nullable(),
  fym_claim: reason.nullable(),
  fym_explanation: reason.nullable(),
  fym_evidence: anchor.nullable(),
  omitted_detail: z.object({ description: reason, original_evidence: anchor }).strict().nullable(),
  simplification_type: z.array(z.enum(transformationTypes)),
  lexical_shift: reason.nullable(),
  syntactic_shift: reason.nullable(),
  conceptual_shift: reason.nullable(),
  age_band: z.object({
    value: z.enum(['upper_elementary', 'middle_1', 'middle_2', 'middle_3', 'high_1', 'high_2', 'high_3']).nullable(),
    assessment_state: z.enum(['proposed', 'unassessed']),
    basis: reason,
  }).strict(),
  confidence: precisionConfidenceSchema,
}).strict().superRefine((value, ctx) => {
  if (value.verdict !== 'held' && (!value.original_claim || !value.original_evidence || !value.fym_claim || !value.fym_explanation || !value.fym_evidence || !value.lexical_shift || !value.syntactic_shift || !value.conceptual_shift || !value.simplification_type.length || value.confidence.assessment_state === 'unassessed'))
    ctx.addIssue({ code: 'custom', message: 'Evaluated alignment needs claims, anchors and transformation judgments' })
  if ((value.age_band.assessment_state === 'unassessed') !== (value.age_band.value === null))
    ctx.addIssue({ code: 'custom', message: 'Age proposal must be explicit; no inferred declared audience' })
})
export const precisionPairSchema = z.object({
  id: z.string().min(1),
  source: z.object({ id: z.string().uuid(), source_id: z.string(), title: z.string(), source_url: z.string().url(), source_revision: z.string(), source_hash: sha256, page_hash: sha256 }).strict(),
  relation: z.object({ doi: z.string(), url: z.string().url(), citation_hash: sha256 }).strict(),
  research: z.object({ access: z.enum(['full_text', 'abstract_only', 'unavailable']), url: z.string().url().nullable(), hash: sha256.nullable(), raw_hash: sha256.nullable(), extraction: z.string().nullable(), checked_at: z.string().datetime({ offset: true }), attempts: z.array(z.string()) }).strict(),
  metadata: z.object({ doi: z.string(), title: z.string().nullable(), authors: z.array(z.string()), container_title: z.string().nullable(), type: z.string().nullable(), url: z.string().url().nullable() }).strict().nullable(),
  files: z.object({ fym: z.string(), fym_page: z.string(), fym_page_hash: sha256, research: z.string().nullable(), research_raw: z.string().nullable(), crossref: z.string().nullable(), epmc: z.string().nullable() }).strict(),
  link_review: z.object({ verdict: z.enum(['verified', 'mismatch', 'held']), reason, identity_checks: z.array(z.enum(['doi', 'title', 'authors'])), confidence: precisionConfidenceSchema }).strict(),
  research_type: z.enum(['experiment', 'observational', 'review', 'theoretical', 'unassessed']),
  reviewed_spans: z.object({ fym: z.array(span), research: z.array(span) }).strict(),
  alignments: z.array(precisionAlignmentSchema).min(1),
}).strict().superRefine((pair, ctx) => {
  if (!frymStudentDoi(pair.source.source_url) || pair.source.source_id !== `frym-full:${frymStudentDoi(pair.source.source_url)}`)
    ctx.addIssue({ code: 'custom', message: 'FYM source URL/key disagree' })
  if (normalizeResearchDoi(pair.relation.doi) !== pair.relation.doi || pair.relation.url !== `https://doi.org/${pair.relation.doi}`)
    ctx.addIssue({ code: 'custom', message: 'Non-canonical research DOI/URL' })
  if (pair.link_review.verdict === 'verified' && (!pair.metadata || !pair.metadata.title?.trim() || !pair.metadata.authors.some((a) => a.trim()) || normalizeResearchDoi(pair.metadata.doi) !== pair.relation.doi ||
      !['doi', 'title', 'authors'].every((c) => pair.link_review.identity_checks.includes(c as 'doi' | 'title' | 'authors')) || pair.link_review.confidence.assessment_state === 'unassessed'))
    ctx.addIssue({ code: 'custom', message: 'Verified link requires independent DOI/title/author checks' })
  if (pair.research.access === 'unavailable' ? Boolean(pair.research.hash || pair.files.research || pair.research.raw_hash || pair.files.research_raw || pair.research.extraction || pair.research.url) : !pair.research.hash || !pair.files.research || !pair.research.raw_hash || !pair.files.research_raw || !pair.research.url || !pair.research.extraction)
    ctx.addIssue({ code: 'custom', message: 'Access evidence files/hashes disagree' })
  for (const a of pair.alignments) {
    if (a.verdict !== 'held' && (pair.link_review.verdict !== 'verified' || pair.research.access !== 'full_text' || !pair.reviewed_spans.fym.length || !pair.reviewed_spans.research.length))
      ctx.addIssue({ code: 'custom', message: 'Full-text alignment requires verified link and recorded reading scope' })
  }
})
export type PrecisionPair = z.infer<typeof precisionPairSchema>

export const precisionRoundSchema = z.object({
  version: z.literal(1), mode: z.literal('local_review'), reviewed_at: z.string().datetime({ offset: true }),
  reviewer: z.literal('codex_observer'), prepared_hash: sha256, origins_hash: sha256,
  selection: z.object({
    method: z.literal('first_declared_original_source_in_source_id_order'), sample_size: z.number().int().min(20).max(50),
    population: z.number().int().positive(),
    counts: z.record(z.number().int().nonnegative()),
    manifests: z.array(z.object({ file: z.string(), sha256 }).strict()),
    screening: z.array(z.object({ id: z.string().uuid(), source_id: z.string(), status: z.enum(['declared_original_source', 'no_explicit_original_source', 'original_source_without_doi', 'held']), declared_dois: z.array(z.string()) }).strict()),
  }).strict(),
  pairs: z.array(precisionPairSchema).min(20),
}).strict().superRefine((round, ctx) => {
  const screening = round.selection.screening
  if (screening.length !== round.selection.population || new Set(screening.map((r) => r.id)).size !== screening.length || new Set(screening.map((r) => r.source_id)).size !== screening.length)
    ctx.addIssue({ code: 'custom', message: 'Screening coverage or UUIDs disagree' })
  const counts: Record<string, number> = {}
  for (const row of screening) counts[row.status] = (counts[row.status] ?? 0) + 1
  if (Object.keys({ ...counts, ...round.selection.counts }).some((key) => (counts[key] ?? 0) !== (round.selection.counts[key] ?? 0)))
    ctx.addIssue({ code: 'custom', message: 'Screening counts disagree' })
  const expected = screening.filter((r) => r.status === 'declared_original_source').sort((a, b) => a.source_id.localeCompare(b.source_id)).slice(0, round.selection.sample_size)
  const actual = new Set(round.pairs.map((p) => p.source.id))
  if (expected.length !== round.selection.sample_size || actual.size !== round.selection.sample_size || expected.some((r) => !actual.has(r.id)))
    ctx.addIssue({ code: 'custom', message: 'Selected articles disagree with declared sampling method' })
  const ids = round.pairs.map((p) => p.id)
  const alignments = round.pairs.flatMap((p) => p.alignments.map((a) => a.id))
  const relations = round.pairs.map((p) => `${p.source.id}:${p.relation.doi}`)
  if (new Set(ids).size !== ids.length || new Set(alignments).size !== alignments.length || new Set(relations).size !== relations.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate pair/alignment/relation IDs' })
  for (const pair of round.pairs) {
    const row = expected.find((r) => r.id === pair.source.id)
    if (!row || row.source_id !== pair.source.source_id || !row.declared_dois.includes(pair.relation.doi))
      ctx.addIssue({ code: 'custom', message: 'Pair is outside screened origins' })
  }
})

function anchorErrors(value: z.infer<typeof anchor> | null, text: string, scope: z.infer<typeof span>[], label: string): string[] {
  if (!value) return []
  if (text.slice(value.start, value.end) !== value.quote) return [`${label}: quote/offset mismatch`]
  if (!scope.some((s) => s.start <= value.start && s.end >= value.end)) return [`${label}: outside recorded reading scope`]
  return []
}
export function validatePrecisionEvidence(pair: PrecisionPair, fym: string, research: string | null): string[] {
  const errors: string[] = []
  if (researchBodyHash(fym) !== pair.source.source_hash) errors.push('FYM hash mismatch')
  if (pair.research.hash && researchBodyHash(research ?? '') !== pair.research.hash) errors.push('Research hash mismatch')
  for (const [label, text, spans] of [['FYM', fym, pair.reviewed_spans.fym], ['Research', research ?? '', pair.reviewed_spans.research]] as const)
    for (const s of spans) if (s.end <= s.start || s.end > text.length) errors.push(`${label}: invalid reading span`)
  for (const a of pair.alignments) {
    errors.push(...anchorErrors(a.fym_evidence, fym, pair.reviewed_spans.fym, a.id))
    errors.push(...anchorErrors(a.original_evidence, research ?? '', pair.reviewed_spans.research, a.id))
    errors.push(...anchorErrors(a.omitted_detail?.original_evidence ?? null, research ?? '', pair.reviewed_spans.research, a.id))
  }
  return errors
}

/** Counts judgments on a selected sample; null accuracy means no eligible judgments, never 0%. */
export function summarizePrecision(pairs: PrecisionPair[]) {
  const links = { total: pairs.length, verified: 0, mismatch: 0, held: 0 }
  const alignment = { total: 0, aligned: 0, partial: 0, contradicted: 0, held: 0 }
  const access = { full_text: 0, abstract_only: 0, unavailable: 0 }
  let goldPairs = 0
  for (const pair of pairs) {
    links[pair.link_review.verdict]++
    access[pair.research.access]++
    if (pair.link_review.verdict === 'verified' && pair.research.access === 'full_text' && pair.alignments.every((a) => a.verdict === 'aligned')) goldPairs++
    for (const a of pair.alignments) {
      alignment.total++
      alignment[a.verdict]++
    }
  }
  const linkJudged = links.verified + links.mismatch
  const alignmentJudged = alignment.aligned + alignment.partial + alignment.contradicted
  return {
    articles: new Set(pairs.map((p) => p.source.id)).size,
    links: { ...links, judged: linkJudged, accuracy: linkJudged ? links.verified / linkJudged : null },
    access,
    pairs: { total: pairs.length, gold_candidates: goldPairs },
    alignment: { ...alignment, judged: alignmentJudged, accuracy: alignmentJudged ? alignment.aligned / alignmentJudged : null },
  }
}
