// scripts/csat/__tests__/source-origin-search.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { alternativeQueries, documentFrequencies, searchSegments, provenanceRequests, localAlignment, buildOriginIndex, searchOriginIndex, classifySearchResponse, runProvenanceSearch, extractOaDocument, loadOaDocument } from '../source-origin-search.mjs'
import { classifyOriginLane, bookQueryFamilies, makeBookPlan, bookCandidate, runBookBatch, retrieverStatistics, searchBookInside, pendingBookPlan, summarizeBookRun, bookCohortSha } from '../source-origin-search.mjs'
import { createSerialLimiter, retryAfterMs, requestWithRetry, benchmarkMetrics, candidateReviewQueue, runFixedSemanticBatch, benchmarkBaseline, apiReadiness, benchmarkStage } from '../source-origin-search.mjs'
import { publicFulltextMetrics, promotionMetrics } from '../source-origin-search.mjs'
import { createHash } from 'node:crypto'

test('public closure rejects incomplete, foreign, duplicated or changed-body evidence', () => {
  const body = 'a'.repeat(64), row = { representative_item_id: 'x', passage_sha256: body, body_sha256_by_item: { x: body }, status: 'unresolved', requests: [{ strategy: 'rare', query: 'fixed' }] }
  const plan = { cohort: [row], cohort_sha256: bookCohortSha([row]), cohort_hash_format: 'canonical-body-map-v2' }
  const item = { ...row, disposition: 'exhausted', searches: [{ strategy: 'rare', query: 'fixed', search_state: 'no_index_hits' }], candidates: [] }
  const closure = { cohort_sha256: plan.cohort_sha256, scope_ids: ['x'], items: [item] }
  assert.equal(publicFulltextMetrics(plan, closure).candidate_precision, null)
  for (const changed of [{ ...item, searches: [] }, { ...item, representative_item_id: 'other' }, { ...item, body_sha256_by_item: { x: 'b'.repeat(64) } }, { ...item, searches: [...item.searches, ...item.searches] }, { ...item, disposition: 'found' }]) assert.throws(() => publicFulltextMetrics(plan, { ...closure, items: [changed] }))
  assert.throws(() => publicFulltextMetrics(plan, { ...closure, items: [item, item] }))
})

test('public metrics count rejected and held candidates, preserve measured denominator and depth', () => {
  const body = 'a'.repeat(64), row = { representative_item_id: 'x', passage_sha256: body, body_sha256_by_item: { x: body }, status: 'unresolved', requests: [{ strategy: 'rare', query: 'fixed' }] }
  const other = { ...row, representative_item_id: 'y', body_sha256_by_item: { y: body } }
  const plan = { cohort: [row, other], cohort_sha256: bookCohortSha([row, other]), cohort_hash_format: 'canonical-body-map-v2' }
  const candidate = { candidate_id: 'book', verdict: 'B', verification_depth: 'full_context', route_checks: [{ state: 'checked' }] }
  const closure = { cohort_sha256: plan.cohort_sha256, scope_ids: ['x'], items: [{ ...row, disposition: 'found', searches: [{ strategy: 'rare', query: 'fixed', search_state: 'evaluated' }], candidates: [candidate, { ...candidate, candidate_id: 'rejected', verdict: 'rejected' }] }] }
  const m = publicFulltextMetrics(plan, closure)
  assert.equal(m.cohort_size, 2); assert.equal(m.measured_scope_size, 1)
  assert.equal(m.candidate_precision, 0.5); assert.equal(m.mean_candidates_per_item, 2)
  assert.equal(m.verification_depth.full_context.B_rate, 0.5); assert.equal(m.verification_depth.page_image.A_rate, null)
  assert.equal(m.B_new, 1); assert.equal(m.A_new, 0)
  const p = { ...row, discovery_closure_sha256: createHash('sha256').update(JSON.stringify(closure, null, 2)).digest('hex'), before_grade: 'B', after_grade: 'A', promotion_reason: ['edition_uncertain'], promotion_priority: 'high', state: 'reviewed', verification_depth: 'page_image', checks: [{ state: 'checked' }] }
  assert.equal(promotionMetrics(plan, closure, [p]).promotion_rate, 1)
  assert.equal(promotionMetrics(plan, closure, [{ ...p, state: 'pending', after_grade: 'B', checks: [] }]).promotion_rate, null)
  for (const changed of [{ ...p, discovery_closure_sha256: body }, { ...p, checks: [] }, { ...p, promotion_reason: ['topic_match'] }, { ...p, before_grade: 'G' }]) assert.throws(() => promotionMetrics(plan, closure, [changed]))
  assert.throws(() => promotionMetrics(plan, closure, [p, p]))
})

test('all concurrent Semantic operations share a serial one-second start queue', async () => {
  let clock = 100, active = 0, peak = 0
  const starts = [], limiter = createSerialLimiter({ nowMs: () => clock, sleep: async ms => { clock += ms } })
  const task = async () => { starts.push(clock); active++; peak = Math.max(peak, active); await Promise.resolve(); clock += 200; active--; return clock }
  await Promise.all([limiter(task), limiter(task), limiter(task)])
  assert.deepEqual(starts, [100, 1100, 2100])
  assert.equal(peak, 1)
})

