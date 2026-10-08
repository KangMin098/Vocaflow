// docs/csat-learner/g2-draft/pglite-harness.mjs
// 통합 SQL 초안의 오프라인 검증(메모리 Postgres · PGlite 0.2.17). 공유 DB 에 닿지 않는다.
// 실행: 임시 폴더에서 npm i @electric-sql/pglite@0.2 → node pglite-harness.mjs <sql> <result.json> <날짜>
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const SQL = fs.readFileSync(process.argv[2], 'utf8')
const results = []
const ok = (name, cond, detail = '') => {
  results.push({ name, pass: Boolean(cond), detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const OLD68 = `'catalog_viewed','csat_atlas_scoped','csat_drill_answered','csat_drill_finished','csat_dx_attempt_saved','csat_dx_habit_answered','csat_dx_history_compared','csat_dx_profile_saved','csat_dx_test_submitted','csat_dx_viewed','csat_ec_capture_closed','csat_ec_capture_finished','csat_ec_capture_opened','csat_evidence_opened','csat_home_viewed','csat_item_back','csat_lecture_ended','csat_lecture_played','csat_map_goal_set','csat_map_node_opened','csat_map_task_toggled','csat_map_viewed','csat_overlay_answered','csat_overlay_loaded','csat_overlay_located','csat_overlay_revealed','csat_paper_read','csat_path_chosen','csat_plan_ordered','csat_plan_speed_set','csat_resume_clicked','csat_review_done','csat_review_started','csat_session_answered','csat_session_explained','csat_session_finished','csat_session_marked','csat_session_started','csat_space_opened','csat_space_scoped','csat_trap_opened','csat_workspace_created','csat_workspace_edited','csat_workspace_opened','csat_workspace_session_started','csat_workspace_suggestion_applied','fit_analyzed','fit_level_moved','fit_share_opened','fit_shared','fit_sheet_opened','fit_signup_clicked','fit_viewed','fit_worksheet_printed','hub_hero_moved','hub_promo_clicked','invite_shared','landing_cta_clicked','landing_demo_moved','landing_section_reached','landing_viewed','screen_viewed','teacher_hub_view','video_completed','video_started','volume_previewed','wayfinder_cta_clicked','wayfinder_opened'`

const STUB = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.knowledge_applications (id uuid primary key);
create table public.knowledge_trials (id uuid primary key);
-- 정본(feat/methodology-vnext 20261008120000) 그대로
create table public.learning_task_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null check (length(task_key) between 1 and 120),
  application_id uuid references public.knowledge_applications(id),
  trial_id uuid references public.knowledge_trials(id),
  synthetic boolean not null default false,
  item_ref text,
  content_hash text,
  phase text not null check (phase in ('pre','practice','post','delayed','transfer')),
  response jsonb not null default '{}'::jsonb,
  is_correct boolean,
  sec integer check (sec between 0 and 7200),
  answered_at timestamptz not null default now()
);
alter table public.learning_task_attempts enable row level security;
revoke all on public.learning_task_attempts from anon, authenticated;
grant select on public.learning_task_attempts to authenticated;
grant select, insert on public.learning_task_attempts to service_role;
create policy learning_task_attempts_own_select on public.learning_task_attempts for select to authenticated using (user_id = auth.uid());
create table public.funnel_events (id bigserial primary key, occurred_at timestamptz default now(), user_id uuid, event text not null, surface text, meta jsonb);
alter table public.funnel_events add constraint funnel_events_event_check check (event in (${OLD68}));
`

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

async function fresh() {
  const db = new PGlite()
  await db.exec(STUB)
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');
    insert into public.funnel_events (event) select unnest(array[${OLD68}]);
    insert into public.learning_task_attempts (user_id, task_key, phase, item_ref) values ('${A}', 'claim_support', 'practice', '2026#20');`)
  return db
}
const one = async (db, q, p) => (await db.query(q, p)).rows[0]

// ── 적용 ──
const db = await fresh()
try {
  await db.exec(SQL)
  ok('통합 SQL 적용(메모리 DB)', true)
} catch (e) {
  ok('통합 SQL 적용(메모리 DB)', false, e.message)
  process.exit(1)
}

