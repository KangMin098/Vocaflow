// scripts/csat/source-get/wikinews-shorts-resplit.mjs
//
// **덜 쪼갠 Wikinews Shorts 꼭지 행을 적어 둔 경계로 다시 쪼갠다** — 판정 기준 v7 §8.
//
// 「Sources」 줄이 없는 모음(2012년 1월 형식)과 따옴표 붙은 「'Sources」 줄은 `wikinews-shorts-split.mjs` 가 못 쪼개
// 무관한 단신 여럿이 꼭지 한 행에 남았다(실측 2026-09-27 · 체크리스트 배치 1에서 8행이 「덜 쪼갠 모음」 보류). 빈 줄은 꼭지 경계가
// 아니므로(한 꼭지가 두세 문단) 경계는 사람·에이전트가 본문을 읽고 `wikinews-shorts-resplit.json` 에 문단 번호로 적는다.
//
// 하는 일(행마다):
//   1. 본문 해시가 경계를 적을 때와 같은지 본다 — 다르면 그 행은 건너뛴다(본문이 바뀌면 문단 번호가 틀린다).
//   2. 꼭지마다 새 원천 행 — `source_id = <행>.<N>`(1부터 · 부모가 꼭지가 아닌 모음이면 `<모음>#brief-N`) · 출처·권리·날짜를 물려받는다 · status `queued` · `csat_fit.digest_of` 로 부모를 가리킨다.
//   3. 부모 행 `csat_fit.derived_from = { kind:'digest', source_id, briefs:N }` 을 **더한다**(기존 csat_fit 을 읽어 키 하나만 ·
//      `updated_at` CAS). 부모의 보관 판정(`gate.retain` hold)은 지우지 않는다 — 왜 다시 쪼갰는지의 기록이다.
// 재실행 안전: 이미 `derived_from.kind === 'digest'` 인 부모는 건너뛰고, 이미 있는 꼭지 source_id 는 넣지 않는다.
// 기본은 예행(쓰기 0). `--commit` 일 때만 쓴다.
//
// 실행: node --tls-max-v1.2 scripts/csat/source-get/wikinews-shorts-resplit.mjs [--commit]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { splitByGroups, briefTitle, briefSourceId, isBriefSourceId } from './_wikinews-shorts.mjs'

try {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}
const COMMIT = process.argv.includes('--commit')
const PLAN = JSON.parse(fs.readFileSync(path.resolve('scripts/csat/source-get/wikinews-shorts-resplit.json'), 'utf8')).rows

const { createScriptClient } = await import('../../lib/supabase-client.mjs')
const db = createScriptClient()

const { data: rows, error } = await db
  .from('library_articles')
  .select('id,source,source_id,source_url,title,author,published_at,license,license_class,copyright_safe_in_kr,language,content,csat_fit,updated_at')
  .in('id', PLAN.map((p) => p.id))
if (error) throw new Error(`행 조회 — ${error.message}`)
const byId = new Map(rows.map((r) => [r.id, r]))

let done = 0
let already = 0
let briefsNew = 0
let briefsExisting = 0
const failures = []
for (const p of PLAN) {
  const d = byId.get(p.id)
  if (!d) { failures.push(`${p.source_id} 행 없음`); continue }
  if (d.csat_fit?.derived_from?.kind === 'digest') { already++; continue }
  if (crypto.createHash('sha256').update(d.content ?? '').digest('hex') !== p.body_sha256) { failures.push(`${p.source_id} 본문이 경계를 적은 뒤 바뀌었다 — 경계를 다시 적는다`); continue }
  const { briefs, problems } = splitByGroups(d.content, p.groups, p.drop)
  if (problems.length) { failures.push(`${p.source_id} ${problems.join(' · ')}`); continue }
  // 덜 쪼갠 꼭지 행 → `<꼭지>.<N>` · 처음부터 손으로 쪼갤 모음(「Sources」 줄 없음) → 자동 쪼개기와 같은 `<모음>#brief-N`.
  const ids = briefs.map((_, i) => (isBriefSourceId(d.source_id) ? `${d.source_id}.${i + 1}` : briefSourceId(d.source_id, i)))
  const { data: have, error: e2 } = await db.from('library_articles').select('source_id').eq('source', d.source).in('source_id', ids)
  if (e2) throw new Error(`꼭지 조회 — ${e2.message}`)
  const exists = new Set((have ?? []).map((r) => r.source_id))
  const digestTitle = String(d.title).split(' — ')[0]
  const insert = briefs
    .map((content, i) => ({ content, i }))
    .filter((b) => !exists.has(ids[b.i]))
    .map((b) => ({
      source: d.source,
      source_id: ids[b.i],
      title: briefTitle(digestTitle, b.content),
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
  briefsNew += insert.length
  done++
  console.log(`  ${d.source_id} → ${briefs.length}꼭지: ${briefs.map((b) => b.split(/\s+/).slice(0, 5).join(' ')).join(' | ')}`)
  if (!COMMIT) continue
  if (insert.length) {
    // POST 는 재시도하지 않는다(supabase-client §멱등성) — 실패하면 그대로 올라오고, 재실행은 이미 있는 꼭지를 건너뛴다.
    const { error: e3 } = await db.from('library_articles').insert(insert)
    if (e3) { failures.push(`${d.source_id} 꼭지 넣기: ${e3.message}`); continue }
  }
  const csat_fit = { ...(d.csat_fit ?? {}), derived_from: { kind: 'digest', source_id: d.source_id, briefs: briefs.length } }
  const { data: upd, error: e4 } = await db.from('library_articles').update({ csat_fit }).eq('id', d.id).eq('updated_at', d.updated_at).select('id')
  if (e4 || upd?.length !== 1) failures.push(`${d.source_id} 부모 표시: ${e4?.message ?? 'CAS 불일치(그 사이 행이 바뀌었다)'}`)
}

console.log(`  ${COMMIT ? '적재' : '예행'} · 경계 ${PLAN.length}행 중 이번 ${done} · 이미 쪼갬 ${already}`)
console.log(`  꼭지 새로 ${briefsNew} · 이미 있음 ${briefsExisting}`)
if (failures.length) {
  console.log(`  실패 ${failures.length}:\n    ${failures.join('\n    ')}`)
  process.exitCode = 1
}
