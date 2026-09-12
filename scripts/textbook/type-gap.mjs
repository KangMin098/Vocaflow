// scripts/textbook/type-gap.mjs
//
// **다음에 무엇을 쓸지 재서 정한다.** 밴드 하나의 유형별 목표 몫(시장 밀도에서 유도)과
// 실제 재고를 나란히 놓고, 모자란 유형만 골라 낸다.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 유형-학년 적합도가 낮을 때 "손으로 쓰는 유형을 더 쓰면 오르겠지" 는 틀린 짐작이다.
// 2026-08-31 에 V6 요지를 9문항 더 채웠지만 목표가 **5문항**이라 이미 남아 있었고,
// 적합도는 74.7% → 76.6% 로 거의 움직이지 않았다. 그때 정작 모자란 것은
// `blank` 18문항과 `title` 7문항이었다. 재고를 재기 전에는 알 수 없다.
//
// ⚠️ **모자란 만큼 한 번에 채운다.** `rung-mix.ts` 의 실측대로 유형을 열고 조금만
//    넣으면 적합도는 **먼저 떨어진다**(topic 0→69.4% · 10→68.8% · 20→77.1%).
//    이 스크립트가 내는 "모자람 N" 이 그 한 번의 몫이다.
//
// 쓰는 법:
//   pnpm dlx tsx scripts/textbook/type-gap.mjs --band 6 [--units 20]
//
// **읽기만 한다.** 아무것도 고치지 않으므로 몇 번을 돌려도 안전하다.
import { loadEnv, fetchAllKeyset, ELEMENTARY_TYPES } from './volume-pool.mjs'

loadEnv()
const { createClient } = await import('@supabase/supabase-js')
const { rungMix, ITEMS_PER_UNIT, MARKET_UNITS_PER_BOOK, itemWordSpec } = await import('@vocaflow/library-pipeline')

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 6)
// 조판기와 같은 기본값을 쓴다 — 다르면 여기서 잰 부족분이 실제 인쇄와 어긋난다.
const UNITS = Number(arg('units') ?? MARKET_UNITS_PER_BOOK.median)
const TOTAL = UNITS * ITEMS_PER_UNIT

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ 행을 끌어와 세지 않는다 — V6 은 22만 행이라 OFFSET 페이징이 타임아웃으로 죽는다
//    (실측 2026-08-31). 유형마다 `head: true` 로 **개수만** 묻는다.
const mixAll = rungMix(BAND)
const types = [...new Set([...mixAll.allowedTypes, ...Object.keys(mixAll.targetShare)])]
const have = {}
for (const t of types) {
  const { count, error } = await db
    .from('csat_dcp_items')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'article')
    .eq('v_level', BAND)
    .eq('type', t)
  if (error) throw new Error(`${t} 개수 조회 실패: ${error.message}`)
  // ⚠️ `count ?? 0` 으로 뭉개지 않는다 — null 은 "0건" 이 아니라 "못 셌다" 이다.
  if (count === null) throw new Error(`${t} 개수가 null — 조회가 실패했는데 0 으로 셀 뻔했다`)
  have[t] = count
}

// ⚠️ **사전에서 즉석 생성되는 유형은 재고를 세면 안 된다.** `rhyme`·`word_meaning`·
//   `spell_blank` 는 `csat_dcp_items` 에 행이 없고 조판할 때 사전에서 만들어진다.
//   행을 세면 0 이 나와 "닫혔다" 고 보고하는데, 실제 V1 조판은 이 셋으로만 채워져
//   적합도 100.0% 다. 이 오보를 실제로 냈다(2026-08-31) — 조판 로그를 보고서야 알았다.
//   상한이 원글 재고가 아니므로 **항상 열려 있는 것으로 센다.**
const GENERATED = ELEMENTARY_TYPES

// ── 쓸 수 있는 재고 ────────────────────────────────────────────────
//
// ⚠️ **개수만 세면 못 쓰는 재고를 있다고 말한다.** 조합기는 `itemWordSpec(type, band)`
//   창 밖 지문을 버린다. 그런데 이 도구는 행 수만 셌다 — 그래서 V3 이 `topic 16 ·
//   title 15 · blank 16` 으로 "부족 1문항" 인데 조판은 그 47건을 **전부 버리고**
//   적합도가 95.6% → 54.6% 로 무너졌다(실측 2026-08-31). 붕괴가 이 화면에 안 보였다.
//
// 그래서 손집필 유형은 **지문을 받아 창을 대 본다.** 기계 생성 유형은 재고가 수만이라
// 목표를 훨씬 넘으므로 정밀도가 필요 없고, 다 받으면 이 도구가 조판만큼 느려진다.
// 그 경계를 `USABLE_PROBE_MAX` 로 둔다 — 넘으면 행 수를 그대로 쓰고 그렇다고 적는다.
const USABLE_PROBE_MAX = 800
const usable = {}
const wordsOf = (p) => {
  const t = [p?.passage, p?.intro, ...(p?.sentences ?? []), ...(p?.remaining ?? []), p?.insert_sentence]
    .filter((x) => typeof x === 'string')
    .join(' ')
  return t.trim() ? t.split(/\s+/).filter(Boolean).length : null
}
for (const t of Object.keys(have)) {
  if (GENERATED.has(t)) { usable[t] = have[t]; continue }
  if (have[t] === 0 || have[t] > USABLE_PROBE_MAX) { usable[t] = have[t]; continue }
  const rows = await fetchAllKeyset(db, 'csat_dcp_items', 'id, payload', 'id', 500, (q) =>
    q.eq('kind', 'article').eq('v_level', BAND).eq('type', t))
  const spec = itemWordSpec(t, BAND)
  usable[t] = rows.filter((r) => {
    const w = wordsOf(r.payload)
    // 지문이 없는 유형은 이 창의 대상이 아니다 — 세는 데서 빼지 않는다.
    if (w == null || spec.max === 0) return true
    return w >= spec.min && w <= spec.max
  }).length
}


