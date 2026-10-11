#!/usr/bin/env node
// scripts/csat/map/v4/plan-sql-harness.mjs
//
// 학습계획 저장 마이그레이션(20261010180218 · 120100 · 120200 — 2026-10-11 개발 DB 적용)의 오프라인 검증 — 메모리 Postgres(PGlite 0.2.17). **공유 DB 에 닿지 않는다.**
// 저장소 의존성에 PGlite 가 없어 설치 위치를 인자로 받는다:
//   node scripts/csat/map/v4/plan-sql-harness.mjs <pglite 를 설치한 폴더(node_modules 의 부모)>
// 4차(2026-10-11) 보완 계약: 신뢰 경계(서버가 템플릿 TASK · 가용량 · 목표 버전을 채움) · 순서 순열 · TASK 소속 · 경계값 ·
//   정의 버전 결속 · 목표 소유 · 미래 시점 · 복원(새 버전) · 목표 동시성/멱등 · 권한(학습자 · service_role) · 추가 전용 · 롤백(보존 사본).
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
const err = async (sql, params) => { try { await db.query(sql, params); return '' } catch (e) { return String(e.message) } }

await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.csat_map_goal (user_id uuid primary key references auth.users(id) on delete cascade, target_score smallint not null check (target_score between 0 and 100), updated_at timestamptz not null default now());
grant select, insert, update on public.csat_map_goal to service_role;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.csat_map_goal values ('00000000-0000-0000-0000-00000000000a', 80, '2026-10-08T00:00:00Z');
`)
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
// 개발 DB 에 실제로 적용한 순서 그대로(2026-10-11): 본 스키마 → search_path 후속 → 충돌 코드 후속
const MIGS = ['20261010180218_map_v4_plan.sql', '20261010180916_map_v4_append_only_search_path.sql', '20261010181834_map_v4_plan_conflict_code.sql']
const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations', MIGS[0]), 'utf8')
for (const m of MIGS) await db.exec(fs.readFileSync(path.join(ROOT, 'supabase/migrations', m), 'utf8'))
rec('적용(트랜잭션 하나)', true)
rec('백필 — 지금 목표 1행이 첫 이력', (await db.query('select count(*)::int n from public.csat_map_goal_version')).rows[0].n === 1)

// ── 목표 RPC ─────────────────────────────────────────────
const goal = (score, key, user = A) => db.query(`select public.csat_map_goal_set($1, $2::smallint, null, 'suneung', null, $3) as id`, [user, score, key])
const g1 = (await goal(70, '11111111-1111-1111-1111-111111111111')).rows[0].id
rec('목표 멱등 — 같은 client_key 는 같은 이력 id', (await goal(70, '11111111-1111-1111-1111-111111111111')).rows[0].id === g1)
// 「동시」 요청: 서로 다른 키 두 개를 연달아(PGlite 는 단일 연결 — 자문 잠금 경로 · 최신 값 = 마지막 이력)
await Promise.all([goal(60, '11111111-1111-1111-1111-111111111112'), goal(90, '11111111-1111-1111-1111-111111111113')])
const last = (await db.query('select target_score from public.csat_map_goal_version where user_id=$1 order by created_at desc, id desc limit 1', [A])).rows[0].target_score
const cur = (await db.query('select target_score from public.csat_map_goal where user_id=$1', [A])).rows[0].target_score
rec('목표 — 최신 값 = 마지막 이력(원자적 통합)', last === cur, `${last}/${cur}`)
rec('목표 점수 범위 밖 거절', /goal_invalid/.test(await err(`select public.csat_map_goal_set($1, 101::smallint, null, null, null, gen_random_uuid())`, [A])))
const goalB = (await goal(50, '22222222-2222-2222-2222-22222222222b', B)).rows[0].id

// ── 계획 RPC ─────────────────────────────────────────────
const TPL = ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure']
const plan = (o = {}) => ({ order: o.order ?? TPL, tasks: (o.tasks ?? TPL.map((t, i) => ({ task: t, stage: i ? null : 'check', planned: i ? null : 9, available: i ? null : 9, rule: i ? null : 'unseen_check_items' }))) })
let k = 0
const key = () => `33333333-3333-3333-3333-${String(++k).padStart(12, '0')}`
const commit = (o) => db.query(
  `select * from public.learner_workspace_plan_commit($1, $2, $3::text[], $4, $5::jsonb, $6, $7, $8::timestamptz, $9, $10, $11, $12)`,
  [o.user ?? A, o.tpl ?? 'ws.central-meaning', o.tasks ?? TPL, o.canon ?? 'rev4.0-draft-1', JSON.stringify(o.plan ?? plan()), o.reason ?? 'initial', o.note ?? null, o.asOf ?? new Date().toISOString(), o.goal === undefined ? g1 : o.goal, o.expected ?? 0, o.key ?? key(), o.restore ?? null])
const fails = async (o, re) => { try { await commit(o); return false } catch (e) { return re.test(String(e.message)) } }

const k1 = key()
const c1 = (await commit({ key: k1 })).rows[0]
rec('첫 확정 = 버전 1 · Workspace 생성', c1.plan_version === 1 && c1.reused === false)
rec('중복 제출 — 같은 client_key 는 같은 버전(reused)', (await commit({ key: k1 })).rows[0].reused === true)
const c2 = (await commit({ plan: plan({ tasks: [{ task: TPL[0], planned: 5, available: 9 }, { task: TPL[1], planned: null, available: null }, { task: TPL[2], planned: null, available: null }] }), reason: 'learner_adjust', note: '이번 주는 5문항만', expected: 1 })).rows[0]
rec('수정 = 버전 2 · 사유 · 메모 보존', c2.plan_version === 2 && (await db.query("select note from public.learner_workspace_plan where plan_version=2")).rows[0].note === '이번 주는 5문항만')
rec('낡은 버전 수정 → 충돌(덮어쓰기 없음)', await fails({ reason: 'learner_adjust', expected: 1 }, /plan_version_conflict/))
rec('충돌 SQLSTATE = PT409(40001 이면 PostgREST 가 재시도 — 실DB 에서 125초 멈춤)', await (async () => { try { await commit({ reason: 'learner_adjust', expected: 1 }); return false } catch (e) { return e.code === 'PT409' } })())
rec('순서 중복 거절', await fails({ plan: plan({ order: [TPL[0], TPL[0], TPL[2]] }), reason: 'learner_adjust', expected: 2 }, /plan_invalid: order/))
rec('순서 누락 거절', await fails({ plan: plan({ order: [TPL[0], TPL[1]] }), reason: 'learner_adjust', expected: 2 }, /plan_invalid: order/))
rec('순서에 모르는 TASK 거절', await fails({ plan: plan({ order: [TPL[0], TPL[1], 'v.core_meaning'] }), reason: 'learner_adjust', expected: 2 }, /plan_invalid: order/))
rec('템플릿 밖 TASK 계획 거절', await fails({ plan: plan({ tasks: [{ task: TPL[0], planned: 1, available: 9 }, { task: TPL[1] }, { task: 'x.time_allocation', planned: 1, available: 3 }] }), reason: 'learner_adjust', expected: 2 }, /plan_invalid: tasks/))
rec('TASK 줄 누락 거절', await fails({ plan: plan({ tasks: [{ task: TPL[0], planned: 1, available: 9 }] }), reason: 'learner_adjust', expected: 2 }, /plan_invalid: tasks/))
rec('계획량 > 가용량 거절', await fails({ plan: plan({ tasks: [{ task: TPL[0], planned: 10, available: 9 }, { task: TPL[1] }, { task: TPL[2] }] }), reason: 'learner_adjust', expected: 2 }, /plan_invalid: 1 task bound/))
rec('가용량 없는 TASK 의 계획량 거절', await fails({ plan: plan({ tasks: [{ task: TPL[0], planned: 1, available: 9 }, { task: TPL[1], planned: 2, available: null }, { task: TPL[2] }] }), reason: 'learner_adjust', expected: 2 }, /task bound/))
rec('음수 · 소수 · 문자 · 큰 수 거절', (await Promise.all([-1, 1.5, '3', 1000].map((v) => fails({ plan: plan({ tasks: [{ task: TPL[0], planned: v, available: 9 }, { task: TPL[1] }, { task: TPL[2] }] }), reason: 'learner_adjust', expected: 2 }, /task bound/)))).every(Boolean))
const c3 = (await commit({ plan: plan({ tasks: [{ task: TPL[0], planned: 0, available: 9 }, { task: TPL[1] }, { task: TPL[2] }] }), reason: 'learner_adjust', expected: 2 })).rows[0]
rec('계획량 0 허용(이번에는 하지 않음)', c3.plan_version === 3)
rec('미래 기준 시점 거절', await fails({ asOf: new Date(Date.now() + 3600_000).toISOString(), reason: 'learner_adjust', expected: 3 }, /as_of_future/))
rec('남의 목표 버전 거절', await fails({ goal: goalB, reason: 'learner_adjust', expected: 3 }, /goal_mismatch/))
rec('정의 버전이 바뀌었는데 사유가 다르면 거절', await fails({ canon: 'rev4.0-draft-2', reason: 'learner_adjust', expected: 3 }, /canon_mismatch/))
const c4 = (await commit({ canon: 'rev4.0-draft-2', reason: 'definition_change', expected: 3 })).rows[0]
rec('정의 변경 사유면 새 버전으로 기록', c4.plan_version === 4)
rec('없는 버전 복원 거절', await fails({ canon: 'rev4.0-draft-2', reason: 'restore', restore: 99, expected: 4 }, /restore_missing/))
const c5 = (await commit({ canon: 'rev4.0-draft-1', reason: 'restore', restore: 2, expected: 4 })).rows[0]
rec('복원 = 새 버전(이전 이력 보존 · restored_from)', c5.plan_version === 5 && (await db.query('select restored_from from public.learner_workspace_plan where plan_version=5')).rows[0].restored_from === 2 && (await db.query('select count(*)::int n from public.learner_workspace_plan')).rows[0].n === 5)
rec('restore 가 아닌데 restored_from 금지(제약)', /check/.test(await err(`insert into public.learner_workspace_plan (workspace_id,user_id,plan_version,plan,reason,restored_from,as_of,canon_version,client_key) values ($1,$2,9,'{"order":[],"tasks":[]}','initial',1,now(),'x',gen_random_uuid())`, [c1.workspace_id, A])))
rec('계획 jsonb 에 수행 기록 칸 없음(복제 안 함)', !/attempt|is_correct|answered/.test((await db.query('select string_agg(plan::text, \'\') t from public.learner_workspace_plan')).rows[0].t))

// ── 추가 전용 · 권한 ─────────────────────────────────────
rec('계획 이력 UPDATE 거절', /추가 전용/.test(await err(`update public.learner_workspace_plan set note='x'`)))
rec('계획 이력 DELETE 거절', /추가 전용/.test(await err(`delete from public.learner_workspace_plan`)))
rec('목표 이력 DELETE 거절', /추가 전용/.test(await err(`delete from public.csat_map_goal_version`)))
rec('Workspace 직접 DELETE 거절(이력 보호)', /추가 전용/.test(await err(`delete from public.learner_workspace`)))
await db.exec(`set role service_role`)
rec('service_role 직접 INSERT(계획) 거절 — RPC 만', /permission/.test(await err(`insert into public.learner_workspace_plan (workspace_id,user_id,plan_version,plan,reason,as_of,canon_version,client_key) values ($1,$2,9,'{"order":[],"tasks":[]}','initial',now(),'x',gen_random_uuid())`, [c1.workspace_id, A])))
rec('service_role 직접 UPDATE(목표 이력) 거절', /permission/.test(await err(`update public.csat_map_goal_version set target_score=1`)))
rec('service_role RPC 실행 가능', (await commit({ user: B, tpl: 'ws.option-match', tasks: ['e.option_correspondence'], plan: { order: ['e.option_correspondence'], tasks: [{ task: 'e.option_correspondence', planned: 3, available: 6 }] }, goal: goalB })).rows[0].plan_version === 1)
await db.exec(`reset role; set role authenticated; select set_config('test.uid', '${B}', false);`)
rec('학습자 B — 자기 계획 1행만', (await db.query('select count(*)::int n from public.learner_workspace_plan')).rows[0].n === 1)
rec('학습자 B — A 의 목표 이력 안 보임', (await db.query(`select count(*)::int n from public.csat_map_goal_version where user_id = '${A}'`)).rows[0].n === 0)
rec('학습자 직접 INSERT 거절', /permission|policy/.test(await err(`insert into public.learner_workspace (user_id, template_id, canon_version) values ($1, 'ws.cohesion', 'x')`, [B])))
rec('학습자 RPC 직접 호출 거절(계획 · 목표)', /permission/.test(await err(`select * from public.learner_workspace_plan_commit($1,'ws.cohesion','{a}'::text[],'x','{"order":["a"],"tasks":[{"task":"a"}]}'::jsonb,'initial',null,now(),null,0,gen_random_uuid(),null)`, [B])) && /permission/.test(await err(`select public.csat_map_goal_set($1, 50::smallint, null, null, null, gen_random_uuid())`, [B])))
await db.exec(`select set_config('test.uid', '${A}', false);`)
rec('학습자 A — 자기 계획 5버전', (await db.query('select count(*)::int n from public.learner_workspace_plan')).rows[0].n === 5)
await db.exec('reset role')

// ── 계정 삭제 cascade(목표 이력 + 계획이 서로 참조) ─────────
await db.exec(`delete from auth.users where id = '${A}'`)
rec('계정 삭제 → 목표 이력 · 계획 cascade(가드 통과)', (await db.query(`select (select count(*) from public.learner_workspace_plan where user_id='${A}')::int + (select count(*) from public.csat_map_goal_version where user_id='${A}')::int n`)).rows[0].n === 0)

// ── 보존형 롤백 ───────────────────────────────────────────
const lines = sql.split('\n').filter((l) => /^--\s{3,5}(CREATE TABLE public\._bak|DROP )/.test(l)).map((l) => l.replace(/^--\s+/, ''))
await db.exec(lines.join('\n'))
const left = (await db.query(`select count(*)::int n from pg_tables where schemaname='public' and tablename in ('csat_map_goal_version','learner_workspace','learner_workspace_plan')`)).rows[0].n
const bak = (await db.query(`select count(*)::int n from public._bak_map_v4_plan`)).rows[0].n
rec('롤백 — 보존 사본 먼저(계획 B 1행) · 새 테이블 0 · 기존 csat_map_goal 유지', left === 0 && bak === 1 && (await db.query(`select to_regclass('public.csat_map_goal') is not null ok`)).rows[0].ok, `bak=${bak}`)

console.log(fail === 0 ? 'ALL PASS' : `FAIL ${fail}`)
process.exit(fail ? 1 : 0)
