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

  /**
   * **겹친 글이 어느 (단원·유형) 자리에 있는가.**
   *
   * 유형표에 여유가 다 있는데도 겹치면(2026-09-05 V3: 여유 16~229 인데 11편 겹침),
   * 어느 유형 자리가 그 글을 두 번 부르는지 봐야 다음 손댈 곳이 나온다.
   * 분포만 보면 "몇 편" 은 알아도 "왜" 는 모른다.
   */
  const slotsOfRef = new Map()
  for (const u of units) {
    for (const it of u.items ?? []) {
      if (!it.ref_id) continue
      if (!slotsOfRef.has(it.ref_id)) slotsOfRef.set(it.ref_id, [])
      slotsOfRef.get(it.ref_id).push(`${u.no}:${it.type}`)
    }
  }
  const reusedDetail = [...slotsOfRef.entries()]
    .filter(([, s]) => new Set(s.map((x) => x.split(':')[0])).size > 1)
    .map(([ref, s]) => {
      const title = (vol.articles?.get?.(ref)?.title ?? vol.articles?.[ref]?.title ?? ref).toString()
      return `    ${title.slice(0, 34).padEnd(34)} ${s.join(' · ')}`
    })
  const typePairs = new Map()
  for (const [, s] of slotsOfRef) {
    const units2 = new Set(s.map((x) => x.split(':')[0]))
    if (units2.size < 2) continue
    const types = s.map((x) => x.split(':')[1]).sort().join('+')
    typePairs.set(types, (typePairs.get(types) ?? 0) + 1)
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
  console.log(`  무중복이려면 최소 ${totalSlots}편 필요 (지금 ${distinct}편으로 돌려 막는 중)`)
  if (reusedDetail.length) {
    console.log('  겹친 글 — 단원:유형 자리:')
    for (const line of reusedDetail) console.log(line)
    console.log(
      '  겹침 유형 조합: ' +
        [...typePairs.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' · '),
    )
  }

  /**
   * **어느 유형이 재사용을 만드는가.**
   *
   * 조합기를 고쳐 "덜 쓰인 글 먼저" 로 바꾼 뒤에도 재사용이 남았다(V2 91/120).
   * 유형마다 **자리 수 vs 그 유형을 가진 글 수**를 나란히 놓아 원인을 짚는다.
   *
   * ── 실측 결과 (2026-09-05 · V2) ─────────────────────────────────────
   * **어느 유형도 자리보다 글이 적지는 않았다** — 처음 세운 가설은 틀렸다.
   *
   *     irrelevant  자리  1 · 글   1      title  자리 22 · 글  30
   *     topic       자리 16 · 글  36      blank  자리 23 · 글  39
   *     word_order  자리 30 · 글 112      unit_vocab  자리 12 · 글 192
   *
   * 진짜 원인은 **유형 간 풀이 겹치는 것**이다. 위 네 희소 유형이 합쳐 **62자리**를
   * 요구하는데, 그중 하나라도 가진 글은 V2 전체 275편 중 **47편**뿐이다(DB 실측).
   * 62자리를 47편으로 채우니 **최소 15회는 겹칠 수밖에 없다** — 관측된 재사용 18편과 맞는다.
   *
   * 그러므로 드레인 대상은 "모자란 유형" 이 아니라 **`title`·`blank`·`topic` 을 가진
   * 글의 수**다. 무중복(120편)까지 가려면 그 네 유형을 가진 글이 62편 이상이어야 한다.
   */
  const slotsByType = new Map()
  for (const u of units) {
    for (const it of u.items ?? []) {
      slotsByType.set(it.type, (slotsByType.get(it.type) ?? 0) + 1)
    }
  }
  const poolRefsByType = new Map()
  for (const it of vol.pool ?? []) {
    if (!poolRefsByType.has(it.type)) poolRefsByType.set(it.type, new Set())
    poolRefsByType.get(it.type).add(it.ref_id)
  }
  const rows = [...slotsByType.entries()]
    .map(([type, slots]) => ({ type, slots, refs: poolRefsByType.get(type)?.size ?? 0 }))
    .sort((a, b) => a.refs - a.slots - (b.refs - b.slots))
  console.log('  유형별 — 자리 / 그 유형 문항을 가진 글 (모자란 순):')
  for (const r of rows) {
    const gap = r.refs - r.slots
    console.log(
      `    ${r.type.padEnd(12)} 자리 ${String(r.slots).padStart(3)} · 글 ${String(r.refs).padStart(4)}` +
        `  ${gap < 0 ? `⚠ ${-gap}편 모자람 — 겹칠 수밖에 없다` : `여유 ${gap}`}`,
    )
  }
  console.log()
}
