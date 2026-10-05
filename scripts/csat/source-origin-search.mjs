// scripts/csat/source-origin-search.mjs
// Search phrases stay inside a sentence and an exam block; passage hashes remain unchanged.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

export const sleepMs = ms => new Promise(resolve => setTimeout(resolve, ms))
export function createSerialLimiter({ nowMs, sleep, intervalMs = 1000 }) {
  let tail = Promise.resolve(), nextStart = 0
  const limit = operation => {
    const run = tail.then(async () => {
      const wait = nextStart - nowMs()
      if (wait > 0) await sleep(wait)
      nextStart = nowMs() + intervalMs
      return operation()
    })
    tail = run.catch(() => {})
    return run
  }
  limit.deferUntil = deadline => { nextStart = Math.max(nextStart, deadline) }
  return limit
}
// All Semantic requests in this Node process share one queue. Run one benchmark CLI.
const semanticLimiter = createSerialLimiter({ nowMs: Date.now, sleep: sleepMs })
export function retryAfterMs(value, nowMs) {
  if (typeof value !== 'string' || !value.trim()) return null
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value) * 1000
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed - nowMs) : null
}

export async function requestWithRetry(url, { provider, fetchImpl = fetch, headers = {}, now, nowMs = Date.now, sleep = sleepMs, random = Math.random,
  limiter = semanticLimiter, authenticated = false, apiKeyProject = null, maxAttempts = 3, maxWaitMs = 30000, attemptOffset = 0, onResponse = () => {} } = {}) {
  if (typeof now !== 'function' || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error('Inject clock and bounded retry count')
  if (apiKeyProject !== null && !/^(?:[a-z][a-z0-9-]{4,28}[a-z0-9]|\d{6,20})$/.test(apiKeyProject)) throw new Error('Invalid project identifier; do not put credentials in metadata')
  const query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? ''
  let last
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const execute = async () => {
      const startedAt = now()
      let response, body = null, parseFailed = false
      try {
        response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(25000) })
        try { body = await response.json() } catch { parseFailed = true }
      } catch {}
      const status = response?.status ?? null
      const retryHeader = response?.headers?.get?.('retry-after') ?? null
      const retryMs = retryAfterMs(retryHeader, nowMs())
      let state = status === null ? 'network_error' : status === 429 ? '429_rate_limited' : [401, 403].includes(status) ? '403/401_auth' : status >= 500 ? '5xx_transient' : status < 200 || status >= 300 ? 'http_error' : parseFailed ? 'parse_failure' : 'success'
      if (state === 'success') { const parsed = classifySearchResponse(provider, status, body); state = parsed.state === 'invalid_response' ? 'parse_failure' : parsed.state === 'no_results' ? 'zero_result' : 'success' }
      const retryWait = retryMs ?? Math.min(30000, 1000 * 2 ** (attempt - 1)) + Math.floor(random() * 250)
      if (provider === 'semantic_scholar' && ['429_rate_limited', '5xx_transient', 'network_error'].includes(state)) limiter.deferUntil?.(nowMs() + retryWait)
      return { body, metadata: { authenticated, api_key_project: apiKeyProject, attempt_no: attemptOffset + attempt, http_status: status,
        retry_after: retryMs === null ? null : retryHeader, retry_after_ms: retryMs, started_at: startedAt, finished_at: now(),
        query_hash: createHash('sha256').update(query).digest('hex'), availability_state: state, retry_delay_ms: retryWait } }
    }
    last = provider === 'semantic_scholar' ? await limiter(execute) : await execute()
    const retryable = ['429_rate_limited', '5xx_transient', 'network_error'].includes(last.metadata.availability_state)
    const wait = last.metadata.retry_delay_ms
    const retry = retryable && attempt < maxAttempts && wait <= maxWaitMs
    last.metadata.will_retry = retry
    last.metadata.retry_deferred_ms = retryable && !retry ? wait : null
    last.metadata.retry_not_before_ms = retryable ? nowMs() + wait : null
    onResponse(last.metadata, last.body)
    if (!retry) break
    await sleep(wait)
  }
  return last
}
export function searchSegments(value, typeId = '') {
  let text = String(value ?? '').normalize('NFC').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  if (typeId === 'R-SUMMARY' && /\(A\)\s*[_━─]/.test(text)) {
    const marker = text.search(/\(A\)\s*[_━─]/)
    const boundary = Math.max(text.lastIndexOf('.', marker), text.lastIndexOf('\n', marker), text.lastIndexOf('↓', marker))
    text = boundary < 0 ? '' : text.slice(0, boundary + 1)
  }
  return text
    .split(/\([A-C]\)|[①-⑤❶-❺]|[_━─]+|[.!?;\n\r]|\([^)]*\)|[→↓]|[\uac00-\ud7a3]+/)
    .map(part => part.replace(/[^\p{Script=Latin}\p{M}0-9'’ -]/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(part => part.split(' ').filter(word => /^[\p{Script=Latin}0-9][\p{Script=Latin}\p{M}0-9'-]*$/u.test(word)))
    .filter(words => words.length >= 7)
}

