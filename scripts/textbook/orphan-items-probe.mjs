// scripts/textbook/orphan-items-probe.mjs
//
// **손으로 쓴 문항인데 원글이 조합 풀 밖이라 한 번도 안 쓰이는 것을 센다.**
//
// ── 왜 필요한가 (실측 2026-09-06) ───────────────────────────────────
// V7 권의 시장 유형 적합도가 45.6% 였고 "재고 0 인 유형 10종" 이라고 나왔다. 그런데
// DB 에는 title 16편 · topic 17편 · blank 15편이 멀쩡히 있었다. 조합 풀은 원글이
// `ready`/`published` 일 때만 문항을 싣는데, 그 글들이 `queued` 로 내려가 있었다.
//
//   V6 57문항 · V7 57문항 — **사람이 쓴 114문항이 조용히 빠져 있었다**
//   (딸려서 함께 빠진 결정론 문항까지 19,815개)
//
// 어쩌다 그리 됐는지는 정상 동작이다 — 게시 게이트가 `archived` 로 내렸다가
// `gate-import.mjs` 가 `queued` 로 되살렸고, 그 다음 단계(처리 큐 → `ready`)가 아직
// 안 돌았다. 문제는 **그 사이에 있는 문항이 아무 데서도 안 보인다**는 것이다.
// 조합기는 "재고 0" 이라고만 말하고, 왜 0 인지는 말하지 않는다.
//
// ⚠️ **이 스크립트는 아무것도 고치지 않는다.** 상태를 올리는 것은 큐레이션 판정이라
//    사람이 결정할 일이다. 여기서는 **얼마나 묶여 있는지만** 말한다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/orphan-items-probe.mjs
//   pnpm dlx tsx scripts/textbook/orphan-items-probe.mjs --band 7

import { loadEnv, fetchAllIn, fetchAllKeyset, SCARCE_TYPES } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = arg('band') ? Number(arg('band')) : null

/**
 * 사람이 쓴 유형 — 드레인으로만 만들어진다. 결정론 유형(순서·삽입·흐름무관·어휘·어법)은
 * 다시 돌리면 되살아나므로 여기서 세지 않는다. **되돌릴 수 없는 노동만 센다.**
 *
 * 목록은 `volume-pool.mjs` 가 정본이다 — 조합 풀도 같은 목록으로 "희소 유형" 을 정하므로
 * 사본을 두면 두 자리에서 뜻이 갈린다.
 */
const HANDWRITTEN = SCARCE_TYPES

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// 사람이 쓴 문항만 받는다 — 전수를 훑으면 42만 행이라 자가 부러진다.
const items = (
  await fetchAllKeyset(db, 'csat_dcp_items', 'id, ref_id, type, v_level', 'id', 500, (q) =>
    q.eq('kind', 'article').in('type', [...HANDWRITTEN]),
  )
).filter((r) => BAND == null || r.v_level === BAND)

if (!items.length) {
  console.log('사람이 쓴 문항이 없다.')
  process.exit(0)
}

const refs = [...new Set(items.map((r) => r.ref_id))]
const arts = await fetchAllIn(db, 'library_articles', 'id, status, article_v_level', 'id', refs, ['id'])
const statusOf = new Map(arts.map((a) => [a.id, a.status]))

const IN_POOL = new Set(['ready', 'published'])
const stuck = items.filter((r) => !IN_POOL.has(statusOf.get(r.ref_id) ?? ''))

console.log(`사람이 쓴 문항 ${items.length.toLocaleString()}건${BAND != null ? ` (V${BAND})` : ''}`)
console.log(
  `  그중 원글이 조합 풀 밖이라 **한 번도 안 쓰이는 것 ${stuck.length.toLocaleString()}건**` +
    ` (${((100 * stuck.length) / items.length).toFixed(1)}%)`,
)
if (!stuck.length) {
  console.log('\n묶여 있는 문항이 없다.')
  process.exit(0)
}

const byBand = new Map()
const byType = new Map()
const byStatus = new Map()
for (const r of stuck) {
  const b = r.v_level ?? '?'
  byBand.set(b, (byBand.get(b) ?? 0) + 1)
  byType.set(r.type, (byType.get(r.type) ?? 0) + 1)
  const s = statusOf.get(r.ref_id) ?? '(원글 없음)'
  byStatus.set(s, (byStatus.get(s) ?? 0) + 1)
}
const line = (m) =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')

console.log(`\n  밴드별   ${line(byBand)}`)
console.log(`  유형별   ${line(byType)}`)
console.log(`  원글 상태 ${line(byStatus)}`)
console.log(
  `\n조합 풀은 원글이 ready/published 일 때만 문항을 싣는다. 위 문항을 되살리려면 원글을` +
    ` 그 상태로 올려야 하는데, 그것은 **큐레이션 판정**이라 이 스크립트가 하지 않는다.`,
)
