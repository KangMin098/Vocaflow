// scripts/csat/reveal-gate/check-surfaces.mjs
//
// Reveal Gate Layer A — 학습자(anon · authenticated)가 닿는 CSAT 표면을 DB · 저장소에서 **자동 수집**해 manifest.json 과 대조한다.
//   실패: ① 분류되지 않은 새 표면 ② 매니페스트에만 있는 낡은 항목(since 가 아직 적용 전이면 제외) ③ DERIVED_SECRET 컬럼이 학습자에게 SELECT 가능
//         ④ csat_ec_private 스키마가 PostgREST 노출 스키마에 있음
// 결과: scripts/csat/reveal-gate/results-surfaces.json · 종료 코드 0 = 통과
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/reveal-gate/check-surfaces.mjs

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const WEB = path.join(REPO, 'apps/web/src')
const require = createRequire(path.join(REPO, 'scripts/csat/error-evidence/dev-smoke/package.json'))
const pg = require('pg')
const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'))

const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const problems = []

// ── DB: 학습자가 행을 읽을 수 있는 관계(표 · 뷰) — 권한(표 · 컬럼) + (RLS 없음 또는 학습자 정책 또는 뷰) ──
const rels = (await db.query(`
  select c.relname n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind in ('r', 'v', 'm') and c.relname like 'csat%'
     and (has_table_privilege('authenticated', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'SELECT')
          or exists (select 1 from information_schema.column_privileges cp where cp.table_schema = 'public' and cp.table_name = c.relname and cp.grantee in ('authenticated', 'anon') and cp.privilege_type = 'SELECT'))
     and (c.relkind <> 'r' or not c.relrowsecurity
          or exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polcmd in ('r', '*')
                      and (p.polroles @> array['authenticated'::regrole::oid] or p.polroles @> array['anon'::regrole::oid] or p.polroles = '{0}')))
   order by 1`)).rows.map((r) => r.n)
const fns = [...new Set((await db.query(`
  select p.proname n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname like 'csat%'
     and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE')) order by 1`)).rows.map((r) => r.n))]
const applied = new Set((await db.query(`select version from supabase_migrations.schema_migrations`)).rows.map((r) => r.version))

const compare = (kind, found, declared) => {
  for (const n of found) if (!declared[n]) problems.push({ kind, name: n, problem: '분류 안 됨(새 표면) — manifest.json 에 class · gate 를 정해 넣는다' })
  for (const [n, v] of Object.entries(declared)) if (!found.includes(n) && (!v.since || applied.has(v.since))) problems.push({ kind, name: n, problem: '매니페스트에만 있음(낡음) — 표면이 사라졌거나 학습자 접근이 끊겼다' })
}
compare('db_relation', rels, manifest.db_relations)
compare('db_function', fns, manifest.db_functions)

// DERIVED_SECRET 컬럼 — 학습자 SELECT 불가여야
for (const [n, v] of Object.entries(manifest.db_relations)) for (const col of v.secret_columns ?? []) {
  const r = (await db.query(`select has_column_privilege('authenticated', $1, $2, 'SELECT') a, has_column_privilege('anon', $1, $2, 'SELECT') b`, [`public.${n}`, col])).rows[0]
  if (r.a || r.b) problems.push({ kind: 'secret_column', name: `${n}.${col}`, problem: '학습자가 SELECT 할 수 있다(DERIVED_SECRET)' })
}
// 비공개 스키마 노출
const exposed = (await db.query(`select coalesce((select setting from pg_settings where name = 'pgrst.db_schemas'), current_setting('pgrst.db_schemas', true), '') s`)).rows[0].s
const roleCfg = (await db.query(`select coalesce(array_to_string(rolconfig, ';'), '') c from pg_roles where rolname = 'authenticator'`)).rows[0].c
if (/csat_ec_private/.test(exposed) || /csat_ec_private/.test(roleCfg)) problems.push({ kind: 'private_schema', name: 'csat_ec_private', problem: 'PostgREST 노출 스키마에 있다' })

// ── 저장소: API 라우트 · 페이지 · JSON 을 읽는 lib ──
const walk = (dir, pred, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, pred, out); else if (pred(p)) out.push(p) } return out }
const rel = (p) => path.relative(WEB, p).replace(/\\/g, '/')
const apis = walk(path.join(WEB, 'app/api/csat'), (p) => p.endsWith('route.ts')).map((p) => rel(p).replace(/^app\/api\//, '').replace(/\/route\.ts$/, ''))
const pages = [path.join(WEB, 'app/(app)/csat'), path.join(WEB, 'app/(main)/csat')].flatMap((d) => walk(d, (p) => p.endsWith('page.tsx'))).map((p) => rel(p).replace(/\/page\.tsx$/, ''))
const jsonLibs = [path.join(WEB, 'components/csat'), path.join(WEB, 'lib/csat')].flatMap((d) => walk(d, (p) => /\.(ts|tsx)$/.test(p) && !/__tests__/.test(p)))
  .filter((p) => /import [^\n]*\.json'/.test(fs.readFileSync(p, 'utf8'))).map(rel)
compare('app_api', apis, manifest.app_api)
compare('app_page', pages, manifest.app_pages)
compare('app_json_import', jsonLibs, manifest.app_json_imports)

await db.end()
const out = { checkedAt: new Date().toISOString(), counts: { relations: rels.length, functions: fns.length, apis: apis.length, pages: pages.length, jsonLibs: jsonLibs.length }, problems }
fs.writeFileSync(path.join(HERE, 'results-surfaces.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`표면 — 관계 ${rels.length} · 함수 ${fns.length} · API ${apis.length} · 페이지 ${pages.length} · JSON lib ${jsonLibs.length}`)
for (const p of problems) console.log('FAIL', p.kind, p.name, '—', p.problem)
console.log(problems.length ? `\n실패 ${problems.length}` : '\n통과 — 분류 누락 0 · 낡은 항목 0 · 비밀 컬럼 노출 0 · 비공개 스키마 노출 0')
process.exitCode = problems.length ? 1 : 0
