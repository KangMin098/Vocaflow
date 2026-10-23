// AT-P6-01~03 — 실제 정의(real-bootstrap.sql) 위에 승인된 v3 SQL 을 적용한 격리 PostgreSQL 사전 시험.
// node at-p6-test.mjs <isolated-pg 폴더> <SQL 파일> <결과 json>
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [pgDir, sqlFile, outFile] = process.argv.slice(2)
const req = createRequire(path.join(pgDir, 'package.json'))
const EmbeddedPostgres = req('embedded-postgres').default
const { Client } = req('pg')
const SQL = fs.readFileSync(sqlFile, 'utf8')
const BOOT = fs.readFileSync(path.join(here, 'real-bootstrap.sql'), 'utf8')
const sha = crypto.createHash('sha256').update(fs.readFileSync(sqlFile)).digest('hex')

const dataDir = path.join(pgDir, `data-at-${process.pid}`)
const port = 55000 + (process.pid % 900)
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port, persistent: false })
await pg.initialise()
const PG_CTL = path.join(pgDir, 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe')
execFileSync(PG_CTL, ['start', '-D', dataDir, '-o', `-p ${port}`, '-w', '-l', dataDir + '.log'], { stdio: 'ignore' })
const client = async () => { const c = new Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' }); await c.connect(); return c }
const results = []
const check = (id, name, pass, detail) => { results.push({ id, name, pass: Boolean(pass), detail }); console.log(pass ? 'PASS' : 'FAIL', id, name, detail === undefined ? '' : JSON.stringify(detail)) }
const err = async (p) => { try { await p; return null } catch (e) { return String(e.message) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const uid = () => crypto.randomUUID()

try {
  const admin = await client()
  await admin.query(BOOT)
  await admin.query(`insert into auth.users values ($1), ($2)`, [U1, U2])
  const svc = await client(); await svc.query('set role service_role')
  // 실제 RPC 로 학습자 시도 하나 · 합성 시도 하나 저장(마이그레이션 전 = 기존 행)
  const submit = (c, o) => c.query(`select * from public.learning_attempt_submit($1,$2,$3,$4,'theater','practice',$5,$6,$7,$8,$9,null,null,'{}'::jsonb,true,30,null)`,
    [o.user ?? U1, o.mut ?? uid(), o.rev ?? uid(), o.cs ?? uid(), o.item, o.help ?? 'independent', o.at ?? new Date().toISOString(), o.syn ?? false, o.task ?? 'task-a'])
  await submit(svc, { item: 'PRE-1' })
  await submit(svc, { item: 'PRE-2', syn: true })
  const preMd5 = (await admin.query(`select count(*)::int n, md5(string_agg(t::text, '|' order by id)) h from learning_task_attempts t`)).rows[0]

  // ── 승인 SQL 적용 ──
  const applyErr = await err(admin.query(SQL))
  check('PRE', `승인 SQL 적용(sha256 ${sha.slice(0, 12)}…)`, applyErr === null, applyErr)
  const postRows = (await admin.query(`select count(*)::int n, md5(string_agg((t.id, t.user_id, t.task_key, t.application_id, t.trial_id, t.synthetic, t.item_ref, t.content_hash, t.phase, t.response, t.is_correct, t.sec, t.answered_at, t.session_id, t.activity, t.help_level, t.client_mutation_id, t.received_at)::text, '|' order by id)) h, count(exposure_order_at)::int filled from learning_task_attempts t`)).rows[0]
  check('PRE', '적용 뒤 기존 시도 행 수 · 기존 열 내용 불변 · 새 열 NULL', postRows.n === preMd5.n && postRows.h === preMd5.h && postRows.filled === 0, { pre: preMd5, post: postRows })

  // ── 노출 기록 RPC 를 service_role 로(실제 Supabase 와 같이 auth.users 권한 없음) ──
  const rpcErr = await err(svc.query(`select public.learning_exposure_record($1,$2,'R0','answer_direct','reveal_api',null,null,null,null,clock_timestamp(),true)`, [U1, uid()]))
  check('RPC', 'service_role 노출 기록 RPC 동작(auth.users 권한 없이)', rpcErr === null, rpcErr)
  const fkErr = await err(svc.query(`select public.learning_exposure_record($1,$2,'R0','answer_direct','reveal_api',null,null,null,null,clock_timestamp(),true)`, ['33333333-3333-3333-3333-333333333333', uid()]))
  check('RPC', '없는 사용자 → 거부(외래 키)', /foreign key|없는 사용자/.test(fkErr ?? ''), fkErr)
  const trackGrant = (await admin.query(`select string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_name='learning_exposure_tracking' and grantee='service_role'`)).rows[0].p
  check('RPC', 'learning_exposure_tracking: service_role 은 SELECT 만', trackGrant === 'SELECT', trackGrant)

  // ── AT-P6-01 기존 시도 저장 RPC 와 새 순서 트리거 호환 ──
  const m1 = uid(), r1 = uid(), c1 = uid(), at1 = new Date().toISOString()
  const s1 = (await submit(svc, { item: 'A1', mut: m1, rev: r1, cs: c1, at: at1 })).rows[0]
  const row1 = (await admin.query(`select exposure_order_at is not null filled, help_level, activity, phase from learning_task_attempts where id=$1`, [s1.attempt_id])).rows[0]
  check('AT-P6-01', 'learning_attempt_submit 실제 RPC 저장 성공 · exposure_order_at 채움', s1.outcome === 'inserted' && row1.filled, { s1, row1 })
  const s1dup = (await submit(svc, { item: 'A1', mut: m1, rev: r1, cs: c1, at: at1 })).rows[0]
  check('AT-P6-01', '같은 요청 재전송 → duplicate · 같은 시도 id(멱등 유지)', s1dup.outcome === 'duplicate' && String(s1dup.attempt_id) === String(s1.attempt_id), s1dup)
  const conflict = await submit(svc, { item: 'A1', mut: m1, rev: r1, cs: c1, at: new Date(Date.now() + 5000).toISOString() }).then((r) => r.rows[0].outcome, (e) => 'ERR ' + e.message)
  check('AT-P6-01', '같은 요청 id · 다른 내용 → conflict(기존 동작 유지)', conflict === 'conflict' || /conflict/.test(conflict), conflict)
  const rec = (await svc.query(`select * from public.learning_attempt_record($1,$2,null,'task-b','theater','practice','independent','A1b',null,'{}'::jsonb,true,10,false,null,null,$3)`, [U1, uid(), new Date().toISOString()])).rows[0]
  check('AT-P6-01', 'learning_attempt_record(세션 없음) 직접 호출 저장 · 순서 시각 채움', rec.outcome === 'inserted' && (await admin.query(`select exposure_order_at is not null v from learning_task_attempts where id=$1`, [rec.attempt_id])).rows[0].v, rec)
  check('AT-P6-01', '시도 RPC 실행 권한 변화 없음(authenticated 실행 불가 유지)', /permission denied/.test(await (async () => { const a = await client(); await a.query('set role authenticated'); const e = await err(a.query(`select * from public.learning_attempt_record($1,$2,null,'t','theater','practice','independent','x',null,'{}'::jsonb,true,1,false)`, [U1, uid()])); await a.end(); return e })() ?? ''))

  // ── AT-P6-02 frozen 트리거 · 불변성과의 상호작용 ──
  const app = (await admin.query(`insert into knowledge_applications default values returning id`)).rows[0].id
  const trial = (await admin.query(`insert into knowledge_trials (application_id, design, status, result, analyzed_at, created_by) values ($1,'{}','analyzed','supported',now(),'test') returning id`, [app])).rows[0].id
  const frozenErr = await err(svc.query(`insert into learning_task_attempts (user_id, task_key, phase, item_ref, trial_id) values ($1,'t','practice','F1',$2)`, [U1, trial]))
  check('AT-P6-02', '분석 완료 표본에 시도 추가 → frozen 트리거가 여전히 거부', /분석 완료된 검증의 표본/.test(frozenErr ?? ''), frozenErr)
  const other = await client(); await other.query('set role service_role')
  const t2 = Date.now(); await other.query(`select pg_advisory_xact_lock(hashtextextended($1 || '|' || 'F1', 0))`, [U1]); const w2 = Date.now() - t2
  check('AT-P6-02', '거부된 트랜잭션은 (사용자·문항) 잠금을 남기지 않음', w2 < 200, { waitedMs: w2 })
  check('AT-P6-02', '실학습자 시도 UPDATE 여전히 거부(update_guard)', /고칠 수 없다/.test(await err(admin.query(`update learning_task_attempts set sec=1 where id=$1`, [s1.attempt_id])) ?? ''))
  check('AT-P6-02', '실학습자 시도 DELETE 여전히 거부(delete_guard)', /지울 수 없다/.test(await err(admin.query(`delete from learning_task_attempts where id=$1`, [s1.attempt_id])) ?? ''))
  const synId = (await admin.query(`select id from learning_task_attempts where item_ref='PRE-2'`)).rows[0].id
  check('AT-P6-02', '합성 시도의 exposure_order_at 은 INSERT 트리거만 채움(UPDATE 경로 무관)', (await err(admin.query(`update learning_task_attempts set sec=2 where id=$1`, [synId]))) === null)
  check('AT-P6-02', '노출 원장 UPDATE 거부(append-only)', /permission denied|고칠 수 없다/.test(await err(svc.query(`update learning_exposures set cue_id='x'`)) ?? 'none'))

  // ── AT-P6-03 실제 learning_first_attempts 뷰 · 동시성 K1 판정 정합성 ──
  const A = await client(); await A.query('set role service_role')
  const B = await client(); await B.query('set role service_role')
  const expo = (c, item) => c.query(`select public.learning_exposure_record($1,$2,$3,'answer_direct','lecture_continue',3,2,$4,'c5',clock_timestamp(),false) id`, [U1, uid(), item, 'a'.repeat(64)])
  const ind = async (id) => (await admin.query(`select public.learning_attempt_independence($1) v`, [id])).rows[0].v
  // K1: 시도 트랜잭션 먼저 시작 → 노출 먼저 커밋 → 실제 RPC 로 시도 저장
  await A.query('begin'); await A.query('select now()'); await sleep(150)
  await expo(B, 'K1')
  const k1 = (await submit(A, { item: 'K1', at: new Date().toISOString() })).rows[0]
  await A.query('commit')
  const k1v = await ind(k1.attempt_id)
  check('AT-P6-03', 'K1(실제 RPC · 실제 뷰): 노출이 먼저 커밋 → after_exposure', k1v === 'after_exposure', k1v)
  // 대조: 노출 없는 첫 시도 → independent_candidate (실제 뷰 판정 통과)
  const c0 = (await submit(svc, { item: 'K0', at: new Date(Date.now() - 1000).toISOString() })).rows[0]
  const c0v = await ind(c0.attempt_id)
  check('AT-P6-03', '대조: 노출 없는 FIND/CHECK 첫 시도 → independent_candidate', c0v === 'independent_candidate', c0v)
  // K2: 시도 RPC 미커밋 중 노출 → 대기 · 시도는 후보 유지
  await A.query('begin')
  const k2 = (await submit(A, { item: 'K2', at: new Date().toISOString() })).rows[0]
  let doneAt = 0; const t0 = Date.now()
  const pending = expo(B, 'K2').then((r) => { doneAt = Date.now(); return r })
  await sleep(400); const early = doneAt !== 0
  await A.query('commit'); await pending
  const k2v = await ind(k2.attempt_id)
  check('AT-P6-03', 'K2(실제 RPC): 노출이 시도 커밋까지 대기 · 시도는 independent_candidate', !early && doneAt - t0 >= 350 && k2v === 'independent_candidate', { waited: doneAt - t0, early, k2v })
  // 뷰 판정(도움)과의 정합: viewed_first 로 공개된 세션의 시도 → helped
  const h = (await submit(svc, { item: 'K3', help: 'viewed_first', at: new Date().toISOString() })).rows[0]
  check('AT-P6-03', '실제 뷰가 viewed_first 로 보는 시도 → helped', (await ind(h.attempt_id)) === 'helped')
  // 추적 이전 행
  const preId = (await admin.query(`select id from learning_task_attempts where item_ref='PRE-1'`)).rows[0].id
  check('AT-P6-03', '적용 전 기존 시도 → legacy_unknown', (await ind(preId)) === 'legacy_unknown')

  for (const c of [A, B, svc, other, admin]) await c.end()
} catch (e) {
  check('RUN', '실행 오류', false, String(e.message ?? e))
} finally {
  try { execFileSync(PG_CTL, ['stop', '-D', dataDir, '-m', 'fast', '-w'], { stdio: 'ignore' }) } catch {}
}
fs.writeFileSync(outFile, JSON.stringify({ sql: path.basename(sqlFile), sha256: sha, results }, null, 1))
const failed = results.filter((r) => !r.pass)
console.log(`${results.length - failed.length}/${results.length} pass`)
process.exit(failed.length ? 1 : 0)
