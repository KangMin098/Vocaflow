// P6 노출 원장 v2 SQL — PGlite 격리 검증(개발 DB 무관). node pglite-test.mjs <@electric-sql/pglite 패키지 경로>
// 의존 객체(auth · 역할 · learning_sessions · learning_task_attempts)는 실제 정의의 최소 사본(스텁)이다.
// ⚠️ PGlite 는 연결이 하나 — 진짜 동시 트랜잭션은 없다. 경합은 순차 재전송 · 고유 제약 · advisory 잠금 호출 · 시각 동률로 본다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pgPath = process.argv[2]
const { PGlite } = await import(pathToFileURL(createRequire(path.join(pgPath, 'package.json')).resolve(pgPath)).href)
const SQL = fs.readFileSync(path.join(here, process.env.SQL_FILE ?? '20261024100000_learning_exposures.v3.sql'), 'utf8')

const STUB = `
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to service_role;
-- 기존 기록 표 최소 사본(판정에 쓰는 열만)
create table public.learning_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null, item_ref text not null,
  help_server_at timestamptz, explanation_server_at timestamptz);
create table public.learning_task_attempts (id bigint generated always as identity primary key, user_id uuid not null, item_ref text,
  task_key text not null default 'k', phase text not null default 'practice', activity text default 'theater', session_id uuid default gen_random_uuid(),
  is_correct boolean default true, answered_at timestamptz default now(),
  help_level text, synthetic boolean not null default false, received_at timestamptz not null default now());
-- 지도 판정 뷰 최소 사본(열 구성 동일 · 판정 단순화): 첫 시도 = (user, task, item, phase) 가장 이른 것, 도움/해설 뒤는 help_level · 세션 해설 시각으로만
create view public.learning_first_attempts with (security_invoker = true) as
  with base as (select distinct on (user_id, task_key, coalesce(item_ref, ''), phase) * from public.learning_task_attempts order by user_id, task_key, coalesce(item_ref, ''), phase, answered_at, id)
  select b.id as attempt_id, b.user_id, b.task_key, b.item_ref, b.phase, b.activity, b.session_id, b.is_correct, b.answered_at,
    coalesce(b.help_level, 'independent') as help_level, b.help_level = 'viewed_first' as after_viewed_first,
    exists (select 1 from public.learning_sessions s where s.user_id = b.user_id and s.item_ref = b.item_ref and s.explanation_server_at <= b.answered_at) as after_explanation,
    b.synthetic, false as timing_uncertain
  from base b;
grant select on public.learning_first_attempts to authenticated, service_role;
alter table public.learning_sessions enable row level security; alter table public.learning_task_attempts enable row level security;
create policy s_own on public.learning_sessions for select to authenticated using (user_id = auth.uid());
create policy a_own on public.learning_task_attempts for select to authenticated using (user_id = auth.uid());
grant select on public.learning_sessions, public.learning_task_attempts to authenticated, service_role;
`
const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const results = []
const check = (name, pass, detail) => results.push({ name, pass: Boolean(pass), detail })
const db = new PGlite()
const q = (s, p) => db.query(s, p)
const err = async (p) => { try { await p; return null } catch (e) { return String(e.message ?? e) } }
const as = async (role, uid = null) => { await q(`reset role`); await q(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']); if (role !== 'postgres') await q(`set role ${role}`) }
const rec = (o) => q(`select public.learning_exposure_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) id`,
  [o.user ?? U1, o.cid, o.item ?? '2026#22', o.kind ?? 'answer_direct', o.source ?? 'lecture_continue', o.av ?? 3, o.lv ?? 2, o.dg ?? 'a'.repeat(64), o.cue ?? 'c5', o.at ?? new Date().toISOString(), o.syn ?? false])
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

await db.exec(STUB)
await q(`insert into auth.users values ($1), ($2)`, [U1, U2])
// 추적 시작 이전의 시도(P6 도입 전 기록) — 마이그레이션 전에 넣는다
await q(`insert into public.learning_task_attempts (user_id, item_ref, help_level, received_at) values ($1, '2026#30', 'independent', clock_timestamp() - interval '1 day')`, [U1])
const migErr = await err(db.exec(SQL)); check('마이그레이션 적용', migErr === null, migErr)

// ── 기록 · 중복 · 내용 다른 재전송 ─────────────────────────────
await as('service_role')
const a = (await rec({ cid: uuid(1) })).rows[0].id
const b = (await rec({ cid: uuid(1) })).rows[0].id
check('같은 client_exposure_id 재전송 → 같은 id · 1행', a === b && (await q(`select count(*)::int n from learning_exposures where client_exposure_id=$1`, [uuid(1)])).rows[0].n === 1)
check('같은 id 로 다른 내용 → 거부', /다른 노출/.test(await err(rec({ cid: uuid(1), kind: 'decisive_hint', source: 'lecture_until' }))))
check('결정적 단서는 강의 경로만(kind·source 제약)', /kind_source|check/i.test(await err(rec({ cid: uuid(2), kind: 'decisive_hint', source: 'judgment_scene' }))))
check('없는 사용자 → 거부', /없는 사용자/.test(await err(rec({ cid: uuid(3), user: '33333333-3333-3333-3333-333333333333' }))))
check('사용자 null → 거부', /필요하다/.test(await err(q(`select public.learning_exposure_record(null,$1,'x','answer_direct','reveal_api',null,null,null,null,now(),false)`, [uuid(4)]))))
await rec({ cid: uuid(5), at: new Date(Date.now() - 3600_000).toISOString() })
check('발생 시각이 10분 넘게 다르면 clock_suspect', (await q(`select clock_suspect from learning_exposures where client_exposure_id=$1`, [uuid(5)])).rows[0].clock_suspect === true)
check('잘못된 digest 형식 → 거부', (await err(rec({ cid: uuid(6), dg: 'xyz' }))) !== null)

// ── 기록 실패 = 전달 없음(서버는 기록이 커밋된 뒤에만 정답 응답) ───────
await as('postgres')
await q(`begin`)
const failed = await err(rec({ cid: uuid(7), kind: 'bogus' }))
await q(`rollback`)
check('기록 실패 시 트랜잭션 롤백 · 행 없음(fail-closed 전제)', failed !== null && (await q(`select count(*)::int n from learning_exposures where client_exposure_id=$1`, [uuid(7)])).rows[0].n === 0)

// ── 권한 ─────────────────────────────────────────────
await as('authenticated', U1)
check('학습자 INSERT 거부', /permission denied/.test(await err(q(`insert into learning_exposures (user_id, client_exposure_id, item_ref, kind, source, occurred_at) values ($1,$2,'x','answer_direct','reveal_api',now())`, [U1, uuid(8)]))))
check('학습자 RPC 실행 거부', /permission denied/.test(await err(rec({ cid: uuid(9) }))))
check('학습자 UPDATE 거부', /permission denied/.test(await err(q(`update learning_exposures set kind='decisive_hint'`))))
check('학습자 DELETE 거부', /permission denied/.test(await err(q(`delete from learning_exposures`))))
await as('service_role'); await rec({ cid: uuid(10), user: U2 })
await as('authenticated', U1)
const mine = await q(`select distinct user_id from learning_exposures`).then((r) => r.rows.map((x) => x.user_id), (e) => ['ERR ' + e.message])
check('학습자는 본인 행만 본다(RLS)', mine.length === 1 && mine[0] === U1, mine)
await as('anon')
check('익명 SELECT 거부', /permission denied/.test(await err(q(`select * from learning_exposures`))))

// ── 불변 ─────────────────────────────────────────────
await as('service_role')
check('service_role UPDATE 거부(권한)', /permission denied/.test(await err(q(`update learning_exposures set cue_id='x'`))))
check('service_role TRUNCATE 거부', /permission denied/.test(await err(q(`truncate learning_exposures`))))
check('실학습자 행 DELETE 거부(트리거)', /지울 수 없다/.test(await err(q(`delete from learning_exposures where client_exposure_id=$1`, [uuid(1)]))))
await rec({ cid: uuid(11), syn: true })
check('합성 행 DELETE 허용', (await err(q(`delete from learning_exposures where client_exposure_id=$1`, [uuid(11)]))) === null)
await as('postgres')
check('소유자(postgres)도 UPDATE 불가(트리거)', /고칠 수 없다/.test(await err(q(`update learning_exposures set cue_id='x' where client_exposure_id=$1`, [uuid(1)]))))

// ── 독립 판정(v3: 지도 뷰 위 · 노출 원장 · 추적 이전 · 단계) ─────────────
await as('postgres')
const ind = async (id) => (await q(`select public.learning_attempt_independence($1) v`, [id])).rows[0].v
const att = async (o) => (await q(`insert into learning_task_attempts (user_id, item_ref, help_level, synthetic, phase, activity, session_id, is_correct, answered_at) values ($1,$2,$3,$4,$5,$6,$7,$8, coalesce($9::timestamptz, now())) returning id`,
  [o.user ?? U1, o.item, o.help ?? 'independent', o.syn ?? false, o.phase ?? 'practice', o.activity === undefined ? 'theater' : o.activity, o.session === undefined ? '44444444-4444-4444-4444-444444444444' : o.session, o.correct === undefined ? true : o.correct, o.at ?? null])).rows[0].id
const pre = (await q(`select id from learning_task_attempts where item_ref='2026#30'`)).rows[0].id
check('추적 이전 시도(exposure_order_at 없음) → legacy_unknown', (await ind(pre)) === 'legacy_unknown')
check('추적 이후 시도는 순서 시각이 채워진다(트리거)', (await q(`select exposure_order_at is not null v from learning_task_attempts where id=$1`, [await att({ item: '2026#40' })])).rows[0].v)
const t1 = await att({ item: '2026#41' })
check('노출 없는 FIND/CHECK 첫 시도 → independent_candidate', (await ind(t1)) === 'independent_candidate')
await as('service_role'); await rec({ cid: uuid(20), item: '2026#41' }); await as('postgres')
check('나중 노출이 앞 시도를 바꾸지 않음(비소급)', (await ind(t1)) === 'independent_candidate')
const t1b = await att({ item: '2026#47' })
await as('service_role'); await rec({ cid: uuid(21), item: '2026#48' }); await as('postgres')
const t2 = await att({ item: '2026#48' })
check('노출 뒤 첫 시도 → after_exposure', (await ind(t2)) === 'after_exposure')
const t4 = await att({ item: '2026#42', help: 'viewed_first' })
check('정답 먼저 보기 · 도움 → helped', (await ind(t4)) === 'helped')
const t5 = await att({ item: '2026#43' }); const t6 = await att({ item: '2026#43' })
check('같은 단계 두 번째 시도 → repeat', (await ind(t5)) === 'independent_candidate' && (await ind(t6)) === 'repeat')
check('TRANSFER(phase transfer) → not_check_phase', (await ind(await att({ item: '2026#44', phase: 'transfer' }))) === 'not_check_phase')
check('practice 화면(activity practice) → not_check_phase', (await ind(await att({ item: '2026#49', activity: 'practice' }))) === 'not_check_phase')
check('REPAIR 류(phase review · 도움 뒤 재수행) → 독립 후보 아님', (await ind(await att({ item: '2026#51', phase: 'review', help: 'hint' }))) === 'not_check_phase')
await q(`insert into learning_sessions (user_id, item_ref, explanation_server_at) values ($1,'2026#45', now() - interval '1 minute')`, [U1])
check('해설 열람 뒤 → helped(기존 뷰 판정)', (await ind(await att({ item: '2026#45' }))) === 'helped')
check('세션 결속 없음 → unbound', (await ind(await att({ item: '2026#52', session: null }))) === 'unbound')
check('정오 없음 → ungraded', (await ind(await att({ item: '2026#53', correct: null }))) === 'ungraded')
const t9 = await att({ item: '2026#46', user: U2 })
await as('authenticated', U1)
check('학습자는 남의 시도를 판정할 수 없다(RLS → null)', (await ind(t9)) === null)
await as('anon')
check('익명은 판정 함수 실행 불가', /permission denied/.test(await err(ind(t1))))
void t1b

// ── 계정 삭제 cascade ─────────────────────────────────
await as('postgres')
check('계정 삭제 시 노출 행 cascade 삭제(실학습자 행도)', (await err(q(`delete from auth.users where id=$1`, [U2]))) === null && (await q(`select count(*)::int n from learning_exposures where user_id=$1`, [U2])).rows[0].n === 0)

// ── 경합(순차 재전송 근사) ─────────────────────────────
await as('service_role')
const ids = await Promise.all(Array.from({ length: 10 }, () => rec({ cid: uuid(30), item: '2026#50' })))
check('같은 요청 10회 동시 호출(단일 연결 직렬) → 1행', new Set(ids.map((r) => r.rows[0].id)).size === 1 && (await q(`select count(*)::int n from learning_exposures where client_exposure_id=$1`, [uuid(30)])).rows[0].n === 1)

await db.close()
const failedN = results.filter((r) => !r.pass)
fs.writeFileSync(path.join(here, process.env.OUT_FILE ?? 'pglite-results-v3.json'), JSON.stringify({ results }, null, 1))
console.log(`${results.length - failedN.length}/${results.length} pass`)
for (const f of failedN) console.log('FAIL', f.name, JSON.stringify(f.detail ?? ''))
