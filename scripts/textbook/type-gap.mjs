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
import { loadEnv } from './volume-pool.mjs'

loadEnv()
const { createClient } = await import('@supabase/supabase-js')
const { rungMix, ITEMS_PER_UNIT, MARKET_UNITS_PER_BOOK } = await import('@vocaflow/library-pipeline')

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

const mix = rungMix(BAND, Object.keys(have).filter((t) => have[t] > 0))
const rows = Object.entries(mix.targetShare)
  .map(([t, s]) => ({ t, want: Math.round(s * TOTAL), got: have[t] ?? 0 }))
  .sort((a, b) => b.want - a.want)

console.log(`V${BAND} · ${UNITS}단원 ${TOTAL}문항 기준 · 목표는 ${mix.derivedFrom === 'market' ? '시장 실측' : '사다리 설계'}에서 유도`)
console.log('유형'.padEnd(16), '목표'.padStart(5), '재고'.padStart(9), '  부족')
let short = 0
for (const { t, want, got } of rows) {
  const gap = Math.max(0, want - got)
  short += gap
  console.log(t.padEnd(16), String(want).padStart(5), String(got).padStart(9), gap ? `  ← ${gap}` : '')
}
if (!short) {
  console.log('\n모자란 유형이 없다 — 적합도가 낮다면 원인은 재고가 아니라 조합 쪽이다.')
} else {
  console.log(`\n모자란 몫 합계 **${short}문항** (인쇄 ${TOTAL}문항의 ${((100 * short) / TOTAL).toFixed(1)}%)`)
  console.log('이만큼이 그대로 적합도 감점이다 — 유형별로 **모자란 만큼 한 번에** 채운다.')
  for (const { t, want, got } of rows) {
    if (want > got) console.log(`  item-drain-export.mjs --type ${t} --band ${BAND}   (${want - got}문항)`)
  }
}
