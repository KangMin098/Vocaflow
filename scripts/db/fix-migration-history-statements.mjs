#!/usr/bin/env node
// scripts/db/fix-migration-history-statements.mjs
//
// **공유 개발 DB migration 이력의 statements 텍스트를 저장소 파일 본문으로 정정한다(객체 · 데이터 변경 없음).**
//   node scripts/db/fix-migration-history-statements.mjs --project <ref> --versions v1,v2 [--commit] [--snapshot <dir>]
// 쓰임: 적용 도구가 begin/commit 감싸개를 뺀 채 기록했거나, 적용 뒤 같은 의미로 정합화된 파일과 이력 텍스트가 갈라져
//   safe-merge(이력 sha256 = HEAD 본문 sha256) 가 막을 때. 사용자 승인 뒤에만 --commit 한다(PR #238 · 2026-10-13 승인).
// 안전: 대상 버전이 이력에 있어야 한다(없는 버전은 만들지 않는다) · 바꾸기 전 원래 statements 를 스냅샷 파일로 남긴다 ·
//   파일 본문을 손으로 옮기지 않고 그대로 읽어 넣는다 · 넣은 뒤 sha256 을 다시 읽어 파일과 같은지 확인한다.
//   토큰은 SUPABASE_ACCESS_TOKEN(셸 환경)에서만 읽고 출력하지 않는다.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const PROJECT = arg('--project')
const VERSIONS = String(arg('--versions', '')).split(',').filter(Boolean)
const COMMIT = process.argv.includes('--commit')
const SNAP = arg('--snapshot', '.agent-logs')
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!PROJECT || !VERSIONS.length || !token) { console.error('사용법: --project <ref> --versions v1,v2 (SUPABASE_ACCESS_TOKEN 필요)'); process.exit(2) }
const sha256 = (t) => createHash('sha256').update(t).digest('hex')

async function q(query, readOnly) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, read_only: readOnly }),
  })
  if (!res.ok) throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}
const lit = (v) => `'${v.replace(/'/g, "''")}'`

const dir = path.join(process.cwd(), 'supabase/migrations')
const files = Object.fromEntries(VERSIONS.map((v) => {
  const f = fs.readdirSync(dir).find((x) => x.startsWith(`${v}_`) && x.endsWith('.sql'))
  if (!f) throw new Error(`${v} 파일 없음`)
  return [v, fs.readFileSync(path.join(dir, f), 'utf8')]
}))

const before = await q(`select version, statements, encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') as sha from supabase_migrations.schema_migrations where version in (${VERSIONS.map(lit).join(',')})`, true)
const have = new Map(before.map((r) => [r.version, r]))
for (const v of VERSIONS) if (!have.has(v)) throw new Error(`${v} 이력 없음 — 이력을 새로 만들지 않는다`)
fs.mkdirSync(SNAP, { recursive: true })
const snapPath = path.join(SNAP, `migration-history-statements-before-${Date.now()}.json`)
fs.writeFileSync(snapPath, JSON.stringify(before, null, 1))
for (const v of VERSIONS) console.log(`${v} 이력 ${have.get(v).sha.slice(0, 12)} → 파일 ${sha256(files[v]).slice(0, 12)}${have.get(v).sha === sha256(files[v]) ? ' (이미 같음)' : ''}`)
console.log(`스냅샷: ${snapPath}`)
if (!COMMIT) { console.log('(dry — --commit 없이 바꾸지 않음)'); process.exit(0) }

for (const v of VERSIONS) {
  if (have.get(v).sha === sha256(files[v])) continue
  // 달러 인용 꼬리표가 본문에 없게 고른다
  let tag = 'mh'
  while (files[v].includes(`$${tag}$`)) tag += 'x'
  await q(`update supabase_migrations.schema_migrations set statements = array[$${tag}$${files[v]}$${tag}$] where version = ${lit(v)}`, false)
}
const after = await q(`select version, encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') as sha from supabase_migrations.schema_migrations where version in (${VERSIONS.map(lit).join(',')})`, true)
let bad = 0
for (const r of after) {
  const ok = r.sha === sha256(files[r.version])
  if (!ok) bad++
  console.log(`${r.version} ${ok ? '일치' : '불일치'} ${r.sha.slice(0, 12)}`)
}
process.exit(bad ? 1 : 0)