test('Retry-After seconds/date take precedence and errors never become zero results', async () => {
  let clock = 0, calls = 0
  const records = [], waits = []
  const result = await requestWithRetry(new URL('https://www.googleapis.com/books/v1/volumes?q=fixed'), { provider: 'google_books', now: () => 'fixed', nowMs: () => clock,
    sleep: async ms => { waits.push(ms); clock += ms }, random: () => 0, authenticated: true, apiKeyProject: 'vocaflow-books',
    fetchImpl: async () => ++calls === 1 ? { status: 429, headers: { get: () => '2' }, json: async () => ({}) } : { status: 200, json: async () => ({ totalItems: 0 }) },
    onResponse: r => records.push(r) })
  assert.deepEqual(waits, [2000])
  assert.deepEqual(records.map(r => r.availability_state), ['429_rate_limited', 'zero_result'])
  assert.equal(records[1].attempt_no, 2)
  assert.equal(result.metadata.authenticated, true)
  assert.match(result.metadata.query_hash, /^[a-f0-9]{64}$/)
  assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:00:05 GMT', 2000), 3000)
  assert.equal(retryAfterMs('invalid', 0), null)
  for (const [status, availability] of [[401, '403/401_auth'], [503, '5xx_transient']]) {
    const r = await requestWithRetry(new URL('https://example.org/?q=fixed'), { provider: 'google_books', now: () => 'fixed', maxAttempts: 1, fetchImpl: async () => ({ status, json: async () => ({}) }) })
    assert.equal(r.metadata.availability_state, availability)
  }
  const malformed = await requestWithRetry(new URL('https://example.org/?q=fixed'), { provider: 'google_books', now: () => 'fixed', fetchImpl: async () => ({ status: 200, json: async () => ({}) }) })
  assert.equal(malformed.metadata.availability_state, 'parse_failure')
})

function tinyBenchmark() {
  const row = { representative_item_id: 'x', status: 'unresolved', passage_sha256: 'sha', body_sha256_by_item: { x: 'body' }, exam_year: 2025, exam_month: 11,
    requests: [{ strategy: 'rare_exact_6_10', query: '"fixed phrase"' }, { strategy: 'edit_tolerant_anchor', query: '"short phrase"' }] }
  return { filter: 'partial', maxResults: 40, max_pages_per_query: 2, cohort: [row] }
}

test('missing credentials issue no HTTP calls and keep planned/completed separate', async () => {
  const plan = tinyBenchmark()
  const book = await runBookBatch(plan, { now: () => 'fixed', requireIdentification: true, fetchImpl: () => { throw Error('must not call') } })
  const s2 = await runFixedSemanticBatch(plan, { now: () => 'fixed', licensePolicy: { usage: 'internal_research', licenseStatus: 'research_allowed' }, fetchImpl: () => { throw Error('must not call') } })
  assert.equal(book.length, 2)
  assert.equal(s2.length, 2)
  assert.ok(book.every(r => r.state === 'not_attempted_missing_auth' && r.started_at === null && r.attempt_no === null))
  assert.equal(s2[0].query, '"fixed phrase"')
  assert.equal(s2[0].submitted_query, 'fixed phrase')
  const m = benchmarkMetrics(plan, book, [], { retriever: 'google_books_api' })
  assert.equal(m.availability.queries_planned, 2)
  assert.equal(m.availability.queries_attempted, 0)
  assert.equal(m.availability.queries_completed, 0)
  assert.equal(m.availability.queries_missing_auth, 2)
  assert.equal(m.rates.candidate_hit_rate, null)
})

test('credential and license eligibility block calls independently and never become failed searches', async () => {
  assert.equal(apiReadiness('google_books_api', { projectPresent: true }).credential_status, 'missing_key')
  assert.equal(apiReadiness('google_books_api', { credentialPresent: true }).credential_status, 'missing_project')
  assert.equal(apiReadiness('google_books_api', { credentialPresent: true, projectPresent: true, apiDisabled: true }).credential_status, 'api_disabled')
  const policy = apiReadiness('semantic_snippet', { credentialPresent: true })
  assert.equal(policy.benchmark_status, 'pending_license')
  assert.equal(apiReadiness('semantic_snippet', { credentialPresent: true, usage: 'product_db', licenseStatus: 'research_allowed' }).eligible, false)
  assert.equal(apiReadiness('semantic_snippet', { credentialPresent: true, usage: 'product_db', licenseStatus: 'expanded_license_required', expandedLicenseApproved: true }).eligible, true)
  const attempts = await runFixedSemanticBatch(tinyBenchmark(), { key: 'PRIVATE_FAKE_KEY', now: () => 'fixed', fetchImpl: () => { throw Error('must not call') } })
  const metrics = benchmarkMetrics(tinyBenchmark(), attempts, [], { retriever: 'semantic_snippet', readiness: policy })
  assert.equal(metrics.availability.queries_eligible, 0)
  assert.equal(metrics.availability.blocked_license, 2)
  assert.equal(metrics.availability.queries_other_error, 0)
  assert.equal(metrics.availability.http_attempts, 0)
  assert.equal(metrics.rates.candidate_hit_rate, null)
  assert.ok(!JSON.stringify(attempts).includes('PRIVATE_FAKE_KEY'))
})

