// scripts/csat/verify-quote-anchors.mjs
//
// **인용문이 지문의 «그 자리» 로 되돌아오는지 전수로 잰다.**
//
// `lib/csat/quote-match.ts` 가 화면에서 할 일을 여기서 미리 해 본다. 합성 검사(vitest)는
// 로직을 지키고, 이 스크립트는 **실제 802문항이 그 로직을 통과하는지**를 지킨다 — 둘은 다른 것을
// 막는다. 지문이 바뀌거나(재추출) 인용문이 바뀌면(재분석) 여기 수치가 먼저 움직인다.
//
// 읽기 전용이다. 몇 번을 돌려도 DB 를 바꾸지 않는다.
//
//   node scripts/csat/verify-quote-anchors.mjs
//   node scripts/csat/verify-quote-anchors.mjs --show 10   # 못 맞춘 것을 보여 준다

import fs from 'node:fs'
import path from 'node:path'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local)')
  process.exit(1)
}

const showN = (() => {
  const i = process.argv.indexOf('--show')
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : 0
})()

const { createClient } = await import('@supabase/supabase-js')
const { findQuote } = await import('../../apps/web/src/lib/csat/quote-match.ts')
const db = createClient(url, key, { auth: { persistSession: false } })

// ⚠️ **페이징한다.** PostgREST 는 요청하지 않으면 1,000행에서 조용히 끊는다 — 오류가 아니라
//    «적게 받은 것»으로 나타나므로 눈에 안 띈다(실측 2026-09-15: 안 넣었더니 분석 3,069건 중
//    1,000건만 와서 802문항이 245문항으로 보였고, 그 245건은 전부 통과해 «100%» 라고 말했다.
//    자른 표본이 좋은 수치를 낸 것이라 더 나빴다).
const PAGE = 1000
const rows = []
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from('csat_item_analyses')
    .select('item_id, version, answer_locus, choice_analysis')
    .eq('status', 'published')
    .order('item_id')
    .order('version', { ascending: false })
    .range(from, from + PAGE - 1)
  if (error) {
    console.error('분석 조회 실패:', error.message)
    process.exit(1)
  }
  rows.push(...data)
  if (data.length < PAGE) break
}

const latest = new Map()
for (const r of rows) if (!latest.has(r.item_id)) latest.set(r.item_id, r)

const items = []
for (let from = 0; ; from += PAGE) {
  const { data, error: iErr } = await db
    .from('csat_items')
    .select('id, passage, body_ok')
    .order('id')
    .range(from, from + PAGE - 1)
  if (iErr) {
    console.error('지문 조회 실패:', iErr.message)
    process.exit(1)
  }
  items.push(...data)
  if (data.length < PAGE) break
}
const passages = new Map(items.map((i) => [i.id, i]))

let total = 0
let okTrue = 0
let okTrueHit = 0
let okFalse = 0
let okFalseHit = 0
let noPassage = 0
let exact = 0
const misses = []

for (const [itemId, a] of latest) {
  const it = passages.get(itemId)
  const quote = a.answer_locus?.quote
  if (!quote) continue
  total += 1
  if (!it?.passage) {
    noPassage += 1
    continue
  }
  const hit = findQuote(it.passage, quote)
  if (hit?.exact) exact += 1
  if (it.body_ok) {
    okTrue += 1
    if (hit) okTrueHit += 1
    else misses.push({ itemId, body_ok: true, quote })
  } else {
    okFalse += 1
    if (hit) okFalseHit += 1
    else misses.push({ itemId, body_ok: false, quote })
  }
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(2) : '—')

console.log(`\n인용 앵커 전수 검증 — 분석 ${total}건\n`)
console.log(`  지문 없음            ${noPassage}`)
console.log(`  body_ok = true       ${okTrueHit} / ${okTrue}  (${pct(okTrueHit, okTrue)}%)   ← 이 줄이 기준이다`)
console.log(`  body_ok = false      ${okFalseHit} / ${okFalse}  (${pct(okFalseHit, okFalse)}%)  (이미 격리된 문항)`)
console.log(`  그대로 찾힌 것       ${exact} (${pct(exact, total)}%) — 나머지는 정규화가 건졌다`)

if (misses.length && showN) {
  console.log(`\n못 맞춘 ${misses.length}건 중 ${Math.min(showN, misses.length)}건:`)
  for (const m of misses.slice(0, showN)) {
    console.log(`  ${m.itemId} (body_ok=${m.body_ok}) — ${m.quote.slice(0, 70)}`)
  }
}

// **body_ok = true 가 하나라도 못 맞으면 실패다.** 격리된 문항은 분모에서 뺀다 —
// 거기 실패는 매칭기가 아니라 지문 추출의 문제이고, 화면이 이미 격리로 표시한다.
const failed = okTrue - okTrueHit
console.log(failed === 0 ? '\n✅ 건강한 문항 전부 매칭됨' : `\n❌ 건강한 문항 ${failed}건이 안 맞는다`)
await new Promise((r) => setTimeout(r, 100))
process.exit(failed === 0 ? 0 : 1)
