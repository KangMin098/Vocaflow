// scripts/csat/source-origin-search.mjs
// Search phrases stay inside a sentence and an exam block; passage hashes remain unchanged.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
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

// JATS body paragraphs are kept separate from bibliography; citation edges remain evidence only.
export function extractOaDocument(xml, documentId) {
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
  return candidates.map(id => ({ document_id: index.entries[id].id, exact_shingle_count: hits.get(id)?.size ?? 0, rare_token_overlap: overlap.get(id)?.size ?? 0, ...localAlignment(exam, index.entries[id].text) }))
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
  return { state: (items?.length ?? 0) ? 'candidates' : 'no_results', hits: items ?? [], reported_total: reported ?? items.length }
}

export async function runProvenanceSearch(queue, { fetchImpl = fetch, now, keys = {}, onAttempt = () => {}, circuit = new Map() } = {}) {
  if (typeof now !== 'function') throw new Error('Inject a clock')
  const attempts = []
  for (const row of queue) for (const request of row.requests) {
    const base = { representative_item_id: row.representative_item_id, passage_sha256: row.passage_sha256, body_sha256_by_item: row.body_sha256_by_item, ...request, attempted_at: now() }
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
  if (process.argv[2] === '--oa') {
    const [input, output] = process.argv.slice(3)
    if (!input || !output) throw new Error('Usage: node source-origin-search.mjs --oa <attempts.jsonl> <output-directory>')
    const attempts = fs.readFileSync(input, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    const ids = new Set(attempts.flatMap(row => row.hits ?? []).filter(hit => hit.isOpenAccess === 'Y' && /^PMC\d+$/.test(hit.pmcid ?? '')).map(hit => hit.pmcid))
    fs.mkdirSync(output, { recursive: true })
    const documents = [], downloads = []
    for (const id of ids) {
      const file = path.join(output, id + '.xml')
      let xml, status, cached = fs.existsSync(file)
      try {
        if (cached) xml = fs.readFileSync(file, 'utf8')
        else {
          const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${id}/fullTextXML`, { signal: AbortSignal.timeout(25000) })
          status = response.status
          if (!response.ok) { downloads.push({ id, state: 'http_error', http_status: status }); continue }
          xml = await response.text()
        }
        const parsed = extractOaDocument(xml, id)
        if (!parsed) { downloads.push({ id, state: 'body_unavailable', http_status: status }); continue }
        if (!cached) fs.writeFileSync(file, xml)
        documents.push(...parsed.paragraphs.map(paragraph => ({ ...paragraph, body_sha256: parsed.body_sha256 })))
        downloads.push({ id, state: cached ? 'cached' : 'downloaded', body_sha256: parsed.body_sha256 })
      } catch { downloads.push({ id, state: 'request_error', http_status: status }) }
    }
    fs.writeFileSync(path.join(output, 'documents.json'), JSON.stringify(documents))
    fs.writeFileSync(path.join(output, 'downloads.json'), JSON.stringify(downloads, null, 2))
    console.log(JSON.stringify({ requested: ids.size, indexed_paragraphs: documents.length, failures: downloads.filter(d => !['cached', 'downloaded'].includes(d.state)).length }))
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
