// scripts/csat/lib-review-ledger.mjs
import crypto from 'node:crypto'

const KINDS = new Set(['blind', 'rereview', 'correction'])
const SEVERITIES = new Set(['minor', 'revise', 're-reject', 'reference', 'rule'])
const STATUSES = new Set(['open', 'in_correction', 'fixed-published', 'dismissed'])
const KNOWN = new Set(['date', 'batch', 'kind', 'chunk_size', 'items', 'agents', 'tokens', 'published', 'refused', 're_rejected', 'note'])
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const hasNullByte = (v) => typeof v === 'string' ? v.includes('\0') :
  Array.isArray(v) ? v.some(hasNullByte) : object(v) ? Object.entries(v).some(([k, x]) => hasNullByte(k) || hasNullByte(x)) : false
// Iteration yields a full code point for a valid pair, but leaves lone surrogates in this range.
const hasUnpairedSurrogate = (v) => typeof v === 'string' ? [...v].some((c) => {
  const code = c.codePointAt(0)
  return code >= 0xd800 && code <= 0xdfff
}) : Array.isArray(v) ? v.some(hasUnpairedSurrogate) : object(v) ?
  Object.entries(v).some(([k, x]) => hasUnpairedSurrogate(k) || hasUnpairedSurrogate(x)) : false
const text = (v) => typeof v === 'string' && !hasNullByte(v) && !hasUnpairedSurrogate(v)
const length = (v) => text(v) ? [...v].length : -1 // PostgreSQL length(text) counts code points
const integer = (v, min = 0) => Number.isInteger(v) && v >= min && v <= 2147483647
const date = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !v.startsWith('0000') &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v

/** Validate every physical JSONL line before constructing either table's writes. Last natural key wins. */
export function prepareReviewLedgers(metrics, followups, now) {
  const errors = []
  const batches = new Map()
  const follow = new Map()
  const read = (body, file, visit) => {
    for (const [i, line] of body.split(/\r?\n/).entries()) {
      if (!line.trim()) continue
      const at = `${file}:${i + 1}`
      let value
      try { value = JSON.parse(line) } catch { errors.push(`${at}: JSON 아님`); continue }
      if (!object(value)) { errors.push(`${at}: 객체가 필요하다`); continue }
      // PostgreSQL text/jsonb cannot represent a zero byte, including nested detail/tokens values.
      if (hasNullByte(value)) { errors.push(`${at}: NUL 문자는 저장할 수 없다`); continue }
      if (hasUnpairedSurrogate(value)) { errors.push(`${at}: 짝이 없는 유니코드 서로게이트는 저장할 수 없다`); continue }
      visit(value, at)
    }
  }
  let notes = 0
  read(metrics, '_metrics.jsonl', (m, at) => {
    // 메모 전용 줄({date, note} 뿐 — batch·items 없음)은 배치가 아니라 장부의 주석이다. 예전 importer 는 batch 없는 줄을 건너뛰었고
    // 실제 장부에 그런 줄이 있다(2026-09-29 비용 해석 메모). 배치 필드가 하나라도 있으면 여전히 검증한다 — 오타를 주석으로 삼키지 않게
    if (m.batch == null && m.items == null && Object.keys(m).every((k) => k === 'date' || k === 'note')) { notes += 1; return }
    const e = []
    if (length(m.batch) < 3 || length(m.batch) > 120) e.push('batch 3~120자')
    if (!date(m.date)) e.push('date 실제 날짜 YYYY-MM-DD')
    if (m.kind != null && !KINDS.has(m.kind)) e.push('kind blind|rereview|correction')
    if (!integer(m.items)) e.push('items 0~2147483647 정수')
    if (m.chunk_size != null && !integer(m.chunk_size, 1)) e.push('chunk_size 1~2147483647 정수')
    for (const k of ['agents', 'published', 'refused', 're_rejected']) if (m[k] != null && !integer(m[k])) e.push(`${k} 0~2147483647 정수`)
    if (m.tokens != null && !object(m.tokens)) e.push('tokens 객체|null')
    if (m.note != null && !text(m.note)) e.push('note 문자열|null')
    if (e.length) { errors.push(`${at}: ${e.join(' · ')}`); return }
    batches.set(m.batch, {
      batch: m.batch, run_date: m.date, kind: m.kind ?? 'blind', chunk_size: m.chunk_size ?? null,
      items: m.items, agents: m.agents ?? null, tokens: m.tokens ?? null,
      published: m.published ?? null, refused: m.refused ?? null, re_rejected: m.re_rejected ?? null, note: m.note ?? null,
      detail: Object.fromEntries(Object.entries(m).filter(([k]) => !KNOWN.has(k))),
    })
  })
  read(followups, '_followups.jsonl', (f, at) => {
    const e = []
    if (!text(f.item_id) || !f.item_id.trim() || !text(f.source) || !f.source.trim()) e.push('item_id·source 문자열 필수')
    if (length(f.finding) < 5) e.push('finding 5자 이상')
    if (!SEVERITIES.has(f.severity)) e.push('severity 허용값 아님')
    if (!STATUSES.has(f.status)) e.push('status 허용값 아님')
    if (!date(f.date)) e.push('date 실제 날짜 YYYY-MM-DD')
    if (e.length) { errors.push(`${at}: ${e.join(' · ')}`); return }
    const row = {
      item_id: f.item_id, source: f.source, finding_key: crypto.createHash('sha256').update(f.finding).digest('hex'),
      finding: f.finding, severity: f.severity, status: f.status, noted_on: f.date, updated_at: now,
    }
    follow.set(JSON.stringify([row.item_id, row.source, row.finding_key]), row)
  })
  if (errors.length) throw new Error(`장부 값 오류 ${errors.length}건 — 아무것도 쓰지 않았다:\n    ${errors.join('\n    ')}`)
  return { batches: [...batches.values()], followups: [...follow.values()], notes }
}
