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

  bands[band] ??= { bucket, total: 0, now: 0, narrow: 0, lost: 0, lostByType: {} }
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
console.log(
  '\n  ⓘ "잃는 몫" 은 지금 창에는 맞지만 교집합에는 안 맞는 재고다 — 좁히면 어느 권에도 못 실린다.',
)
