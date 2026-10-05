// scripts/csat/source-origin-search.mjs
// Search phrases stay inside a sentence and an exam block; passage hashes remain unchanged.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
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
  const identity = cohort.map(r => ({ id: r.representative_item_id, registry: r.passage_sha256, bodies: r.body_sha256_by_item, exam_year: r.exam_year, exam_month: r.exam_month, requests: r.requests }))
  return { classification_version: 'book-routing-v2', reference_count: references.length, reference_labels: references.map(r => ({ item_id: r.representative_item_id, status: r.status, lane: referenceLane(r) })), classified,
    cohort, cohort_sha256: createHash('sha256').update(JSON.stringify(identity)).digest('hex'), sample_size_requested: sampleSize,
    filter: 'partial', maxResults: 40, max_pages_per_query: 2,
    limitations: ['Heuristic routes overlap; no origin-type ground truth or held-out accuracy.', 'A and B references retain different verification status.', 'Missing name clues yield three families rather than fabricated names.', 'Preview filter excludes non-previewable candidates; no result does not establish absent source.'] }
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

export async function runBookBatch(plan, { fetchImpl = fetch, now, key, onAttempt = () => {}, previous = [] } = {}) {
  if (typeof now !== 'function') throw new Error('Inject a clock')
  if (!['partial', 'full'].includes(plan.filter) || plan.maxResults !== 40 || !Number.isInteger(plan.max_pages_per_query) || plan.max_pages_per_query < 1 || plan.max_pages_per_query > 10) throw new Error('Invalid bounded book batch options')
  const attemptKey = r => JSON.stringify([r.passage_sha256, Object.entries(r.body_sha256_by_item ?? {}).sort(), r.query, r.startIndex, plan.filter, plan.maxResults])
  const done = new Map(previous.filter(r => ['candidates', 'no_results'].includes(r.state) && r.retriever === 'google_books_api' && r.filter === plan.filter && r.maxResults === plan.maxResults).map(r => [attemptKey(r), r]))
  let blocked = null
  const attempts = []
  for (const row of plan.cohort) for (const request of row.requests) {
    for (let page = 0; page < plan.max_pages_per_query; page++) {
      const base = { representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item,
        ...request, retriever: 'google_books_api', startIndex: page * 40, maxResults: 40, filter: plan.filter, attempted_at: now() }
      const cached = done.get(attemptKey(base))
      if (cached) { if (cached.state === 'no_results' || cached.hits.length < 40 || base.startIndex + 40 >= cached.reported_total) break; continue }
      if (blocked) { const attempt = { ...base, state: 'not_attempted_provider_blocked', blocked_by: blocked, hits: null }; attempts.push(attempt); onAttempt(attempt); break }
      const url = new URL('https://www.googleapis.com/books/v1/volumes')
      for (const [k, v] of Object.entries({ q: request.query, printType: 'books', langRestrict: 'en', filter: plan.filter, maxResults: 40, startIndex: base.startIndex })) url.searchParams.set(k, String(v))
      if (key) url.searchParams.set('key', key)
      let attempt
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(25000) })
        const body = await response.json().catch(() => null)
        const result = classifySearchResponse('google_books', response.status, body)
        attempt = { ...base, http_status: response.status, ...result, hits: result.hits?.map((hit, i) => bookCandidate(hit, row, base.startIndex + i + 1)) ?? null }
        if (['rate_limited', 'access_denied'].includes(attempt.state)) blocked = attempt.state
      } catch { attempt = { ...base, state: 'request_error', hits: null } }
      attempts.push(attempt); onAttempt(attempt)
      if (!['candidates', 'no_results'].includes(attempt.state) || !attempt.hits.length || attempt.hits.length < 40 || base.startIndex + 40 >= attempt.reported_total) break
    }
  }
  return attempts
}

export function pendingBookPlan(plan, currentRows) {
  const current = new Map(currentRows.map(r => [r.representative_item_id, r]))
  const pending = []
  for (const row of plan.cohort) {
    const latest = current.get(row.representative_item_id)
    if (!latest || latest.passage_sha256 !== row.passage_sha256 || !isDeepStrictEqual(latest.body_sha256_by_item, row.body_sha256_by_item)) throw new Error('Frozen cohort body changed: ' + row.representative_item_id)
    if (latest.status === 'unresolved') pending.push(row)
  }
  return { ...plan, cohort: pending, fixed_cohort_size: plan.cohort.length, already_resolved: plan.cohort.length - pending.length }
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
  if (!Array.isArray(items) && reported !== 0) return { state: 'invalid_response', hits: null }
  if (reported > 0 && !(items?.length)) return { state: 'invalid_response', hits: null }
  return { state: (items?.length ?? 0) ? 'candidates' : 'no_results', hits: items ?? [], reported_total: reported ?? items.length }
}

export async function runProvenanceSearch(queue, { fetchImpl = fetch, now, keys = {}, onAttempt = () => {}, circuit = new Map() } = {}) {
  if (typeof now !== 'function') throw new Error('Inject a clock')
  const attempts = []
  for (const row of queue) for (const request of row.requests) {
      const base = { representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item, retriever: ({ semantic_scholar: 'semantic_snippet', google_books: 'google_books_api', europe_pmc: 'europe_pmc' })[request.provider], ...request, attempted_at: now() }
    if (circuit.has(request.provider)) { const skipped = { ...base, state: 'not_attempted_provider_blocked', blocked_by: circuit.get(request.provider) }; attempts.push(skipped); onAttempt(skipped); continue }
    const urls = { semantic_scholar: 'https://api.semanticscholar.org/graph/v1/snippet/search', google_books: 'https://www.googleapis.com/books/v1/volumes', europe_pmc: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search' }
    const url = new URL(urls[request.provider])
    url.searchParams.set(request.provider === 'google_books' ? 'q' : 'query', request.query)
    const headers = {}
    if (request.provider === 'semantic_scholar') { url.searchParams.set('limit', '5'); if (keys.semantic_scholar) headers['x-api-key'] = keys.semantic_scholar }
    if (request.provider === 'google_books') { url.searchParams.set('maxResults', '10'); if (keys.google_books) url.searchParams.set('key', keys.google_books) }
    if (request.provider === 'europe_pmc') { url.searchParams.set('format', 'json'); url.searchParams.set('pageSize', '10') }
    let attempt
    try {
      const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(25000) })
      const body = await response.json().catch(() => null)
      attempt = { ...base, http_status: response.status, ...classifySearchResponse(request.provider, response.status, body) }
      if (['rate_limited', 'access_denied'].includes(attempt.state)) circuit.set(request.provider, attempt.state)
    } catch { attempt = { ...base, state: 'request_error', hits: null } }
    attempts.push(attempt); onAttempt(attempt)
  }
  return attempts
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
    if (process.argv[2] === '--books') {
      const [input, output, fresh] = process.argv.slice(3)
      if (!input || !output || !fresh) throw new Error('Usage: --books <plan.json> <attempts.jsonl> <current-rows.json>')
      const plan = pendingBookPlan(JSON.parse(fs.readFileSync(input, 'utf8')), JSON.parse(fs.readFileSync(fresh, 'utf8')))
      const previous = fs.existsSync(output) ? fs.readFileSync(output, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
      fs.mkdirSync(path.dirname(output), { recursive: true })
      const attempts = await runBookBatch(plan, { now: () => new Date().toISOString(), key: process.env.GOOGLE_BOOKS_API_KEY, previous,
        onAttempt: r => fs.appendFileSync(output, JSON.stringify(r) + '\n') })
      console.log(JSON.stringify(retrieverStatistics(attempts)))
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
