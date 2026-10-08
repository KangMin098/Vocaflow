// scripts/knowledge/m8-clock-probe.mjs — M8 두 기기 시계 반례 재현(methodology · 2026-10-08 · Codex 정적 P1)
//   도움 기기: 실제 10:00 노출 · 서버 도착 10:02(그 기기 시계는 정확 → help_received_at 10:00)
//   판단 기기: 실제 10:01 판단 · 기기 시계 10분 늦음 → answered_at 09:51 · 서버 도착 10:01
//   실제로는 도움 뒤 판단이다. 기대: independent 로 확정하지 않는다(timing_uncertain = true 이거나 실효 도움 ≠ independent)
//   --fix: 수정안 — 세션에 도움이 있고, 판단의 「서버 수신 − 기기 판단 시각」이 2분을 넘으면(판단 기기 시계가 늦거나 오프라인) 보류
//   node scripts/knowledge/m8-clock-probe.mjs <M8 후보가 있는 저장소> [--fix]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = process.argv[2]
const FIX = process.argv.includes('--fix')
const PG_DIR = 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
// M8 파일 이름 — 적용 뒤에는 _pending_ 이 빠진다
const M8F = fs.existsSync(path.join(REPO, 'supabase/migrations/20261008180000_learning_help_timing.sql')) ? '20261008180000_learning_help_timing.sql' : '_pending_20261008180000_learning_help_timing.sql'
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`) }
const uuid = () => crypto.randomUUID()
const U = '00000000-0000-4000-8000-0000000000f1'

const cluster = await startCluster()
let pool = null
try {
  const su = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
  await su.connect()
  await su.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await su.query('alter role postgres set search_path = public, extensions')
  await su.query(`insert into auth.users (id) values ('${U}')`)
  await su.end()
  pool = conn('postgres', 'postgres')
  pool.on('error', () => {})
  const q = async (sql, params = []) => { const c = await pool.connect(); try { return await c.query(sql, params) } finally { c.release() } }
  for (const f of ['20260919120000_methodology_intelligence.sql', '20260928120000_knowledge_registry.sql', '20260928130000_knowledge_evidence_invariants.sql',
    '20260928140000_knowledge_evidence_concurrency.sql', '20260928150000_knowledge_regrade_locks_items.sql', '20261001120000_knowledge_evidence_version.sql',
    '20261001130000_knowledge_evidence_observed.sql', '20261008120000_knowledge_vnext.sql', '20261008140000_knowledge_review_cascade_guard.sql',
    '20261008150000_knowledge_statement_review_fix.sql']) await q(M(f))
  await q('delete from funnel_events')
  await q(M('20261008160000_learning_sessions_integrated.sql'))
  const f170 = fs.existsSync(path.join(REPO, 'supabase/migrations/20261008170000_knowledge_trial_evidence_guard.sql')) ? '20261008170000_knowledge_trial_evidence_guard.sql' : '_pending_20261008170000_knowledge_trial_evidence_guard.sql'
  await q(M(f170))
  await q(M(M8F))
  console.log(`M8 sha256 ${crypto.createHash('sha256').update(M(M8F)).digest('hex')}`)
  if (FIX) {
    // 뷰 정의를 읽어 timing_uncertain 식에 조건 하나를 더한다(열 순서 · 이름 그대로)
    const def = (await q(`select pg_get_viewdef('public.learning_first_attempts'::regclass, true) d`)).rows[0].d
    const marker = 'AS timing_uncertain'
    if (!def.includes(marker)) throw new Error('뷰에 timing_uncertain 없음')
    const fixed = def.replace('AS timing_uncertain', () => "OR (s.help_received_at IS NOT NULL AND a.received_at IS NOT NULL AND (a.received_at - a.answered_at) > '00:02:00'::interval) AS timing_uncertain")  // pg_get_viewdef 는 바깥 괄호 없이 OR 를 잇는다
    await q(`create or replace view public.learning_first_attempts with (security_invoker = true) as ${fixed}`)
    console.log('· --fix 적용: 도움 있는 세션에서 판단의 서버 수신 − 기기 시각 > 2분이면 보류')
  }

  // 같은 세션을 두 기기가 공유한다
  const cs = uuid()
  // 판단 기기가 먼저 세션을 열고(독립 공개) 판단을 기록 — 서버 도착은 10:01 이지만 기기 시각 09:51
  const sid = (await q(`select * from learning_session_apply($1,$2,$3,'practice','pre','clock-1','revealed',0,1,'independent','2026-10-08T09:51:00Z',null,false,false,'clk',null,null,null)`, [U, uuid(), cs])).rows[0].session_id
  const mutJ = uuid()
  await q(`select * from learning_attempt_record($1,$2,$3,'clk',null,null,null,null,'h','{}',true,5,false,null,null,'2026-10-08T09:51:00Z')`, [U, mutJ, sid])
  const ru = await q(`update learning_task_attempts set received_at = '2026-10-08T10:01:00Z' where client_mutation_id = $1`, [mutJ]).then((r) => r.rowCount, (e) => e.message)
  console.log('received_at 갱신', ru)
  // 도움 기기: 10:00 에 해설 먼저(기기 시계 정확) · 서버 도착 10:02
  await q(`select * from learning_session_apply($1,$2,$3,'practice','pre','clock-1','revealed',0,1,'viewed_first','2026-10-08T10:00:00Z',null,false,false,'clk',null,null,null)`, [U, uuid(), cs])
  await q(`update learning_sessions set help_server_at = '2026-10-08T10:02:00Z' where id = $1`, [sid]).catch(() => {})
  const s = (await q('select help_level, help_received_at, help_server_at, help_clock_suspect from learning_sessions where id = $1', [sid])).rows[0]
  const f = (await q('select f.help_level, f.timing_uncertain, a.answered_at, a.received_at from learning_first_attempts f join learning_task_attempts a on a.id = f.attempt_id where f.session_id = $1', [sid])).rows[0]
  rec(`${FIX ? '수정안' : '현재'} — 시계 반례 판단을 independent 로 확정하지 않는다`, !!f && (f.timing_uncertain === true || f.help_level !== 'independent'), { 세션: s, 첫시도: f })
  // 대조: 시계가 정상인 독립 판단(도움 전 · 지연 없음)은 그대로 independent · 확정
  const cs2 = uuid()
  const sid2 = (await q(`select * from learning_session_apply($1,$2,$3,'practice','pre','clock-2','revealed',0,1,'independent','2026-10-08T09:59:00Z',null,false,false,'clk',null,null,null)`, [U, uuid(), cs2])).rows[0].session_id
  const mut2 = uuid()
  await q(`select * from learning_attempt_record($1,$2,$3,'clk',null,null,null,null,'h','{}',true,5,false,null,null,'2026-10-08T09:59:30Z')`, [U, mut2, sid2])
  await q(`update learning_task_attempts set received_at = '2026-10-08T09:59:35Z' where client_mutation_id = $1`, [mut2])
  await q(`select * from learning_session_apply($1,$2,$3,'practice','pre','clock-2','revealed',0,1,'viewed_first','2026-10-08T10:10:00Z',null,false,false,'clk',null,null,null)`, [U, uuid(), cs2])
  const f2 = (await q('select help_level, timing_uncertain from learning_first_attempts where session_id = $1', [sid2])).rows[0]
  rec(`${FIX ? '수정안' : '현재'} — 대조: 시계 정상 · 도움 전 판단은 independent 확정(과잉 보류 없음)`, !!f2 && f2.help_level === 'independent' && f2.timing_uncertain === false, f2)
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await pool?.end().catch(() => {})
  await cluster.stop()
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
process.exitCode = fail ? 1 : 0
