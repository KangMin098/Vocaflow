// scripts/csat/__tests__/source-origin-incremental.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { bookCohortSha, apiReadiness } from '../source-origin-search.mjs'
import { freezePublicBaseline, incrementalMetrics, investigationState, promotionEvidenceEvent, validatePublicBaseline } from '../source-origin-incremental.mjs'

const body = 'a'.repeat(64)
function fixture() {
  const row = id => ({ representative_item_id: id, passage_sha256: body, body_sha256_by_item: { [id]: body }, status: 'unresolved', requests: [{ strategy: 'rare', query: 'fixed' }] })
  const rows = [row('x'), { ...row('y'), status: 'confirmed_exact' }], plan = { cohort: rows, cohort_hash_format: 'canonical-body-map-v2', filter: 'partial', maxResults: 40, max_pages_per_query: 2 }
  plan.cohort_sha256 = bookCohortSha(rows)
  const closure = { cohort_sha256: plan.cohort_sha256, scope_ids: ['x'], items: [{ ...rows[0], disposition: 'exhausted', candidates: [], searches: [{ strategy: 'rare', query: 'fixed', search_state: 'evaluated' }] }] }
  const baseline = freezePublicBaseline(plan, closure, rows)
  const readiness = apiReadiness('google_books_api', { credentialPresent: true, projectPresent: true })
  const options = { retriever: 'google_books_api', apiKeyProject: 'vocaflow-books', readiness }
  const attempts = rows.map(r => ({ ...r, ...r.requests[0], retriever: 'google_books_api', state: 'candidates', authenticated: true, api_key_project: 'vocaflow-books', filter: 'partial', maxResults: 40, startIndex: 0, hits: [{ volume_id: 'newbook', title: 'Title' }] }))
  const metrics = { termination: { all_fixed_queries_completed: true }, availability: { queries_completed: 2 } }
  return { plan, baseline, options, attempts, metrics, rows, closure }
}

test('incremental metrics exclude public controls, await novel reviews and require actual registration', () => {
  const f = fixture(), { plan, baseline, options, attempts, metrics, rows } = f
  const pending = incrementalMetrics(plan, attempts, [], metrics, baseline, options)
  assert.equal(pending.incremental_candidate_items, 1); assert.equal(pending.books_incremental_candidate_hit, 0.5)
  assert.equal(pending.books_incremental_AB, null); assert.equal(pending.decision, 'pending')
  const outcome = { ...rows[0], retriever: options.retriever, candidate_id: 'newbook', before: 'G', after: 'B', plausible_candidate: true }
  assert.throws(() => incrementalMetrics(plan, attempts, [outcome], metrics, baseline, { ...options, currentRows: rows }), /registered/)
  const done = incrementalMetrics(plan, attempts, [outcome, { ...outcome, representative_item_id: 'y' }], metrics, baseline, { ...options, currentRows: [{ ...rows[0], status: 'supported_candidate' }] })
  assert.equal(done.incremental_AB_items, 1); assert.equal(done.books_candidate_precision, 1); assert.equal(done.queries_per_incremental_AB, 2)
  assert.equal(done.decision, 'next_authorized_lane')
  assert.throws(() => incrementalMetrics(plan, attempts, [{ ...outcome, before: 'B' }], metrics, baseline, options))
  assert.throws(() => incrementalMetrics(plan, attempts, [outcome, { ...outcome, after: 'A' }], metrics, baseline, options), /Conflicting/)
  assert.equal(incrementalMetrics(plan, attempts, [], { ...metrics, termination: { all_fixed_queries_completed: false } }, baseline, options).books_incremental_candidate_hit, null)
})

test('public closure hash and known aliases suppress rediscovery without erasing API pending', () => {
  const f = fixture()
  const held = { ...f.closure, items: [{ ...f.closure.items[0], disposition: 'plausible-but-unverified', candidates: [{ candidate_id: 'publicbook', alias_ids: ['newbook'], verdict: 'G', verification_depth: 'indexed_text', route_checks: [{ state: 'checked' }] }] }] }
  const aliasBaseline = freezePublicBaseline(f.plan, held, f.rows)
  const rediscovery = incrementalMetrics(f.plan, f.attempts, [], f.metrics, aliasBaseline, f.options)
  assert.equal(rediscovery.incremental_candidate_items, 0)
  assert.equal(rediscovery.books_incremental_AB, 0)
  assert.equal(rediscovery.queries_per_incremental_AB, null)
  const withNovel = structuredClone(f.attempts)
  withNovel[0].hits.push({ volume_id: 'actually-new', candidate_rank: 2 })
  const ranked = incrementalMetrics(f.plan, withNovel, [], f.metrics, aliasBaseline, { ...f.options, topN: 1 })
  assert.equal(ranked.review_queue[0].candidates[0].candidate_id, 'actually-new')
  assert.throws(() => validatePublicBaseline(f.plan, { ...f.baseline, baseline_sha256: 'changed' }))
  const state = investigationState(f.baseline.rows[0], apiReadiness('google_books_api'))
  assert.equal(state.public_state, 'G_PUBLIC_EXHAUSTED'); assert.equal(state.api_state, 'G_API_PENDING'); assert.equal(state.public_research_allowed, false)
  const previous = { ...f.rows[0], status: 'supported_candidate', candidate_id: 'book', evidence_ids: ['old'] }
  const event = { ...f.rows[0], candidate_id: 'book', evidence_id: 'old', evidence_type: 'pdf' }
  assert.equal(promotionEvidenceEvent(previous, event).enqueue, false)
  assert.equal(promotionEvidenceEvent(previous, { ...event, evidence_id: 'new' }).enqueue, true)
  assert.throws(() => promotionEvidenceEvent(previous, { ...event, candidate_id: 'other' }))
  assert.throws(() => promotionEvidenceEvent(previous, { ...event, evidence_type: 'metadata' }))
})
