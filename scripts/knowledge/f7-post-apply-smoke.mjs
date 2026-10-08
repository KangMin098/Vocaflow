// scripts/knowledge/f7-post-apply-smoke.mjs
//
// F7(20261008190000_learning_records_append_only) 적용 **뒤** 실제 개발 DB 독립 smoke(methodology · 2026-10-09).
// 한 트랜잭션 안에서만 쓰고 끝에 반드시 ROLLBACK — 행이 남지 않는다. F7 미적용이면 exit 2.
//   node --tls-max-v1.2 --env-file=<.env.local> scripts/knowledge/f7-post-apply-smoke.mjs
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
  const ver = (await q(`select version from supabase_migrations.schema_migrations where name = 'learning_records_append_only'`)).map((r) => r.version)
  if (!ver.length) { console.log('F7 미적용 — 아무것도 하지 않았다.'); process.exitCode = 2 }
  else {
    rec('원장 버전 = 20261008190000(적용 시각 버전 아님)', ver.length === 1 && ver[0] === '20261008190000', ver)
    const before = await counts()
    await c.query('begin')
    const U = uuid(), T = uuid()
    await c.query('insert into auth.users (id) values ($1), ($2)', [U, T])
    await q(`select * from public.learning_attempt_record($1,$2,null,'smoke','practice','pre','independent','smoke-f7','h','{}',false,5,false,null,null,now() - interval '1 minute')`, [U, uuid()])
    rec('실제 시도 is_correct 수정 거부', !!(await err('update public.learning_task_attempts set is_correct = true where user_id = $1', [U])))
    rec('실제 시도 user_id 이동 거부', !!(await err('update public.learning_task_attempts set user_id = $1 where user_id = $2', [T, U])))
    rec('실제 시도 단건 DELETE 거부(계정 살아 있음)', !!(await err('delete from public.learning_task_attempts where user_id = $1', [U])))
    rec('원장 UPDATE 거부', !!(await err(`update public.learning_mutations set payload = '{}'::jsonb where user_id = $1`, [U])))
    const tr = (await q(`select has_table_privilege('service_role', 'public.learning_mutations', 'TRUNCATE') m, has_table_privilege('service_role', 'public.learning_task_attempts', 'TRUNCATE') a, has_table_privilege('service_role', 'public.learning_sessions', 'TRUNCATE') s`))[0]
    rec('service_role TRUNCATE 권한 없음(3표)', !tr.m && !tr.a && !tr.s, tr)
    rec('계정 삭제 cascade 허용(실제 기록 포함)', !(await err('delete from auth.users where id = $1', [U])))
    rec('knowledge_trials.review_required_at 열 있음', (await q(`select count(*)::int n from information_schema.columns where table_name = 'knowledge_trials' and column_name = 'review_required_at'`))[0].n === 1)
    await c.query('rollback')
    const after = await counts()
    rec('롤백 뒤 세션 · 시도 · 원장 · 검토 · 검증 · 켜진 적용 수가 시작과 같다', JSON.stringify(after) === JSON.stringify(before), { before, after })
  }
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await c.query('rollback').catch(() => {})
  await c.end()
}
if (process.exitCode !== 2) { console.log(fail ? `실패 ${fail}` : '모든 단언 통과'); if (fail) process.exitCode = 1 }
