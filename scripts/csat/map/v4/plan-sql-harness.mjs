#!/usr/bin/env node
// scripts/csat/map/v4/plan-sql-harness.mjs
//
// `supabase/migrations/_pending_map_v4_plan.sql`(승인 대기)의 오프라인 검증 — 메모리 Postgres(PGlite 0.2.17). **공유 DB 에 닿지 않는다.**
// 저장소 의존성에 PGlite 가 없어 설치 위치를 인자로 받는다:
//   node scripts/csat/map/v4/plan-sql-harness.mjs <pglite 를 설치한 폴더(node_modules 의 부모)>
// 검사: 적용 · 백필 · RLS(본인만 · 쓰기 불가) · 멱등(같은 client_key) · 버전 충돌 · 계획량 검증 · 추가 전용 · 계정 삭제 cascade · 롤백 문.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const dir = process.argv[2]
if (!dir) throw new Error('PGlite 설치 폴더를 인자로 준다')
const { PGlite } = await import(pathToFileURL(path.join(dir, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
let fail = 0
const rec = (name, ok, d = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${d ? ' — ' + d : ''}`) }
const throws = async (sql, params, re) => { try { await db.query(sql, params); return false } catch (e) { return re.test(String(e.message)) } }

// Supabase 최소 바탕 — 역할 · auth 스키마 · 기존 csat_map_goal
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.csat_map_goal (user_id uuid primary key references auth.users(id) on delete cascade, target_score smallint not null check (target_score between 0 and 100), updated_at timestamptz not null default now());
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.csat_map_goal values ('00000000-0000-0000-0000-00000000000a', 80, '2026-10-08T00:00:00Z');
`)
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'

const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/_pending_map_v4_plan.sql'), 'utf8')
await db.exec(sql)
rec('적용(트랜잭션 하나)', true)

const back = await db.query('select user_id, target_score from public.csat_map_goal_version')
rec('백필 — 지금 목표 1행이 첫 이력', back.rows.length === 1 && back.rows[0].target_score === 80)

// 목표 설정 RPC — 멱등
const k1 = '11111111-1111-1111-1111-111111111111'
const g1 = (await db.query(`select public.csat_map_goal_set($1, 70::smallint, null, 'suneung', null, $2) as id`, [A, k1])).rows[0].id
const g2 = (await db.query(`select public.csat_map_goal_set($1, 70::smallint, null, 'suneung', null, $2) as id`, [A, k1])).rows[0].id
rec('목표 설정 멱등 — 같은 client_key 는 같은 이력', g1 === g2 && (await db.query('select count(*)::int n from public.csat_map_goal_version where user_id=$1', [A])).rows[0].n === 2)
rec('목표 최신 값 갱신', (await db.query('select target_score from public.csat_map_goal where user_id=$1', [A])).rows[0].target_score === 70)

// 계획 확정 · 수정
const plan = (planned, available = 9) => JSON.stringify({ order: ['r.central_meaning'], tasks: [{ task: 'r.central_meaning', stage: 'check', planned, available, rule: 'unseen_check_items' }, { task: 'r.discourse_function', stage: null, planned: null, available: null, rule: null }] })
const commit = (p, reason, expected, key) => db.query(`select * from public.learner_workspace_plan_commit($1, 'ws.central-meaning', 'rev4.0-draft-1', 'rev4.0-draft-1', $2::jsonb, $3, null, now(), $4, $5)`, [A, p, reason, expected, key])
const c1 = (await commit(plan(9), 'initial', 0, '22222222-2222-2222-2222-222222222222')).rows[0]
rec('첫 계획 = 버전 1 · Workspace 생성', c1.plan_version === 1 && c1.reused === false)
const c1b = (await commit(plan(9), 'initial', 0, '22222222-2222-2222-2222-222222222222')).rows[0]
rec('중복 제출 — 같은 client_key 는 같은 버전(reused)', c1b.plan_version === 1 && c1b.reused === true)
const c2 = (await commit(plan(5), 'learner_adjust', 1, '33333333-3333-3333-3333-333333333333')).rows[0]
rec('수정 = 버전 2 · 사유 보존', c2.plan_version === 2 && (await db.query('select reason from public.learner_workspace_plan where plan_version=2')).rows[0].reason === 'learner_adjust')
rec('보던 버전이 낡으면 거절(덮어쓰기 없음)', await throws(`select * from public.learner_workspace_plan_commit($1, 'ws.central-meaning', 'x', 'x', $2::jsonb, 'learner_adjust', null, now(), 1, '44444444-4444-4444-4444-444444444444')`, [A, plan(3)], /plan_version_conflict/))
rec('계획량 > 가용량 거절', await throws(`select * from public.learner_workspace_plan_commit($1, 'ws.central-meaning', 'x', 'x', $2::jsonb, 'learner_adjust', null, now(), 2, '55555555-5555-5555-5555-555555555555')`, [A, plan(12)], /plan_invalid/))
rec('가용량 없는 TASK 에 계획량 거절(근거 없는 권장량 저장 불가)', await throws(`select * from public.learner_workspace_plan_commit($1, 'ws.central-meaning', 'x', 'x', $2::jsonb, 'learner_adjust', null, now(), 2, '66666666-6666-6666-6666-666666666666')`, [A, JSON.stringify({ order: [], tasks: [{ task: 'v.core_meaning', planned: 4, available: null }] })], /plan_invalid/))
rec('알 수 없는 사유 거절', await throws(`select * from public.learner_workspace_plan_commit($1, 'ws.central-meaning', 'x', 'x', $2::jsonb, 'because', null, now(), 2, '77777777-7777-7777-7777-777777777777')`, [A, plan(4)], /check/))
rec('계획 jsonb 에 수행 기록 칸이 없다(복제 안 함)', !/attempt|is_correct|answered/.test((await db.query('select plan::text t from public.learner_workspace_plan')).rows.map((r) => r.t).join()))

// 추가 전용
rec('계획 이력 UPDATE 거절', await throws(`update public.learner_workspace_plan set note='x'`, [], /추가 전용|permission/))
rec('계획 이력 DELETE 거절', await throws(`delete from public.learner_workspace_plan`, [], /추가 전용/))
rec('목표 이력 DELETE 거절', await throws(`delete from public.csat_map_goal_version`, [], /추가 전용/))
rec('Workspace 직접 DELETE 거절(계획 이력 보호)', await throws(`delete from public.learner_workspace`, [], /추가 전용/))
rec('아주 큰 계획량 거절(넘침 아닌 plan_invalid)', await throws(`select * from public.learner_workspace_plan_commit($1, 'ws.central-meaning', 'x', 'x', $2::jsonb, 'learner_adjust', null, now(), 2, '88888888-8888-8888-8888-888888888888')`, [A, JSON.stringify({ order: [], tasks: [{ task: 'r.central_meaning', planned: 99999999999, available: 9 }] })], /plan_invalid/))
{
  // 계획하지 않음(planned 없음)은 가용량이 있어도 허용 — 그 뒤 버전 3
  const r = (await db.query(`select * from public.learner_workspace_plan_commit($1, 'ws.central-meaning', 'x', 'x', $2::jsonb, 'learner_adjust', '이번 주는 건너뜀', now(), 2, '99999999-9999-9999-9999-999999999999')`, [A, JSON.stringify({ order: [], tasks: [{ task: 'r.central_meaning', planned: null, available: 9 }] })])).rows[0]
  rec('계획하지 않음(planned 없음) 허용 · 메모 보존', r.plan_version === 3)
}

// RLS — 학습자 B 는 A 의 행을 못 본다 · 학습자는 쓰지 못한다
await db.exec(`set role authenticated; select set_config('test.uid', '${B}', false);`)
rec('RLS — 다른 학습자 계획 0행', (await db.query('select count(*)::int n from public.learner_workspace_plan')).rows[0].n === 0)
rec('학습자 직접 INSERT 거절', await throws(`insert into public.learner_workspace (user_id, template_id, canon_version) values ($1, 'ws.cohesion', 'x')`, [B], /permission|policy/))
rec('학습자 RPC 직접 호출 거절', await throws(`select * from public.learner_workspace_plan_commit($1, 'ws.cohesion', 'x', 'x', '{"order":[],"tasks":[]}'::jsonb, 'initial', null, now(), 0, gen_random_uuid())`, [B], /permission/))
await db.exec(`select set_config('test.uid', '${A}', false);`)
rec('RLS — 본인 계획 3버전 보임', (await db.query('select count(*)::int n from public.learner_workspace_plan')).rows[0].n === 3)
await db.exec('reset role')

// 계정 삭제 cascade 는 허용
await db.exec(`delete from auth.users where id = '${A}'`)
rec('계정 삭제 → 이력 cascade(추가 전용 가드 통과)', (await db.query('select count(*)::int n from public.learner_workspace_plan')).rows[0].n === 0 && (await db.query('select count(*)::int n from public.csat_map_goal_version')).rows[0].n === 0)

// 롤백 문(파일 머리)
const rollback = sql.split('\n').filter((l) => /^--\s{3}DROP /.test(l)).map((l) => l.replace(/^--\s+/, '')).join('\n')
await db.exec(rollback)
const left = (await db.query(`select count(*)::int n from pg_tables where schemaname='public' and tablename in ('csat_map_goal_version','learner_workspace','learner_workspace_plan')`)).rows[0].n
rec('롤백 — 새 테이블 0 · 기존 csat_map_goal 유지', left === 0 && (await db.query(`select to_regclass('public.csat_map_goal') is not null ok`)).rows[0].ok)

console.log(fail === 0 ? 'ALL PASS' : `FAIL ${fail}`)
process.exit(fail ? 1 : 0)