// ⚠️ **재고 0 인 유형은 목표에서 빠진다** — `rungMix` 는 available 안에서 다시 정규화한다.
//   그래서 아예 없는 유형은 "부족" 으로도 안 잡히고, 적합도는 그만큼 후하게 나온다.
//   실측 2026-08-31: V7 이 "부족 없음" 인데 89.7% 였다. 재고가 0 이라 `blank`·`title`·
//   `main_point` 가 목표에서 통째로 빠져 있었던 것이다. **두 잣대를 같이 보여 준다.**
const openTypes = Object.keys(have).filter((t) => have[t] > 0 || GENERATED.has(t))
const mix = rungMix(BAND, openTypes)
const market = rungMix(BAND).targetShare
const union = [...new Set([...Object.keys(market), ...Object.keys(mix.targetShare)])]
const rows = union
  .map((t) => ({
    t,
    marketWant: Math.round((market[t] ?? 0) * TOTAL),
    want: Math.round((mix.targetShare[t] ?? 0) * TOTAL),
    got: usable[t] ?? 0,
    raw: have[t] ?? 0,
  }))
  .sort((x, y) => y.marketWant - x.marketWant || y.want - x.want)

console.log(`V${BAND} · ${UNITS}단원 ${TOTAL}문항 기준 · 목표는 ${mix.derivedFrom === 'market' ? '시장 실측' : '사다리 설계'}에서 유도`)
console.log('유형'.padEnd(16), '시장'.padStart(5), '현목표'.padStart(6), '재고'.padStart(9), '  부족')
let short = 0
let closed = 0
for (const { t, marketWant, want, got, raw } of rows) {
  // 사전 생성 유형은 상한이 없다 — 모자랄 수가 없으므로 부족분에서 뺀다.
  const gap = GENERATED.has(t) ? 0 : Math.max(0, want - got)
  short += gap
  const shut = got === 0 && marketWant > 0 && !GENERATED.has(t)
  if (shut) closed += marketWant
  const note = shut ? `  ← 닫힘 (시장은 ${marketWant})` : gap ? `  ← ${gap}` : ''
  // 행 수와 쓸 수 있는 수가 다르면 **둘 다** 보인다 — 그 차이가 곧 창 밖 재고다.
  const stock = GENERATED.has(t)
    ? '사전생성'
    : raw !== got ? `${got}(${raw})` : String(got)
  console.log(t.padEnd(16), String(marketWant).padStart(5), String(want).padStart(6), stock.padStart(9), note)
}

if (closed) {
  console.log(`**닫힌 유형이 시장 기준 ${closed}문항어치** (인쇄 ${TOTAL}문항의 ${((100 * closed) / TOTAL).toFixed(1)}%)`)
  console.log('재고가 0 이라 목표에서 빠져 있다 — 적합도는 이만큼 후하게 나온다. 열려면 시장 몫만큼 한 번에 넣는다.')
  for (const { t, marketWant, got } of rows) {
    if (got === 0 && marketWant > 0 && !GENERATED.has(t)) console.log(`  item-drain-export.mjs --type ${t} --band ${BAND}   (${marketWant}문항)`)
  }
  console.log()
}
if (!short) {
  console.log(closed ? '열려 있는 유형 중에는 모자란 것이 없다.' : '모자란 유형이 없다 — 적합도가 낮다면 원인은 재고가 아니라 조합 쪽이다.')
} else {
  console.log(`모자란 몫 합계 **${short}문항** (인쇄 ${TOTAL}문항의 ${((100 * short) / TOTAL).toFixed(1)}%)`)
  console.log('이만큼이 그대로 적합도 감점이다 — 유형별로 **모자란 만큼 한 번에** 채운다.')
  for (const { t, want, got } of rows) {
    if (want > got && got > 0 && !GENERATED.has(t)) console.log(`  item-drain-export.mjs --type ${t} --band ${BAND}   (${want - got}문항)`)
  }
}