// scripts/csat/source-get/wikinews-shorts-split.mjs
//
// **이미 들어온 Wikinews Shorts(단신 모음) 행을 꼭지별 원천으로 쪼갠다** — 판정 기준 v7 §8.
//
// 하는 일(모음 행마다):
//   1. 본문을 「Sources」 줄에서 꼭지로 자른다(`_wikinews-shorts.mjs`).
//   2. 꼭지마다 새 원천 행을 넣는다 — `source_id = <모음>#brief-N` · 모음의 출처·권리·날짜를 물려받는다 · status `queued`.
//   3. 모음 행의 `csat_fit.derived_from` 에 `{kind:'digest', source_id:<모음 자신>, briefs:N}` 을 **더한다**(기존 csat_fit 을 읽어 키 하나만 —
//      통째로 덮으면 gate·rights 가 날아간다). 이후 보관 판정·회차 표본은 이 행을 파생물로 건너뛴다(`gate-rules.derivativeKind`).
// 모음 행을 지우지 않는다 — 이미 붙은 판정 기록(`gate.retain`)이 남아야 무엇을 왜 쪼갰는지 거슬러 갈 수 있다.
//
// 재실행 안전: 이미 `derived_from.kind === 'digest'` 인 모음은 건너뛰고, 이미 있는 꼭지 source_id 는 넣지 않는다.
// 기본은 예행(쓰기 0). `--commit` 일 때만 쓴다.
//
// 실행: node --tls-max-v1.2 scripts/csat/source-get/wikinews-shorts-split.mjs [--commit] [--limit N]

import fs from 'node:fs'
import path from 'node:path'

import { isDigestTitle, splitDigest, briefTitle, briefSourceId } from './_wikinews-shorts.mjs'

try {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}
const COMMIT = process.argv.includes('--commit')
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1] || 0) || Infinity

const { createScriptClient } = await import('../../lib/supabase-client.mjs')
const db = createScriptClient()

const { data: digests, error } = await db
  .from('library_articles')
  .select('id,source,source_id,source_url,title,author,published_at,license,license_class,copyright_safe_in_kr,language,content,csat_fit')
  .eq('source', 'wikinews')
  .ilike('title', 'Wikinews Shorts%')
  .order('source_id')
if (error) throw new Error(`모음 조회 — ${error.message}`)

let done = 0
let already = 0
let briefsNew = 0
let briefsExisting = 0
let dropped = 0
let judged = 0
const failures = []
for (const d of digests.filter((x) => isDigestTitle(x.title))) {
  if (done >= LIMIT) break
  if (d.csat_fit?.derived_from?.kind === 'digest') { already++; continue }
  if (d.csat_fit?.gate?.retain) judged++
  const { briefs, dropped: tail } = splitDigest(d.content)
  dropped += tail.length
  const ids = briefs.map((_, i) => briefSourceId(d.source_id, i))
  const { data: have, error: e2 } = await db.from('library_articles').select('source_id').eq('source', 'wikinews').in('source_id', ids)
  if (e2) throw new Error(`꼭지 조회 — ${e2.message}`)
  const exists = new Set((have ?? []).map((r) => r.source_id))
  const rows = briefs
    .map((content, i) => ({ content, source_id: ids[i], i }))
    .filter((b) => !exists.has(b.source_id))
    .map((b) => ({
      source: 'wikinews',
      source_id: b.source_id,
      title: briefTitle(d.title, b.content),
      author: d.author,
      source_url: d.source_url,
      published_at: d.published_at,
      license: d.license,
      license_class: d.license_class,
      copyright_safe_in_kr: d.copyright_safe_in_kr,
      language: d.language,
      content: b.content,
      audio_url: null,
      feed_id: null,
      status: 'queued',
      csat_fit: {
        ...(d.csat_fit?.rights ? { rights: d.csat_fit.rights } : {}),
        digest_of: { id: d.id, source_id: d.source_id, brief: b.i + 1, of: briefs.length },
      },
    }))
  briefsExisting += exists.size
  briefsNew += rows.length
  done++
  if (!COMMIT) continue
  if (rows.length) {
    // POST 는 재시도하지 않는다(supabase-client §멱등성) — 실패하면 그대로 올라오고, 재실행은 이미 있는 꼭지를 건너뛴다.
    const { error: e3 } = await db.from('library_articles').insert(rows)
    if (e3) { failures.push(`${d.source_id} 꼭지 넣기: ${e3.message}`); continue }
  }
  const csat_fit = { ...(d.csat_fit ?? {}), derived_from: { kind: 'digest', source_id: d.source_id, briefs: briefs.length } }
  const { error: e4 } = await db.from('library_articles').update({ csat_fit }).eq('id', d.id)
  if (e4) failures.push(`${d.source_id} 모음 표시: ${e4.message}`)
}

console.log(`  ${COMMIT ? '적재' : '예행'} · 모음 ${digests.length}행 중 이번 ${done} · 이미 쪼갬 ${already}`)
console.log(`  꼭지 새로 ${briefsNew} · 이미 있음 ${briefsExisting} · 꼬리 조각 뺌 ${dropped} · 판정 기록이 붙은 모음 ${judged}(지우지 않고 파생물로 표시)`)
if (failures.length) {
  console.log(`  실패 ${failures.length}:\n    ${failures.join('\n    ')}`)
  process.exitCode = 1
}
