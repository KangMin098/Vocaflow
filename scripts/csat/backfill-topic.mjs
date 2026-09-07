// scripts/csat/backfill-topic.mjs
//
// **소재를 행에 적어 둔다 — 표본으로 세던 것을 SQL 로 세기 위해.**
//
// ── 왜 필요한가 (실측 2026-09-03) ────────────────────────────────────
// 균형 사정권은 `min_t (재고_t / 목표비율_t)` 이라 **병목 칸 하나**의 수가 전부를 정한다.
// 그런데 `topic-gap.mjs` 는 표본 3,000편을 분류해 전량으로 환산하고, 병목은 정의상 가장
// 희소하므로 표본에서 **26편**밖에 안 잡힌다. 푸아송 오차 ±5편이 목표비율 3.5% 로 나뉘며
// **사정권 ±2,000편**으로 증폭된다 — 작문 48편을 넣고 잰 「+912」가 전부 그 잡음 안이었다.
//
// 소재를 한 번 계산해 행에 적어 두면, 이후로는 **SQL 한 줄로 정확히** 세어진다.
// 새로 들어오는 행은 수확·작문 경로가 적재 시점에 이미 분류하므로 이 백필은 **과거분만**이다.
//
// ── 어디에 적는가 ────────────────────────────────────────────────────
// `csat_fit` jsonb 에 **키 하나만 더한다**(CLAUDE.md §🤖 — 통째로 덮지 않는다).
// 기존 값을 읽어 `topic` · `topicMargin` · `topicV` 만 얹는다.
//
// ⚠️ **`csat_fit.pass` 의 계약은 그대로다** — 모양·담화만 잰다(`lib-fit.mjs`).
//   `topic` 은 **따로 계산한 별개의 라벨**이고 분류기는 약하다(`lib-topic.mjs` 머리말).
//   둘을 한 컬럼에 담는다고 해서 하나가 다른 하나를 검증하지 않는다.
//
// 재실행 안전: 이미 같은 판으로 분류된 행은 건너뛴다. `--force` 로만 다시 한다.
//
// 실행:
//   node scripts/csat/backfill-topic.mjs                 # 밀린 양만 센다(읽기 전용)
//   node scripts/csat/backfill-topic.mjs --commit [--limit 5000]

import fs from 'node:fs'
import path from 'node:path'

// 분류판 번호는 **분류기가 갖는다** — 여기 사본을 두면 표를 고치고 번호 올리는 것을 잊는다.
import { classify, TOPIC_V } from './lib-topic.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const FORCE = process.argv.includes('--force')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log(`소재 백필 — 표본 대신 SQL 로 세기 위해\n${'='.repeat(78)}\n`)

// ⚠️ 적합 원문만 분류한다. 부적합 원문은 균형 사정권 계산에 안 들어가므로,
//   전량을 훑으면 시간과 대역폭을 1.5배 쓰고 쓰이지 않을 값을 만든다.
/**
 * ⚠️ **아직 안 적힌 행만 읽는다.** 처음에는 적합 원문 전량을 읽었는데, 재고가 2만을 넘자
 *   두 번째 실행이 `canceling statement due to statement timeout` 으로 죽었다 — 이미
 *   다 적어 둔 2만 편을 본문째 다시 받으려 했기 때문이다. 남은 11편만 받으면 즉시 끝난다.
 *   (`--force` 는 의도적으로 전량을 다시 받으므로 그때만 느리다.)
 *
 * ⚠️ **커서 페이징이다 — `range()` 오프셋이 아니다.** 2026-09-07 에 분류판을 1→2 로 올리자
 *   「아직 안 적힌 행」이 다시 6.9만 편이 됐고, 오프셋 22,000 에서 **statement timeout** 으로
 *   죽었다(오프셋은 매 페이지마다 앞의 행을 전부 다시 세고, 그 위에 jsonb 필터가 얹힌다).
 *   마지막 `id` 를 이어받으면 페이지 비용이 일정하다. 그리고 `--limit` 은 **읽기에도** 건다 —
 *   5,000편만 쓸 거면서 6.9만 편의 본문을 받을 이유가 없다.
 */