test('Semantic license changes invalidate successful cache and completion while preserving transport history', async () => {
  const plan = tinyBenchmark(), previous = [], licensePolicy = { usage: 'internal_research', licenseStatus: 'research_allowed' }
  const common = { key: 'dummy', now: () => 'fixed', retryOptions: { limiter: operation => operation(), nowMs: () => 1000 },
    fetchImpl: async () => ({ status: 200, json: async () => ({ data: [] }) }) }
  await runFixedSemanticBatch(plan, { ...common, licensePolicy, onAttempt: r => previous.push(r) })
  const changed = { usage: 'product_db', licenseStatus: 'expanded_license_required', expandedLicenseApproved: true }
  const readiness = apiReadiness('semantic_snippet', { ...changed, credentialPresent: true })
  assert.equal(benchmarkMetrics(plan, previous, [], { retriever: 'semantic_snippet', readiness }).availability.queries_completed, 0)
  let calls = 0
  const next = await runFixedSemanticBatch(plan, { ...common, previous, licensePolicy: changed, fetchImpl: async () => { calls++; return { status: 200, json: async () => ({ data: [] }) } } })
  assert.equal(calls, 2)
  assert.equal(benchmarkMetrics(plan, [...previous, ...next], [], { retriever: 'semantic_snippet', readiness }).availability.queries_completed, 2)
  const deferred = await runFixedSemanticBatch(plan, { ...common, previous: [{ ...previous[0], retry_not_before_ms: 120000 }], forceRefresh: true, licensePolicy: changed, fetchImpl: () => { throw Error('cooldown') } })
  assert.ok(deferred.every(r => r.state === 'not_attempted_provider_blocked'))
})

test('general provenance CLI resumes provider Retry-After across separate runs', async () => {
  const row = tinyBenchmark().cohort[0], request = { provider: 'semantic_scholar', query: 'fixed original query' }
  const options = { now: () => 'fixed', keys: { semantic_scholar: 'dummy' }, licensePolicy: { usage: 'internal_research', licenseStatus: 'research_allowed' },
    retryOptions: { nowMs: () => 1000, limiter: operation => operation(), maxAttempts: 1 } }
  const previous = [{ ...row, ...request, started_at: 'fixed', retry_not_before_ms: 120000 }]
  const deferred = await runProvenanceSearch([{ ...row, requests: [request] }], { ...options, previous, fetchImpl: () => { throw Error('must honor cooldown') } })
  assert.equal(deferred[0].state, 'not_attempted_provider_blocked')
  assert.equal(deferred[0].retry_not_before_ms, 120000)
  let calls = 0
  await runProvenanceSearch([{ ...row, requests: [request] }], { ...options, previous, retryOptions: { ...options.retryOptions, nowMs: () => 120000 },
    fetchImpl: async () => { calls++; return { status: 200, json: async () => ({ data: [] }) } } })
  assert.equal(calls, 1)
})

test('smoke and five-query canary use only frozen queries and cannot be skipped when eligible', () => {
  const plan = tinyBenchmark(), ready = apiReadiness('google_books_api', { credentialPresent: true, projectPresent: true })
  assert.equal(benchmarkStage(plan, 'smoke', [], ready, 'google_books_api', 'vocaflow-books').cohort[0].requests.length, 1)
  assert.throws(() => benchmarkStage(plan, 'full', [], ready, 'google_books_api', 'vocaflow-books'), /smoke first/)
  const smoke = { ...plan.cohort[0], ...plan.cohort[0].requests[0], phase: 'smoke', state: 'smoke_schema_valid', schema_valid: true, retriever: 'google_books_api', authenticated: true, credential_present: true, api_key_project: 'vocaflow-books', filter: plan.filter, maxResults: 40, startIndex: 0 }
  const canary = benchmarkStage(plan, 'canary', [smoke], ready, 'google_books_api', 'vocaflow-books')
  assert.deepEqual(canary.cohort[0].requests, plan.cohort[0].requests)
  assert.throws(() => benchmarkStage(plan, 'full', [smoke], ready, 'google_books_api', 'vocaflow-books'), /canary/)
  const previous = [smoke, ...plan.cohort[0].requests.map(q => ({ ...smoke, ...q, phase: 'canary', state: 'no_results', hits: [] }))]
  assert.equal(benchmarkStage(plan, 'full', previous, ready, 'google_books_api', 'vocaflow-books').cohort.length, 1)
  assert.throws(() => benchmarkStage(plan, 'full', previous, ready, 'google_books_api', 'different-project'), /smoke/)
  const partialPage = previous.map(r => r.phase === 'canary' && r.query === smoke.query ? { ...r, state: 'candidates', hits: Array.from({ length: 40 }, (_, i) => ({ volume_id: String(i) })), reported_total: 60 } : r)
  assert.throws(() => benchmarkStage(plan, 'full', partialPage, ready, 'google_books_api', 'vocaflow-books'), /canary/)
  assert.equal(benchmarkStage(plan, 'full', [...partialPage, { ...partialPage[1], startIndex: 40, hits: [{ volume_id: 'last' }] }], ready, 'google_books_api', 'vocaflow-books').cohort.length, 1)
  assert.equal(benchmarkMetrics(plan, [smoke], [], { retriever: 'google_books_api', apiKeyProject: 'vocaflow-books' }).availability.queries_other_error, 0)
})

test('disabled Books API has a closed error classification and no response body leaks to metadata', async () => {
  const { metadata } = await requestWithRetry(new URL('https://www.googleapis.com/books/v1/volumes?q=fixed&key=PRIVATE_FAKE_KEY'), {
    provider: 'google_books', now: () => 'fixed', maxAttempts: 1,
    fetchImpl: async () => ({ status: 403, json: async () => ({ error: { errors: [{ reason: 'accessNotConfigured', message: 'PRIVATE_FAKE_KEY' }] } }) }),
  })
  assert.equal(metadata.api_disabled, true)
  assert.ok(!JSON.stringify(metadata).includes('PRIVATE_FAKE_KEY'))
})

