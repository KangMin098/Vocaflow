// scripts/knowledge/m8-post-apply-smoke.mjs
//
// M8 적용 **뒤** 실제 개발 DB 독립 smoke(methodology · 2026-10-08 준비). 한 트랜잭션 안에서만 쓰고 끝에 반드시 ROLLBACK 한다 — 행이 남지 않는다.
// M8 이 아직 적용되지 않았으면(learning_sessions.help_received_at 없음) 아무것도 하지 않고 exit 2.
// 확인: 원장에 M8 기록 · 새 열 · 뷰 timing_uncertain · 세션 synthetic 양방향 불변 · 시도 synthetic 양방향 불변(세션 있음 · 없음) ·
//       합성 불일치 기록 거부 · 정상 기록 inserted → 재전송 duplicate · 롤백 뒤 세션 · 시도 · 원장 · 검토 이력 · 검증 · 켜진 적용 수가 시작과 같다.
//   node --tls-max-v1.2 --env-file=<.env.local> scripts/knowledge/m8-post-apply-smoke.mjs
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const { Client } = createRequire(path.join('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/node_modules', 'x.js'))('pg')
const url = process.env.SUPABASE_DB_URL
if (!url?.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { ca: fs.readFileSync('D:/workspace/Vocaflow-ec-reveal/tmp/reveal-db-deployment/supabase-ca.crt', 'utf8'), rejectUnauthorized: true } })
await c.connect()
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + JSON.stringify(detail).slice(0, 200) : ''}`) }
const q = async (s, p) => (await c.query(s, p)).rows
const err = async (s, p) => { await c.query('savepoint s'); try { await c.query(s, p); await c.query('release savepoint s'); return null } catch (e) { await c.query('rollback to savepoint s'); return e.message } }
const uuid = () => crypto.randomUUID()
const counts = async () => (await q(`select (select count(*)::int from public.learning_sessions) s, (select count(*)::int from public.learning_task_attempts) a, (select count(*)::int from public.learning_mutations) m, (select count(*)::int from public.knowledge_reviews) reviews, (select count(*)::int from public.knowledge_trials) trials, (select count(*)::int from public.knowledge_applications where status = 'active') active_apps`))[0]

try {
  const has = (await q(`select count(*)::int n from information_schema.columns where table_schema='public' and table_name='learning_sessions' and column_name='help_received_at'`))[0].n
  if (!has) { console.log('M8 미적용 — help_received_at 없음. 아무것도 하지 않았다.'); process.exitCode = 2 }
  else {
    const before = await counts()
    rec('원장에 20261008180000 기록', (await q(`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261008180000'`))[0].n === 1)
    rec('뷰 learning_first_attempts 에 timing_uncertain 열', (await q(`select count(*)::int n from information_schema.columns where table_name='learning_first_attempts' and column_name='timing_uncertain'`))[0].n === 1)
    await c.query('begin')
    const U = uuid()
    await c.query(`insert into auth.users (id) values ($1)`, [U])
    const apply = (synthetic, item) => q(`select * from public.learning_session_apply($1,$2,$3,'practice','pre',$4,'revealed',0,1,'independent',now(),null,false,$5,'smoke',null,null,null)`, [U, uuid(), uuid(), item, synthetic])
    const real = (await apply(false, 'smoke-1'))[0].session_id
    const syn = (await apply(true, 'smoke-2'))[0].session_id
    rec('세션 synthetic false → true 거부', !!(await err('update public.learning_sessions set synthetic = true where id = $1', [real])))
    rec('세션 synthetic true → false 거부', !!(await err('update public.learning_sessions set synthetic = false where id = $1', [syn])))
    const mut = uuid()
    const rec1 = (sid, synthetic, m = uuid()) => q(`select * from public.learning_attempt_record($1,$2,$3,'smoke',null,null,null,null,'h','{}',true,5,$4,null,null,now() - interval '1 minute')`, [U, m, sid, synthetic])
    const first = (await rec1(real, false, mut))[0].outcome
    rec('정상 기록 inserted', first === 'inserted', first)
    rec('합성 불일치 기록 거부', /contradicts/.test(await err(`select * from public.learning_attempt_record($1,$2,$3,'smoke',null,null,null,null,'h','{}',true,5,true,null,null,now())`, [U, uuid(), real]) ?? ''))
    await rec1(syn, true)
    await q(`select * from public.learning_attempt_record($1,$2,null,'smoke','practice','pre','independent','smoke-3','h','{}',true,5,true,null,null,now() - interval '1 minute')`, [U, uuid()])
    rec('시도 synthetic false → true 거부(세션 있음)', !!(await err('update public.learning_task_attempts set synthetic = true where session_id = $1', [real])))
    rec('시도 synthetic true → false 거부(세션 있음)', !!(await err('update public.learning_task_attempts set synthetic = false where session_id = $1', [syn])))
    rec('시도 synthetic true → false 거부(세션 없음)', !!(await err(`update public.learning_task_attempts set synthetic = false where user_id = $1 and session_id is null`, [U])))
    rec('같은 mutation 재전송 duplicate', (await rec1(real, false, mut))[0].outcome === 'duplicate')
    await c.query('rollback')
    const after = await counts()
    rec('롤백 뒤 세션 · 시도 · 원장 행 수가 시작과 같다', JSON.stringify(after) === JSON.stringify(before), { before, after })
  }
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await c.query('rollback').catch(() => {})
  await c.end()
}
if (process.exitCode !== 2) { console.log(fail ? `실패 ${fail}` : '모든 단언 통과'); if (fail) process.exitCode = 1 }
