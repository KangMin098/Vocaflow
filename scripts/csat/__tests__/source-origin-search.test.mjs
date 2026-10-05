// scripts/csat/__tests__/source-origin-search.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { alternativeQueries, documentFrequencies, searchSegments, provenanceRequests, localAlignment, buildOriginIndex, searchOriginIndex, classifySearchResponse, runProvenanceSearch, extractOaDocument, loadOaDocument } from '../source-origin-search.mjs'

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