export function documentFrequencies(passages) {
  const frequencies = new Map()
  for (const passage of passages) {
    const words = searchSegments(passage).flat().map(word => word.toLowerCase())
    for (const word of new Set(words)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
  }
  return frequencies
}

export function selectFingerprints(passage, frequencies, documentCount, typeId = '') {
  const candidates = []
  searchSegments(passage, typeId).forEach((words, segment) => {
    const size = Math.min(11, words.length)
    for (let start = 0; start <= words.length - size; start++) {
      const window = words.slice(start, start + size)
      const score = [...new Set(window.map(word => word.toLowerCase()))].reduce(
        (sum, word) => sum + Math.log((documentCount + 1) / ((frequencies.get(word) ?? 0) + 1)), 0)
      candidates.push({ segment, start, end: start + size, score, text: window.join(' ') })
    }
  })
  candidates.sort((a, b) => b.score - a.score || a.segment - b.segment || a.start - b.start)
  const selected = []
  for (const candidate of candidates) {
    if (selected.some(other => other.segment === candidate.segment && Math.max(other.start, candidate.start) < Math.min(other.end, candidate.end))) continue
    selected.push(candidate)
    if (selected.length === 3) break
  }
  return selected.map(({ text }) => text)
}

export function searchQueries(fingerprints) {
  return fingerprints.map(phrase => `"${phrase.split(' ').slice(0, 8).join(' ')}"`)
}

export function searchAttemptKey(row) {
  return JSON.stringify([row.passage_sha256, row.provider ?? 'legacy_web', row.query, row.attempt_id ?? 'legacy'])
}

// Short anchors tolerate local exam edits; every phrase still comes from one block.
export function alternativeQueries(passage, frequencies, documentCount, typeId = '') {
  const fingerprints = selectFingerprints(passage, frequencies, documentCount, typeId)
  const anchors = fingerprints.map(phrase => {
    const words = phrase.split(' ')
    let best = { score: -Infinity, text: '' }
    for (let start = 0; start <= words.length - 4; start++) {
      const window = words.slice(start, start + 4)
      const score = [...new Set(window.map(word => word.toLowerCase()))].reduce(
        (sum, word) => sum + Math.log((documentCount + 1) / ((frequencies.get(word) ?? 0) + 1)), 0)
      if (score > best.score) best = { score, text: window.join(' ') }
    }
    return best.text
  }).filter(Boolean)
  const queries = anchors.map(phrase => ({ strategy: 'short_phrase', query: `"${phrase}"` }))
  if (anchors.length > 1) queries.unshift({ strategy: 'dual_anchor', query: `"${anchors[0]}" "${anchors[1]}"` })
  return queries.filter((row, index) => queries.findIndex(other => other.query === row.query) === index)
}

export function provenanceRequests(row, frequencies, documentCount) {
  const alternatives = alternativeQueries(row.passage, frequencies, documentCount, row.type_id)
  const phrases = alternatives.filter(q => q.strategy === 'short_phrase').map(q => q.query)
  const fingerprints = selectFingerprints(row.passage, frequencies, documentCount, row.type_id)
  if (!phrases.length) return []
  return [
    { provider: 'semantic_scholar', strategy: 'plain_text', query: fingerprints[0] },
    { provider: 'google_books', strategy: 'exact_phrase', query: phrases[0] },
    ...(phrases.length > 1 ? [{ provider: 'google_books', strategy: 'pair_phrase', query: phrases.slice(0, 2).join(' ') }] : []),
    { provider: 'europe_pmc', strategy: 'oa_phrase_union', query: `(${phrases.join(' OR ')}) AND OPEN_ACCESS:Y` },
  ]
}

export function originTokens(value) {
  return String(value ?? '').normalize('NFC').toLowerCase().match(/[\p{Script=Latin}0-9][\p{Script=Latin}\p{M}0-9'’-]*/gu) ?? []
}

// Routing is a transparent heuristic, not an origin verdict or calibrated probability.
export function passageLaneFeatures(row) {
  const text = String(row.passage ?? ''), words = originTokens(text)
  const sentences = text.split(/[.!?]+/).filter(s => originTokens(s).length >= 4)
  const count = pattern => [...text.matchAll(pattern)].length
  return {
    long_explanation: words.length >= 120 ? 1 : 0,
    long_sentences: sentences.length && words.length / sentences.length >= 20 ? 1 : 0,
    examples: Math.min(3, count(/\b(for example|for instance|consider|imagine|suppose|say your|such as)\b/gi)),
    conceptual: Math.min(3, count(/\b(therefore|however|thus|whereas|in contrast|in other words|concept|principle|theory)\b/gi)),
    study: Math.min(3, count(/\b(researchers?|experiment|study|studies|findings|laboratory|hypothesis|survey)\b/gi)),
    measurement: Math.min(3, count(/\b(percent|percentage|sample|measured|statistically|correlation|data)\b|\d+(?:\.\d+)?%/gi)),
    notice: row.type_id === 'R-NOTICE' || /\b(dear|sincerely|register|registration|deadline|call us|email us|e-mail us|ticket|admission|opening hours)\b/i.test(text) ? 1 : 0,
    chart: row.type_id === 'R-CHART' || /\b(the (?:above )?(?:graph|chart) (?:shows|illustrates)|as shown in the (?:graph|chart|table))\b/i.test(text) ? 1 : 0,
    narrative: Math.min(3, count(/\b(I was|I had|she was|he was|my father|my mother|said|walked|smiled)\b/gi)),
  }
}

export function referenceLane(row) {
  const bibliography = `${row.source_title ?? ''} ${row.source_publisher ?? ''} ${row.source_part ?? ''}`
  const urls = (row.evidence ?? []).map(e => e.url ?? '').join(' ')
  if (/\b(journal|proceedings|working paper)\b/i.test(bibliography) || /doi\.org|pubmed|europepmc|\/articles\//i.test(urls)) return 'academic-likely'
  if (/\b(chapter|edition|press|wiley|routledge|pearson|polity|bloomsbury|mcgraw|nolo|springer|sage|books)\b/i.test(bibliography) || /books\.google|\/book\/|\/books\/|oreilly\.com\/library/i.test(urls)) return 'book-likely'
  if (/\b(report|magazine|newspaper|news|blog)\b/i.test(bibliography)) return 'report-web-likely'
  return 'unclassified'
}

export function classifyOriginLane(row, references = []) {
  const f = passageLaneFeatures(row)
  const scores = {
    'book-likely': 2 * f.long_explanation + f.long_sentences + 2 * f.examples + f.conceptual + f.narrative - 4 * f.notice - 4 * f.chart,
    'academic-likely': 3 * f.study + 2 * f.measurement + f.long_explanation + f.conceptual - 3 * f.notice - 3 * f.narrative,
    'report-web-likely': 5 * f.notice + 5 * f.chart + (f.long_explanation ? 0 : 1),
  }
  const nearest = references.map(ref => {
    const rf = passageLaneFeatures(ref)
    const distance = Object.keys(f).reduce((sum, key) => sum + Math.abs(f[key] - rf[key]), 0)
    return { item_id: ref.representative_item_id, lane: referenceLane(ref), status: ref.status, distance }
  }).filter(ref => ref.lane !== 'unclassified').sort((a, b) => a.distance - b.distance || a.item_id.localeCompare(b.item_id)).slice(0, 3)
  // At most one point per lane: reference likeness cannot override clear notice/study features.
  for (const lane of Object.keys(scores)) if (nearest.some(ref => ref.lane === lane && ref.distance <= 2)) scores[lane] += 1
  // Passage function beats incidental research words in charts and event notices.
  if (f.chart || f.notice) scores['report-web-likely'] = Math.max(...Object.values(scores)) + 3
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return { lane: ranked[0][0], scores, book_priority_score: scores['book-likely'] - Math.max(scores['academic-likely'], scores['report-web-likely']) / 2 - 2 * f.narrative,
    ambiguity: ranked[0][1] - ranked[1][1] <= 2 ? 'overlapping' : 'preferred', features: f, nearest_reference: nearest,
    classification_kind: 'routing_heuristic', verdict: 'unreviewed' }
}

export function bookQueryFamilies(row, frequencies, documentCount) {
  const phrases = selectFingerprints(row.passage, frequencies, documentCount, row.type_id)
  if (!phrases.length) return []
  const short = alternativeQueries(row.passage, frequencies, documentCount, row.type_id).filter(q => q.strategy === 'short_phrase')
  const requests = [{ provider: 'google_books', retriever: 'google_books_api', strategy: 'rare_exact_6_10', query: `"${phrases[0].split(' ').slice(0, 8).join(' ')}"` }]
  if (short.length >= 2) requests.push({ provider: 'google_books', retriever: 'google_books_api', strategy: 'two_anchors_and', query: `${short[0].query} ${short[1].query}` })
  // A shorter contiguous anchor avoids local exam edits; never silently invent synonyms.
  if (short.length) requests.push({ provider: 'google_books', retriever: 'google_books_api', strategy: 'edit_tolerant_anchor', query: short[0].query })
  const name = String(row.passage ?? '').match(/\b(?:[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?\s+){1,2}[A-Z][a-z]+\b/gu)?.[0]
  if (name && short.length && !short[0].query.includes(name)) requests.push({ provider: 'google_books', retriever: 'google_books_api', strategy: 'name_and_anchor', query: `"${name}" ${short[0].query}`, name_is_unverified: true })
  return requests.filter((r, i) => requests.findIndex(other => other.query === r.query) === i)
}

export function makeBookPlan(rows, exams, { sampleSize = 50 } = {}) {
  if (!Number.isInteger(sampleSize) || sampleSize < 1) throw new Error('Positive sample size required')
  const references = rows.filter(r => ['confirmed_exact', 'supported_candidate'].includes(r.status))
  const byExam = new Map(exams.map(e => [e.id, e]))
  const frequencies = documentFrequencies(rows.map(r => r.passage))
  const classified = rows.filter(r => r.status === 'unresolved').map(row => {
    const exam = byExam.get(row.exam_id)
    if (!exam || !Number.isInteger(exam.exam_year) || !Number.isInteger(exam.month)) throw new Error('Missing actual exam year/month: ' + row.exam_id)
    return { representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item,
      exam_kind: exam.kind, exam_year: exam.exam_year, exam_month: exam.month, ...classifyOriginLane(row, references), requests: bookQueryFamilies(row, frequencies, rows.length) }
  }).sort((a, b) => b.book_priority_score - a.book_priority_score || a.representative_item_id.localeCompare(b.representative_item_id))
  const cohort = classified.filter(r => r.exam_kind === 'suneung' && r.lane === 'book-likely' && r.requests.length).slice(0, sampleSize)
  return { classification_version: 'book-routing-v2', reference_count: references.length, reference_labels: references.map(r => ({ item_id: r.representative_item_id, status: r.status, lane: referenceLane(r) })), classified,
    cohort, cohort_sha256: bookCohortSha(cohort), cohort_hash_format: 'canonical-body-map-v2', sample_size_requested: sampleSize,
    filter: 'partial', maxResults: 40, max_pages_per_query: 2,
    limitations: ['Heuristic routes overlap; no origin-type ground truth or held-out accuracy.', 'A and B references retain different verification status.', 'Missing name clues yield three families rather than fabricated names.', 'Preview filter excludes non-previewable candidates; no result does not establish absent source.'] }
}

export function bookCohortSha(cohort, { format = 'canonical-body-map-v2' } = {}) {
  if (!['canonical-body-map-v2', 'legacy-body-map-v1'].includes(format)) throw new Error('Unknown cohort hash format')
  const identity = cohort.map(r => ({ id: r.representative_item_id, registry: r.passage_sha256, bodies: format === 'legacy-body-map-v1' ? r.body_sha256_by_item : Object.fromEntries(Object.entries(r.body_sha256_by_item ?? {}).sort(([a], [b]) => a.localeCompare(b))), exam_year: r.exam_year, exam_month: r.exam_month, requests: r.requests }))
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex')
}

export function bookCandidate(hit, row, candidateRank) {
  const v = hit.volumeInfo ?? {}, publishedDate = v.publishedDate ?? null
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(publishedDate ?? '')
  const year = match ? Number(match[1]) : null, month = match?.[2] ? Number(match[2]) : null
  const timing = year === null ? 'unknown' : year > row.exam_year || year === row.exam_year && month !== null && month > row.exam_month ? 'later_edition' : year === row.exam_year && (month === null || month === row.exam_month) ? 'same_year_or_month_uncertain' : 'predates_exam_month'
  return { retriever: 'google_books_api', candidate_rank: candidateRank, verification_depth: hit.searchInfo?.textSnippet ? 'indexed_text' : 'metadata_only',
    volume_id: hit.id ?? null, title: v.title ?? null, authors: v.authors ?? [], publisher: v.publisher ?? null, publishedDate,
    ISBN: (v.industryIdentifiers ?? []).filter(i => /^ISBN_/.test(i.type ?? '')).map(i => ({ type: i.type, identifier: i.identifier })),
    preview_url: `https://books.google.com/books?id=${encodeURIComponent(hit.id ?? '')}`, viewability: hit.accessInfo?.viewability ?? null,
    publication_timing: timing, timing_penalty: timing === 'later_edition' ? 1 : 0, review_priority_score: 1 / candidateRank - (timing === 'later_edition' ? 1 : 0), snippet: hit.searchInfo?.textSnippet ?? null,
    candidate_confidence: 'unassessed', verdict: 'unreviewed', remaining_uncertainty: 'Volume match and edition timing require human attribution review; ranking never upgrades A/B.' }
}

export async function runBookBatch(plan, { fetchImpl = fetch, now, key, apiKeyProject = null, requireIdentification = false, retryOptions = {}, onAttempt = () => {}, previous = [] } = {}) {
  if (typeof now !== 'function') throw new Error('Inject a clock')
  if (apiKeyProject !== null && !/^(?:[a-z][a-z0-9-]{4,28}[a-z0-9]|\d{6,20})$/.test(apiKeyProject)) throw new Error('Invalid project identifier; credentials cannot be metadata')
  if (!['partial', 'full'].includes(plan.filter) || plan.maxResults !== 40 || !Number.isInteger(plan.max_pages_per_query) || plan.max_pages_per_query < 1 || plan.max_pages_per_query > 10) throw new Error('Invalid bounded book batch options')
  const attemptKey = r => JSON.stringify([r.representative_item_id, r.passage_sha256, Object.entries(r.body_sha256_by_item ?? {}).sort(), r.strategy ?? null, r.query, r.startIndex, plan.filter, plan.maxResults])
  const done = new Map(previous.filter(r => ['candidates', 'no_results'].includes(r.state) && Array.isArray(r.hits) && r.hits.every(candidateId) && r.retriever === 'google_books_api' && r.filter === plan.filter && r.maxResults === plan.maxResults
    && (!requireIdentification || r.authenticated === true && r.api_key_project === apiKeyProject)).map(r => [attemptKey(r), r]))
  const clockMs = retryOptions.nowMs ?? Date.now
  const priorTransport = previous.filter(r => r.retriever === 'google_books_api' && r.authenticated === Boolean(key) && r.api_key_project === apiKeyProject && r.started_at != null).at(-1)
  let blocked = priorTransport?.retry_not_before_ms > clockMs() ? 'retry_after_wait' : null
  const attempts = []
  for (const row of plan.cohort) for (const request of row.requests) {
    for (let page = 0; page < plan.max_pages_per_query; page++) {
      const base = { representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item,
        ...request, retriever: 'google_books_api', startIndex: page * 40, maxResults: 40, filter: plan.filter, attempted_at: now(),
        authenticated: Boolean(key), api_key_project: apiKeyProject, query_hash: createHash('sha256').update(request.query).digest('hex') }
      if (requireIdentification && (!key || !apiKeyProject)) { const missing = { ...base, state: key ? 'not_attempted_missing_project' : 'not_attempted_missing_auth', hits: null,
        attempt_no: null, http_status: null, retry_after: null, started_at: null, finished_at: null }; attempts.push(missing); onAttempt(missing); break }
      const cached = done.get(attemptKey(base))
      if (cached) { if (cached.state === 'no_results' || cached.hits.length < 40 || base.startIndex + 40 >= cached.reported_total) break; continue }
      if (blocked) { const attempt = { ...base, state: 'not_attempted_provider_blocked', blocked_by: blocked, retry_not_before_ms: priorTransport?.retry_not_before_ms ?? null, hits: null }; attempts.push(attempt); onAttempt(attempt); break }
      const url = new URL('https://www.googleapis.com/books/v1/volumes')
      for (const [k, v] of Object.entries({ q: request.query, printType: 'books', langRestrict: 'en', filter: plan.filter, maxResults: 40, startIndex: base.startIndex })) url.searchParams.set(k, String(v))
      if (key) url.searchParams.set('key', key)
      let attempt
      const offset = Math.max(0, ...previous.filter(r => attemptKey(r) === attemptKey(base) && r.authenticated === Boolean(key) && r.api_key_project === apiKeyProject).map(r => r.attempt_no ?? 0))
      await requestWithRetry(url, { ...retryOptions, provider: 'google_books', fetchImpl, now, authenticated: Boolean(key), apiKeyProject, attemptOffset: offset,
        onResponse: (metadata, body) => {
          const result = classifySearchResponse('google_books', metadata.http_status ?? 0, body)
          attempt = { ...base, ...result, ...metadata, state: metadata.availability_state === 'network_error' ? 'request_error' : result.state,
            hits: result.hits?.map((hit, i) => bookCandidate(hit, row, base.startIndex + i + 1)) ?? null }
          attempts.push(attempt); onAttempt(attempt)
        } })
      if (['429_rate_limited', '403/401_auth', '5xx_transient', 'network_error', 'parse_failure'].includes(attempt.availability_state)) blocked = attempt.availability_state
      if (!['candidates', 'no_results'].includes(attempt.state) || !attempt.hits.length || attempt.hits.length < 40 || base.startIndex + 40 >= attempt.reported_total) break
    }
  }
  return attempts
}

export function pendingBookPlan(plan, currentRows, { includeResolved = false } = {}) {
  const hashFormats = plan.cohort_hash_format ? [plan.cohort_hash_format] : ['legacy-body-map-v1', 'canonical-body-map-v2']
  if (!hashFormats.some(format => plan.cohort_sha256 === bookCohortSha(plan.cohort, { format }))) throw new Error('Frozen cohort SHA mismatch; restore the plan or create a new experiment')
  const current = new Map(currentRows.map(r => [r.representative_item_id, r]))
  const pending = []; let resolved = 0
  for (const row of plan.cohort) {
    const latest = current.get(row.representative_item_id)
    if (!latest || latest.passage_sha256 !== row.passage_sha256 || !isDeepStrictEqual(latest.body_sha256_by_item, row.body_sha256_by_item)) throw new Error('Frozen cohort body changed: ' + row.representative_item_id)
    if (latest.status !== 'unresolved') resolved++
    if (latest.status === 'unresolved' || includeResolved) pending.push(row)
  }
  return { ...plan, cohort: pending, fixed_cohort: plan.cohort.map(row => ({ ...row, current_status: current.get(row.representative_item_id).status })), fixed_cohort_size: plan.cohort.length, already_resolved: resolved, benchmark_all_targets: includeResolved }
}

export function summarizeBookRun(plan, previous, attempts) {
  const cohort = new Map((plan.fixed_cohort ?? plan.cohort).map(r => [r.representative_item_id, r]))
  const belongs = r => {
    const target = cohort.get(r.representative_item_id)
    return target && r.retriever === 'google_books_api' && target.passage_sha256 === r.passage_sha256 && isDeepStrictEqual(target.body_sha256_by_item, r.body_sha256_by_item)
      && target.requests.some(q => q.query === r.query && q.strategy === r.strategy) && r.filter === plan.filter && r.maxResults === plan.maxResults
      && Number.isInteger(r.startIndex) && r.startIndex >= 0 && r.startIndex % 40 === 0 && r.startIndex < plan.max_pages_per_query * 40
  }
  const scopedPrevious = previous.filter(belongs)
  if (!attempts.every(belongs)) throw new Error('New retrieval attempt outside the fixed experiment')
  return { cohort_sha256: plan.cohort_sha256, fixed_cohort_size: plan.fixed_cohort_size ?? plan.cohort.length,
    already_resolved: plan.already_resolved ?? 0, pending_targets: (plan.fixed_cohort_size ?? plan.cohort.length) - (plan.already_resolved ?? 0), queued_targets: plan.cohort.length,
    new_attempt_records: attempts.length, excluded_previous_records: previous.length - scopedPrevious.length,
    cumulative_statistics: retrieverStatistics([...scopedPrevious, ...attempts]) }
}

export function retrieverStatistics(attempts, outcomes = []) {
  const names = new Set([...attempts.map(r => r.retriever ?? r.provider ?? 'web_exact'), ...outcomes.map(r => r.retriever)])
  return [...names].map(retriever => {
    const rows = attempts.filter(r => (r.retriever ?? r.provider ?? 'web_exact') === retriever)
    const judged = outcomes.filter(r => r.retriever === retriever)
    const attempted = rows.filter(r => !r.state.startsWith('not_attempted'))
    const keys = new Set(attempted.map(r => r.passage_sha256 ?? r.representative_item_id))
    const successful = new Set(rows.filter(r => ['candidates', 'no_results'].includes(r.state)).map(r => r.passage_sha256 ?? r.representative_item_id))
    return { retriever, requested_targets: keys.size, searched_targets: successful.size, issued_queries: attempted.length,
      http_requests: retriever.startsWith('web_') ? null : attempted.length, http_responses: retriever.startsWith('web_') ? null : rows.filter(r => r.http_status != null).length,
      not_attempted: rows.filter(r => r.state.startsWith('not_attempted')).length, candidate_count: rows.reduce((sum, r) => sum + (r.hits?.length ?? 0), 0),
      unique_candidate_count: new Set(rows.flatMap(r => (r.hits ?? []).map(h => h.volume_id ?? h.id ?? h.paperId ?? h.url).filter(Boolean))).size,
      reviewed_candidates: judged.length, new_A: judged.filter(r => r.before === 'G' && r.after === 'A').length,
      new_B: judged.filter(r => r.before === 'G' && r.after === 'B').length, upgraded_A: judged.filter(r => r.before === 'B' && r.after === 'A').length,
      review_actions: judged.reduce((sum, r) => sum + (r.review_actions ?? 0), 0),
      review_minutes: judged.some(r => r.review_minutes == null) || !judged.length ? null : judged.reduce((sum, r) => sum + r.review_minutes, 0),
      observed_yield_available: successful.size > 0 && judged.length > 0 }
  })
}

export function benchmarkMetrics(plan, attempts, outcomes = [], { retriever, requireIdentification = true, apiKeyProject = null, topN = 3 } = {}) {
  const fixed = plan.fixed_cohort ?? plan.cohort
  const baseline = benchmarkBaseline(plan, plan.benchmark_baseline)
  const expected = new Map(fixed.flatMap(row => row.requests.map(q => [JSON.stringify([row.representative_item_id, q.strategy, q.query]), { row, q }])))
  const groups = new Map(), quarantined = []
  for (const r of attempts) {
    const key = JSON.stringify([r.representative_item_id, r.strategy, r.query]), target = expected.get(key)
    const page = r.startIndex ?? 0
    if (r.retriever !== retriever || !target || target.row.passage_sha256 !== r.passage_sha256 || !isDeepStrictEqual(target.row.body_sha256_by_item, r.body_sha256_by_item)
      || retriever === 'google_books_api' && (r.filter !== plan.filter || r.maxResults !== plan.maxResults || !Number.isInteger(page) || page < 0 || page % 40 || page >= plan.max_pages_per_query * 40)) { quarantined.push(r); continue }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const wasAttempted = r => !r.state.startsWith('not_attempted')
  const valid = r => ['candidates', 'no_results'].includes(r.state) && Array.isArray(r.hits) && r.hits.every(h => candidateId(h)) && (!requireIdentification || r.authenticated === true && (retriever !== 'google_books_api' || apiKeyProject && r.api_key_project === apiKeyProject))
  const completed = new Map()
  for (const [key, records] of groups) {
    const pages = new Map(records.filter(valid).map(r => [r.startIndex ?? 0, r]))
    const first = pages.get(0)
    if (!first) continue
    const needed = retriever === 'google_books_api' && first.hits.length === 40 && first.reported_total > 40 ? Math.min(plan.max_pages_per_query, Math.ceil(first.reported_total / 40)) : 1
    if (Array.from({ length: needed }, (_, i) => retriever === 'google_books_api' ? i * 40 : 0).every(i => pages.has(i))) completed.set(key, [...pages.values()])
  }
  const scoped = [...groups.values()].flat(), candidateRecords = [...completed.values()].flat().filter(r => r.hits?.length)
  const docId = candidateId
  const selected = candidateReviewQueue(plan, scoped.filter(valid), { retriever, topN }).flatMap(r => r.candidates.map(c => ({ ...r, candidate_id: c.candidate_id })))
  const selectedKeys = new Set(selected.map(r => JSON.stringify([r.representative_item_id, r.candidate_id])))
  const judged = outcomes.filter(o => o.retriever === retriever && selectedKeys.has(JSON.stringify([o.representative_item_id, o.candidate_id])))
  if (judged.some(o => !fixed.some(r => r.representative_item_id === o.representative_item_id && r.passage_sha256 === o.passage_sha256 && isDeepStrictEqual(r.body_sha256_by_item, o.body_sha256_by_item)))) throw new Error('Unbound benchmark candidate review')
  const uniqueJudged = [...new Map(judged.map(o => [JSON.stringify([o.representative_item_id, o.candidate_id]), o])).values()]
  if (uniqueJudged.some(o => !o.candidate_id)) throw new Error('Benchmark verification requires a stable candidate ID')
  if (uniqueJudged.some(o => !['A', 'B', 'C', 'G'].includes(o.before) || !['A', 'B', 'C', 'G'].includes(o.after))) throw new Error('Invalid benchmark review grade')
  const useful = uniqueJudged.filter(o => ['A', 'B'].includes(o.after)), usefulItems = new Set(useful.map(o => o.representative_item_id))
  const hitItems = new Set(candidateRecords.map(r => r.representative_item_id))
  const completeItems = fixed.filter(row => row.requests.every(q => completed.has(JSON.stringify([row.representative_item_id, q.strategy, q.query])))).length
  const allComplete = completed.size === expected.size && fixed.length > 0
  const reviewedKeys = new Set(uniqueJudged.filter(o => ['A', 'B', 'C', 'G'].includes(o.after)).map(o => JSON.stringify([o.representative_item_id, o.candidate_id])))
  const verificationComplete = allComplete && [...selectedKeys].every(k => reviewedKeys.has(k))
  const newAItems = new Set(uniqueJudged.filter(o => o.before === 'G' && o.after === 'A' && baseline.rows.some(r => r.representative_item_id === o.representative_item_id && r.status === 'unresolved')).map(o => o.representative_item_id))
  const availability = {
    queries_planned: expected.size, queries_attempted: [...groups.values()].filter(rs => rs.some(wasAttempted)).length, queries_completed: completed.size,
    queries_429: [...groups.values()].filter(rs => rs.some(r => r.http_status === 429)).length,
    queries_other_error: [...groups.values()].filter(rs => rs.some(r => wasAttempted(r) && !['candidates', 'no_results', 'rate_limited'].includes(r.state))).length,
    http_attempts: scoped.filter(wasAttempted).length, http_429_attempts: scoped.filter(r => r.http_status === 429).length,
    queries_missing_auth: [...groups.values()].filter(rs => rs.some(r => ['not_attempted_missing_auth', 'not_attempted_missing_project'].includes(r.state))).length,
    targets_completed: completeItems, targets_planned: fixed.length, quarantined_records: quarantined.length,
  }
  return { retriever, availability, retrieval: { valid_queries: completed.size, queries_with_candidate: [...completed.values()].filter(rs => rs.some(r => r.hits.length)).length,
    unique_candidates: new Set(candidateRecords.flatMap(r => r.hits.map(docId)).filter(Boolean)).size, candidates_reviewed: uniqueJudged.length },
    verification: { unit: 'candidate_decision', A: useful.filter(o => o.after === 'A').length, B: useful.filter(o => o.after === 'B').length,
      C: uniqueJudged.filter(o => o.after === 'C').length, G: uniqueJudged.filter(o => o.after === 'G').length, A_promotions: uniqueJudged.filter(o => o.before === 'B' && o.after === 'A').length },
    termination: { all_fixed_queries_completed: allComplete, ranking_ready: allComplete, verification_complete: verificationComplete, benchmark_complete: verificationComplete, topN, selected_candidates: selectedKeys.size },
    rates: { candidate_hit_rate: allComplete ? hitItems.size / fixed.length : null, useful_hit_rate: verificationComplete ? usefulItems.size / fixed.length : null,
      A_rate: verificationComplete ? newAItems.size / fixed.length : null, review_precision: uniqueJudged.length ? useful.length / uniqueJudged.length : null,
      queries_per_useful_source: verificationComplete && usefulItems.size ? completed.size / usefulItems.size : null },
    provisional_useful_items: usefulItems.size,
    limitation: 'Completed query counts deduplicate retries and require all predeclared pages. Final useful/A rates wait for frozen top-N review completion; status histories may overlap after retries.' }
}

export function benchmarkBaseline(plan, snapshot = null) {
  const fixed = plan.fixed_cohort ?? plan.cohort
  const identity = r => ({ representative_item_id: r.representative_item_id, passage_sha256: r.passage_sha256, body_sha256_by_item: r.body_sha256_by_item })
  const result = snapshot ?? { cohort_sha256: plan.cohort_sha256 ?? null, rows: fixed.map(r => ({ ...identity(r), status: r.current_status ?? r.status ?? null })) }
  if (result.cohort_sha256 !== (plan.cohort_sha256 ?? null) || !Array.isArray(result.rows) || result.rows.length !== fixed.length || !isDeepStrictEqual(result.rows.map(identity), fixed.map(identity))) throw new Error('Benchmark baseline identity mismatch')
  if (result.rows.some(r => r.status !== null && !['unresolved', 'confirmed_exact', 'supported_candidate', 'topic_lineage_only'].includes(r.status))) throw new Error('Unknown benchmark baseline status')
  return result
}

function candidateId(hit) {
  const id = hit && (hit.volume_id ?? hit.paperId ?? hit.paper?.paperId ?? hit.paperInfo?.paperId ?? hit.id)
  if (typeof id === 'string' && id.trim()) return id
  const corpusId = hit?.paper?.corpusId ?? hit?.corpusId
  return Number.isSafeInteger(corpusId) && corpusId > 0 ? `CorpusId:${corpusId}` : null
}

export function candidateReviewQueue(plan, attempts, { retriever, topN = 3, requireIdentification = false, apiKeyProject = null } = {}) {
  if (!Number.isInteger(topN) || topN < 1 || topN > 10) throw new Error('Bounded top-N required')
  const fixed = plan.fixed_cohort ?? plan.cohort
  return fixed.map(row => {
    const hits = attempts.filter(r => r.retriever === retriever && r.representative_item_id === row.representative_item_id && r.passage_sha256 === row.passage_sha256
      && isDeepStrictEqual(r.body_sha256_by_item, row.body_sha256_by_item) && row.requests.some(q => q.query === r.query && q.strategy === r.strategy) && r.state === 'candidates'
      && (!requireIdentification || r.authenticated === true && (retriever !== 'google_books_api' || apiKeyProject && r.api_key_project === apiKeyProject))
      && (retriever !== 'google_books_api' || r.filter === plan.filter && r.maxResults === plan.maxResults && Number.isInteger(r.startIndex) && r.startIndex >= 0 && r.startIndex % 40 === 0 && r.startIndex < plan.max_pages_per_query * 40))
      .flatMap(r => r.hits.map(hit => ({ ...hit, origin_query: r.query, origin_strategy: r.strategy })))
    const byId = new Map()
    for (const hit of hits.sort((a, b) => (b.review_priority_score ?? 0) - (a.review_priority_score ?? 0) || (a.candidate_rank ?? 0) - (b.candidate_rank ?? 0))) {
      const id = candidateId(hit)
      if (id && !byId.has(id)) byId.set(id, { ...hit, candidate_id: id, verdict: 'unreviewed' })
    }
    return { representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item, topN, candidates: [...byId.values()].slice(0, topN) }
  })
}

export async function searchBookInside({ volume_id, query, candidate_rank = null }, { fetchImpl = fetch } = {}) {
  if (!/^[A-Za-z0-9_-]{8,24}$/.test(volume_id ?? '') || typeof query !== 'string' || !query.trim()) throw new Error('Known volume ID and nonempty query required')
  const url = new URL('https://books.google.com/books')
  url.search = new URLSearchParams({ jscmd: 'SearchWithinVolume2', vid: volume_id, q: query })
  const base = { retriever: 'google_books_inside', volume_id, query, candidate_rank, url: String(url), verification_depth: null }
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(25000) })
    const body = await response.json().catch(() => null)
    if (response.status === 429) return { ...base, http_status: 429, state: 'rate_limited', hits: null }
    if ([401, 403].includes(response.status)) return { ...base, http_status: response.status, state: 'access_denied', hits: null }
    if (response.status < 200 || response.status >= 300) return { ...base, http_status: response.status, state: 'http_error', hits: null }
    if (!Number.isInteger(body?.number_of_results) || body.number_of_results < 0 || body.number_of_results > 0 && !body.search_results?.length || body.search_results !== undefined && !Array.isArray(body.search_results) || body.number_of_results === 0 && body.search_results?.length) return { ...base, http_status: response.status, state: 'invalid_response', hits: null }
    const hits = body.search_results ?? []
    return { ...base, http_status: response.status, state: hits.length ? 'candidates' : 'no_results', reported_total: body.number_of_results,
      verification_depth: hits.length ? 'indexed_text' : null, hits: hits.map(p => ({ page_id: p.page_id, page_number: p.page_number ?? null, snippet: p.snippet_text ?? '', verification_depth: 'indexed_text', verdict: 'unreviewed' })),
      remaining_uncertainty: 'Public reader fragments only; no complete paragraph/page confirmation or A upgrade.' }
  } catch { return { ...base, state: 'request_error', hits: null } }
}

function completeXml(xml) {
  const entityText = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, '')
  for (const match of entityText.matchAll(/&#([^;]*);/g)) {
    if (!/^(?:x[0-9a-f]+|\d+)$/i.test(match[1])) return false
    const n = /^x/i.test(match[1]) ? parseInt(match[1].slice(1), 16) : Number(match[1])
    if (![9, 10, 13].includes(n) && !(n >= 32 && n <= 0xD7FF) && !(n >= 0xE000 && n <= 0xFFFD) && !(n >= 0x10000 && n <= 0x10FFFF)) return false
  }
  const stack = []
  let position = 0, roots = 0
  while (position < xml.length) {
    const start = xml.indexOf('<', position)
    const text = xml.slice(position, start < 0 ? xml.length : start)
    if (!stack.length && text.trim()) return false
    if (start < 0) break
    const special = [['<!--', '-->'], ['<![CDATA[', ']]>'], ['<?', '?>']].find(([prefix]) => xml.startsWith(prefix, start))
    if (special) {
      const end = xml.indexOf(special[1], start + special[0].length)
      if (end < 0) return false
      position = end + special[1].length; continue
    }
    let end = start + 1, quote = '', brackets = 0
    const declaration = xml.startsWith('<!DOCTYPE', start)
    for (; end < xml.length; end++) {
      const char = xml[end]
      if (quote) { if (char === quote) quote = ''; continue }
      if (char === '"' || char === "'") { quote = char; continue }
      if (declaration && char === '[') brackets++
      if (declaration && char === ']') brackets--
      if (char === '>' && !brackets) break
    }
    if (end === xml.length || quote || brackets) return false
    const tag = xml.slice(start + 1, end).trim()
    if (!declaration) {
      const closing = tag.startsWith('/'), name = tag.match(/^\/?([A-Za-z_][\w:.-]*)/)?.[1]
      if (!name) return false
      if (closing) { if (stack.pop() !== name || tag !== '/' + name) return false }
      else { if (!stack.length && ++roots > 1) return false; if (!tag.endsWith('/')) stack.push(name) }
    }
    position = end + 1
  }
  return roots === 1 && !stack.length
}

// JATS body paragraphs are kept separate from bibliography; citation edges remain evidence only.
export function extractOaDocument(xml, documentId) {
  if (!completeXml(xml) || !/<article\b/i.test(xml) || /<html\b/i.test(xml)) return null
  const body = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)?.[1]
  if (!body) return null
  const decode = value => value.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
  const paragraphs = [], references = []
  for (const ref of xml.matchAll(/<ref\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/ref>/g)) references.push({ id: ref[1], document_id: `${documentId}#${ref[1]}`, bibliography: decode(ref[2]) })
  let n = 0
  for (const paragraph of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = decode(paragraph[1]), tokens = originTokens(text)
    const citations = []
    for (const xref of paragraph[1].matchAll(/<xref\b([^>]+)>/g)) {
      if (/ref-type="bibr"/.test(xref[1])) citations.push(...(xref[1].match(/rid="([^"]+)"/)?.[1].split(/\s+/) ?? []))
    }
    for (let start = 0; start < tokens.length; start += 200) {
      if (tokens.length - start < 7) break
      paragraphs.push({ id: `${documentId}:${n}:${start}`, document_id: documentId, text: tokens.slice(start, start + 300).join(' '), citation_edges: [...new Set(citations)].map(id => references.find(ref => ref.id === id)).filter(Boolean).map(ref => ({ type: 'CITES', from: documentId, to: ref.document_id, bibliography: ref.bibliography, scope: 'Citation marker in paragraph; original author of matching words remains unverified.' })) })
    }
    n++
  }
  return { paragraphs, references, body_sha256: createHash('sha256').update(xml).digest('hex') }
}

export async function loadOaDocument(documentId, { cachedXml, fetchImpl = fetch } = {}) {
  if (!/^PMC\d+$/.test(documentId)) throw new Error('Invalid OA document ID')
  let cached = null
  try { cached = cachedXml ? extractOaDocument(cachedXml, documentId) : null } catch { /* Corrupt entity in cache: recover from the official endpoint. */ }
  if (cached) return { state: 'cached', xml: cachedXml, parsed: cached }
  const response = await fetchImpl(`https://www.ebi.ac.uk/europepmc/webservices/rest/${documentId}/fullTextXML`, { signal: AbortSignal.timeout(25000) })
  if (!response.ok) return { state: 'http_error', http_status: response.status }
  const xml = await response.text()
  let parsed = null
  try { parsed = extractOaDocument(xml, documentId) } catch { /* Invalid remote XML is not a usable body. */ }
  return parsed ? { state: 'downloaded', xml, parsed } : { state: 'body_unavailable', http_status: response.status }
}

// Smith-Waterman over tokens: substitutions and inserted/deleted words are explicit gaps.
// This score ranks text matches; it does not decide source attribution or synonym equivalence.
export function localAlignment(exam, document) {
  const a = originTokens(exam), b = originTokens(document)
  if (a.length * b.length > 2_000_000) throw new Error('Split documents into paragraphs before alignment')
  const width = b.length + 1, scores = new Int32Array((a.length + 1) * width)
  let best = 0, endI = 0, endJ = 0
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const score = Math.max(0, scores[(i - 1) * width + j - 1] + (a[i - 1] === b[j - 1] ? 2 : -1), scores[(i - 1) * width + j] - 1, scores[i * width + j - 1] - 1)
    scores[i * width + j] = score
    if (score > best) { best = score; endI = i; endJ = j }
  }
  let i = endI, j = endJ, matched = 0, edits = 0
  while (i && j && scores[i * width + j] > 0) {
    const current = scores[i * width + j]
    if (current === scores[(i - 1) * width + j - 1] + (a[i - 1] === b[j - 1] ? 2 : -1)) {
      if (a[i - 1] === b[j - 1]) matched++; else edits++
      i--; j--
    } else if (current === scores[(i - 1) * width + j] - 1) { i--; edits++ }
    else { j--; edits++ }
  }
  return { local_alignment_score: best, matched_exam_token_count: matched, exam_token_coverage: a.length ? matched / a.length : 0, aligned_exam_span: [i, endI], aligned_document_span: [j, endJ], edits, order_preservation: matched + edits ? matched / (matched + edits) : 0 }
}

export function buildOriginIndex(documents, shingleSize = 5) {
  if (!Number.isInteger(shingleSize) || shingleSize < 2) throw new Error('Invalid shingle size')
  const entries = documents.map(doc => ({ ...doc, tokens: originTokens(doc.text) }))
  const postings = new Map(), tokenPostings = new Map()
  entries.forEach((doc, index) => {
    for (const token of new Set(doc.tokens)) {
      if (!tokenPostings.has(token)) tokenPostings.set(token, new Set())
      tokenPostings.get(token).add(index)
    }
    for (let n = 0; n <= doc.tokens.length - shingleSize; n++) {
      const key = doc.tokens.slice(n, n + shingleSize).join(' ')
      if (!postings.has(key)) postings.set(key, new Set())
      postings.get(key).add(index)
    }
  })
  return { entries, postings, tokenPostings, shingleSize }
}

export function searchOriginIndex(index, exam, limit = 20) {
  const tokens = originTokens(exam), hits = new Map()
  for (let n = 0; n <= tokens.length - index.shingleSize; n++) {
    const key = tokens.slice(n, n + index.shingleSize).join(' ')
    for (const id of index.postings.get(key) ?? []) {
      if (!hits.has(id)) hits.set(id, new Set())
      hits.get(id).add(key)
    }
  }
  const rare = [...new Set(tokens)].filter(token => index.tokenPostings.has(token)).sort((a, b) => index.tokenPostings.get(a).size - index.tokenPostings.get(b).size).slice(0, 20)
  const overlap = new Map()
  for (const token of rare) for (const id of index.tokenPostings.get(token)) {
    if (!overlap.has(id)) overlap.set(id, new Set())
    overlap.get(id).add(token)
  }
  const candidates = [...new Set([...hits.keys(), ...[...overlap].filter(([, words]) => words.size >= 3).map(([id]) => id)])]
    .sort((a, b) => (hits.get(b)?.size ?? 0) - (hits.get(a)?.size ?? 0) || (overlap.get(b)?.size ?? 0) - (overlap.get(a)?.size ?? 0)).slice(0, limit)
  return candidates.map(id => {
    const doc = index.entries[id], { text, tokens: ignoredTokens, ...metadata } = doc
    return { ...metadata, document_id: doc.id, candidate_document_id: doc.candidate_document_id ?? doc.document_id ?? doc.pmcid ?? doc.id, candidate_title: doc.candidate_title ?? doc.title ?? null, candidate_author: doc.candidate_author ?? doc.authorString ?? null, candidate_year: doc.candidate_year ?? doc.pubYear ?? null, document_body_sha256: doc.document_body_sha256 ?? doc.body_sha256 ?? null, matched_block_sha256: createHash('sha256').update(text).digest('hex'), citation_edges: doc.citation_edges ?? [], publication_predates_exam: doc.publication_predates_exam ?? null, candidate_role: 'unclassified', verdict: 'unreviewed', direct_text_seen: true, page_image_seen: false, remaining_uncertainty: 'Automatic text ranking; original authorship, edition and publication timing require review.', exact_shingle_count: hits.get(id)?.size ?? 0, rare_token_overlap: overlap.get(id)?.size ?? 0, ...localAlignment(exam, text) }
  })
    .sort((a, b) => b.local_alignment_score - a.local_alignment_score)
}

export function classifySearchResponse(provider, status, body) {
  if (status === 429) return { state: 'rate_limited', hits: null }
  if ([401, 403].includes(status)) return { state: 'access_denied', hits: null }
  if (status < 200 || status >= 300) return { state: 'http_error', hits: null }
  const arrays = { semantic_scholar: body?.data, google_books: body?.items, europe_pmc: body?.resultList?.result }
  const reported = provider === 'google_books' ? body?.totalItems : body?.hitCount
  const items = arrays[provider]
  if (items !== undefined && !Array.isArray(items)) return { state: 'invalid_response', hits: null }
  if (!Array.isArray(items) && reported !== 0) return { state: 'invalid_response', hits: null }
  if (reported > 0 && !(items?.length)) return { state: 'invalid_response', hits: null }
  if (['google_books', 'semantic_scholar'].includes(provider) && items?.some(hit => !candidateId(hit))) return { state: 'invalid_response', hits: null }
  return { state: (items?.length ?? 0) ? 'candidates' : 'no_results', hits: items ?? [], reported_total: reported ?? items.length }
}

export async function runProvenanceSearch(queue, { fetchImpl = fetch, now, keys = {}, retryOptions = {}, onAttempt = () => {}, circuit = new Map() } = {}) {
  if (typeof now !== 'function') throw new Error('Inject a clock')
  const attempts = []
  for (const row of queue) for (const request of row.requests) {
      const base = { representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item, retriever: ({ semantic_scholar: 'semantic_snippet', google_books: 'google_books_api', europe_pmc: 'europe_pmc' })[request.provider], ...request, attempted_at: now() }
    if (circuit.has(request.provider)) { const skipped = { ...base, state: 'not_attempted_provider_blocked', blocked_by: circuit.get(request.provider) }; attempts.push(skipped); onAttempt(skipped); continue }
    const urls = { semantic_scholar: 'https://api.semanticscholar.org/graph/v1/snippet/search', google_books: 'https://www.googleapis.com/books/v1/volumes', europe_pmc: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search' }
    const url = new URL(urls[request.provider])
      url.searchParams.set(request.provider === 'google_books' ? 'q' : 'query', request.submitted_query ?? request.query)
    const headers = {}
    if (request.provider === 'semantic_scholar') { url.searchParams.set('limit', '5'); if (keys.semantic_scholar) headers['x-api-key'] = keys.semantic_scholar }
    if (request.provider === 'google_books') { url.searchParams.set('maxResults', '10'); if (keys.google_books) url.searchParams.set('key', keys.google_books) }
    if (request.provider === 'europe_pmc') { url.searchParams.set('format', 'json'); url.searchParams.set('pageSize', '10') }
      let attempt
      await requestWithRetry(url, { maxAttempts: request.provider === 'semantic_scholar' ? 3 : 1, ...retryOptions, provider: request.provider, fetchImpl, headers, now,
        authenticated: Boolean(keys[request.provider]), apiKeyProject: request.provider === 'google_books' ? keys.google_books_project ?? null : null,
        attemptOffset: request.attempt_offset ?? 0, onResponse: (metadata, body) => {
          const result = classifySearchResponse(request.provider, metadata.http_status ?? 0, body)
          attempt = { ...base, ...result, ...metadata, state: metadata.availability_state === 'network_error' ? 'request_error' : result.state }
          if (request.provider === 'semantic_scholar' && attempt.hits) attempt.hits = attempt.hits.map((hit, i) => ({ ...hit, retriever: 'semantic_snippet', candidate_rank: i + 1,
            verification_depth: hit.snippet || hit.snippets || hit.text ? 'indexed_text' : 'metadata_only', verdict: 'unreviewed' }))
          attempts.push(attempt); onAttempt(attempt)
        } })
      if (['429_rate_limited', '403/401_auth', '5xx_transient', 'network_error', 'parse_failure'].includes(attempt.availability_state)) circuit.set(request.provider, attempt.availability_state)
  }
  return attempts
}

export async function runFixedSemanticBatch(plan, { previous = [], key, requireIdentification = true, onAttempt = () => {}, ...options } = {}) {
  const identity = r => JSON.stringify([r.representative_item_id, r.passage_sha256, Object.entries(r.body_sha256_by_item ?? {}).sort(), r.strategy, r.query])
  const done = new Set(previous.filter(r => r.retriever === 'semantic_snippet' && ['candidates', 'no_results'].includes(r.state) && Array.isArray(r.hits) && r.hits.every(candidateId) && (!requireIdentification || r.authenticated === true)).map(identity))
  const queue = plan.cohort.map(row => ({ ...row, requests: row.requests.filter(q => !done.has(identity({ ...row, ...q }))).map(q => ({ ...q, provider: 'semantic_scholar', retriever: 'semantic_snippet',
    submitted_query: q.query.replace(/"/g, '').replace(/\s+/g, ' ').trim(),
    attempt_offset: Math.max(0, ...previous.filter(r => identity(r) === identity({ ...row, ...q })).map(r => r.attempt_no ?? 0)) })) }))
  if (requireIdentification && !key) {
    const skipped = queue.flatMap(r => r.requests.map(q => ({ representative_item_id: r.representative_item_id, passage_sha256: r.passage_sha256, body_sha256_by_item: r.body_sha256_by_item,
      ...q, state: 'not_attempted_missing_auth', authenticated: false, api_key_project: null, attempt_no: null, http_status: null, retry_after: null, started_at: null, finished_at: null,
      query_hash: createHash('sha256').update(q.submitted_query).digest('hex'), hits: null })))
    skipped.forEach(onAttempt); return skipped
  }
  const clockMs = options.retryOptions?.nowMs ?? Date.now
  const prior = previous.filter(r => r.retriever === 'semantic_snippet' && r.authenticated === Boolean(key) && r.started_at != null).at(-1)
  if (prior?.retry_not_before_ms > clockMs()) {
    const deferred = queue.flatMap(r => r.requests.map(q => ({ representative_item_id: r.representative_item_id, passage_sha256: r.passage_sha256, body_sha256_by_item: r.body_sha256_by_item,
      ...q, retriever: 'semantic_snippet', state: 'not_attempted_provider_blocked', blocked_by: 'retry_after_wait', retry_not_before_ms: prior.retry_not_before_ms, hits: null })))
    deferred.forEach(onAttempt); return deferred
  }
  return runProvenanceSearch(queue, { ...options, keys: { semantic_scholar: key }, onAttempt })
}

// CLI writes an append-only local attempt log, never the attribution DB. Resume successes only.
async function main() {
    if (process.argv[2] === '--book-plan') {
      const [input, exams, output] = process.argv.slice(3)
      if (!input || !exams || !output) throw new Error('Usage: --book-plan <fresh-rows.json> <exams.json> <plan.json>')
      const plan = makeBookPlan(JSON.parse(fs.readFileSync(input, 'utf8')), JSON.parse(fs.readFileSync(exams, 'utf8')))
      fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(plan, null, 2))
      console.log(JSON.stringify({ classified: plan.classified.length, reference_count: plan.reference_count, cohort: plan.cohort.length, cohort_sha256: plan.cohort_sha256 }))
      return
    }
    if (['--books', '--semantic-fixed'].includes(process.argv[2])) {
      const [input, output, fresh] = process.argv.slice(3)
      if (!input || !output || !fresh) throw new Error('Usage: --books <plan.json> <attempts.jsonl> <current-rows.json>')
      const benchmark = process.argv.includes('--benchmark') || process.argv[2] === '--semantic-fixed'
      const plan = pendingBookPlan(JSON.parse(fs.readFileSync(input, 'utf8')), JSON.parse(fs.readFileSync(fresh, 'utf8')), { includeResolved: benchmark })
      const previous = fs.existsSync(output) ? fs.readFileSync(output, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
      fs.mkdirSync(path.dirname(output), { recursive: true })
      const baselinePath = output + '.baseline.json'
      plan.benchmark_baseline = benchmarkBaseline(plan, fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null)
      if (!fs.existsSync(baselinePath)) fs.writeFileSync(baselinePath, JSON.stringify(plan.benchmark_baseline, null, 2), { flag: 'wx' })
      const common = { now: () => new Date().toISOString(), previous, onAttempt: r => fs.appendFileSync(output, JSON.stringify(r) + '\n') }
      const semantic = process.argv[2] === '--semantic-fixed'
      const attempts = semantic ? await runFixedSemanticBatch(plan, { ...common, key: process.env.SEMANTIC_SCHOLAR_API_KEY })
        : await runBookBatch(plan, { ...common, key: process.env.GOOGLE_BOOKS_API_KEY, apiKeyProject: process.env.GOOGLE_BOOKS_API_PROJECT ?? null, requireIdentification: true })
      const all = [...previous, ...attempts], retriever = semantic ? 'semantic_snippet' : 'google_books_api'
      const reviewsAt = process.argv.indexOf('--reviews')
      const outcomes = reviewsAt < 0 ? [] : JSON.parse(fs.readFileSync(process.argv[reviewsAt + 1], 'utf8')).outcomes
      if (!Array.isArray(outcomes)) throw new Error('--reviews requires an outcomes array')
      const metrics = benchmarkMetrics(plan, all, outcomes, { retriever, apiKeyProject: semantic ? null : process.env.GOOGLE_BOOKS_API_PROJECT ?? null })
      fs.writeFileSync(output + '.metrics.json', JSON.stringify(metrics, null, 2))
      fs.writeFileSync(output + '.review-queue.json', JSON.stringify(candidateReviewQueue(plan, all, { retriever, requireIdentification: true, apiKeyProject: semantic ? null : process.env.GOOGLE_BOOKS_API_PROJECT ?? null }), null, 2))
      console.log(JSON.stringify({ fixed_cohort_size: plan.fixed_cohort_size, already_resolved: plan.already_resolved,
        pending_targets: plan.fixed_cohort_size - plan.already_resolved, queued_targets: plan.cohort.length,
        ...(semantic ? {} : summarizeBookRun(plan, previous, attempts)), benchmark, metrics }))
      return
    }
  if (process.argv[2] === '--oa') {
    const [input, output] = process.argv.slice(3)
    if (!input || !output) throw new Error('Usage: node source-origin-search.mjs --oa <attempts.jsonl> <output-directory>')
    const attempts = fs.readFileSync(input, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    const hits = new Map(attempts.flatMap(row => row.hits ?? []).filter(hit => hit.isOpenAccess === 'Y' && /^PMC\d+$/.test(hit.pmcid ?? '')).map(hit => [hit.pmcid, hit]))
    fs.mkdirSync(output, { recursive: true })
    const documents = [], downloads = []
    for (const [id, hit] of hits) {
      const file = path.join(output, id + '.xml')
      try {
        const result = await loadOaDocument(id, { cachedXml: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined })
        if (!result.parsed) { downloads.push({ id, state: result.state, http_status: result.http_status }); continue }
        if (result.state === 'downloaded') fs.writeFileSync(file, result.xml)
        documents.push(...result.parsed.paragraphs.map(paragraph => ({ ...paragraph, body_sha256: result.parsed.body_sha256, candidate_title: hit.title ?? null, candidate_author: hit.authorString ?? null, candidate_year: hit.pubYear ?? null, publication_date: hit.firstPublicationDate ?? null, url: `https://europepmc.org/articles/${id}`, retriever: 'europe_pmc_oa', bibliography_seen: !!hit.title })))
        downloads.push({ id, state: result.state, body_sha256: result.parsed.body_sha256 })
      } catch { downloads.push({ id, state: 'request_error' }) }
    }
    fs.writeFileSync(path.join(output, 'documents.json'), JSON.stringify(documents))
    fs.writeFileSync(path.join(output, 'downloads.json'), JSON.stringify(downloads, null, 2))
    console.log(JSON.stringify({ requested: hits.size, indexed_paragraphs: documents.length, failures: downloads.filter(d => !['cached', 'downloaded'].includes(d.state)).length }))
    return
  }
  if (process.argv[2] === '--local') {
    const [input, corpus, output] = process.argv.slice(3)
    if (!input || !corpus || !output) throw new Error('Usage: node source-origin-search.mjs --local <fresh-rows.json> <paragraph-documents.json> <ranking.json>')
    const rows = JSON.parse(fs.readFileSync(input, 'utf8'))
    const documents = JSON.parse(fs.readFileSync(corpus, 'utf8'))
    const index = buildOriginIndex(documents)
    const ranking = rows.filter(row => row.status === 'unresolved').map(row => ({ representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item, verdict: 'unreviewed', candidates: searchOriginIndex(index, row.passage) }))
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, JSON.stringify({ indexed_paragraphs: documents.length, ranking }, null, 2))
    console.log(JSON.stringify({ targets: ranking.length, indexed_paragraphs: documents.length, output }))
    return
  }
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error('Usage: node source-origin-search.mjs <fresh-rows.json> <attempts.jsonl>')
  const rows = JSON.parse(fs.readFileSync(input, 'utf8'))
  const frequencies = documentFrequencies(rows.map(row => row.passage))
  const queue = rows.filter(row => row.status === 'unresolved').map(row => ({ representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item, requests: provenanceRequests(row, frequencies, rows.length) }))
  const previous = fs.existsSync(output) ? fs.readFileSync(output, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
  const key = row => JSON.stringify([row.passage_sha256, Object.entries(row.body_sha256_by_item ?? {}).sort(([a], [b]) => a.localeCompare(b)), row.provider, row.query])
  const done = new Set(previous.filter(r => ['candidates', 'no_results'].includes(r.state)).map(key))
  const pending = queue.map(row => ({ ...row, requests: row.requests.filter(request => !done.has(key({ ...row, ...request }))) }))
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const planned = pending.reduce((n, row) => n + row.requests.length, 0)
  fs.writeFileSync(output + '.queue.json', JSON.stringify(queue, null, 2))
  console.log(JSON.stringify({ targets: queue.length, planned, resumed_successes: done.size }))
  const circuit = new Map(), counts = {}
  const keys = { semantic_scholar: process.env.SEMANTIC_SCHOLAR_API_KEY, google_books: process.env.GOOGLE_BOOKS_API_KEY }
  for (let i = 0; i < pending.length; i++) {
    await runProvenanceSearch([pending[i]], { now: () => new Date().toISOString(), keys, circuit, onAttempt: row => {
      fs.appendFileSync(output, JSON.stringify(row) + '\n'); counts[row.state] = (counts[row.state] ?? 0) + 1
    } })
    if ((i + 1) % 30 === 0) console.log(JSON.stringify({ processed: i + 1, counts }))
  }
  console.log(JSON.stringify({ complete: true, targets: queue.length, counts, output_sha256: createHash('sha256').update(fs.readFileSync(output)).digest('hex') }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1 })