test('retry cooldown survives a new batch and never sleeps beyond declared budget', async () => {
  const plan = tinyBenchmark(), previous = []
  let calls = 0
  await runBookBatch(plan, { now: () => 'fixed', key: 'dummy', apiKeyProject: 'vocaflow-books', previous,
    retryOptions: { nowMs: () => 0, maxWaitMs: 30000 }, onAttempt: r => previous.push(r),
    fetchImpl: async () => { calls++; return { status: 429, headers: { get: () => '120' }, json: async () => ({}) } } })
  assert.equal(calls, 1)
  assert.equal(previous[0].retry_not_before_ms, 120000)
  const next = await runBookBatch(plan, { now: () => 'fixed', key: 'dummy', apiKeyProject: 'vocaflow-books', previous, forceRefresh: true, retryOptions: { nowMs: () => 1000 }, fetchImpl: () => { throw Error('cooldown') } })
  assert.ok(next.every(r => r.state === 'not_attempted_provider_blocked'))
})

test('benchmark closes only after all fixed queries and bound top-N reviews; retries deduplicate', async () => {
  const plan = tinyBenchmark(), attempts = []
  let calls = 0, clock = 0
  await runBookBatch(plan, { now: () => 'fixed', key: 'dummy', apiKeyProject: 'vocaflow-books', requireIdentification: true,
    retryOptions: { nowMs: () => clock, sleep: async ms => { clock += ms }, random: () => 0 }, onAttempt: r => attempts.push(r),
    fetchImpl: async () => { calls++; return calls === 1 ? { status: 429, json: async () => ({}) } : calls === 2 ? { status: 200, json: async () => ({ totalItems: 1, items: [{ id: 'book1', volumeInfo: { title: 'Title' } }] }) } : { status: 200, json: async () => ({ totalItems: 0 }) } } })
  const options = { retriever: 'google_books_api', apiKeyProject: 'vocaflow-books' }
  const beforeReview = benchmarkMetrics(plan, attempts, [], options)
  assert.equal(beforeReview.availability.queries_attempted, 2)
  assert.equal(beforeReview.availability.http_attempts, 3)
  assert.equal(beforeReview.availability.queries_429, 1)
  assert.equal(beforeReview.availability.queries_completed, 2)
  assert.equal(beforeReview.rates.candidate_hit_rate, 1)
  assert.equal(beforeReview.rates.useful_hit_rate, null)
  assert.equal(beforeReview.termination.benchmark_complete, false)
  const outcome = { ...plan.cohort[0], retriever: 'google_books_api', candidate_id: 'book1', before: 'G', after: 'A' }
  const final = benchmarkMetrics(plan, attempts, [outcome], options)
  assert.equal(final.rates.useful_hit_rate, 1)
  assert.equal(final.rates.queries_per_useful_source, 2)
  assert.equal(final.termination.benchmark_complete, true)
  assert.equal(final.rates.A_rate, 1)
  const control = structuredClone(plan); control.cohort[0].current_status = 'confirmed_exact'
  assert.equal(benchmarkMetrics(control, attempts, [outcome], options).rates.A_rate, 0)
  control.cohort[0].current_status = 'topic_lineage_only'
  assert.equal(benchmarkMetrics(control, attempts, [outcome], options).rates.A_rate, 0)
  assert.equal(benchmarkBaseline(control).rows[0].status, 'topic_lineage_only')
  control.benchmark_baseline = benchmarkBaseline(plan)
  assert.equal(benchmarkMetrics(control, attempts, [outcome], options).rates.A_rate, 1)
  assert.throws(() => benchmarkBaseline(plan, { ...control.benchmark_baseline, rows: [] }), /baseline identity/)
  assert.equal(benchmarkMetrics(plan, attempts, [], { retriever: 'google_books_api' }).availability.queries_completed, 0)
  const broken = attempts.map(r => r.state === 'candidates' ? { ...r, hits: [{ title: 'No stable ID' }] } : r)
  assert.equal(benchmarkMetrics(plan, broken, [], options).termination.benchmark_complete, false)
  assert.equal(classifySearchResponse('semantic_scholar', 200, { data: [{ text: 'missing id' }] }).state, 'invalid_response')
  assert.throws(() => benchmarkMetrics(plan, attempts, [{ ...outcome, body_sha256_by_item: {} }], options), /Unbound/)
  assert.equal(candidateReviewQueue(plan, attempts, { ...options, requireIdentification: true })[0].candidates.length, 1)
})

test('official Semantic corpus IDs survive parsing, ranking and deduplication; malformed arrays do not crash', () => {
  const plan = tinyBenchmark(), hit = { paper: { corpusId: 123, title: 'Paper' }, snippet: { text: 'target text' } }
  assert.equal(classifySearchResponse('semantic_scholar', 200, { data: [hit] }).state, 'candidates')
  assert.equal(classifySearchResponse('google_books', 200, { totalItems: 0, items: {} }).state, 'invalid_response')
  const attempts = plan.cohort[0].requests.map(q => ({ ...plan.cohort[0], ...q, retriever: 'semantic_snippet', state: 'candidates', authenticated: true, usage: 'internal_research', license_status: 'research_allowed', expanded_license_approved: false, hits: [hit] }))
  assert.equal(candidateReviewQueue(plan, attempts, { retriever: 'semantic_snippet' })[0].candidates[0].candidate_id, 'CorpusId:123')
  assert.equal(benchmarkMetrics(plan, attempts, [], { retriever: 'semantic_snippet', readiness: apiReadiness('semantic_snippet', { credentialPresent: true, usage: 'internal_research', licenseStatus: 'research_allowed' }) }).retrieval.unique_candidates, 1)
})

