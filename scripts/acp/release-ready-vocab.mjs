// scripts/acp/release-ready-vocab.mjs
//
// **발행 대기(`ready`) 외부 글의 어휘 행을 걷는다** — docs/reports/lav-retention-2026-09-24.md §4 6단계.
//
// 전제(모두 들어가 있어야 한다): 게시·미리보기·조판은 행이 없으면 `ensureArticleVocab` 로 다시 만들고(2~4),
// 배치 분석은 V-Level 뒤 행을 걷는다(7). 남기는 글의 판정은 `shouldKeepArticleVocab` 하나 —
// 배치 분석과 **같은 규칙**이다(발행 글 · 가공 글 `original` 은 남긴다).
//
// 재실행 안전: 지운 글은 다음 실행에서 행 0 이라 그대로 지나간다. 중간에 끊겨도 다시 돌리면 이어서 한다.
// 경합: 목록을 받은 뒤 발행된 글이 있을 수 있어 **지우기 직전에 묶음의 상태를 다시 읽는다.**
// 되돌리기: 행은 본문에서 재현된다 — 필요한 글은 게시·미리보기가 스스로 만들고, 전량이면 약 50분.
//
// 실행:
//   node --tls-max-v1.2 --import tsx scripts/acp/release-ready-vocab.mjs            # 예행(읽기만)
//   node --tls-max-v1.2 --import tsx scripts/acp/release-ready-vocab.mjs --limit 20 --commit
//   node --tls-max-v1.2 --import tsx scripts/acp/release-ready-vocab.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
// 한 번에 지우는 글 수 — 글당 약 500행이라 20편이면 문장 하나가 약 1만 행이다.
const BATCH = 20

const { createClient } = await import('@supabase/supabase-js')
const { shouldKeepArticleVocab } = await import('@vocaflow/library-pipeline')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ① 대상 글 id — ready 이면서 가공 글이 아닌 것. id 순 커서로 받는다(정렬 없는 range 는 겹치고 샌다).
const targets = []
let cursor = null
for (;;) {
  let q = db.from('library_articles').select('id, status, source').eq('status', 'ready').neq('source', 'original').order('id').limit(1000)
  if (cursor) q = q.gt('id', cursor)
  const { data, error } = await q
  if (error) throw new Error(`대상 조회 실패: ${error.message}`)
  if (!data?.length) break
  for (const a of data) if (!shouldKeepArticleVocab({ status: a.status, source: a.source })) targets.push(a.id)
  cursor = data[data.length - 1].id
  if (targets.length >= LIMIT) break
}
const list = targets.slice(0, LIMIT)
console.log(`대상 글 ${list.length.toLocaleString()}편 (ready · original 제외)${commit ? '' : ' — 예행: 쓰지 않는다'}`)
if (!commit) {
  console.log('지우려면 --commit. 먼저 --limit 20 --commit 으로 소량 확인할 것.')
  process.exit(0)
}

// ② 묶음마다 상태를 다시 읽고, 여전히 걷을 글만 지운다.
let released = 0
let skipped = 0
const failed = []
for (let i = 0; i < list.length; i += BATCH) {
  const chunk = list.slice(i, i + BATCH)
  try {
    const { data: now, error: se } = await db.from('library_articles').select('id, status, source').in('id', chunk)
    if (se) throw new Error(`상태 재조회 실패: ${se.message}`)
    const still = (now ?? []).filter((a) => !shouldKeepArticleVocab({ status: a.status, source: a.source })).map((a) => a.id)
    skipped += chunk.length - still.length
    if (still.length) {
      const { error: de } = await db.from('library_article_vocabularies').delete().in('library_article_id', still)
      if (de) throw new Error(de.message)
      released += still.length
    }
  } catch (e) {
    failed.push(`${chunk[0]}…: ${e instanceof Error ? e.message : String(e)}`)
  }
  if ((i / BATCH) % 50 === 0) process.stdout.write(`\r  ${Math.min(i + BATCH, list.length).toLocaleString()} / ${list.length.toLocaleString()} …`)
}
process.stdout.write('\n')
console.log(`걷음 ${released.toLocaleString()}편 · 상태가 바뀌어 건너뜀 ${skipped} · 실패 묶음 ${failed.length}`)
for (const f of failed.slice(0, 5)) console.log(`  ✗ ${f}`)
if (failed.length) console.log('다시 돌리면 이어서 한다 — 지운 글은 행 0 이라 그대로 지나간다.')
