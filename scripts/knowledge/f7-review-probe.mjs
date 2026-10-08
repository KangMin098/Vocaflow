// scripts/knowledge/f7-review-probe.mjs — F7(요청 원장 · 기록 추가 전용) 독립 검토 probe(methodology · 2026-10-08)
//   실제 원장 순서 …150000 → 160000 → 170000 → M8 → F7 을 격리 PG 에 올리고, f5 하네스가 다루지 않는 경로를 본다:
//   ① 실제 학습자 계정 삭제(auth.users ON DELETE CASCADE)가 F7 트리거에 막히는가
//   ② 합성 원장 행만 지운 뒤 같은 mutation 재전송이 어떻게 되는가(합성 데이터 안에서만 영향)
//   ③ 합성 · 실제가 섞인 계정 삭제
//   node scripts/knowledge/f7-review-probe.mjs <F7 후보가 있는 저장소 경로>
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = process.argv[2]
const PG_DIR = 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
// M8 파일 이름 — 적용 뒤에는 _pending_ 이 빠진다
const M8F = fs.existsSync(path.join(REPO, 'supabase/migrations/20261008180000_learning_help_timing.sql')) ? '20261008180000_learning_help_timing.sql' : '_pending_20261008180000_learning_help_timing.sql'
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + JSON.stringify(detail).slice(0, 220) : ''}`) }
const uuid = () => crypto.randomUUID()
const R = '00000000-0000-4000-8000-0000000000e1', S = '00000000-0000-4000-8000-0000000000e2', X = '00000000-0000-4000-8000-0000000000e3'

const cluster = await startCluster()
let pool = null
let su = null
try {
  su = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
  await su.connect()
  await su.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await su.query('alter role postgres set search_path = public, extensions')
  await su.query(`insert into auth.users (id) values ('${R}'), ('${S}'), ('${X}')`)
  pool = conn('postgres', 'postgres')
  pool.on('error', () => {})
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
  await q(M(M8F))
  const f7err = await err(M('_pending_20261008190000_learning_records_append_only.sql'))
  rec('실제 순서 … → M8 → F7 적용', !f7err, f7err ?? '')
  // --fix: 수정안 — 계정(auth.users) 삭제에 따른 cascade 만 허용(부모 행이 이미 없으면 통과). 일반 DELETE 는 그대로 막는다
  if (process.argv.includes('--fix')) {
    await su.query(`create or replace function public.learning_records_delete_guard() returns trigger
language plpgsql set search_path = public as $f$
begin
  if not exists (select 1 from auth.users u where u.id = old.user_id) then return old; end if;  -- 계정 삭제 cascade
  if not old.synthetic then raise exception '실제 학습자 기록은 지울 수 없다 — 합성 기록만 정리할 수 있다'; end if;
  if tg_table_name = 'learning_task_attempts' and exists (select 1 from public.knowledge_trials t where t.id = old.trial_id and t.status = 'analyzed' and not t.synthetic) then
    raise exception '분석 완료된 검증의 표본은 지울 수 없다'; end if;
  return old;
end $f$`)
    await su.query(`create or replace function public.learning_mutations_append_only() returns trigger
language plpgsql set search_path = public as $f$
begin
  if tg_op = 'UPDATE' then raise exception '요청 원장은 고칠 수 없다(추가 전용)'; end if;
  if not exists (select 1 from auth.users u where u.id = old.user_id) then return old; end if;  -- 계정 삭제 cascade
  if not coalesce((old.payload->>'synthetic')::boolean, false) then raise exception '실제 학습자의 요청 원장은 지울 수 없다 — 합성 기록만 정리할 수 있다'; end if;
  return old;
