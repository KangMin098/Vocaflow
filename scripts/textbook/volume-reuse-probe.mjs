// scripts/textbook/volume-reuse-probe.mjs
//
// **한 권 안에서 같은 글을 몇 번 읽히는가 — 세어 본다.**
//
// ── 왜 재는가 (2026-09-05) ──────────────────────────────────────────
// 자동 검수에는 *"한 단원에서 같은 글이 반복되지 않는다"* 가 있고 20단원 모두 통과한다.
// 그런데 `compose-unit.ts` 의 중복 금지(`refsInUnit`)는 **단원 안에서만** 작동한다 —
// 권 전체로는 같은 글이 여러 단원에 다시 나올 수 있고, 실제로 V2 조합 출력에서
// 한 제목이 네 단원에 걸쳐 보였다.
//
// 학습자에게는 **한 권에서 같은 지문을 네 번 읽는 일**이 된다. "20/20 단원 조합 성공" 은
// 그 사실을 가리지 못한다 — 검수 항목이 그 자리를 안 보기 때문이다.
// **없는 검사 항목은 통과로 보인다.**
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/volume-reuse-probe.mjs --band 2
//   ... --band 1,2,3,5

import { loadEnv, loadVolume } from './volume-pool.mjs'

loadEnv()

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BANDS = String(arg('band') ?? '2')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean)
const UNITS = Number(arg('units') ?? 20)

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

for (const band of BANDS) {
  const vol = await loadVolume(db, { band, unitCount: UNITS })
  const units = vol.units ?? vol.composed ?? []
  if (!units.length) {
    console.log(`V${band} — 단원이 조합되지 않았다`)
    continue
  }

  /** 글 하나가 이 권의 몇 **단원**에 나오는가. 같은 단원 안의 중복은 이미 막혀 있다. */
  const unitsPerRef = new Map()
  for (const u of units) {
    const refs = new Set()
    for (const it of u.items ?? []) if (it.ref_id) refs.add(it.ref_id)
    for (const r of refs) unitsPerRef.set(r, (unitsPerRef.get(r) ?? 0) + 1)
  }

  const counts = [...unitsPerRef.values()].sort((a, b) => b - a)
  const distinct = counts.length
  const totalSlots = counts.reduce((a, b) => a + b, 0)
  const reused = counts.filter((c) => c > 1).length
  const max = counts[0] ?? 0
  const hist = new Map()
  for (const c of counts) hist.set(c, (hist.get(c) ?? 0) + 1)

  console.log(
    `V${band} — 단원 ${units.length} · 서로 다른 글 ${distinct}편이 ${totalSlots}자리를 채운다\n` +
      `  두 단원 이상에 나오는 글 ${reused}편 (${((reused / distinct) * 100).toFixed(1)}%) · 최다 ${max}단원\n` +
      `  분포: ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}단원:${v}편`).join(' · ')}`,
  )
  // 무중복으로 이 권을 만들려면 글이 몇 편 있어야 하는가 — 그것이 곧 "권수" 의 분모다.
  console.log(`  무중복이려면 최소 ${totalSlots}편 필요 (지금 ${distinct}편으로 돌려 막는 중)\n`)
}