test('Semantic Retry-After defers other queued requests before releasing the shared limiter', async () => {
  let clock = 0
  const starts = [], limiter = createSerialLimiter({ nowMs: () => clock, sleep: async ms => { clock += ms } })
  await Promise.all([0, 1].map(i => requestWithRetry(new URL('https://example.org/?query=fixed'), {
    provider: 'semantic_scholar', limiter, now: () => 'fixed', nowMs: () => clock, maxAttempts: 1,
    fetchImpl: async () => { starts.push(clock); return i === 0 ? { status: 429, headers: { get: () => '120' }, json: async () => ({}) } : { status: 200, json: async () => ({ data: [] }) } },
  })))
  assert.deepEqual(starts, [0, 120000])
})

test('fixed real cohort remains 50/161, including two PDF successes as API controls', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../../docs/reports/csat-source-origin-priority-review-20261005.json', import.meta.url), 'utf8'))
  const frozen = manifest.book_lane_experiment.plan
  assert.equal(frozen.cohort_sha256, '26e37b254b5500af979b25527bc94eb93e74b12e113a6d83781cb98ca8dcdb82')
  const rows = frozen.cohort.map(r => ({ ...r, status: ['2016#32', '2014B#32'].includes(r.representative_item_id) ? 'confirmed_exact' : 'unresolved' }))
  const controls = pendingBookPlan(frozen, rows, { includeResolved: true })
  assert.equal(controls.cohort.length, 50)
  assert.equal(controls.already_resolved, 2)
  assert.equal(controls.cohort.reduce((n, r) => n + r.requests.length, 0), 161)
})

test('routing treats notices and studies differently and never produces a source verdict', () => {
  assert.equal(classifyOriginLane({ passage: 'Dear visitors, register before the deadline and call us for admission tickets.' }).lane, 'report-web-likely')
  assert.equal(classifyOriginLane({ passage: 'Researchers measured participants in an experiment. Their study findings used statistically measured data.' }).lane, 'academic-likely')
  const row = classifyOriginLane({ passage: 'Consider the principle of opportunity. For example, imagine how a concept changes over time.' })
  assert.equal(row.lane, 'book-likely')
  assert.equal(row.verdict, 'unreviewed')
  assert.equal(classifyOriginLane({ type_id: 'R-CHART', passage: 'The graph shows percentages from a survey. Researchers measured statistically significant data.' }).lane, 'report-web-likely')
  assert.equal(classifyOriginLane({ type_id: 'R-NOTICE', passage: 'Participants enjoy a festival in October.' }).lane, 'report-web-likely')
  assert.equal(classifyOriginLane({ passage: 'He was frustrated, walked over and hit the table. Then he smiled.' }).features.chart, 0)
  assert.equal(classifyOriginLane({ passage: 'Be an active participant in class discussions.' }).features.study, 0)
})

test('book families preserve exam blocks, tolerate edits and do not invent names', () => {
  const passage = 'Distinctive axolotl regeneration mechanisms create unusual opportunities for organism survival. (A) Evolutionary examples demonstrate inherited adaptations across numerous environmental conditions.'
  const families = bookQueryFamilies({ passage }, documentFrequencies([passage]), 1)
  assert.equal(families.length, 3)
  assert.ok(families[0].query.split(' ').length >= 6)
  for (const r of families) for (const [, phrase] of r.query.matchAll(/"([^"]+)"/g)) assert.ok(searchSegments(passage).some(words => words.join(' ').includes(phrase)))
  assert.deepEqual(bookQueryFamilies({ passage: '① ___ 한글' }, new Map(), 1), [])
})

test('book cohort is reproducible, unresolved only, and uses actual exam dates', () => {
  const example = 'Consider the principle of opportunity. For example, imagine how a concept changes over time.'
  const rows = ['z', 'a'].map(id => ({ representative_item_id: id, exam_id: 'e', passage: example, status: 'unresolved', passage_sha256: id, body_sha256_by_item: { [id]: id } }))
  const exams = [{ id: 'e', kind: 'suneung', year: 2026, exam_year: 2025, month: 11 }]
  const first = makeBookPlan(rows, exams, { sampleSize: 1 })
  assert.equal(first.cohort[0].representative_item_id, 'a')
  assert.equal(first.cohort[0].exam_year, 2025)
  assert.equal(first.cohort_sha256, makeBookPlan([...rows].reverse(), exams, { sampleSize: 1 }).cohort_sha256)
  assert.equal(makeBookPlan(rows.map(r => ({ ...r, status: 'supported_candidate' })), exams).cohort.length, 0)
  assert.throws(() => makeBookPlan(rows, []), /actual exam/)
  const pending = pendingBookPlan(first, rows.map(r => ({ ...r, status: 'confirmed_exact' })))
  assert.equal(pending.cohort.length, 0)
  assert.equal(pending.fixed_cohort_size, 1)
  assert.throws(() => pendingBookPlan(first, rows.map(r => ({ ...r, body_sha256_by_item: {} }))), /body changed/)
  const edited = structuredClone(first); edited.cohort[0].requests[0].query = 'changed'
  assert.throws(() => pendingBookPlan(edited, rows), /cohort SHA mismatch/)
  const shrunk = { ...first, cohort: [] }
  assert.throws(() => pendingBookPlan(shrunk, rows), /cohort SHA mismatch/)
  const legacy = structuredClone(first)
  delete legacy.cohort_hash_format
  legacy.cohort[0].body_sha256_by_item = { z: 'body-z', a: 'body-a' }
  legacy.cohort_sha256 = bookCohortSha(legacy.cohort, { format: 'legacy-body-map-v1' })
  const legacyRows = [{ ...rows[1], body_sha256_by_item: { a: 'body-a', z: 'body-z' } }]
  assert.equal(pendingBookPlan(legacy, legacyRows).cohort.length, 1)
  assert.notEqual(legacy.cohort_sha256, bookCohortSha(legacy.cohort))
  // Frozen output from makeBookPlan at commit 6e2bf7d: canonical hash, no version field.
  const transition = structuredClone(legacy)
  transition.cohort_sha256 = '627ec48c39b55ba8dbc94513a651f6bfd7b6d828ecea3f75c178cd4f9de88346'
  assert.equal(bookCohortSha(transition.cohort), transition.cohort_sha256)
  assert.equal(pendingBookPlan(transition, legacyRows).cohort.length, 1)
})

