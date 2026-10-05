// scripts/csat/source-origin-incremental.mjs
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { benchmarkBaseline, publicFulltextMetrics, candidateReviewQueue } from './source-origin-search.mjs'

export function validatePublicBaseline(plan, baseline) {
  benchmarkBaseline(plan, baseline)
  const expected = createHash('sha256').update(JSON.stringify({ cohort_sha256: baseline.cohort_sha256, rows: baseline.rows }, null, 2)).digest('hex')
  if (baseline.baseline_sha256 !== expected || baseline.phase !== 'public_fulltext_closed_before_api') throw new Error('Public baseline is not frozen')
  if (baseline.rows.some(r => !Array.isArray(r.known_candidate_ids) || !Array.isArray(r.known_work_ids) || !['found', 'plausible-but-unverified', 'exhausted'].includes(r.disposition))) throw new Error('Incomplete public baseline')
  return baseline
}

export function freezePublicBaseline(plan, closure, current, priorCandidates = []) {
  publicFulltextMetrics(plan, closure)
  const registry = new Map(current.map(r => [r.representative_item_id, r]))
  const rows = plan.cohort.map(target => {
    const r = registry.get(target.representative_item_id), item = closure.items.find(i => i.representative_item_id === target.representative_item_id)
    if (!r || r.passage_sha256 !== target.passage_sha256 || !isDeepStrictEqual(r.body_sha256_by_item, target.body_sha256_by_item)) throw new Error('Fresh baseline body mismatch')
    const known = item?.candidates ?? priorCandidates.filter(c => c.representative_item_id === target.representative_item_id)
    const resolved = ['confirmed_exact', 'supported_candidate'].includes(r.status)
    if (!item && !resolved) throw new Error('Missing public closure for unresolved item')
    const grade = item?.candidates.some(c => c.verdict === 'A') ? 'confirmed_exact' : item?.candidates.some(c => c.verdict === 'B') ? 'supported_candidate' : 'unresolved'
    if (item && grade !== r.status) throw new Error('Public closure differs from registry')
    return { representative_item_id: r.representative_item_id, passage_sha256: r.passage_sha256, body_sha256_by_item: r.body_sha256_by_item, status: r.status,
      disposition: item?.disposition ?? 'found', known_candidate_ids: [...new Set(known.flatMap(c => [c.candidate_id, ...(c.alias_ids ?? [])]).filter(Boolean))],
      known_work_ids: [...new Set(known.map(c => c.canonical_work_id).filter(Boolean))] }
  })
  const content = { cohort_sha256: plan.cohort_sha256, rows }
  return { ...content, phase: 'public_fulltext_closed_before_api', baseline_sha256: createHash('sha256').update(JSON.stringify(content, null, 2)).digest('hex') }
}

