// scripts/textbook/window-narrow-probe.mjs
//
// **교집합 창으로 좁히면 재고가 얼마나 줄어드는가.**
//
// ── 왜 재는가 ───────────────────────────────────────────────────────
// 조립기(`itemWordSpec`)는 `market-spec.json` 의 **합본** 창을 쓴다. 합본은 쪽수
// 가중평균이라 한 출판사의 창보다 넓을 수 있고, 실제로 고1 이 그렇다:
//
//   고1  합본 47~242   ↔   NE능률 43~160 · EBS 47~234 · 쎄듀 49~250   → 교집합 49~160
//
// 즉 180어짜리 고1 지문은 **합본 규격에는 맞고 NE능률 규격에는 안 맞는다.**
// 교집합으로 좁히면 모든 출판사의 창을 동시에 만족하지만, **재료가 줄어든다.**
// 얼마나 줄어드는지 모르고 좁히면 권이 안 채워진다 — 그래서 먼저 잰다.
// (`compose-unit.ts` 가 이미 적어 둔 규칙: "좁히려다 재료를 0 으로 만들지 않는다".)
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않는다.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/window-narrow-probe.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const { withRetry } = await import('./volume-pool.mjs')
const {
  intersectWindows,
  V_TO_MARKET_BUCKET,
  itemWordSpec,
  LONG_ITEM_TYPES,
  SCHOOL_SENTENCE_TYPES,
  ELEMENTARY_ITEM_TYPES,
} = await import('@vocaflow/library-pipeline')

const marketSpec = JSON.parse(
  fs.readFileSync(path.resolve('packages/library-pipeline/src/textbook/market-spec.json'), 'utf8'),
)
const pubSpec = JSON.parse(
  fs.readFileSync(path.resolve('packages/library-pipeline/src/textbook/publisher-spec.json'), 'utf8'),
)

