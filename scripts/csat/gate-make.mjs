// scripts/csat/gate-make.mjs
//
// **`csat_fit.make` 를 채운다 — 문항 생성기가 바로 쓰는 값.**
//
// 담는 것은 넷뿐이다: `words` · `sents` · `paras` · `windows`.
// `windows` 는 대역을 만족하는 창의 **위치**(문장 인덱스)다. 지금까지 `pass` 는
// 창이 몇 개인지만 알았고, 생성기는 "어디에 빈칸을 뚫을지" 를 처음부터 다시 계산해야 했다.
//
// ⚠️ **유형별 적합도 점수는 넣지 않는다.** `data/passage-selection.json` 실측에서
//   대조군(선정 안 된 산문 0.936)이 빈칸용(0.860)·주제용(0.893)·순서용(0.899)보다
//   높았다 — 결속도는 유형을 가르지 못한다. 검증 안 된 점수를 필드로 만들면
//   파이프라인이 그것을 근거로 문항을 고르고, 그때는 틀렸다는 사실조차 안 보인다.
//
// ⚠️ **`gate-import.mjs` 와 동시에 돌리면 안 된다.** 둘 다 `csat_fit` 을 읽어-고쳐-쓰기
//   하므로 나중에 끝난 쪽이 앞의 것을 덮는다. 순서대로 돌릴 것.
//
// 재실행 안전: 같은 값이면 쓰지 않는다.
//
// 실행: node scripts/csat/gate-make.mjs [--commit] [--source gutenberg]

import fs from 'node:fs'
import path from 'node:path'

import { windowsOf, splitSentences, W } from './lib-fit.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const COMMIT = process.argv.includes('--commit')
const SOURCE = arg('source', 'gutenberg')
const MAKE_VERSION = 1

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log(`make 채우기 (${SOURCE})` + (COMMIT ? ' — **쓴다**' : ' — 예행'))
console.log('='.repeat(78))

const t = { rows: 0, wrote: 0, same: 0, noWin: 0 }
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,content,csat_fit')
    .eq('source', SOURCE)
    .gt('id', cursor)
    .order('id')
    .limit(300)
  if (error) {
    console.error('\n  ❌ 조회 실패:', error.message)
    process.exit(1)
  }
  if (!data?.length) break
  cursor = data[data.length - 1].id

  for (const row of data) {
    t.rows += 1
    const text = String(row.content ?? '')
    const wins = windowsOf(text).filter((w) => w.pass).map((w) => ({ s: w.s, e: w.e }))
    if (!wins.length) t.noWin += 1
    const make = {
      v: MAKE_VERSION,
      words: W(text).length,
      sents: splitSentences(text).length,
      paras: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
      windows: wins,
    }
    const prev = row.csat_fit?.make
    if (prev && JSON.stringify(prev) === JSON.stringify(make)) {
      t.same += 1
      continue
    }
    if (!COMMIT) continue
    // 기존 csat_fit 을 읽어 키 하나만 더한다 — 통째로 덮으면 pass·topic·gate 가 날아간다.
    const { error: uErr } = await db
      .from('library_articles')
      .update({ csat_fit: { ...(row.csat_fit ?? {}), make } })
      .eq('id', row.id)
    if (uErr) {
      console.error(`\n  ❌ 쓰기 실패 ${row.id}: ${uErr.message}`)
      process.exit(1)
    }
    t.wrote += 1
  }
  process.stdout.write(`\r  ${t.rows.toLocaleString()}편 · 쓴 것 ${t.wrote.toLocaleString()}`)
  if (data.length < 300) break
}
console.log(
  `\n\n  훑음 ${t.rows.toLocaleString()} · 쓴 것 ${t.wrote.toLocaleString()}` +
    ` · 이미 같음 ${t.same.toLocaleString()} · 통과 창 없음 ${t.noWin.toLocaleString()}`,
)
if (!COMMIT) console.log(`\n  예행이었다. 실제로 쓰려면 --commit`)
