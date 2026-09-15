// scripts/csat/anchor-inventory.mjs
//
// **해설이 원문을 가리킬 수 있는 «자리» 가 실제로 몇 개인가 — 전수 재고조사.**
//
// 화면을 설계하기 전에 이걸 먼저 재야 한다. 분석 jsonb 에는 위치를 말하는 필드가 여럿인데
// **신뢰도가 서로 다르고, 낮은 쪽은 조용히 틀린다.** 실측(2026-09-15 · body_ok=true 589문항):
//
//   · answer_locus.quote          — **589/589 (100%)**. 인용문은 지문에서 그대로 찾힌다
//   · answer_locus.sentence_index — **1-기반 65.0%** / 0-기반 15.8%.
//       ⚠️ **이것을 근거로 칠하면 3문항 중 1문항이 틀린 문장을 칠한다.** 규약이 저장소
//          어디에도 없다(export·validate·에이전트 정의 전부에 없음) — LLM 분석가가 자기
//          방식으로 센 값이다. **화면에 쓰지 않는다.** 문장은 인용 위치에서 역산한다.
//   · choice_analysis[].confirmed_at — 532건이지만 **quote 가 0건**이고 sentence_index 뿐이라
//       같은 이유로 쓸 수 없다.
//   · choice_analysis[].how_to_reject — 한국어 산문 «속에 박힌» 영어 조각이 근거다.
//       20자 이상 조각을 뽑아 걸면 **1,119개**가 원문에 붙는다(문항 454/589 = 77.1%).
//
// 그래서 화면이 쓸 수 있는 믿을 만한 앵커는 **589 + 1,119 = 1,708개**다. 이 수가 목표의 분모다.
//
// 읽기 전용. 몇 번을 돌려도 DB 를 바꾸지 않는다.   node scripts/csat/anchor-inventory.mjs

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

const { createClient } = await import('@supabase/supabase-js')
const { findQuote } = await import('../../apps/web/src/lib/csat/quote-match.ts')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ 페이징한다 — PostgREST 는 1,000행에서 조용히 끊는다(오류가 아니라 «적게 받음»이다).
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
  if (error) { console.error('분석 조회 실패:', error.message); process.exit(1) }
  rows.push(...data)
  if (data.length < PAGE) break
}
const latest = new Map()
for (const r of rows) if (!latest.has(r.item_id)) latest.set(r.item_id, r)

const items = []
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db.from('csat_items').select('id, passage, body_ok').order('id').range(from, from + PAGE - 1)
  if (error) { console.error('지문 조회 실패:', error.message); process.exit(1) }
  items.push(...data)
  if (data.length < PAGE) break
}
const P = new Map(items.map((i) => [i.id, i]))

// 흔한 영어 문장 분할. 여기서 재는 것은 «이 분할기가 옳은가» 가 아니라
// «분석가가 쓴 번호가 어떤 분할기와도 일치하나» 다.
function split(t) {
  return t.split(/(?<=[.!?]["')]?)\s+(?=[A-Z“"(])/).filter((s) => s.trim())
}
function sentOf(text, off) {
  const s = split(text)
  let acc = 0
  for (let i = 0; i < s.length; i += 1) {
    const start = text.indexOf(s[i], acc)
    const end = start + s[i].length
    if (off >= start && off < end) return i
    acc = end
  }
  return -1
}

// 한국어 산문에 박힌 영어 조각. 최소 길이를 두는 이유: 낱말 하나는 지문 어디에나 있어서
// «아무 데나 칠하기» 가 된다. 근거로 쓰려면 구(句) 이상이어야 한다.
const MIN = 20
const FRAG = new RegExp(`[A-Za-z][A-Za-z0-9 ,.;:'"()\-‘’“”–—]{${MIN - 1},}`, 'g')
function fragments(text) {
  const out = []
  for (const m of text.matchAll(FRAG)) {
    const s = m[0].trim().replace(/[\s,.;:]+$/, '')
    if (s.length >= MIN) out.push(s)
  }
  return out.sort((a, b) => b.length - a.length) // 긴 것부터 — 가장 구체적인 근거
}

let n = 0, nomatch = 0, hasSidx = 0, agree0 = 0, agree1 = 0, sentTotal = 0
let rowsN = 0, withReject = 0, anyFrag = 0, matched = 0, itemsWithAny = 0

for (const [id, a] of latest) {
  const it = P.get(id)
  const quote = a.answer_locus?.quote
  if (!it?.passage || !it.body_ok || !quote) continue
  n += 1

  const hit = findQuote(it.passage, quote)
  if (!hit) { nomatch += 1 } else {
    const mine = sentOf(it.passage, hit.start)
    sentTotal += split(it.passage).length
    const sidx = a.answer_locus?.sentence_index
    if (Array.isArray(sidx) && sidx.length) {
      hasSidx += 1
      if (sidx.includes(mine)) agree0 += 1
      if (sidx.includes(mine + 1)) agree1 += 1
    }
  }

  let itemHit = false
  for (const ch of a.choice_analysis || []) {
    rowsN += 1
    const r = ch.how_to_reject
    if (!r) continue
    withReject += 1
    const fr = fragments(r)
    if (!fr.length) continue
    anyFrag += 1
    if (fr.some((f) => findQuote(it.passage, f))) { matched += 1; itemHit = true }
  }
  if (itemHit) itemsWithAny += 1
}

const pct = (x, y) => (y ? ((100 * x) / y).toFixed(1) : '—')
const L = (label, value) => console.log('  ' + label.padEnd(28) + value)

console.log(`\n=== 앵커 재고조사 (body_ok=true ${n}문항) ===`)
console.log('\n[정답 근거]')
L('인용문이 지문에서 찾힘', `${n - nomatch} / ${n} (${pct(n - nomatch, n)}%)   <- 화면이 쓸 앵커`)
console.log('\n[sentence_index 신뢰도 — 화면에 쓰지 않는 이유]')
L('보유', String(hasSidx))
L('1-기반 일치', `${agree1} (${pct(agree1, hasSidx)}%)`)
L('0-기반 일치', `${agree0} (${pct(agree0, hasSidx)}%)`)
L('지문당 평균 문장', (sentTotal / Math.max(n, 1)).toFixed(1))
console.log('\n[오답 배제 근거]')
L('선지행', String(rowsN))
L('how_to_reject 있음', `${withReject} (${pct(withReject, rowsN)}%)`)
L(`영어 조각 ${MIN}자+ 있음`, `${anyFrag} (${pct(anyFrag, withReject)}%)`)
L('그중 원문에 걸림', `${matched} (${pct(matched, anyFrag)}%)`)
L('문항이 하나 이상 보유', `${itemsWithAny} / ${n} (${pct(itemsWithAny, n)}%)`)
console.log(`\n>>> 화면이 쓸 수 있는 앵커 합계 ${n - nomatch + matched}개\n`)

await new Promise((r) => setTimeout(r, 100))
process.exit(0)
