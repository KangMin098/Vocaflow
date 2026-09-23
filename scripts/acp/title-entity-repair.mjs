// scripts/acp/title-entity-repair.mjs
//
// **이미 저장된 제목의 HTML 엔티티를 푼다. 기본은 예행 — `--commit` 이 있어야 쓴다.**
//
// ── 왜 필요한가 (실측 2026-09-23) ───────────────────────────────────────────
// `/admin/csat/sources` 조회 화면에 제목이 이렇게 나온다:
//   "Best-first search&ndash;based approach for mining top-k closed frequent itemsets"
// `decodeEntities` 가 이름 있는 엔티티를 7개(`&amp;` `&lt;` …)만 알고 있어서
// 활자 엔티티(`&ndash;` `&rsquo;` `&ldquo;` …)가 그대로 저장됐다.
// **수집기는 고쳤다**(`packages/library-pipeline/src/ingest-article/_helpers.ts` 의 표) —
// 이 스크립트는 그 전에 들어온 것만 되돌린다.
//
// 전수 실측: 제목 2,548편 · 본문 28편, **전부 `plos`**(다른 원천 0). 본문이 거의 깨끗한 이유는
// plos 본문이 초록 평문 경로로 들어오고 제목만 마크업 경로를 타기 때문이다.
//
// ── 무엇을 안 하는가 ────────────────────────────────────────────────────────
// - **정규식으로 `&...;` 를 싹 지우지 않는다.** 전수에서 걸린 75종 중 `&ARM;` `&MS;`
//   `&Japan;` `&O1;` 같은 것은 **엔티티가 아니라 본문 글자**다. `decodeEntities` 의
//   표에 있는 것만 바뀐다(그 표가 정본이고 여기서 따로 정의하지 않는다).
// - 본문·판정·문항은 건드리지 않는다. `title` 한 칸만 쓴다.
// - 바뀔 게 없는 행은 아예 UPDATE 하지 않는다 → **재실행 안전**(두 번째 실행은 0건).
//
// 실행:
//   node --tls-max-v1.2 scripts/acp/title-entity-repair.mjs            # 예행 + 표본 출력
//   node --tls-max-v1.2 scripts/acp/title-entity-repair.mjs --commit   # 실제 쓰기

import fs from 'node:fs'
import path from 'node:path'

import { decodeEntities } from '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
import { track } from '../csat/drain-run.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const COMMIT = process.argv.includes('--commit')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const runId = new Date().toISOString().replace(/[:.]/g, '-')
const outPath = path.resolve(`scripts/acp/title-entity-repair.${COMMIT ? 'commit' : 'plan'}-${runId}.json`)

await track(db, {
  stage: 'source',
  script: 'scripts/acp/title-entity-repair.mjs',
  mode: COMMIT ? 'import' : 'validate',
  args: COMMIT ? '--commit' : '(예행)',
}, async () => {
  // PostgREST 는 한 번에 1,000행까지만 준다 — id 로 쪽을 넘긴다.
  const changes = []
  let scanned = 0
  let cursor = ''
  for (;;) {
    let q = db.from('library_articles').select('id,title,source').order('id').limit(1000)
    if (cursor) q = q.gt('id', cursor)
    const page = await q
    if (page.error) throw new Error(`읽지 못했다: ${page.error.message}`)
    if (!page.data.length) break
    for (const row of page.data) {
      scanned++
      const decoded = decodeEntities(row.title ?? '')
      if (decoded !== row.title) changes.push({ id: row.id, source: row.source, before: row.title, after: decoded })
    }
    cursor = page.data.at(-1).id
  }

  const bySource = {}
  for (const c of changes) bySource[c.source] = (bySource[c.source] ?? 0) + 1

  // 되돌릴 근거를 먼저 남긴다 — 쓰기보다 앞이다.
  fs.writeFileSync(outPath, JSON.stringify({ runId, mode: COMMIT ? 'commit' : 'dry-run', scanned, changed: changes.length, bySource, changes }, null, 2), { flag: 'wx' })

  console.log(`\n  훑은 편수 ${scanned.toLocaleString()} · 바뀔 제목 ${changes.length.toLocaleString()}`)
  console.log(`  원천별: ${JSON.stringify(bySource)}`)
  console.log(`  기록: ${outPath}\n`)
  console.log('  표본 12편 — **눈으로 본다**(정확도 지표만 보면 그럴듯한 오분류를 못 잡는다):')
  for (const c of changes.slice(0, 12)) {
    console.log(`    - ${c.before}`)
    console.log(`      → ${c.after}`)
  }

  let wrote = 0
  if (COMMIT) {
    for (const c of changes) {
      // title 만 쓴다. updated_at 이 움직이면 판정 캐시가 stale 이 되므로 그 영향을 감수하고
      // 적재 뒤 `source-policy-refresh.mjs` 를 돌리라고 알린다(아래 안내).
      const r = await db.from('library_articles').update({ title: c.after }).eq('id', c.id).eq('title', c.before).select('id')
      if (r.error) throw new Error(`쓰지 못했다 ${c.id}: ${r.error.message}`)
      if (r.data.length !== 1) throw new Error(`제목이 그 사이 바뀌었다: ${c.id} — 다시 예행부터`)
      wrote++
      if (wrote % 200 === 0) process.stdout.write(`\r  쓴 것 ${wrote.toLocaleString()}/${changes.length.toLocaleString()}`)
    }
    console.log(`\n\n  **${wrote.toLocaleString()}편 고침.** 제목이 바뀌면 updated_at 이 움직여 판정 캐시가`)
    console.log('  stale 이 된다 — 이어서 `source-policy-refresh.mjs` 를 돌린다.')
  } else {
    console.log('\n  예행이었다. 실제로 쓰려면 --commit')
  }

  return { total: scanned, done: wrote, skipped: scanned - changes.length }
})
