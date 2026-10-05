// scripts/csat/__tests__/source-origin-search.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { alternativeQueries, documentFrequencies, searchSegments, provenanceRequests, localAlignment, buildOriginIndex, searchOriginIndex, classifySearchResponse, runProvenanceSearch, extractOaDocument, loadOaDocument } from '../source-origin-search.mjs'
import { classifyOriginLane, bookQueryFamilies, makeBookPlan, bookCandidate, runBookBatch, retrieverStatistics, searchBookInside, pendingBookPlan, summarizeBookRun, bookCohortSha } from '../source-origin-search.mjs'

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
  await runBookBatch(changed, { now: () => 'fixed', previous: out, fetchImpl: async () => { retry++; return { status: 429, json: async () => ({}) } } })
  assert.equal(retry, 1)
})

test('failed Books requests block remaining families, without false successful search denominators', async () => {
  const plan = { filter: 'full', maxResults: 40, max_pages_per_query: 2, cohort: [{ representative_item_id: 'x', passage_sha256: 'sha', body_sha256_by_item: { x: 'body' }, requests: [{ query: 'a' }, { query: 'b' }] }] }
  const out = await runBookBatch(plan, { now: () => 'fixed', fetchImpl: async () => ({ status: 429, json: async () => ({}) }) })
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
