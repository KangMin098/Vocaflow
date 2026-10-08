// scripts/knowledge/vnext-db-snapshot.mjs
//
// 학습 원리 vNext 마이그레이션 앞뒤 상태 기록(2026-10-08) — **읽기만 한다.** 표 · 행 수 · 항목 층 × 상태 · 근거 · 검토 이력 ·
// RLS · 정책 · 권한 · 함수 · 트리거 · 학습자 기록 대상을 JSON 으로 남긴다. 앞(before)과 뒤(after)를 비교해 「기존 데이터 삭제 0」을 확인한다.
//   node --tls-max-v1.2 --env-file=<.env.local> scripts/knowledge/vnext-db-snapshot.mjs <before|after> [--out tmp/knowledge]
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const phase = process.argv[2]
if (!['before', 'after'].includes(phase)) throw new Error('사용: vnext-db-snapshot.mjs <before|after>')
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'tmp/knowledge'
const url = process.env.SUPABASE_DB_URL
if (!url?.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const { Client } = createRequire('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/node_modules/x.js')('pg')
const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { ca: fs.readFileSync('D:/workspace/Vocaflow-ec-reveal/tmp/reveal-db-deployment/supabase-ca.crt', 'utf8') } })
await c.connect()
const q = async (sql, p) => (await c.query(sql, p)).rows
const TABLES = ['knowledge_items', 'knowledge_links', 'knowledge_evidence', 'knowledge_csat_origins', 'knowledge_gaps', 'knowledge_reviews',
  'knowledge_research_sources', 'knowledge_inquiries', 'knowledge_inquiry_links', 'knowledge_applications', 'knowledge_trials', 'learning_task_attempts',
  'methodology_batches', 'methodology_sources', 'methodology_experts', 'methodology_channels', 'methodology_taxonomy']
const snap = { phase, at: new Date().toISOString(), tables: {}, rls: {}, grants: {} }
for (const t of TABLES) {
  const exists = (await q(`select to_regclass($1) is not null e`, [`public.${t}`]))[0].e
  if (!exists) { snap.tables[t] = null; continue }
  snap.tables[t] = Number((await q(`select count(*) n from public.${t}`))[0].n)
  const r = (await q(`select relrowsecurity rls, (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=$1) pol from pg_class where oid = $2::regclass`, [t, `public.${t}`]))[0]
  snap.rls[t] = { rls: r.rls, policies: Number(r.pol) }
  snap.grants[t] = (await q(`select grantee, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and table_name=$1 and grantee in ('anon','authenticated','service_role') group by grantee order by grantee`, [t])).map((x) => `${x.grantee}:${x.p}`)
}
snap.itemsByLayerStatus = await q(`select layer, status, count(*)::int n from knowledge_items group by 1,2 order by 1,2`)
snap.itemIds = (await q(`select id from knowledge_items order by id`)).map((r) => r.id)
snap.evidenceIds = (await q(`select id from knowledge_evidence order by id`)).map((r) => r.id)
snap.reviewIds = (await q(`select id from knowledge_reviews order by id`)).map((r) => String(r.id))
snap.itemVersions = Object.fromEntries((await q(`select id, version, status, evidence_version from knowledge_items`)).map((r) => [r.id, `${r.version}/${r.status}/${r.evidence_version}`]))
snap.triggers = (await q(`select event_object_table t, trigger_name n from information_schema.triggers where event_object_schema='public' and (event_object_table like 'knowledge%' or event_object_table = 'learning_task_attempts') group by 1,2 order by 1,2`)).map((r) => `${r.t}.${r.n}`)
snap.functions = (await q(`select proname from pg_proc where pronamespace='public'::regnamespace and proname like 'knowledge%' order by 1`)).map((r) => r.proname)
if (snap.tables.knowledge_items !== null) {
  const hasKind = (await q(`select 1 from information_schema.columns where table_name='knowledge_items' and column_name='kind'`)).length > 0
  if (hasKind) snap.kinds = await q(`select layer, kind, count(*)::int n from knowledge_items group by 1,2 order by 1,2`)
  const hasLevel = (await q(`select 1 from information_schema.columns where table_name='knowledge_evidence' and column_name='evidence_level'`)).length > 0
  if (hasLevel) snap.evidenceLevels = await q(`select source_type, evidence_level, applicability, count(*)::int n from knowledge_evidence group by 1,2,3 order by 1,2,3`)
}
await c.end()
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, `db-${phase}.json`), JSON.stringify(snap, null, 1))
console.log(JSON.stringify({ phase, tables: snap.tables, itemsByLayerStatus: snap.itemsByLayerStatus, kinds: snap.kinds, evidenceLevels: snap.evidenceLevels, triggers: snap.triggers.length, functions: snap.functions.length }))