test('candidate depth and later edition penalty never imply a reviewed attribution', () => {
  const row = { exam_year: 2025, exam_month: 11 }
  const c = bookCandidate({ id: 'book', volumeInfo: { title: 'Title', publishedDate: '2026-01', industryIdentifiers: [{ type: 'ISBN_13', identifier: 'isbn' }] }, searchInfo: { textSnippet: 'matching text' } }, row, 2)
  assert.equal(c.publication_timing, 'later_edition')
  assert.equal(c.timing_penalty, 1)
  assert.equal(c.verification_depth, 'indexed_text')
  assert.equal(c.verdict, 'unreviewed')
  assert.equal(bookCandidate({ id: 'older', volumeInfo: { publishedDate: '2025' } }, row, 1).publication_timing, 'same_year_or_month_uncertain')
  assert.equal(bookCandidate({ id: 'old', volumeInfo: { publishedDate: '2024' } }, row, 1).verification_depth, 'metadata_only')
})

test('bounded Books pagination and successful resume preserve request filters, ranks and credentials', async () => {
  const plan = { filter: 'partial', maxResults: 40, max_pages_per_query: 2, cohort: [{ representative_item_id: 'x', passage_sha256: 'sha', body_sha256_by_item: { x: 'body' }, exam_year: 2025, exam_month: 11, requests: [{ query: 'anchor' }] }] }
  const called = []
  const out = await runBookBatch(plan, { now: () => 'fixed', key: 'not-to-log', fetchImpl: async url => {
    called.push(url)
    return { status: 200, json: async () => ({ totalItems: 43, items: Array.from({ length: called.length === 1 ? 40 : 3 }, (_, i) => ({ id: 'v' + (Number(url.searchParams.get('startIndex')) + i) })) }) }
  } })
  assert.equal(called.length, 2)
  assert.equal(called[1].searchParams.get('startIndex'), '40')
  for (const u of called) { assert.equal(u.searchParams.get('maxResults'), '40'); assert.equal(u.searchParams.get('langRestrict'), 'en'); assert.equal(u.searchParams.get('printType'), 'books'); assert.equal(u.searchParams.get('filter'), 'partial') }
  assert.equal(out[1].hits[0].candidate_rank, 41)
  assert.ok(!JSON.stringify(out).includes('not-to-log'))
  assert.equal((await runBookBatch(plan, { now: () => 'fixed', previous: out, fetchImpl: () => { throw Error('should resume') } })).length, 0)
  const summary = summarizeBookRun({ ...plan, fixed_cohort_size: 50, already_resolved: 49 }, out, [])
  assert.equal(summary.fixed_cohort_size, 50)
  assert.equal(summary.already_resolved, 49)
  assert.equal(summary.pending_targets, 1)
  assert.equal(summary.cumulative_statistics[0].searched_targets, 1)
  assert.equal(summary.cumulative_statistics[0].candidate_count, 43)
  const foreign = [
    { ...out[0], representative_item_id: 'other' }, { ...out[0], passage_sha256: 'other-body' },
    { ...out[0], query: 'unrelated' }, { ...out[0], filter: 'full' },
    { ...out[0], body_sha256_by_item: { x: 'changed' } }, { ...out[0], startIndex: 80 },
  ]
  const scoped = summarizeBookRun(plan, [...out, ...foreign], [])
  assert.equal(scoped.excluded_previous_records, 6)
  assert.equal(scoped.cumulative_statistics[0].searched_targets, 1)
  assert.equal(scoped.cumulative_statistics[0].candidate_count, 43)
  const completed = summarizeBookRun({ ...plan, fixed_cohort: plan.cohort, cohort: [], fixed_cohort_size: 1, already_resolved: 1 }, out, [])
  assert.equal(completed.cumulative_statistics[0].candidate_count, 43)
  assert.equal(completed.pending_targets, 0)
  let foreignResumeCalls = 0
  await runBookBatch(plan, { now: () => 'fixed', previous: out.map(r => ({ ...r, representative_item_id: 'other' })), fetchImpl: async () => {
    foreignResumeCalls++; return { status: 200, json: async () => ({ totalItems: 0 }) }
  } })
  assert.equal(foreignResumeCalls, 1)
  const changed = structuredClone(plan); changed.cohort[0].body_sha256_by_item.x = 'new'
  let retry = 0
  await runBookBatch(changed, { now: () => 'fixed', previous: out, retryOptions: { maxAttempts: 1 }, fetchImpl: async () => { retry++; return { status: 429, json: async () => ({}) } } })
  assert.equal(retry, 1)
})

test('failed Books requests block remaining families, without false successful search denominators', async () => {
  const plan = { filter: 'full', maxResults: 40, max_pages_per_query: 2, cohort: [{ representative_item_id: 'x', passage_sha256: 'sha', body_sha256_by_item: { x: 'body' }, requests: [{ query: 'a' }, { query: 'b' }] }] }
  const out = await runBookBatch(plan, { now: () => 'fixed', retryOptions: { maxAttempts: 1 }, fetchImpl: async () => ({ status: 429, json: async () => ({}) }) })
  assert.deepEqual(out.map(r => r.state), ['rate_limited', 'not_attempted_provider_blocked'])
  const stats = retrieverStatistics(out)[0]
  assert.equal(stats.searched_targets, 0)
  assert.equal(stats.http_requests, 1)
  assert.equal(stats.not_attempted, 1)
  assert.equal(stats.observed_yield_available, false)
  assert.equal(stats.review_minutes, null)
})