const rows = []
let cursor = null
while (rows.length < LIMIT) {
  let q = db
    .from('library_articles')
    .select('id, title, content, csat_fit')
    .gt('csat_fit->>pass', '0')
    .not('content', 'is', null)
  if (!FORCE) q = q.or('csat_fit->>topicV.is.null,csat_fit->>topicV.neq.' + TOPIC_V)
  if (cursor) q = q.gt('id', cursor)
  const page = Math.min(500, LIMIT === Infinity ? 500 : LIMIT - rows.length)
  const { data, error } = await q.order('id').limit(page)
  if (error) throw new Error(`조회 실패: ${error.message}`)
  if (!data?.length) break
  rows.push(...data)
  cursor = data[data.length - 1].id
  process.stderr.write(`\r  읽음 ${rows.length.toLocaleString()}…`)
  if (data.length < page) break
}
process.stderr.write('\r' + ' '.repeat(30) + '\r')

const need = rows.filter((r) => FORCE || r.csat_fit?.topicV !== TOPIC_V)
console.log(
  `  적합 원문 ${rows.length.toLocaleString()} · 분류 필요 ${need.length.toLocaleString()}` +
    `${COMMIT ? ` · 이번에 ${Math.min(need.length, LIMIT).toLocaleString()}편` : ' (읽기 전용 — --commit 을 붙이면 쓴다)'}\n`,
)

const tally = {}
// 옛 라벨과 달라지는 행 수 — **재분류가 얼마나 큰 일인지 쓰기 전에 안다.**
// 분류기를 고치면 「몇 편이 바뀌는가」가 곧 결정의 크기다(백필은 별도 결정).
let changed = 0
const shift = {}
let written = 0
const failures = []
for (const a of need.slice(0, LIMIT === Infinity ? undefined : LIMIT)) {
  // 앞 6,000자만 본다 — `topic-gap.mjs` 와 같은 입력이어야 두 값을 견줄 수 있다.
  const c = classify(String(a.content).slice(0, 6000), { title: a.title })
  tally[c.topic] = (tally[c.topic] ?? 0) + 1
  const before = a.csat_fit?.topic ?? null
  if (before && before !== c.topic) {
    changed += 1
    shift[`${before} → ${c.topic}`] = (shift[`${before} → ${c.topic}`] ?? 0) + 1
  }
  if (!COMMIT) continue
  // 기존 값을 읽어 **키만 더한다** — 통째로 덮으면 pass·shape·bandsHash 가 날아간다.
  const next = { ...(a.csat_fit ?? {}), topic: c.topic, topicMargin: c.margin, topicV: TOPIC_V }
  const { error } = await db.from('library_articles').update({ csat_fit: next }).eq('id', a.id)
  if (error) failures.push(`${a.id}: ${error.message}`)
  else written++
  if (written % 500 === 0) process.stderr.write(`\r  기록 ${written.toLocaleString()}…`)
}
process.stderr.write('\r' + ' '.repeat(30) + '\r')

console.log(`  ${'소재'.padEnd(11)}${'편수'.padStart(8)}`)
console.log('  ' + '-'.repeat(20))
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(11)}${v.toLocaleString().padStart(8)}`)
}
if (changed) {
  console.log(`\n  옛 라벨과 달라지는 행 **${changed.toLocaleString()}편** (가장 큰 이동 5)`)
  for (const [k, v] of Object.entries(shift).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`    ${String(v).toLocaleString().padStart(6)}  ${k}`)
  }
}
if (COMMIT) console.log(`\n  기록 ${written.toLocaleString()}편`)
if (failures.length) {
  console.log(`\n  실패 ${failures.length}:`)
  for (const f of failures.slice(0, 5)) console.log('    · ' + f)
}
console.log(
  `\n  이후로는 표본이 아니라 이 질의로 센다:\n` +
    `    select csat_fit->>'topic' t, count(*) from library_articles\n` +
    `    where (csat_fit->>'pass')::int > 0 group by 1 order by 2 desc;`,
)
