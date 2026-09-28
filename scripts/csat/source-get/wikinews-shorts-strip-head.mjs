// scripts/csat/source-get/wikinews-shorts-strip-head.mjs
//
// **이미 쪼갠 꼭지의 첫머리에 남은 모음 머리말을 걷는다** — `stripDigestHead`(`_wikinews-shorts.mjs`).
//
// 부고 모음(「Deaths in 2008」「The following deaths were reported …:」)을 쪼갤 때 머리말이 첫 꼭지에 붙어 들어갔다.
// 체크리스트가 그 머리말을 「목록 머리만 있고 끊겼다」로 읽어 멀쩡한 꼭지를 보류로 보낸다(실측 2026-09-28 · 배치 8).
//
// 대상: 꼭지 행(`#brief-`) 중 **보관 판정이 아직 없는** 행만 — 판정이 붙은 행은 본문 해시에 묶여 있어 본문을 바꾸면
//   판정이 낡는다(그런 행은 세기만 하고 건드리지 않는다).
// 쓰기: `content` 만 바꾼다(`updated_at` CAS). 재실행 안전 — 머리말이 없어진 행은 다시 걸리지 않는다.
// 기본은 예행(쓰기 0). `--commit` 일 때만 쓴다.
//
// 실행: node --tls-max-v1.2 scripts/csat/source-get/wikinews-shorts-strip-head.mjs [--commit]

import fs from 'node:fs'
import path from 'node:path'

import { stripDigestHead } from './_wikinews-shorts.mjs'

const envFile = path.resolve('apps/web/.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const COMMIT = process.argv.includes('--commit')

const { createScriptClient } = await import('../../lib/supabase-client.mjs')
const db = createScriptClient()

// 본문까지 한 번에 읽으면 문 시간 제한에 걸린다(2026-09-28) — id 만 먼저, 본문은 100행씩.
const { data: ids, error } = await db
  .from('library_articles')
  .select('id')
  .eq('source', 'wikinews')
  .like('source_id', '%#brief-%')
if (error) throw new Error(`꼭지 조회 — ${error.message}`)
const rows = []
for (let i = 0; i < ids.length; i += 100) {
  const { data, error: e1 } = await db
    .from('library_articles')
    .select('id,source_id,content,updated_at,retain:csat_fit->gate->retain')
    .in('id', ids.slice(i, i + 100).map((r) => r.id))
  if (e1) throw new Error(`본문 조회 — ${e1.message}`)
  rows.push(...data)
}

let fixed = 0
const judged = []
const failures = []
for (const r of rows) {
  const next = stripDigestHead(r.content)
  if (next === String(r.content ?? '').trim() || next === r.content) continue
  if (r.retain) { judged.push(r.source_id); continue }
  console.log(`  ${r.source_id}: 「${String(r.content).slice(0, next ? String(r.content).indexOf(next.slice(0, 20)) : 60).replace(/\n+/g, ' / ').trim()}」 걷음`)
  fixed++
  if (!COMMIT) continue
  const { data: upd, error: e2 } = await db.from('library_articles').update({ content: next }).eq('id', r.id).eq('updated_at', r.updated_at).select('id')
  if (e2 || upd?.length !== 1) failures.push(`${r.source_id}: ${e2?.message ?? 'CAS 불일치(그 사이 행이 바뀌었다)'}`)
}

console.log(`  ${COMMIT ? '적재' : '예행'} · 꼭지 ${rows.length}행 중 머리말 걷음 ${fixed}`)
if (judged.length) console.log(`  판정이 붙어 건드리지 않음 ${judged.length}: ${judged.join(' ')}`)
if (failures.length) {
  console.log(`  실패 ${failures.length}:\n    ${failures.join('\n    ')}`)
  process.exitCode = 1
}