test('known-volume public reader errors are not absence or full-context verification', async () => {
  const request = { volume_id: 'SHvzzuCnuv8C', query: 'rare phrase', candidate_rank: 1 }
  await assert.rejects(searchBookInside({ volume_id: '../escape', query: 'text' }), /Known volume/)
  const mock = body => async () => ({ status: 200, json: async () => body })
  assert.equal((await searchBookInside(request, { fetchImpl: mock(null) })).state, 'invalid_response')
  assert.equal((await searchBookInside(request, { fetchImpl: mock({ number_of_results: 2, search_results: [] }) })).state, 'invalid_response')
  assert.equal((await searchBookInside(request, { fetchImpl: mock({ number_of_results: 0 }) })).state, 'no_results')
  const result = await searchBookInside(request, { fetchImpl: mock({ number_of_results: 1, search_results: [{ page_id: 'PA1', snippet_text: 'partial phrase' }] }) })
  assert.equal(result.verification_depth, 'indexed_text')
  assert.equal(result.hits[0].verdict, 'unreviewed')
})

test('short and dual anchors remain in original exam blocks and exclude edited summary', () => {
  const passage = 'Auditory looming protects rhesus monkeys from approaching dangers and other hazards. (A) Distinctive rhinoceros examples illustrate the evolutionary benefit of predictable errors. (B) Natural selection favors safety over accuracy in dangerous situations.'
  const queries = alternativeQueries(passage, documentFrequencies([passage]), 1)
  assert.equal(queries[0].strategy, 'dual_anchor')
  assert.ok(queries.filter(q => q.strategy === 'short_phrase').length >= 2)
  const segments = searchSegments(passage).map(words => words.join(' '))
  for (const row of queries) for (const [, phrase] of row.query.matchAll(/"([^"]+)"/g)) {
    assert.equal(phrase.split(' ').length, 4)
    assert.ok(segments.some(segment => segment.includes(phrase)))
  }
  const summary = passage + '\nOriginal sentences contain several more searchable descriptive terms.\nScientific findings are summarized using (A) ______ and (B) ______ explanations.'
  assert.ok(alternativeQueries(summary, documentFrequencies([summary]), 1, 'R-SUMMARY').every(row => !row.query.includes('Scientific findings')))
})

test('rare phrase wins over shared vocabulary and unusable bodies yield no invented query', () => {
  const passage = 'The common words describe shared facts about the unusual axolotl regeneration mechanism.'
  const frequencies = documentFrequencies([passage, ...Array(20).fill('The common words describe shared facts about the same ordinary objects today.')])
  const queries = alternativeQueries(passage, frequencies, 21)
  assert.equal(queries[0].query, '"unusual axolotl regeneration mechanism"')
  assert.deepEqual(alternativeQueries('① ______ 한글', frequencies, 21), [])
})

test('accented Latin names remain intact in quoted searches', () => {
  const passage = 'The zebra-striped Atitlán Giant Grebe lived peacefully on Lake Atitlán in Guatemala.'
  for (const input of [passage, passage.normalize('NFD')]) {
    const queries = alternativeQueries(input, documentFrequencies([input]), 1)
    assert.ok(queries.some(row => row.query.includes('Atitlán')))
    assert.ok(queries.every(row => !row.query.includes('Atitl n')))
    for (const row of queries) for (const [, phrase] of row.query.matchAll(/"([^"]+)"/g)) {
      assert.ok(passage.includes(phrase))
    }
  }
})