// ── 이벤트 CHECK ──
ok('기존 68종 행이 새 CHECK 를 통과(적용 성공으로 확인)', (await one(db, 'select count(*)::int n from public.funnel_events')).n === 68)
for (const ev of ['csat_prediction_submitted', 'knowledge_task_viewed', 'screen_viewed']) {
  await db.query('insert into public.funnel_events (event) values ($1)', [ev])
  ok(`허용: ${ev}`, true)
}
try {
  await db.query("insert into public.funnel_events (event) values ('not_an_event')")
  ok('목록 밖 이벤트 거부', false)
} catch {
  ok('목록 밖 이벤트 거부', true)
}
const n83 = await one(db, "select (select count(*) from regexp_matches(pg_get_constraintdef(oid), '''([a-z0-9_]+)''::text', 'g'))::int n from pg_constraint where conname='funnel_events_event_check'")
ok('허용 목록 83종', n83.n === 83, `실측 ${n83.n}`)

// ── 기존 practice 기록 호환 ──
await db.query("insert into public.learning_task_attempts (user_id, task_key, phase, item_ref, content_hash, is_correct, sec) values ($1,'claim_support','practice','2026#21','h',true,30)", [A])
ok('기존 practice INSERT(새 열 없이) 그대로 동작', true)

// ── 세션: 0시도 세션 · 멱등 · 충돌 · 단조 ──
const T = (m) => `2026-10-08T06:${String(m).padStart(2, '0')}:00Z`
const apply = (mut, stage, step, help, at, extra = {}) =>
  one(db, 'select * from public.learning_session_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [
    A, mut, uuid(900), 'theater', extra.phase ?? 'practice', '2026#34', stage, step, 14, help, at, extra.review ?? null, extra.deleted ?? false, false,
  ])
let r = await apply(uuid(1), 'open', 0, null, T(0))
const sid = r.session_id
ok('열기만 한 세션(시도 0건)이 서버에 남는다', r.outcome === 'applied' && (await one(db, 'select count(*)::int n from public.learning_sessions')).n === 1)
r = await apply(uuid(1), 'open', 0, null, T(0))
ok('같은 mutation · 같은 내용 재전송 → duplicate', r.outcome === 'duplicate')
r = await apply(uuid(1), 'open', 5, null, T(0))
ok('같은 mutation · 다른 내용 → conflict', r.outcome === 'conflict')
ok('conflict 는 아무것도 바꾸지 않는다', (await one(db, 'select step from public.learning_sessions where id=$1', [sid])).step === 0)
await apply(uuid(2), 'revealed', 3, 'viewed_first', T(1))
await apply(uuid(3), 'revealed', 6, 'independent', T(2)) // 다른 기기가 늦게 다르게 공개
let s = await one(db, 'select * from public.learning_sessions where id=$1', [sid])
ok('도움 수준은 먼저 공개한 값(viewed_first)', s.help_level === 'viewed_first')
ok('단계는 최신 값', s.step === 6)
await apply(uuid(4), 'finished', 13, 'viewed_first', T(3))
await apply(uuid(5), 'revealed', 9, 'independent', T(4)) // 옛 기기가 뒤늦게 「공개」를 보냄
s = await one(db, 'select * from public.learning_sessions where id=$1', [sid])
ok('마친 세션은 되돌아가지 않는다(stage · finished_at)', s.stage === 'finished' && s.finished_at != null)
ok('마친 세션의 단계는 바뀌지 않는다', s.step === 13)
await apply(uuid(6), 'finished', 13, 'viewed_first', T(5), { review: '2026-10-11T06:05:00Z' })
await apply(uuid(7), 'finished', 13, 'viewed_first', T(6), { review: '2026-10-20T00:00:00Z' })
s = await one(db, 'select review_at from public.learning_sessions where id=$1', [sid])
ok('복습 예약은 먼저 정한 값', new Date(s.review_at).toISOString() === '2026-10-11T06:05:00.000Z')
await apply(uuid(8), 'finished', 13, 'viewed_first', T(7), { deleted: true })
await apply(uuid(9), 'finished', 13, 'viewed_first', T(8), { deleted: false })
ok('삭제 표시는 되살아나지 않는다', (await one(db, 'select deleted_at from public.learning_sessions where id=$1', [sid])).deleted_at != null)
try {
  await db.query("insert into public.learning_sessions (user_id, client_session_id, activity, item_ref, stage, started_at, last_active_at) values ($1, $2, 'theater', 'x', 'finished', now(), now())", [A, uuid(901)])
  ok('모양이 틀린 세션(공개 없이 finished) 거부', false)
} catch {
  ok('모양이 틀린 세션(공개 없이 finished) 거부', true)
}