/** 지문 어수 — 벤치마크(`market-benchmark.mjs`)와 같은 방식으로 센다. */
const PASSAGE_TEXT_KEYS = ['passage', 'remaining', 'sentences', 'intro']
function passageWords(payload) {
  let text = ''
  for (const k of PASSAGE_TEXT_KEYS) {
    const v = payload?.[k]
    if (typeof v === 'string') text += ` ${v}`
    else if (Array.isArray(v)) text += ` ${v.map((x) => (typeof x === 'string' ? x : x?.text ?? '')).join(' ')}`
  }
  if (typeof payload?.insert_sentence === 'string') text += ` ${payload.insert_sentence}`
  if (!text.trim()) return null
  return (text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
}

/** 그 버킷의 출판사 창들. 표본이 없는 출판사는 빠진다. */
function publisherWindows(bucket) {
  const out = []
  for (const p of pubSpec.publishers) {
    const w = p.passageWords?.[bucket]?.words
    if (w && typeof w.p10 === 'number' && typeof w.p90 === 'number') {
      out.push({ publisher: p.publisher, min: w.p10, max: w.p90 })
    }
  }
  return out
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

async function fetchAll() {
  const rows = []
  const PAGE = 1000
  let cursor = null
  for (;;) {
    // 커서(keyset) 방식 — OFFSET 은 재고가 깊어질수록 타임아웃한다(market-benchmark.mjs 참조).
    const at = cursor
    const data = await withRetry('창 좁힘 probe', () => {
      let q = supabase.from('csat_dcp_items').select('id,type,v_level,payload').order('id').limit(PAGE)
      if (at != null) q = q.gt('id', at)
      return q
    })
    rows.push(...data)
    if (data.length < PAGE) break
    cursor = data[data.length - 1].id
  }
  return rows
}

const items = await fetchAll()

// 밴드별로 센다. 창을 안 쓰는 유형(장문·문장·초등)은 이 축의 대상이 아니다.
const bands = {}
for (const it of items) {
  const band = it.v_level
  if (band == null) continue
  const t = it.type
  if (LONG_ITEM_TYPES.has(t) || SCHOOL_SENTENCE_TYPES.has(t) || ELEMENTARY_ITEM_TYPES.has(t)) continue
  const w = passageWords(it.payload)
  if (w == null || w < 10) continue
  const bucket = V_TO_MARKET_BUCKET[band]
  if (!bucket) continue

  bands[band] ??= { bucket, total: 0, now: 0, narrow: 0, lost: 0, lostByType: {}, byType: {} }
  const b = bands[band]

  const nowSpec = itemWordSpec(t, band)
  const pubs = publisherWindows(bucket)
  const inter = intersectWindows(pubs.map(({ min, max }) => ({ min, max })))
  // 교집합이 없으면 지금 창을 그대로 쓴다 — 좁히려다 재료를 0 으로 만들지 않는다.
  const narrowSpec = inter
    ? { min: Math.max(nowSpec.min, inter.min), max: Math.min(nowSpec.max, inter.max) }
    : nowSpec

  b.total += 1
  const inNow = w >= nowSpec.min && w <= nowSpec.max
  const inNarrow = w >= narrowSpec.min && w <= narrowSpec.max
  if (inNow) b.now += 1
  if (inNarrow) b.narrow += 1
  if (inNow && !inNarrow) {
    b.lost += 1
    b.lostByType[t] = (b.lostByType[t] ?? 0) + 1
  }
  // **유형별 잔량** — 총량이 넉넉해도 한 유형이 마르면 권이 안 채워진다.
  b.byType[t] ??= { now: 0, narrow: 0 }
  if (inNow) b.byType[t].now += 1
  if (inNarrow) b.byType[t].narrow += 1
  b.nowSpec = nowSpec
  b.narrowSpec = narrowSpec
  b.pubs = pubs
}

console.log('교집합 창으로 좁혔을 때 잃는 재고')
console.log(`  대상 ${items.length.toLocaleString()}문항 (장문·문장·초등 유형 제외)\n`)
console.log('  밴드 버킷  지금 창      교집합 창    적격(지금)  적격(교집합)   잃는 몫')
console.log('  ' + '─'.repeat(78))
for (const [band, b] of Object.entries(bands).sort((a, c) => Number(a[0]) - Number(c[0]))) {
  const nowW = `${b.nowSpec.min}~${b.nowSpec.max}`
  const narW = `${b.narrowSpec.min}~${b.narrowSpec.max}`
  const pctNow = ((100 * b.now) / b.total).toFixed(1)
  const pctNar = ((100 * b.narrow) / b.total).toFixed(1)
  const lostPct = b.now ? ((100 * b.lost) / b.now).toFixed(1) : '0.0'
  console.log(
    `  V${band}   ${b.bucket.padEnd(4)} ${nowW.padEnd(11)} ${narW.padEnd(11)} ` +
      `${String(b.now).padStart(7)} ${pctNow.padStart(5)}% ${String(b.narrow).padStart(7)} ${pctNar.padStart(5)}%  ` +
      `${String(b.lost).padStart(6)} (${lostPct}%)`,
  )
}
console.log('  ' + '─'.repeat(78))
for (const [band, b] of Object.entries(bands).sort((a, c) => Number(a[0]) - Number(c[0]))) {
  if (!b.lost) continue
  const top = Object.entries(b.lostByType).sort((a, c) => c[1] - a[1]).slice(0, 6)
  console.log(`  V${band} 잃는 유형 — ${top.map(([t, n]) => `${t} ${n}`).join(' · ')}`)
  console.log(`       출판사 창: ${b.pubs.map((p) => `${p.publisher} ${p.min}~${p.max}`).join(' | ')}`)
}
// ── 유형별 잔량 — 여기가 진짜 위험이 보이는 자리다 ──────────────────
//
// 한 권은 `MARKET_UNITS_PER_BOOK.median`(10)단원이고 단원마다 유형별 자리가 있다.
// 그래서 **한 유형에 필요한 최소 재고는 수십 개 수준**이다. 총량이 3만이어도
// 어느 유형이 20 밑으로 떨어지면 그 유형은 권에 못 실린다.
//
// 문턱을 근거로 정한다: 한 권이 한 유형에서 최대로 쓰는 수 = 단원 수(10) × 단원당
// 그 유형 자리(최대 2) = **20**.
//
// ⚠️ **원래 얇은 것과 좁혀서 마른 것을 구별한다.** 첫 판은 V2 `topic 20→20(-0%)` 도
//   ⛔ 로 찍었는데, 그건 좁힘과 무관하게 원래 그만큼인 것이다. 이 probe 가 답할 질문은
//   "**좁히면 무엇이 나빠지는가**" 하나다. 원래 얇은 것을 같이 찍으면 진짜 신호가
//   소음에 묻힌다 — 실제로 V5 의 9종이 0 이 되는 것이 그 소음에 묻혀 있었다.
const NEED_PER_VOLUME = 20

console.log('\n  유형별 잔량 (교집합으로 좁힌 뒤) — 마르는 유형이 있는가')
console.log('  ' + '─'.repeat(78))
const starved = []
for (const [band, b] of Object.entries(bands).sort((a, c) => Number(a[0]) - Number(c[0]))) {
  const rows = Object.entries(b.byType).filter(([, v]) => v.now > 0)
  // **좁힘이 원인인 것만** 센다. 두 가지를 나눠 본다 —
  //   ① 완전 소멸: 있던 유형이 0 이 된다. 문턱과 무관하게 명백하다.
  //   ② 문턱 하향: 지금은 한 권을 채울 수 있었는데(>= 20) 좁히면 못 채운다.
  // 원래부터 20 밑이던 유형이 4→3 이 된 것은 **좁힘이 원인이 아니다** — 그것까지
  // ⛔ 로 찍으면 과장이 된다(첫 판이 그랬다).
  const caused = rows
    .filter(([, v]) => (v.narrow === 0 && v.now > 0) || (v.now >= NEED_PER_VOLUME && v.narrow < NEED_PER_VOLUME))
    .sort((a, c) => a[1].narrow - c[1].narrow)
  const shrunk = rows.filter(([, v]) => v.narrow < v.now)
  if (!shrunk.length) {
    console.log(`  V${band} — 좁혀도 줄어드는 유형이 없다`)
    continue
  }
  const drop = (v) => (v.now ? (100 * (v.now - v.narrow)) / v.now : 0)
  console.log(
    `  V${band} 줄어드는 ${shrunk.length}종: ` +
      shrunk
        .sort((a, c) => drop(c[1]) - drop(a[1]))
        .slice(0, 6)
        .map(([t, v]) => `${t} ${v.now}→${v.narrow}(-${drop(v).toFixed(0)}%)`)
        .join(' · '),
  )
  for (const [t, v] of caused) {
    starved.push({ band, type: t, now: v.now, narrow: v.narrow })
    console.log(
      v.narrow === 0
        ? `     ⛔ V${band} ${t} — ${v.now}개 → **0개**. 이 유형이 통째로 사라진다`
        : `     ⛔ V${band} ${t} — ${v.now}개 → **${v.narrow}개**. 한 권에 ${NEED_PER_VOLUME}개가 필요한데 못 채운다`,
    )
  }
}
console.log('  ' + '─'.repeat(78))
if (starved.length) {
  const byBand = {}
  for (const x of starved) (byBand[x.band] ??= []).push(x.type)
  console.log('  ⛔ 좁히면 **권에서 사라지는 유형**이 있다 — 그대로 좁히면 안 된다:')
  for (const [band, ts] of Object.entries(byBand)) {
    console.log(`     V${band} ${ts.length}종 — ${ts.join(' · ')}`)
  }
  console.log(
    '     지수 한 축(A6)을 올리려고 **유형 다양성(A5)을 깎는 맞바꿈**이다. 한 지표를 좋게 만들면\n' +
      '     대개 다른 지표를 판다 — 여기서는 그 대가가 명시적으로 보인다.',
  )
} else {
  console.log('  ✅ 좁혀도 권에서 사라지는 유형이 없다.')
}
console.log(
  '\n  ⓘ "잃는 몫" 은 지금 창에는 맞지만 교집합에는 안 맞는 재고다 — 좁히면 어느 권에도 못 실린다.',
)
