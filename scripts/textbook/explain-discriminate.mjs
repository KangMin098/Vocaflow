// scripts/textbook/explain-discriminate.mjs
//
// **해설이 정말 답을 가리는가.** 커버리지는 "해설을 썼다" 는 뜻일 뿐이다.
//
// ── 왜 이걸 재는가 ───────────────────────────────────────────────────
// 해설의 근거가 **틀린 답지에도 똑같이 붙는다면 그건 근거가 아니다.** 그래서 답지 5개
// **전부**에 같은 탐지기를 돌려 정답이 유일 최다인 비율을 센다.
//
// 이 스크립트가 처음 밝힌 것(2026-08-21): 단서를 앞 글 전체와 맞추던 첫 판에서
// 커버리지는 92.1% 였지만 **정답만 가리키는 해설은 2.6%** 였고 **22.3% 는 오답을 더
// 가리켰다.** 그래서 근거를 인접(바로 앞 단위)으로 좁히고 유일 최다 규칙을 넣었다.
//
// ⚠️ "오답을 더 가리킴" 은 **0 이어야 한다** — 해설을 쓴 문항에서 그런 일이 있으면
//   해설이 오답을 변호하고 있다는 뜻이다.
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/explain-discriminate.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const {
  toCsatOrder,
  toCsatInsert,
  explainOrder,
  explainInsert,
  orderEvidenceByChoice,
  insertEvidenceBySlot,
  isPositional,
} = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * ⚠️ **이 조회가 자라서 자를 못 쓰게 만들었다** (실측 2026-09-01).
 *
 * 원래는 `csat_dcp_items` **전량**을 `payload` 까지 받아 `.range(from, from+499)` 로
 * offset 페이징했다. 표가 **426,784행**(heap 603 MB)까지 자란 지금은 statement timeout 이
 * 나서 **판별력을 아예 못 잰다** — `production-stages.ts` 에 적힌 6.9% 가 2026-08-21 값에서
 * 멈춰 있는 이유다. 자가 고장 나면 이긴 것도 진 것도 알 수 없다.
 *
 * 두 가지를 고쳤다:
 *   ① **쓰는 유형만 받는다** — 이 자는 `order`·`insert` 만 본다(아래 `toCsatOrder`/`toCsatInsert`).
 *      426,784 → 210,462행으로 절반이 된다. 나머지 유형은 받아서 `continue` 로 버리고 있었다.
 *   ② **keyset 페이징** — offset 은 뒤로 갈수록 앞을 다시 훑어 비용이 선형으로 는다.
 *      `id > 마지막값` 으로 끊으면 페이지마다 비용이 같다.
 *      (이 저장소가 같은 함정을 여러 번 겪어 `scan-unpaged-queries.mjs` 를 만들었다.)
 */
const MEASURED_TYPES = ['order', 'insert']
const PAGE = 500
const rows = []
let cursor = null
for (;;) {
  let q = db
    .from('csat_dcp_items')
    .select('id, type, payload, answer_key')
    .in('type', MEASURED_TYPES)
    .order('id')
    .limit(PAGE)
  if (cursor) q = q.gt('id', cursor)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  rows.push(...data)
  cursor = data[data.length - 1].id
  if (data.length < PAGE) break
}
console.log(`대상 ${rows.length.toLocaleString('en-US')}행 (order·insert 만 · keyset 페이징)`)

const score = (evs) => evs.filter(isPositional).length

const stat = {
  order: { n: 0, unique: 0, tied: 0, beaten: 0, zero: 0, explained: 0 },
  insert: { n: 0, unique: 0, tied: 0, beaten: 0, zero: 0, explained: 0 },
}
const violations = []

for (const r of rows) {
  const isOrder = r.type === 'order'
  const item = isOrder
    ? toCsatOrder(r.payload?.presented ?? [], r.answer_key?.source_order ?? [])
    : toCsatInsert(r.payload?.remaining ?? [], r.payload?.insert_sentence ?? '', r.answer_key?.position)
  if (!item) continue

  const byChoice = isOrder ? orderEvidenceByChoice(item) : insertEvidenceBySlot(item)
  const scores = byChoice.map(score)
  const mine = scores[item.answer - 1]
  const best = Math.max(...scores)
  const s = stat[r.type]
  s.n++
  if (best === 0) s.zero++
  else if (mine < best) s.beaten++
  else if (scores.filter((x) => x === best).length > 1) s.tied++
  else s.unique++

  const ex = isOrder ? explainOrder(item) : explainInsert(item)
  if (ex.body) {
    s.explained++
    // 해설을 쓴 문항은 반드시 정답이 유일 최다여야 한다.
    if (mine < best || scores.filter((x) => x === mine).length > 1) violations.push(r.id)
  }
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')
console.log('─'.repeat(72))
console.log('해설의 판별력 — 근거가 정답만 가리키는가\n')
const all = { n: 0, unique: 0, tied: 0, beaten: 0, zero: 0, explained: 0 }
for (const s of Object.values(stat)) for (const k of Object.keys(all)) all[k] += s[k]

for (const [t, s] of Object.entries(stat)) {
  console.log(
    `  ${t.padEnd(8)} 문항 ${String(s.n).padStart(4)} · 정답 유일 최다 ${String(s.unique).padStart(4)} (${pct(s.unique, s.n)})` +
      ` · 해설 ${String(s.explained).padStart(4)} (${pct(s.explained, s.n)})`,
  )
}
console.log(`\n  **정답이 유일 최다: ${all.unique}/${all.n} = ${pct(all.unique, all.n)}**  → 해설 ${all.explained}건`)
console.log(`  동점(가리지 못함):   ${all.tied} = ${pct(all.tied, all.n)}`)
console.log(`  근거 자체가 없음:    ${all.zero} = ${pct(all.zero, all.n)}`)
console.log(`  오답을 더 가리킴:    ${all.beaten} = ${pct(all.beaten, all.n)}`)
console.log(
  `\n  해설을 쓰고도 정답이 유일 최다가 아닌 것: ${violations.length}   ← 0 이어야 한다` +
    (violations.length ? `\n    ${violations.slice(0, 10).join(', ')}` : ''),
)
if (violations.length) process.exitCode = 1
