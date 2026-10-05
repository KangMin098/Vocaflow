// scripts/csat/source-origin-search.mjs
// Search phrases stay inside a sentence and an exam block; passage hashes remain unchanged.
export function searchSegments(value, typeId = '') {
  let text = String(value ?? '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  if (typeId === 'R-SUMMARY' && /\(A\)\s*[_━─]/.test(text)) {
    const marker = text.search(/\(A\)\s*[_━─]/)
    const boundary = Math.max(text.lastIndexOf('.', marker), text.lastIndexOf('\n', marker), text.lastIndexOf('↓', marker))
    text = boundary < 0 ? '' : text.slice(0, boundary + 1)
  }
  return text
    .split(/\([A-C]\)|[①-⑤❶-❺]|[_━─]+|[.!?;\n\r]|\([^)]*\)|[→↓]|[\uac00-\ud7a3]+/)
    .map(part => part.replace(/[^A-Za-z0-9'’ -]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(part => part.split(' ').filter(word => /^[A-Za-z0-9][A-Za-z0-9'-]*$/.test(word)))
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