// ── 시도 · 첫 시도 ──
const s2 = (await one(db, 'select * from public.learning_session_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [A, uuid(20), uuid(910), 'theater', 'practice', '2026#18', 'open', 0, 14, null, T(10)])).session_id
await one(db, 'select * from public.learning_session_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [A, uuid(21), uuid(910), 'theater', 'practice', '2026#18', 'revealed', 0, 14, 'independent', T(11)])
const rec = (mut, correct, sid2 = s2) =>
  one(db, 'select * from public.learning_attempt_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [A, mut, sid2, 'csat_theater_gate', 'theater', 'practice', 'independent', '2026#18', 'v4', JSON.stringify({ sentence: 1, choice: 3 }), correct, 40, false])
let a = await rec(uuid(30), false)
ok('시도 기록 inserted', a.outcome === 'inserted')
a = await rec(uuid(30), false)
ok('재전송 → duplicate · 행 1개', a.outcome === 'duplicate' && (await one(db, "select count(*)::int n from public.learning_task_attempts where item_ref='2026#18'")).n === 1)
a = await rec(uuid(30), true)
ok('같은 mutation · 다른 채점 → conflict', a.outcome === 'conflict')
await rec(uuid(31), true) // 다시 풀기 = 새 mutation
const first = await db.query("select * from public.learning_first_attempts where item_ref='2026#18'")
ok('첫 시도는 하나 — 가장 이른 판단 제출', first.rows.length === 1 && first.rows[0].is_correct === false)
ok('재풀이는 시도로 남되 첫 시도가 아니다', (await one(db, "select count(*)::int n from public.learning_task_attempts where item_ref='2026#18'")).n === 2)
try {
  await db.query('select * from public.learning_attempt_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [B, uuid(40), s2, 'k', 'theater', 'practice', 'independent', 'x', null, '{}', true, 1, false])
  ok('남의 세션에 시도를 붙일 수 없다', false)
} catch {
  ok('남의 세션에 시도를 붙일 수 없다', true)
}
// 해설 먼저 본 세션의 판단은 표시된다
const s3 = (await one(db, 'select * from public.learning_session_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [A, uuid(50), uuid(920), 'theater', 'practice', '2026#19', 'revealed', 0, 14, 'viewed_first', T(20)])).session_id
await one(db, 'select * from public.learning_attempt_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [A, uuid(51), s3, 'csat_theater_gate', 'theater', 'practice', null, '2026#19', 'v4', '{}', true, 20, false])
ok('해설 먼저 본 세션의 첫 시도는 after_viewed_first=true', (await one(db, "select after_viewed_first from public.learning_first_attempts where item_ref='2026#19'")).after_viewed_first === true)

// ── Codex 리뷰 P1 회귀 ──
// (1) 오프라인 판단이 늦게 동기화돼도 첫 시도는 판단 시각 순
const recAt = (mut, correct, at, item = '2026#30', app = null) =>
  one(db, 'select * from public.learning_attempt_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)', [
    A, mut, null, 'csat_theater_gate', 'theater', 'practice', 'independent', item, 'v4', '{}', correct, 10, false, app, null, at,
  ])
await recAt(uuid(70), true, '2026-10-08T07:40:00Z') // 나중 판단이 먼저 도착
await recAt(uuid(71), false, '2026-10-08T07:30:00Z') // 먼저 한 판단이 늦게 도착
ok('첫 시도는 판단 시각 순(늦게 도착한 이른 판단)', (await one(db, "select is_correct from public.learning_first_attempts where item_ref='2026#30'")).is_correct === false)
let d = await recAt(uuid(71), false, '2026-10-08T07:35:00Z')
ok('같은 mutation · 다른 판단 시각 → conflict', d.outcome === 'conflict')
// (2) application · trial · synthetic 이 달라도 conflict
await db.query("insert into public.knowledge_applications values ('33333333-3333-3333-3333-333333333333')")
await recAt(uuid(80), true, '2026-10-08T07:50:00Z', '2026#31')
d = await recAt(uuid(80), true, '2026-10-08T07:50:00Z', '2026#31', '33333333-3333-3333-3333-333333333333')
ok('같은 mutation · 다른 application_id → conflict', d.outcome === 'conflict')
d = await one(db, 'select * from public.learning_session_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [
  A, uuid(20), uuid(910), 'theater', 'practice', '2026#18', 'open', 0, 14, null, T(10), null, false, true,
])
ok('세션: 같은 mutation · 다른 synthetic → conflict', d.outcome === 'conflict')
// (3) 충돌한 세션 변경은 새 세션을 만들지 않는다
d = await one(db, 'select * from public.learning_session_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [A, uuid(1), uuid(950), 'theater', 'practice', '2026#40', 'open', 0, 14, null, T(30)])
ok('세션: 이미 쓴 mutation 으로 다른 세션 → conflict', d.outcome === 'conflict')
ok('conflict 는 빈 세션조차 만들지 않는다', (await one(db, 'select count(*)::int n from public.learning_sessions where client_session_id=$1', [uuid(950)])).n === 0)

// ── 권한(RLS · RPC) ──
await db.exec(`set test.uid = '${B}'; set role authenticated;`)
ok('다른 학습자는 내 세션을 못 본다(RLS)', (await one(db, 'select count(*)::int n from public.learning_sessions')).n === 0)
try {
  await db.query("select * from public.learning_session_apply($1,$2,$3,'theater','practice','x','open',0,0,null,now())", [B, uuid(60), uuid(930)])
  ok('학습자는 기록 RPC 를 직접 못 부른다', false)
} catch {
  ok('학습자는 기록 RPC 를 직접 못 부른다', true)
}
try {
  await db.query("insert into public.learning_sessions (user_id, client_session_id, activity, item_ref, started_at, last_active_at) values ($1,$2,'theater','x',now(),now())", [B, uuid(931)])
  ok('학습자는 세션 표에 직접 못 쓴다', false)
} catch {
  ok('학습자는 세션 표에 직접 못 쓴다', true)
}
try {
  await db.query('select count(*) from public.learning_mutations')
  ok('학습자는 멱등 원장을 못 읽는다', false)
} catch {
  ok('학습자는 멱등 원장을 못 읽는다', true)
}
await db.exec(`reset role; set test.uid = '${A}'; set role authenticated;`)
ok('본인은 자기 세션을 읽는다', (await one(db, 'select count(*)::int n from public.learning_sessions')).n >= 3)
await db.exec('reset role;')

// ── 되돌리기 ──
const rb = SQL.split('-- ── 되돌리기')[1]
  .split('\n')
  .filter((l) => l.startsWith('-- ') && !l.startsWith('-- 전제'))
  .map((l) => l.slice(3))
  .join('\n')
  .replace('/* 기존 68 */', OLD68)
const db2 = await fresh()
await db2.exec(SQL)
try {
  await db2.exec(rb)
  const cols = (await db2.query("select column_name from information_schema.columns where table_name='learning_task_attempts' order by ordinal_position")).rows.map((x) => x.column_name)
  const gone = (await one(db2, "select to_regclass('public.learning_sessions') is null and to_regclass('public.learning_mutations') is null as g")).g
  ok('되돌리기 실행 · 새 표 제거 · 시도 표 원래 13열', gone && cols.length === 13, cols.length + '열')
} catch (e) {
  ok('되돌리기 실행', false, e.message)
}

const failed = results.filter((x) => !x.pass)
console.log(`\n${results.length - failed.length}/${results.length} PASS`)
fs.writeFileSync(process.argv[3], JSON.stringify({ at: process.argv[4], pglite: '0.2.17', results }, null, 2))
process.exit(failed.length ? 1 : 0)