export function incrementalMetrics(plan, attempts, outcomes, metrics, baseline, options) {
  validatePublicBaseline(plan, baseline)
  const byId = new Map(baseline.rows.map(r => [r.representative_item_id, r]))
  const selected = candidateReviewQueue(plan, attempts, { ...options, requireIdentification: true, excludeCandidate: (c, row) => {
    const b = byId.get(row.representative_item_id)
    return b.status !== 'unresolved' || b.known_candidate_ids.includes(c.candidate_id) || Boolean(c.canonical_work_id && b.known_work_ids.includes(c.canonical_work_id))
  } })
  const eligible = selected.filter(r => byId.get(r.representative_item_id).status === 'unresolved')
  const keys = new Map(eligible.flatMap(r => r.candidates.map(c => [JSON.stringify([r.representative_item_id, c.candidate_id]), { row: r, candidate: c }])))
  const reviews = new Map()
  for (const o of outcomes.filter(o => o.retriever === options.retriever)) {
    const key = JSON.stringify([o.representative_item_id, o.candidate_id]), selected = keys.get(key)
    if (!selected) continue
    if (o.passage_sha256 !== selected.row.passage_sha256 || !isDeepStrictEqual(o.body_sha256_by_item, selected.row.body_sha256_by_item) || o.before !== 'G' || !['A', 'B', 'C', 'G'].includes(o.after) || typeof o.plausible_candidate !== 'boolean' || ['A', 'B'].includes(o.after) && !o.plausible_candidate) throw new Error('Unbound incremental review')
    if (reviews.has(key) && !isDeepStrictEqual(reviews.get(key), o)) throw new Error('Conflicting incremental decisions')
    reviews.set(key, o)
  }
  const reviewed = [...reviews.values()], useful = reviewed.filter(o => ['A', 'B'].includes(o.after))
  for (const o of useful) {
    const current = options.currentRows?.find(r => r.representative_item_id === o.representative_item_id)
    if (!current || current.passage_sha256 !== o.passage_sha256 || !isDeepStrictEqual(current.body_sha256_by_item, o.body_sha256_by_item) || current.status !== (o.after === 'A' ? 'confirmed_exact' : 'supported_candidate')) throw new Error('Incremental attribution has not been registered')
  }
  const hits = new Set(eligible.filter(r => r.candidates.length).map(r => r.representative_item_id))
  const plausible = new Set(reviewed.filter(o => o.plausible_candidate).map(o => o.representative_item_id))
  const usefulItems = new Set(useful.map(o => o.representative_item_id))
  const retrievalComplete = metrics.termination.all_fixed_queries_completed
  const complete = retrievalComplete && reviews.size === keys.size
  const decision = !complete ? 'pending' : plausible.size >= 5 ? 'expand_books' : plausible.size >= 2 ? 'prepare_academic_cohort' : 'next_authorized_lane'
  return { baseline_sha256: baseline.baseline_sha256, cohort_size: baseline.rows.length, baseline_AB: baseline.rows.filter(r => ['confirmed_exact', 'supported_candidate'].includes(r.status)).length,
    selected_novel_candidates: keys.size, candidates_reviewed: reviews.size, incremental_candidate_items: hits.size, plausible_candidate_items: plausible.size, incremental_AB_items: usefulItems.size,
    books_incremental_candidate_hit: retrievalComplete ? hits.size / baseline.rows.length : null,
    books_incremental_AB: complete ? usefulItems.size / baseline.rows.length : null,
    books_candidate_precision: reviewed.length ? useful.length / reviewed.length : null,
    queries_per_incremental_AB: complete && usefulItems.size ? metrics.availability.queries_completed / usefulItems.size : null,
    retrieval_complete: retrievalComplete, novel_verification_complete: complete, decision, review_queue: eligible.filter(r => r.candidates.length),
    limitation: 'Top-N novel candidates on public-unresolved passages only. New IDs across editions need reviewed alias/work identities. Plausibility is reviewed, not inferred from metadata; thresholds are operational, not population yield estimates.' }
}

export function investigationState(baselineRow, readiness) {
  const registered = ['confirmed_exact', 'supported_candidate'].includes(baselineRow.status)
  return { public_state: registered ? 'REGISTERED' : baselineRow.disposition === 'exhausted' ? 'G_PUBLIC_EXHAUSTED' : baselineRow.disposition === 'plausible-but-unverified' ? 'G_STRONG_CANDIDATE_UNVERIFIED' : 'G_OPEN',
    api_state: readiness.eligible ? 'ready' : registered ? 'pending_credentials' : 'G_API_PENDING', public_research_allowed: !registered && !['exhausted', 'plausible-but-unverified'].includes(baselineRow.disposition) }
}

export function promotionEvidenceEvent(previous, incoming) {
  if (previous.status !== 'supported_candidate' || previous.representative_item_id !== incoming.representative_item_id || previous.passage_sha256 !== incoming.passage_sha256 || !isDeepStrictEqual(previous.body_sha256_by_item, incoming.body_sha256_by_item)) throw new Error('Promotion event identity mismatch')
  if (!incoming.candidate_id || !incoming.evidence_id || !['edition', 'pdf', 'page_image', 'original_snippet'].includes(incoming.evidence_type)) throw new Error('Promotion needs identified new evidence')
  if (incoming.candidate_id !== previous.candidate_id) throw new Error('Promotion event candidate mismatch')
  return { enqueue: !(previous.evidence_ids ?? []).includes(incoming.evidence_id), reason: (previous.evidence_ids ?? []).includes(incoming.evidence_id) ? 'already_seen' : 'new_evidence', event: incoming }
}
