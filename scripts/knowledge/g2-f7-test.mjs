// scripts/knowledge/g2-f7-test.mjs
//
// F7(_pending_20261008190000_learning_records_append_only) 격리 PostgreSQL 검증(2026-10-08) — **공유 개발 DB 를 쓰지 않는다.**
// 원장 순서 …150000 → 160000 → 170000 → M8 → F7. service_role 로: TRUNCATE 거부 · 원장 UPDATE 거부 · 실제 기록 삭제 거부 ·
// 합성 기록 정리 경로(시도 → 세션 → 원장) 허용 · 분석 표본 삭제 거부 · 기록 RPC 정상 · 되돌리기 실행.
//   node scripts/knowledge/g2-f7-test.mjs [--pg-dir <isolated-pg 경로>]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const PG_DIR = process.argv.includes('--pg-dir') ? process.argv[process.argv.indexOf('--pg-dir') + 1] : 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
const F7 = '_pending_20261008190000_learning_records_append_only.sql'
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 220) : ''}`) }
const uuid = () => crypto.randomUUID()
console.log(`F7 sha256 ${crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'supabase/migrations', F7))).digest('hex')}`)

const cluster = await startCluster()
const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2'
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
  // service_role 로 한 문장 — 서버 API 와 같은 권한
  const svc = async (sql, params = []) => { const c = await pool.connect(); try { await c.query('begin'); await c.query('set local role service_role'); const r = await c.query(sql, params); await c.query('commit'); return { ok: true, rows: r.rows } } catch (e) { await c.query('rollback').catch(() => {}); return { ok: false, err: e.message } } finally { c.release() } }
  for (const f of ['20260919120000_methodology_intelligence.sql', '20260928120000_knowledge_registry.sql', '20260928130000_knowledge_evidence_invariants.sql',
    '20260928140000_knowledge_evidence_concurrency.sql', '20260928150000_knowledge_regrade_locks_items.sql', '20261001120000_knowledge_evidence_version.sql',
    '20261001130000_knowledge_evidence_observed.sql', '20261008120000_knowledge_vnext.sql', '20261008140000_knowledge_review_cascade_guard.sql',
    '20261008150000_knowledge_statement_review_fix.sql']) await q(M(f))
  await q('delete from funnel_events')
  await q(M('20261008160000_learning_sessions_integrated.sql'))
  await q(M('20261008170000_knowledge_trial_evidence_guard.sql'))
  await q(M('20261008180000_learning_help_timing.sql'))
  // 개발 DB 실측과 같은 기본 GRANT(Supabase 기본 권한) — F7 이 이것을 회수하는지 본다
  await q('grant all on public.learning_mutations, public.learning_sessions, public.learning_task_attempts to service_role')
  await q(M(F7))
  rec('…160000 → 170000 → M8 → F7 적용', true)

  const sess = (synthetic, item) => svc(`select * from learning_session_apply($1,$2,$3,'practice','practice',$4,'revealed',0,1,'independent','2026-10-05T09:00:00Z',null,false,$5,'g2',null,null,null)`, [A, uuid(), uuid(), item, synthetic])
  const att = (sid, synthetic, trial = null) => svc(`select * from learning_attempt_record($1,$2,$3,'g2',null,null,null,null,'h','{}',true,5,$4,null,$5,'2026-10-05T09:01:00Z')`, [A, uuid(), sid, synthetic, trial])
  const real = await sess(false, 'r1')
  const realAtt = await att(real.rows[0].session_id, false)
  rec('기록 RPC 는 그대로 동작(실제 기록 세션 · 시도)', real.ok && realAtt.ok && realAtt.rows[0].outcome === 'inserted', real.err ?? realAtt.err)
  const syn = await sess(true, 's1')
  const synAtt = await att(syn.rows[0].session_id, true)

  for (const t of ['learning_mutations', 'learning_sessions', 'learning_task_attempts']) rec(`service_role TRUNCATE ${t} 거부`, !(await svc(`truncate public.${t} cascade`)).ok)
  rec('원장 UPDATE 거부(service_role)', !(await svc(`update learning_mutations set payload = payload where user_id = $1`, [A])).ok)
  rec('원장 UPDATE 거부(소유자 — 트리거)', /추가 전용/.test(await err(`update learning_mutations set payload = payload where user_id = $1`, [A]) ?? ''))
  rec('실제 시도 삭제 거부', /실제 학습자 기록/.test((await svc('delete from learning_task_attempts where id = $1', [realAtt.rows[0].attempt_id])).err ?? ''))
  rec('실제 세션 삭제 거부', /실제 학습자 기록/.test((await svc('delete from learning_sessions where id = $1', [real.rows[0].session_id])).err ?? ''))
  rec('실제 원장 삭제 거부', /실제 학습자의 요청 원장/.test((await svc(`delete from learning_mutations where user_id = $1 and payload->>'synthetic' = 'false'`, [A])).err ?? ''))

  // 합성 기록 정리 경로 — 시도 → 세션 → 원장(PK 로)
  const c1 = await svc('delete from learning_task_attempts where id = $1', [synAtt.rows[0].attempt_id])
  const c2 = await svc('delete from learning_sessions where id = $1', [syn.rows[0].session_id])
  const c3 = await svc(`delete from learning_mutations where user_id = $1 and payload->>'synthetic' = 'true'`, [A])
  rec('합성 기록 정리(시도 → 세션 → 원장) 허용', c1.ok && c2.ok && c3.ok, c1.err ?? c2.err ?? c3.err)
  const left = (await q(`select (select count(*)::int from learning_sessions) s, (select count(*)::int from learning_task_attempts) a, (select count(*)::int from learning_mutations) m`)).rows[0]
  rec('정리 뒤 실제 기록만 남음(세션 1 · 시도 1 · 원장 2)', left.s === 1 && left.a === 1 && left.m === 2, left)

  // 분석 완료 실검증 표본은 합성 시도라도 못 지운다(합성 시도는 표본 수에 안 들어가지만 묶인 행은 고정)
  const it = (await q(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('practice','task','f7-t','t','s','in_review','t','t') returning id`)).rows[0].id
  await q(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'B','stated','external','https://e.x/f7','t','t')`, [it])
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [it])
  const app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task','f7','t','t') returning id`, [it])).rows[0].id
  const trial = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [app])).rows[0].id
  const s2 = await sess(true, 's2')
  const a2 = await att(s2.rows[0].session_id, true, trial)
  for (const phase of ['pre', 'post']) {
    const sid = (await svc(`select * from learning_session_apply($1,$2,$3,'practice',$4,'x1','revealed',0,1,'independent','2026-10-05T09:00:00Z',null,false,false,'g2',null,$5,null)`, [A, uuid(), uuid(), phase, trial])).rows[0].session_id
    await svc(`select * from learning_attempt_record($1,$2,$3,'g2',null,null,null,null,'h','{}',true,10,false,null,$4,'2026-10-05T10:00:00Z')`, [A, uuid(), sid, trial])
  }
  // B: 검증 없는 합성 첫 시도(09:30) 뒤에 같은 묶음의 실제 시도(10:00, 이 검증) — B 의 실제 시도는 첫 시도가 아니라 표본에 안 든다
  const bSynSess = (await svc(`select * from learning_session_apply($1,$2,$3,'practice','pre','x1','revealed',0,1,'independent','2026-10-05T09:00:00Z',null,false,true,'g2',null,null,null)`, [B, uuid(), uuid()])).rows[0].session_id
  const bSyn = (await svc(`select * from learning_attempt_record($1,$2,$3,'g2',null,null,null,null,'h','{}',true,10,true,null,null,'2026-10-05T09:30:00Z')`, [B, uuid(), bSynSess])).rows[0]
  const bRealSess = (await svc(`select * from learning_session_apply($1,$2,$3,'practice','pre','x1','revealed',0,1,'independent','2026-10-05T09:50:00Z',null,false,false,'g2',null,$4,null)`, [B, uuid(), uuid(), trial])).rows[0].session_id
  await svc(`select * from learning_attempt_record($1,$2,$3,'g2',null,null,null,null,'h','{}',true,10,false,null,$4,'2026-10-05T10:00:00Z')`, [B, uuid(), bRealSess, trial])
  rec('분석 완료 전환(실제 독립 표본)', !(await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [trial])))
  rec('분석 완료 검증에 묶인 합성 시도 삭제 거부', /표본은 지울 수 없다/.test((await svc('delete from learning_task_attempts where id = $1', [a2.rows[0].attempt_id])).err ?? ''))
  rec('F7-3 표본 첫 시도 묶음의 이른 합성 시도 삭제 거부(뒤 실제 시도가 첫 시도로 올라오지 않게 · Codex P2)', /첫 시도 묶음/.test((await svc('delete from learning_task_attempts where id = $1', [bSyn.attempt_id])).err ?? ''))

  // F7-5 · F7-3 합성 표시 원장으로 실제 요청을 지우는 길(methodology f7-review-probe P1-2)
  {
    const cs = uuid()
    await svc(`select * from learning_session_apply($1,$2,$3,'practice','practice','r9','revealed',0,1,'independent','2026-10-05T11:00:00Z',null,false,false,'g2',null,null,null)`, [A, uuid(), cs])
    const mm = uuid()
    rec('F7-5 실제 세션에 합성 표시 변경 → 거부(원장도 남지 않음)', /synthetic mismatch/.test((await svc(`select * from learning_session_apply($1,$2,$3,'practice','practice','r9','revealed',0,1,'viewed_first','2026-10-05T11:05:00Z',null,false,true,'g2',null,null,null)`, [A, mm, cs])).err ?? '')
      && (await q('select count(*)::int n from learning_mutations where client_mutation_id = $1', [mm])).rows[0].n === 0)
    // 원장 payload 만 합성으로 위조돼 있어도(소유자 직접 INSERT) 실제 대상이 실제면 삭제 거부
    const fake = uuid()
    await q(`insert into learning_mutations (user_id, client_mutation_id, kind, target, payload) values ($1, $2, 'session', $3, '{"synthetic": true}')`, [A, fake, cs])
    rec('F7-3 원장 삭제는 실제 대상 synthetic 과 대조 — payload 위조로 실제 세션 원장 삭제 거부', /실제 학습자의 요청 원장/.test((await svc('delete from learning_mutations where user_id = $1 and client_mutation_id = $2', [A, fake])).err ?? ''))
  }

  // F7-7 소유자 불변 — 실제 기록을 임시 계정으로 옮겨 지우는 길(f7-review-probe ⑤)
  rec('F7-7 실제 시도 user_id 변경 거부', /user_id/.test(await err('update learning_task_attempts set user_id = $1 where id = $2', [B, realAtt.rows[0].attempt_id]) ?? ''))
  rec('F7-7 실제 세션 user_id 변경 거부', /user_id/.test(await err('update learning_sessions set user_id = $1 where id = $2', [B, real.rows[0].session_id]) ?? ''))

  // F7-4 계정 삭제 — 실제 · 합성이 섞인 계정도 cascade 로 지워진다 · 분석 표본이 줄면 검증에 재검토 필요 표시
  {
    const su2 = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
    await su2.connect()
    let delErr = null
    try { await su2.query(`delete from auth.users where id = $1`, [B]) } catch (e) { delErr = e.message }
    await su2.end()
    const left = (await q(`select (select count(*)::int from learning_task_attempts where user_id = $1) a, (select count(*)::int from learning_sessions where user_id = $1) s, (select count(*)::int from learning_mutations where user_id = $1) m`, [B])).rows[0]
    rec('F7-4 실제 · 합성이 섞인 계정 삭제 cascade 허용 · 기록 0 남음', !delErr && left.a === 0 && left.s === 0 && left.m === 0, delErr ?? left)
    const tr = (await q('select status, review_required_at, review_required_reason from knowledge_trials where id = $1', [trial])).rows[0]
    rec('F7-4 분석 표본 학습자 계정 삭제 → 결과 행은 analyzed 그대로 · 재검토 필요 표시', tr.status === 'analyzed' && tr.review_required_at !== null && /재계산/.test(tr.review_required_reason ?? ''), tr)
    rec('F7-6 재검토 필요 검증은 효과 판정 근거가 아니다(efficacy 갱신 거부)', /뒷받침하는/.test(await err(`update knowledge_items set efficacy = 'research_supported', updated_by = 't' where id = $1`, [it]) ?? ''))
    rec('F7-4 계정이 살아 있으면 실제 기록 삭제는 여전히 거부', /실제 학습자 기록/.test((await svc('delete from learning_sessions where id = $1', [real.rows[0].session_id])).err ?? ''))
  }

  // 되돌리기
  const full = M(F7)
  const rb = full.slice(full.indexOf('-- ── 되돌리기')).split(/\r?\n/).filter((l) => l.startsWith('-- ') && !l.startsWith('-- ──') && !l.startsWith('-- 검증')).map((l) => l.slice(3)).join('\n')
  const rbErr = await err(rb)
  rec('되돌리기 블록이 그대로 실행된다', !rbErr, rbErr)
  rec('되돌린 뒤 — 원장 UPDATE 다시 허용(트리거 · 권한 복원)', (await svc(`update learning_mutations set payload = payload where user_id = $1`, [A])).ok)
  await pool.end()
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await cluster.stop()
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