test('snippet uses plain text while Books and Europe PMC use their own query syntax', () => {
  const passage = 'Auditory looming protects rhesus monkeys from approaching dangers and other hazards. Distinctive rhinoceros examples illustrate the evolutionary benefit of predictable errors.'
  const requests = provenanceRequests({ passage }, documentFrequencies([passage]), 1)
  assert.ok(!/["~]/.test(requests.find(r => r.provider === 'semantic_scholar').query))
  assert.equal(requests.filter(r => r.provider === 'google_books').length, 2)
  assert.ok(requests.find(r => r.provider === 'europe_pmc').query.includes(' OR '))
})

test('local alignment finds deletion and substitution without treating topic overlap as attribution', () => {
  const exam = 'distinctive monkeys heard rapidly approaching sounds and fled toward safety'
  const original = 'irrelevant introduction distinctive monkeys heard rapidly looming approaching sounds and ran toward safety irrelevant ending'
  const match = localAlignment(exam, original)
  assert.ok(match.exam_token_coverage >= 0.8)
  assert.ok(match.edits >= 2)
  const index = buildOriginIndex([{ id: 'original', text: original }, { id: 'topic', text: 'monkeys experience safety in forests while danger approaches' }], 3)
  assert.equal(searchOriginIndex(index, exam)[0].document_id, 'original')
  assert.deepEqual(searchOriginIndex(index, 'unrelated rare phrase with no matches'), [])
  assert.equal(localAlignment('', original).exam_token_coverage, 0)
})

test('API failures and malformed successes never become empty search results', () => {
  assert.equal(classifySearchResponse('google_books', 429, {}).hits, null)
  assert.equal(classifySearchResponse('semantic_scholar', 403, {}).state, 'access_denied')
  assert.equal(classifySearchResponse('europe_pmc', 200, {}).state, 'invalid_response')
  assert.equal(classifySearchResponse('google_books', 200, { totalItems: 0 }).state, 'no_results')
})

test('rare-token fallback retrieves edited text with no exact shingle', () => {
  const original = 'axolotl extraordinary regeneration occurs beyond conventional organism biology'
  const exam = 'axolotl unusual regeneration happens beyond standard organism biology'
  const match = searchOriginIndex(buildOriginIndex([{ id: 'edited', text: original }]), exam)[0]
  assert.equal(match.document_id, 'edited')
  assert.equal(match.exact_shingle_count, 0)
  assert.ok(match.matched_exam_token_count >= 4)
})

test('OA body parsing keeps reference text out of match corpus and resolves citation markers', () => {
  const xml = '<article><body><p>Distinctive original words occur in this body paragraph <xref rid="r1" ref-type="bibr">1</xref>.</p></body><back><ref-list><ref id="r1"><mixed-citation>Unrelated bibliography title and author</mixed-citation></ref></ref-list></back></article>'
  const doc = extractOaDocument(xml, 'PMC123')
  assert.equal(doc.paragraphs.length, 1)
  assert.ok(!doc.paragraphs[0].text.includes('bibliography'))
  assert.equal(doc.paragraphs[0].citation_edges[0].to, 'PMC123#r1')
  assert.match(doc.body_sha256, /^[a-f0-9]{64}$/)
  assert.equal(extractOaDocument('<error>not full text</error>', 'PMC123'), null)
})

test('provider circuit skips requests after throttling while other providers continue', async () => {
  const called = [], attempts = []
  const queue = [{ representative_item_id: 'sample', passage_sha256: 'sha', body_sha256_by_item: { sample: 'body' }, requests: [
    { provider: 'google_books', query: 'first' }, { provider: 'google_books', query: 'second' }, { provider: 'europe_pmc', query: 'third' },
  ] }]
  const out = await runProvenanceSearch(queue, { now: () => '2026-10-05T00:00:00Z', onAttempt: row => attempts.push(row), fetchImpl: async url => {
    called.push(url.hostname)
    return { status: url.hostname === 'www.googleapis.com' ? 429 : 200, json: async () => ({ hitCount: 0, resultList: { result: [] } }) }
  } })
  assert.equal(called.length, 2)
  assert.deepEqual(out.map(r => r.state), ['rate_limited', 'not_attempted_provider_blocked', 'no_results'])
  assert.equal(attempts.length, 3)
})

test('positive reported totals with empty hit pages stay retryable', () => {
  assert.equal(classifySearchResponse('google_books', 200, { totalItems: 2, items: [] }).state, 'invalid_response')
  assert.equal(classifySearchResponse('europe_pmc', 200, { hitCount: 1, resultList: { result: [] } }).hits, null)
})

test('local ranking preserves source evidence without promoting its verdict', () => {
  const text = 'distinctive axolotl regeneration occurs under carefully controlled experimental conditions'
  const result = searchOriginIndex(buildOriginIndex([{ id: 'block', document_id: 'PMC123', text, body_sha256: 'a'.repeat(64), candidate_title: 'Source title', candidate_author: 'Author', candidate_year: '2001', citation_edges: [{ type: 'CITES', to: 'reference' }], verdict: 'A' }]), text)[0]
  assert.equal(result.candidate_title, 'Source title')
  assert.equal(result.candidate_document_id, 'PMC123')
  assert.equal(result.document_body_sha256, 'a'.repeat(64))
  assert.equal(result.citation_edges[0].to, 'reference')
  assert.equal(result.publication_predates_exam, null)
  assert.equal(result.verdict, 'unreviewed')
  assert.ok(result.remaining_uncertainty)
  assert.equal(result.text, undefined)
})

test('invalid XML caches are replaced by fetched body and valid caches avoid requests', async () => {
  let calls = 0
  const xml = '<article><body><p>Distinctive original words occur in this valid body paragraph.</p></body></article>'
  const fetchImpl = async () => { calls++; return { ok: true, status: 200, text: async () => xml } }
  const loaded = await loadOaDocument('PMC123', { cachedXml: '<article>truncated', fetchImpl })
  assert.equal(loaded.state, 'downloaded')
  assert.equal(loaded.xml, xml)
  assert.equal((await loadOaDocument('PMC123', { cachedXml: loaded.xml, fetchImpl })).state, 'cached')
  assert.equal(calls, 1)
  assert.equal(extractOaDocument('<html><body><p>Error page</p></body></html>', 'PMC123'), null)
})

test('truncated bibliography and invalid numeric entities recover through a remote request', async () => {
  const valid = '<article><body><p>Distinctive original words occur in this valid body paragraph.</p></body><back><ref-list/></back></article>'
  for (const cache of [valid.slice(0, valid.indexOf('<back>')), valid.replace('Distinctive', '&#999999999;'), valid.replace('Distinctive', '&#0;'), valid.replace('Distinctive', '&#xD800;'), valid.replace('<back><ref-list/></back>', '<back><ref-list/></broken>')]) {
    let calls = 0
    const result = await loadOaDocument('PMC123', { cachedXml: cache, fetchImpl: async () => { calls++; return { ok: true, status: 200, text: async () => valid } } })
    assert.equal(calls, 1)
    assert.equal(result.state, 'downloaded')
    assert.equal(result.xml, valid)
  }
  assert.ok(extractOaDocument('<?xml version="1.0"?><!DOCTYPE article [<!ENTITY example "text">]>' + valid, 'PMC123'))
})
