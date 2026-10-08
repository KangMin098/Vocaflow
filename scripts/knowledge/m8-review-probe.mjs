// scripts/knowledge/m8-review-probe.mjs — M8 독립 검토 probe(methodology · 2026-10-08) — 실제 원장 순서 150000 → 160000 → 170000 → M8 로 격리 PG 에 올리고 사용자 요구 5가지를 단언한다.
//   node scripts/knowledge/m8-review-probe.mjs <M8 후보가 있는 저장소 경로(예: feat/csat-g2-integration 워크트리)>
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = process.argv[2]
const PG_DIR = 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + JSON.stringify(detail).slice(0, 200) : ''}`) }
const uuid = () => crypto.randomUUID()
const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2'

const cluster = await startCluster()
try {
  const su = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
  await su.connect()
  await su.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await su.query('alter role postgres set search_path = public, extensions')
  await su.query(`insert into auth.users (id) values ('${A}'), ('${B}')`)
  await su.end()
  const pool = conn('postgres', 'postgres')
  const q = async (sql, params = []) => { const c = await pool.connect(); try { return await c.query(sql, params) } finally { c.release() } }
  const err = async (sql, params = []) => { try { await q(sql, params); return null } catch (e) { return e.message } }
  for (const f of ['20260919120000_methodology_intelligence.sql', '20260928120000_knowledge_registry.sql', '20260928130000_knowledge_evidence_invariants.sql',
    '20260928140000_knowledge_evidence_concurrency.sql', '20260928150000_knowledge_regrade_locks_items.sql', '20261001120000_knowledge_evidence_version.sql',
    '20261001130000_knowledge_evidence_observed.sql', '20261008120000_knowledge_vnext.sql', '20261008140000_knowledge_review_cascade_guard.sql',
    '20261008150000_knowledge_statement_review_fix.sql']) await q(M(f))
  await q('delete from funnel_events')
  await q(M('20261008160000_learning_sessions_integrated.sql'))
  const f170 = fs.existsSync(path.join(REPO, 'supabase/migrations/20261008170000_knowledge_trial_evidence_guard.sql')) ? '20261008170000_knowledge_trial_evidence_guard.sql' : '_pending_20261008170000_knowledge_trial_evidence_guard.sql'
  await q(M(f170))
  const m8err = await err(M('_pending_20261008180000_learning_help_timing.sql'))
  rec('실제 순서 160000 → 170000 → M8 적용', !m8err, m8err ?? '')
  const trg = (await q(`select tgname, tgrelid::regclass::text rel from pg_trigger where not tgisinternal and tgrelid in ('learning_sessions'::regclass, 'learning_task_attempts'::regclass, 'knowledge_trials'::regclass) order by 1`)).rows
  rec('트리거 중복 없음(이름 유일)', new Set(trg.map((t) => t.tgname)).size === trg.length, trg.map((t) => t.tgname))

  // 사슬 · 적용 · 검증(min_n 1)
  const it = (await q(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('practice','task','g2p','g2p','s','in_review','t','t') returning id`)).rows[0].id
  await q(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'B','stated','external','https://e.x/g2p','t','t')`, [it])
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [it])
  const app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task','g2p','t','t') returning id`, [it])).rows[0].id
  const trial = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [app])).rows[0].id
  const sess = async (user, phase, synthetic, item = 'x1', help = 'independent', at = '2026-10-05T09:00:00Z') =>
    (await q(`select * from learning_session_apply($1,$2,$3,'practice',$4,$5,'revealed',0,1,$6,$7,null,false,$8,'g2p',null,$9,null)`, [user, uuid(), uuid(), phase, item, help, at, synthetic, trial])).rows[0].session_id
  const att = (user, sid, synthetic, mut = uuid(), at = '2026-10-05T09:10:00Z') =>
    q(`select * from learning_attempt_record($1,$2,$3,'g2p',null,null,null,null,'h','{}',true,10,$4,null,$5,$6)`, [user, mut, sid, synthetic, trial, at])

  // R1 세션 synthetic 변경 차단(분석 전에도)
  const s1 = await sess(A, 'pre', false)
  rec('R1 세션 synthetic 변경 거부(분석 전)', /합성|synthetic/.test(await err('update learning_sessions set synthetic = true where id = $1', [s1]) ?? ''))
  // R2 시도 · 세션 synthetic 불일치 기록 거부
  rec('R2 실제 세션에 합성 시도 기록 거부', /contradicts/.test(await err(`select * from learning_attempt_record($1,$2,$3,'g2p',null,null,null,null,'h','{}',true,10,true,null,$4,'2026-10-05T09:10:00Z')`, [A, uuid(), s1, trial]) ?? ''))
  // R3 오염 행 집계 제외 — 합성 세션의 시도를 synthetic=false 로 덮어도 뷰는 합성
  const sSyn = await sess(B, 'pre', true, 'x9')
  await att(B, sSyn, true)
  await q('update learning_task_attempts set synthetic = false where session_id = $1', [sSyn])
  rec('R3 합성 세션 오염 행 → 뷰 합성', (await q('select bool_and(synthetic) b from learning_first_attempts where session_id = $1', [sSyn])).rows[0].b === true)
  // R3′ 세션 없는 합성 시도를 synthetic=false 로 뒤집으면 실제 표본이 되는가(세션 불변만으로는 못 막는 길)
  await q(`select * from learning_attempt_record($1,$2,null,'g2p','practice','pre','independent','x5','h','{}',true,10,true,null,$3,'2026-10-05T09:10:00Z')`, [B, uuid(), trial])
  const flip = await err(`update learning_task_attempts set synthetic = false where user_id = $1 and session_id is null`, [B])
  rec('R3′ 세션 없는 합성 시도의 synthetic 뒤집기 거부', /합성|synthetic/.test(flip ?? ''), flip ?? '허용됨 — 분석 전 시도 synthetic 은 바꿀 수 있다')
  // R4 재전송 · 동시 멱등
  const mut = uuid()
  const first = (await att(A, s1, false, mut)).rows[0].outcome
  const again = (await att(A, s1, false, mut)).rows[0].outcome
  const pa = conn('postgres', 'postgres'), pb = conn('postgres', 'postgres')
  const m2 = uuid()
  const s2 = await sess(A, 'post', false)
  const call = (p) => p.query(`select * from learning_attempt_record($1,$2,$3,'g2p',null,null,null,null,'h','{}',true,10,false,null,$4,'2026-10-05T09:20:00Z')`, [A, m2, s2, trial]).then((r) => r.rows[0].outcome)
  const outs = (await Promise.all([call(pa), call(pb)])).sort()
  await pa.end(); await pb.end()
  rec('R4 재전송 duplicate · 동시 2건 inserted 1 + duplicate 1', first === 'inserted' && again === 'duplicate' && JSON.stringify(outs) === JSON.stringify(['duplicate', 'inserted']), { first, again, outs })
  // R5 최소 표본 우회 불가 — 합성만으로는 analyzed 거부, 실제 독립 사전 · 사후면 허용
  const t2app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task','g2p2','t','t') returning id`, [it])).rows[0].id
  const t2 = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [t2app])).rows[0].id
  for (const phase of ['pre', 'post']) {
    const sid = (await q(`select * from learning_session_apply($1,$2,$3,'practice',$4,'y1','revealed',0,1,'independent','2026-10-05T09:00:00Z',null,false,true,'g2p',null,$5,null)`, [B, uuid(), uuid(), phase, t2])).rows[0].session_id
    await q(`select * from learning_attempt_record($1,$2,$3,'g2p',null,null,null,null,'h','{}',true,10,true,null,$4,'2026-10-05T09:10:00Z')`, [B, uuid(), sid, t2])
  }
  rec('R5 합성 세션만으로 analyzed 거부', !!(await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [t2])))
  // R3″ 그 구멍의 결과 — 세션 없는 합성 사전 · 사후 시도를 뒤집으면 실제 효과 판정이 통과하는가
  const t3app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task','g2p3','t','t') returning id`, [it])).rows[0].id
  const t3 = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [t3app])).rows[0].id
  const U3 = '00000000-0000-4000-8000-0000000000a1'
  for (const phase of ['pre', 'post']) await q(`select * from learning_attempt_record($1,$2,null,'g2p','practice',$3,'independent','z1','h','{}',true,10,true,null,$4,'2026-10-05T09:10:00Z')`, [U3, uuid(), phase, t3])
  const before = await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [t3])
  await q('update learning_task_attempts set synthetic = false where trial_id = $1', [t3])
  const after = await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [t3])
  rec('R3″ 합성 시도 뒤집기로 실제 효과 판정 통과 불가', !!after, { 뒤집기전: before ? '거부' : '허용', 뒤집은뒤: after ? '거부' : '허용(우회됨)' })
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await cluster.stop()
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
process.exitCode = fail ? 1 : 0