end $f$`)
    console.log('· --fix 적용: 계정 삭제 cascade 만 허용')
  }

  const record = async (user, synthetic, item) => {
    const sid = (await q(`select * from learning_session_apply($1,$2,$3,'practice','pre',$4,'revealed',0,1,'independent',now(),null,false,$5,'f7p',null,null,null)`, [user, uuid(), uuid(), item, synthetic])).rows[0].session_id
    const mut = uuid()
    await q(`select * from learning_attempt_record($1,$2,$3,'f7p',null,null,null,null,'h','{}',true,5,$4,null,null,now() - interval '1 minute')`, [user, mut, sid, synthetic])
    return { sid, mut }
  }
  await record(R, false, 'r1')
  const syn = await record(S, true, 's1')
  await record(X, false, 'x1'); await record(X, true, 'x2')

  // ① 실제 학습자 계정 삭제(supabase_admin = auth.admin.deleteUser 와 같은 cascade 경로)
  let e1 = null
  try { await su.query(`delete from auth.users where id = '${R}'`) } catch (e) { e1 = e.message }
  const left = (await q(`select (select count(*)::int from learning_sessions where user_id = $1) s, (select count(*)::int from learning_task_attempts where user_id = $1) a, (select count(*)::int from learning_mutations where user_id = $1) m`, [R])).rows[0]
  rec('① 실제 기록이 있는 학습자 계정 삭제(cascade)', !e1, { 오류: e1, 남은행: left })
  // ③ 합성 · 실제가 섞인 계정
  let e3 = null
  try { await su.query(`delete from auth.users where id = '${X}'`) } catch (e) { e3 = e.message }
  rec('③ 합성 · 실제가 섞인 계정 삭제(cascade)', !e3, e3 ?? '')
  // 합성만 있는 계정은 지워져야 한다(테스트 계정 정리)
  let e4 = null
  try { await su.query(`delete from auth.users where id = '${S}'`) } catch (e) { e4 = e.message }
  rec('합성 기록만 있는 테스트 계정 삭제(cascade)', !e4, e4 ?? '')
  // ② 합성 원장만 지운 뒤 재전송 — 새 S2 계정으로
  const S2 = '00000000-0000-4000-8000-0000000000e4'
  await su.query(`insert into auth.users (id) values ('${S2}')`)
  const s2 = await record(S2, true, 's2')
  const del = await err(`delete from learning_mutations where user_id = $1 and client_mutation_id = $2`, [S2, s2.mut])
  const replay = del ? null : await q(`select * from learning_attempt_record($1,$2,$3,'f7p',null,null,null,null,'h','{}',true,5,true,null,null,now() - interval '1 minute')`, [S2, s2.mut, s2.sid]).then((r) => r.rows[0].outcome, (e) => `오류: ${e.message.slice(0, 80)}`)
  const n = (await q('select count(*)::int n from learning_task_attempts where user_id = $1', [S2])).rows[0].n
  // 원장만 지우면 재전송은 duplicate 가 아니라 시도 표 unique 충돌 오류가 된다 — 중복 행은 생기지 않지만 정리 순서(시도 → 세션 → 원장)를 지켜야 한다
  rec('② 합성 원장만 지우고 재전송 → 중복 행 없음(unique 충돌로 막힘)', n === 1 && typeof replay === 'string' && replay.startsWith('오류'), { 원장삭제: del ?? '허용', 재전송: replay, 시도행: n })
  if (process.argv.includes('--fix')) {
    const T = '00000000-0000-4000-8000-0000000000e5'
    await su.query(`insert into auth.users (id) values ('${T}')`)
    await record(T, false, 't1')
    rec('수정안 — 계정이 살아 있으면 실제 기록 DELETE 는 여전히 거부', !!(await err('delete from learning_task_attempts where user_id = $1', [T])) && !!(await err('delete from learning_mutations where user_id = $1', [T])))
  }
  // ④ Codex P1 — 실제 세션에 p_synthetic=true 로 변경을 보내면 「합성」 원장이 생기고, 그 원장을 지운 뒤 같은 id 로 다른 내용을 보내면 실제 세션에 다시 적용되는가
  const U4 = '00000000-0000-4000-8000-0000000000e6'
  await su.query(`insert into auth.users (id) values ('${U4}')`)
  const cs4 = uuid(), m4 = uuid()
  await q(`select * from learning_session_apply($1,$2,$3,'practice','pre','u4','open',0,1,null,now(),null,false,false,'f7p',null,null,null)`, [U4, uuid(), cs4])
  const o1 = await q(`select * from learning_session_apply($1,$2,$3,'practice','pre','u4','revealed',0,1,'independent',now(),null,false,true,'f7p',null,null,null)`, [U4, m4, cs4]).then((r) => r.rows[0].outcome, (e) => 'err: ' + e.message.slice(0, 60))
  const sesSyn = (await q('select synthetic, help_level from learning_sessions where user_id = $1', [U4])).rows[0]
  const d4 = await err('delete from learning_mutations where user_id = $1 and client_mutation_id = $2', [U4, m4])
  const o2 = d4 ? null : await q(`select * from learning_session_apply($1,$2,$3,'practice','pre','u4','revealed',0,1,'viewed_first',now(),null,false,false,'f7p',null,null,null)`, [U4, m4, cs4]).then((r) => r.rows[0].outcome, (e) => 'err: ' + e.message.slice(0, 60))
  const after4 = (await q('select help_level from learning_sessions where user_id = $1', [U4])).rows[0]
  // 가장 강한 결과는 첫 변경부터 거부되는 것(합성 표시 불일치) — 그러면 합성 원장이 생기지 않는다
  rec('④ 실제 세션에 합성 표시 변경 → 그 원장 삭제 → 같은 id 다른 내용 재적용 불가', (typeof o1 === 'string' && o1.startsWith('err') && /synthetic|합성/.test(o1)) || !!d4 || o2 !== 'applied', { 첫변경: o1, 세션: sesSyn, 원장삭제: d4 ?? '허용', 재적용: o2, 뒤도움수준: after4 })
  // ⑤ Codex P1 — 실제 기록의 user_id 를 임시 계정으로 옮긴 뒤 그 계정을 지우면(cascade) 원래 학습자가 살아 있는데 실제 기록이 지워지는가
  const U5 = '00000000-0000-4000-8000-0000000000e7', TMP = '00000000-0000-4000-8000-0000000000e8'
  await su.query(`insert into auth.users (id) values ('${U5}'), ('${TMP}')`)
  await q(`select * from learning_attempt_record($1,$2,null,'f7p','practice','pre','independent','u5','h','{}',true,5,false,null,null,now() - interval '1 minute')`, [U5, uuid()])
  const mv = await err('update learning_task_attempts set user_id = $1 where user_id = $2', [TMP, U5])
  let dl = null
  if (!mv) { try { await su.query(`delete from auth.users where id = '${TMP}'`) } catch (e) { dl = e.message } }
  const left5 = (await q('select count(*)::int n from learning_task_attempts where user_id = any($1)', [[U5, TMP]])).rows[0].n
  rec('⑤ 실제 기록의 user_id 를 옮겨 계정 cascade 로 지우기 불가', !!mv || !!dl || left5 > 0, { 옮기기: mv ?? '허용', 임시계정삭제: dl ?? '허용', 남은실제기록: left5 })
  void syn
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await su?.end().catch(() => {})
  await pool?.end().catch(() => {})
  await cluster.stop()
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
process.exitCode = fail ? 1 : 0
