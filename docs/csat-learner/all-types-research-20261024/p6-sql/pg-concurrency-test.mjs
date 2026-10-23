// P6 노출 원장 — 실제 PostgreSQL 다중 연결 동시성 시험(embedded-postgres · 격리 클러스터 · 공유 개발 DB 무관).
// node pg-concurrency-test.mjs <isolated-pg 폴더(embedded-postgres · pg 설치)> <SQL 파일> <결과 json>
//
// 기존 시도 저장은 learning_attempt_record 본문과 같은 단순 INSERT(서버 now() 기본값)로 재현한다 — 실제 RPC 본문 · 다른 트리거는 스텁이 없다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const [pgDir, sqlFile, outFile] = process.argv.slice(2)
const req = createRequire(path.join(pgDir, 'package.json'))
const EmbeddedPostgres = req('embedded-postgres').default
const { Client } = req('pg')
const SQL = fs.readFileSync(sqlFile, 'utf8')

const dataDir = path.join(pgDir, `data-${path.basename(sqlFile).replace(/\W/g, '')}-${process.pid}`)
const port = 54000 + (process.pid % 900)
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port, persistent: false })
await pg.initialise()
// Windows 관리자 계정은 postgres.exe 직접 실행이 거부된다 — pg_ctl 이 제한 토큰으로 띄운다
const PG_CTL = path.join(pgDir, 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe')
execFileSync(PG_CTL, ['start', '-D', dataDir, '-o', `-p ${port}`, '-w', '-l', dataDir + '.log'], { stdio: 'ignore' })
const client = () => { const c = new Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' }); return c.connect().then(() => c) }
const results = []
const check = (name, pass, detail) => { results.push({ name, pass: Boolean(pass), detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
try {
  const admin = await client()
  await admin.query(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant anon, authenticated, service_role to postgres;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;
    create table public.learning_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null, item_ref text not null,
      help_server_at timestamptz, explanation_server_at timestamptz);
    create table public.learning_task_attempts (id bigint generated always as identity primary key, user_id uuid not null, item_ref text,
      task_key text not null default 'k', phase text not null default 'practice', activity text default 'theater', session_id uuid default gen_random_uuid(),
      is_correct boolean default true, answered_at timestamptz default now(), help_level text default 'independent', synthetic boolean not null default false,
      received_at timestamptz not null default now());
    create view public.learning_first_attempts with (security_invoker = true) as
      with base as (select distinct on (user_id, task_key, coalesce(item_ref, ''), phase) * from public.learning_task_attempts order by user_id, task_key, coalesce(item_ref, ''), phase, answered_at, id)
      select b.id as attempt_id, b.user_id, b.task_key, b.item_ref, b.phase, b.activity, b.session_id, b.is_correct, b.answered_at,
        coalesce(b.help_level, 'independent') as help_level, b.help_level = 'viewed_first' as after_viewed_first, false as after_explanation, b.synthetic, false as timing_uncertain
      from base b;
    grant select, insert on public.learning_task_attempts to service_role; grant select on public.learning_sessions, public.learning_first_attempts to service_role;
    insert into auth.users values ('${U1}'), ('${U2}');`)
  await admin.query(SQL)
  const isV3 = /exposure_order_at/.test(SQL)
  const A = await client()
  const B = await client()
  for (const c of [A, B]) await c.query(`set role service_role`)
  const rec = (c, o) => c.query(`select public.learning_exposure_record($1,$2,$3,'answer_direct','lecture_continue',3,2,$4,'c5',clock_timestamp(),false) id`, [o.user ?? U1, o.cid, o.item, 'a'.repeat(64)])
  const ind = async (id) => (await admin.query(`select public.learning_attempt_independence($1) v`, [id])).rows[0].v
  const attemptIns = (c, item, user = U1) => c.query(`insert into public.learning_task_attempts (user_id, item_ref) values ($1,$2) returning id`, [user, item])

  // K1 시도 트랜잭션이 먼저 시작(now()=T0) → 그 사이 노출 커밋(T1) → 시도 INSERT · 커밋. 실제 순서는 노출이 먼저다
  await A.query('begin'); await A.query('select now()')
  await sleep(150)
  await rec(B, { cid: uuid(1), item: 'K1' })
  await sleep(50)
  const k1 = (await attemptIns(A, 'K1')).rows[0].id
  await A.query('commit')
  const k1v = await ind(k1)
  check(`K1 시도 트랜잭션이 노출보다 먼저 시작했지만 노출이 먼저 커밋 → 독립 아님 (${isV3 ? 'v3' : 'v2'})`, k1v === 'after_exposure', k1v)

  // K2 시도 INSERT 가 잠금을 쥔 채 미커밋 → 같은 학습자 · 문항 노출은 커밋까지 기다리고, 시도는 독립 후보로 남는다
  await A.query('begin')
  const k2 = (await attemptIns(A, 'K2')).rows[0].id
  const t0 = Date.now()
  // 노출 기록이 끝난 시각을 그 순간에 잰다(커밋 뒤에 재면 sleep 이 섞여 대기 여부를 가르지 못한다)
  let doneAt = 0
  const waiting = rec(B, { cid: uuid(2), item: 'K2' }).then((r) => { doneAt = Date.now(); return r })
  await sleep(400)
  const doneBeforeCommit = doneAt !== 0
  await A.query('commit')
  await waiting
  const waited = doneAt - t0
  const k2v = await ind(k2)
  check(`K2 같은 학습자·문항: 노출이 시도 커밋까지 대기 · 시도는 독립 후보 (${isV3 ? 'v3' : 'v2'})`, !doneBeforeCommit && waited >= 350 && ['independent_candidate', 'independent'].includes(k2v), { waited, doneBeforeCommit, k2v })

  // K3 시도가 롤백되면 노출은 진행 · 유령 시도 없음
  await A.query('begin'); await attemptIns(A, 'K3'); const t3 = Date.now()
  const w3 = rec(B, { cid: uuid(3), item: 'K3' }); await sleep(200); await A.query('rollback'); await w3
  check('K3 시도 롤백 → 노출 기록 진행 · 시도 0행', (await admin.query(`select count(*)::int n from learning_task_attempts where item_ref='K3'`)).rows[0].n === 0, { waited: Date.now() - t3 })

  // K4 다른 학습자 · 다른 문항은 서로 기다리지 않는다
  await A.query('begin'); await attemptIns(A, 'K4a', U1)
  const t4 = Date.now(); await rec(B, { cid: uuid(4), item: 'K4b', user: U2 }); const w4 = Date.now() - t4
  await A.query('commit')
  check('K4 다른 학습자·문항 → 잠금 대기 없음', w4 < 150, { waitedMs: w4 })

  // K5 같은 client_exposure_id 를 두 연결이 동시에 → 1행 · 같은 id
  await A.query('begin'); const r5a = (await rec(A, { cid: uuid(5), item: 'K5' })).rows[0].id
  const p5b = rec(B, { cid: uuid(5), item: 'K5' }); await sleep(200); await A.query('commit')
  const r5b = (await p5b).rows[0].id
  check('K5 같은 요청 동시 2연결 → 1행 · 같은 id', String(r5a) === String(r5b) && (await admin.query(`select count(*)::int n from learning_exposures where client_exposure_id=$1`, [uuid(5)])).rows[0].n === 1, { r5a, r5b })

  // K6 기록 실패 → 롤백 · 재시도 성공(1행)
  await A.query('begin')
  let failed = null
  try { await A.query(`select public.learning_exposure_record($1,$2,'K6','bogus','lecture_continue',null,null,null,null,clock_timestamp(),false)`, [U1, uuid(6)]) } catch (e) { failed = e.message }
  await A.query('rollback')
  await rec(A, { cid: uuid(6), item: 'K6' })
  check('K6 기록 실패 → 롤백 · 같은 id 재시도 성공 1행', failed && (await admin.query(`select count(*)::int n from learning_exposures where client_exposure_id=$1`, [uuid(6)])).rows[0].n === 1, failed?.slice(0, 80))

  // K7 응답 전 확정: 기록 트랜잭션이 커밋되기 전에는 다른 연결(=판정 · 다른 요청)이 노출을 볼 수 없다 → 서버는 커밋 뒤에만 응답해야 한다
  await A.query('begin'); await rec(A, { cid: uuid(7), item: 'K7' })
  const seenBefore = (await B.query(`select count(*)::int n from learning_exposures where client_exposure_id=$1`, [uuid(7)])).rows[0].n
  await A.query('commit')
  const seenAfter = (await B.query(`select count(*)::int n from learning_exposures where client_exposure_id=$1`, [uuid(7)])).rows[0].n
  check('K7 커밋 전 노출은 다른 연결에 보이지 않음 · 커밋 뒤 보임(응답은 커밋 뒤)', seenBefore === 0 && seenAfter === 1, { seenBefore, seenAfter })

  for (const c of [A, B, admin]) await c.end()
} catch (e) {
  check('실행 오류', false, String(e.message ?? e))
} finally {
  try { execFileSync(PG_CTL, ['stop', '-D', dataDir, '-m', 'fast', '-w'], { stdio: 'ignore' }) } catch {}
}
fs.writeFileSync(outFile, JSON.stringify({ sql: path.basename(sqlFile), results }, null, 1))
console.log(`${results.filter((r) => r.pass).length}/${results.length} pass`)
