// scripts/csat/plos-extract-recheck.mjs
//
// **이미 적재한 추출 지문을 지금 규칙으로 다시 본다.**
//
// ⚠️ 추출기의 관문은 산출물을 **읽으면서** 늘어났다 — 종명 약어 절단, Discussion 누출,
//   문서 내부 지시("This section will introduce…"), 도판 참조("The top right graph…").
//   규칙이 늘 때마다 **이미 들어간 것은 옛 기준으로 남는다.** 그대로 두면 코퍼스 안에
//   기준이 여러 벌 섞이고, 나중에는 어느 것이 어느 기준으로 들어왔는지 알 수 없다.
//
// 지우지 않고 `status='archived'` 로 내린다 — 규칙이 또 바뀌면 되살릴 수 있어야 한다.
//
// 실행: node scripts/csat/plos-extract-recheck.mjs [--commit] [--curl]

import fs from 'node:fs'
import path from 'node:path'

import { splitSentences } from './lib-fit.mjs'
import { protectAbbr, restoreAbbr, SENT_DROP } from './lib-plos.mjs'
import { curlFetch } from './lib-curl-fetch.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  ...(process.argv.includes('--curl') ? { global: { fetch: curlFetch } } : {}),
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 4) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    await sleep(1500 * 2 ** attempt)
    return retry(fn, what, attempt + 1)
  }
}

console.log('추출 지문 재검사' + (COMMIT ? ' — **내린다**' : ' — 예행'))
console.log('='.repeat(78))
console.log(`  규칙 ${SENT_DROP.length}개 (추출기와 같은 표)\n`)

const hit = {}
let rows = 0
let bad = 0
let wrote = 0
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        .select('id,content,status,csat_fit')
        .eq('feed_id', 'plos-extract')
        .gt('id', cursor)
        .order('id')
        .limit(300),
    '조회',
  )
  if (!data?.length) break
  cursor = data[data.length - 1].id

  for (const row of data) {
    rows += 1
    const codes = new Set()
    // ⚠️ 추출기와 **같은 순서**로 나눈다 — 약어를 보호하지 않고 나누면 재검사기가
      //   스스로 만든 조각을 보고 truncated-abbr 370건을 냈다(자체 오탐).
      for (const raw of splitSentences(protectAbbr(String(row.content ?? '')))) {
      const s = restoreAbbr(raw)
      const d = SENT_DROP.find((r) => r.re.test(s))
      if (d) codes.add(d.id)
    }
    if (!codes.size) continue
    bad += 1
    for (const c of codes) hit[c] = (hit[c] ?? 0) + 1
    if (!COMMIT || row.status === 'archived') continue
    const gate = { ...(row.csat_fit?.gate ?? {}), publishable: false, blockedBy: [...codes][0] }
    await retry(
      () =>
        db
          .from('library_articles')
          .update({
            status: 'archived',
            status_message: `게시 게이트: 수능 지문 · ${[...codes].join(',')}`,
            csat_fit: { ...(row.csat_fit ?? {}), gate },
          })
          .eq('id', row.id),
      `쓰기 ${row.id}`,
    )
    wrote += 1
  }
  process.stdout.write(`\r  ${rows.toLocaleString()}편 · 걸림 ${bad.toLocaleString()}`)
}

console.log(`\n\n  훑음 ${rows.toLocaleString()} · **걸림 ${bad.toLocaleString()}** · 내림 ${wrote.toLocaleString()}\n`)
for (const [k, n] of Object.entries(hit).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(16)}${n.toLocaleString().padStart(7)}`)
}
if (!COMMIT) console.log(`\n  예행이었다. 내리려면 --commit`)
