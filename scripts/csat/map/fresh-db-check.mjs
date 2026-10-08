// scripts/csat/map/fresh-db-check.mjs
//
// 학습 지도 통합(feat/map-vnext-integration · 2026-10-08) — **빈 PostgreSQL 에서 main 마이그레이션 → 지도 마이그레이션**
// 순서로 적용해, 개발 DB 에 우연히 있던 객체 없이도 지도 스키마가 서는지 본다.
//   1) Supabase 최소 환경(역할 · auth.uid · extensions) 만 만든다 — 데이터 없음
//   2) supabase/migrations/*.sql(_pending 제외)을 파일 이름 순으로 하나씩 적용한다. 지도 3개 앞의 실패는 기록만 한다
//      (Supabase 전용 확장 · storage 등 이 격리 환경에 없는 것) — 단, 지도가 기대는 객체가 그 실패로 빠졌는지는 3) 에서 잡는다
//   3) 지도 마이그레이션 3개는 반드시 성공해야 하고, 앱이 읽는 표 · 컬럼 · RPC 가 모두 있어야 한다
//   4) 학습자 권한 smoke — 본인 목표 · 과제 완료만 쓰고 남의 것은 못 본다 · 지도 정의는 읽기 전용
// 실행: node --experimental-vm-modules scripts/csat/map/fresh-db-check.mjs --pg <isolated-pg 디렉터리(embedded-postgres · pg 설치됨)>
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..')
const PG_DIR = process.argv[process.argv.indexOf('--pg') + 1]
if (!PG_DIR || !fs.existsSync(path.join(PG_DIR, 'node_modules'))) throw new Error('--pg <embedded-postgres 가 설치된 디렉터리> 가 필요하다')
const req = createRequire(path.join(PG_DIR, 'package.json'))
const pg = req('pg')
const EmbeddedPostgres = (await import(new URL('file:///' + req.resolve('embedded-postgres').replace(/\\/g, '/')).href)).default
const PORT = 54331
const DATA = path.join(REPO, 'tmp/map-fresh-db')
const MAP = ['20261002120000_csat_map.sql', '20261002120100_funnel_allow_csat_map.sql', '20261002130000_csat_map_item_rate_ledger.sql']
const out = { applied: 0, failedBeforeMap: [], map: {}, objects: {}, smoke: {} }
let fail = 0
const rec = (k, ok, d = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${k}${d ? ' — ' + String(d).slice(0, 200) : ''}`) }

const bin = path.join(PG_DIR, 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe')
spawnSync(bin, ['-D', DATA, '-m', 'immediate', 'stop'], { stdio: 'ignore', timeout: 30000 })
fs.rmSync(DATA, { recursive: true, force: true })
await new EmbeddedPostgres({ databaseDir: DATA, user: 'supabase_admin', password: 'admin', port: PORT, persistent: false, onLog: () => {}, onError: () => {} }).initialise()
spawn(bin, ['-D', DATA, '-o', `-p ${PORT}`, '-l', path.join(DATA, '..', 'map-fresh-db.log'), 'start'], { detached: true, stdio: 'ignore' }).unref()
const admin = (db) => new pg.Client({ host: '127.0.0.1', port: PORT, database: db, user: 'supabase_admin', password: 'admin' })
for (let i = 0; ; i++) {
  try { const c = admin('postgres'); await c.connect(); await c.query('create database fresh'); await c.end(); break } catch (e) { if (i > 60) throw e; await new Promise((r) => setTimeout(r, 1000)) }
}
try {
  const su = admin('fresh')
  await su.connect()
  await su.query(`
    create role postgres login nosuperuser bypassrls createrole inherit password 'postgres';
    create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls;
    create role supabase_auth_admin nologin; create role supabase_storage_admin nologin; create role dashboard_user nologin;
    grant anon, authenticated, service_role to postgres; grant create on database fresh to postgres;
    create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;
    grant usage on schema extensions to postgres, anon, authenticated, service_role;
    create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to postgres, anon, authenticated, service_role; grant select, references on auth.users to postgres;
    grant execute on all functions in schema auth to public;
    alter schema public owner to postgres; grant usage on schema public to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
    -- 운영 DB 기준선(마이그레이션 이력 이전 대시보드 생성분) 중 funnel_events 생성이 기대는 함수 하나 — 관리자 판정은 이 검증과 무관해 false
    create function public.is_admin_or_curator() returns boolean language sql stable as $$ select false $$;
    alter function public.is_admin_or_curator() owner to postgres;
    set search_path = public, extensions;
    alter database fresh set search_path = public, extensions;`)
  await su.end()

  const files = fs.readdirSync(path.join(REPO, 'supabase/migrations')).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort()
  const mig = new pg.Client({ host: '127.0.0.1', port: PORT, database: 'fresh', user: 'postgres', password: 'postgres' })
  await mig.connect()
  for (const f of files) {
    const sql = fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
    try {
      await mig.query('begin'); await mig.query(sql); await mig.query('commit'); out.applied++
      if (MAP.includes(f)) out.map[f] = 'ok'
    } catch (e) {
      await mig.query('rollback').catch(() => {})
      if (MAP.includes(f)) out.map[f] = e.message
      else out.failedBeforeMap.push(`${f}: ${e.message.slice(0, 120)}`)
    }
  }
  for (const f of MAP) rec(`지도 마이그레이션 ${f}`, out.map[f] === 'ok', out.map[f])

  // 앱(lib/csat/map · lib/csat/diagnosis · api/csat/diagnosis/map)이 읽고 쓰는 객체 — 코드의 from()/rpc() 전수
  const TABLES = ['csat_map_node', 'csat_map_edge', 'csat_map_task', 'csat_map_source', 'csat_map_settings', 'csat_map_node_source', 'csat_map_edge_source',
    'csat_map_line_link', 'csat_map_item_rate', 'csat_map_goal', 'csat_map_task_done', 'csat_exams', 'csat_items', 'csat_items_public', 'csat_types',
    'csat_dx_answer_key', 'csat_dx_habit_feedback', 'csat_dx_item_attribute', 'csat_dx_option_trap', 'csat_dx_profile_hist', 'csat_dx_response',
    'csat_dx_session', 'csat_dx_settings', 'csat_dx_snapshot', 'csat_dx_trap_family']
  for (const t of TABLES) {
    const r = await mig.query('select to_regclass($1) is not null as ok', [`public.${t}`])
    out.objects[t] = r.rows[0].ok
    if (!r.rows[0].ok) rec(`객체 ${t}`, false, '없음')
  }
  rec(`앱이 읽는 표 · 뷰 ${TABLES.length}개 존재`, Object.values(out.objects).every(Boolean))
  const fn = await mig.query(`select count(*)::int n from pg_proc where proname = 'csat_dx_record_session'`)
  rec('RPC csat_dx_record_session 존재', fn.rows[0].n > 0)
  const cols = await mig.query(`select column_name from information_schema.columns where table_schema='public' and table_name='csat_exams' and column_name='diagnosis_ready'`)
  rec('csat_exams.diagnosis_ready 존재(진단 반영 게이트)', cols.rowCount === 1)
  // load.ts 의 select 목록이 실제 컬럼과 맞다
  for (const [t, c] of [['csat_map_node', 'code, kind, name, axis, track, summary, why, signal, evidence_status, sort'], ['csat_map_edge', 'id, from_code, to_code, kind, basis'],
    ['csat_map_task', 'id, line_code, ord, title, how, cadence, done_when, material, method_line'], ['csat_map_source', 'id, citation, supports, status, url']]) {
    try { await mig.query(`select ${c} from public.${t} limit 0`); rec(`${t} 컬럼 = 로더 계약`, true) } catch (e) { rec(`${t} 컬럼 = 로더 계약`, false, e.message) }
  }

  // 학습자 권한 — PostgREST 처럼 역할을 바꿔 한 트랜잭션씩
  const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b'
  const s2 = admin('fresh'); await s2.connect()
  await s2.query(`insert into auth.users(id) values ($1), ($2)`, [A, B])
  await s2.query(`set role postgres`)
  const node = await s2.query(`select code from public.csat_map_node limit 1`)
  await s2.end()
  const as = async (uid, sql, params = []) => {
    const c = new pg.Client({ host: '127.0.0.1', port: PORT, database: 'fresh', user: 'postgres', password: 'postgres' }); await c.connect()
    try { await c.query('begin'); await c.query(`set local role ${uid ? 'authenticated' : 'anon'}`); if (uid) await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]); const r = await c.query(sql, params); await c.query('rollback'); return { ok: true, rows: r.rows, n: r.rowCount } } catch (e) { await c.query('rollback').catch(() => {}); return { ok: false, err: e.message } } finally { await c.end() }
  }
  const goalCols = (await (async () => { const c = admin('fresh'); await c.connect(); const r = await c.query(`select column_name, is_nullable, column_default from information_schema.columns where table_name='csat_map_goal' order by ordinal_position`); await c.end(); return r.rows })())
  out.smoke.goalCols = goalCols.map((r) => r.column_name)
  // 쓰기는 API 라우트(service_role)만 — 학습자 키로 직접 쓰면 거부, 읽기는 본인 행만
  const insGoal = await as(A, `insert into public.csat_map_goal(user_id, target_score) values ($1, 80)`, [A])
  rec('학습자 A — 목표 직접 쓰기 거부(쓰기는 서버 라우트만)', !insGoal.ok, insGoal.err)
  const s3 = admin('fresh'); await s3.connect()
  await s3.query(`set role service_role`)
  await s3.query(`insert into public.csat_map_goal(user_id, target_score) values ($1, 70), ($2, 90)`, [A, B])
  await s3.end()
  const own = await as(A, `select user_id from public.csat_map_goal`)
  rec('학습자 A — 본인 목표만 보인다', own.ok && own.rows.length === 1 && own.rows[0].user_id === A, JSON.stringify(own.rows ?? own.err))
  const defWrite = await as(A, `update public.csat_map_node set name = name`)
  rec('학습자 — 지도 정의(노드) 쓰기 불가', !defWrite.ok || defWrite.n === 0, defWrite.err ?? `rows ${defWrite.n}`)
  const anonGoal = await as(null, `select * from public.csat_map_goal`)
  rec('익명 — 목표 읽기 0행 또는 거부', !anonGoal.ok || anonGoal.rows.length === 0)
  out.smoke.seededNodes = node.rowCount
  await mig.end()
} finally {
  spawnSync(bin, ['-D', DATA, '-m', 'fast', 'stop'], { stdio: 'ignore', timeout: 60000 })
  fs.mkdirSync(path.join(REPO, 'tmp'), { recursive: true })
  fs.writeFileSync(path.join(REPO, 'tmp/map-fresh-db.json'), JSON.stringify(out, null, 2))
  console.log(`main 마이그레이션 ${out.applied} 적용 · 지도 앞 실패 ${out.failedBeforeMap.length}(격리 환경에 없는 Supabase 전용 객체 — tmp/map-fresh-db.json)`)
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
