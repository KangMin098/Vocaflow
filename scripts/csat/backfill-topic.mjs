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

import { classify } from './lib-topic.mjs'

/** 분류표가 바뀌면 올린다 — 그래야 이미 적힌 행이 재분류 대상이 된다. */
const TOPIC_V = 1

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
const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('library_articles')
    .select('id, content, csat_fit')
    .gt('csat_fit->>pass', '0')
    .not('content', 'is', null)
    .order('id')
    .range(from, from + 499)
  if (error) throw new Error(`조회 실패: ${error.message}`)
  if (!data?.length) break
  rows.push(...data)
  process.stderr.write(`\r  읽음 ${rows.length.toLocaleString()}…`)
  if (data.length < 500) break
}
process.stderr.write('\r' + ' '.repeat(30) + '\r')

const need = rows.filter((r) => FORCE || r.csat_fit?.topicV !== TOPIC_V)
console.log(
  `  적합 원문 ${rows.length.toLocaleString()} · 분류 필요 ${need.length.toLocaleString()}` +
    `${COMMIT ? ` · 이번에 ${Math.min(need.length, LIMIT).toLocaleString()}편` : ' (읽기 전용 — --commit 을 붙이면 쓴다)'}\n`,
)

const tally = {}
let written = 0
const failures = []
for (const a of need.slice(0, LIMIT === Infinity ? undefined : LIMIT)) {
  // 앞 6,000자만 본다 — `topic-gap.mjs` 와 같은 입력이어야 두 값을 견줄 수 있다.
  const c = classify(String(a.content).slice(0, 6000))
  tally[c.topic] = (tally[c.topic] ?? 0) + 1
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
