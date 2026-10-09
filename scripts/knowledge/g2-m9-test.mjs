// scripts/knowledge/g2-m9-test.mjs
//
// M9(_pending_20261009100000_learning_cross_session_help) 격리 PostgreSQL 검증(2026-10-09) — **공유 개발 DB 를 쓰지 않는다.**
// 원장 순서 …150000 → 160000 → 170000 → M8(180000) → F7(190000) → M9. 세션을 건너온 도움이 첫 시도 뷰 · 효과 게이트에 반영되는지.
//   node scripts/knowledge/g2-m9-test.mjs [--pg-dir <isolated-pg 경로>]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const PG_DIR = process.argv.includes('--pg-dir') ? process.argv[process.argv.indexOf('--pg-dir') + 1] : 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
const M9 = '_pending_20261009100000_learning_cross_session_help.sql'
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 220) : ''}`) }
const uuid = () => crypto.randomUUID()
console.log(`M9 sha256 ${crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'supabase/migrations', M9))).digest('hex')}`)

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
  for (const f of ['20260919120000_methodology_intelligence.sql', '20260928120000_knowledge_registry.sql', '20260928130000_knowledge_evidence_invariants.sql',
    '20260928140000_knowledge_evidence_concurrency.sql', '20260928150000_knowledge_regrade_locks_items.sql', '20261001120000_knowledge_evidence_version.sql',
    '20261001130000_knowledge_evidence_observed.sql', '20261008120000_knowledge_vnext.sql', '20261008140000_knowledge_review_cascade_guard.sql',
    '20261008150000_knowledge_statement_review_fix.sql']) await q(M(f))
  await q('delete from funnel_events')
  for (const f of ['20261008160000_learning_sessions_integrated.sql', '20261008170000_knowledge_trial_evidence_guard.sql', '20261008180000_learning_help_timing.sql', '20261008190000_learning_records_append_only.sql']) await q(M(f))
  await q(M(M9))
  rec('…160000 → 170000 → M8 → F7 → M9 적용', true)

  const nowMs = Date.parse((await q('select now() t')).rows[0].t)
  const iso = (ms) => new Date(ms).toISOString()
  // 다른 세션의 해설 열람(극장 공개처럼) — 서버 수신 시각은 실제 now()
  const reveal = (user, item, atMs) => q(`select * from learning_session_apply($1,$2,$3,'theater','practice',$4,'revealed',0,1,'independent',$5,null,false,false,null,null,null,$5)`, [user, uuid(), uuid(), item, iso(atMs)])
  // 판단 — 자기 세션(independent) 공개 + 시도
  const judge = async (user, item, atMs, trial = null, phase = 'practice') => {
    const cs = uuid()
    const sid = (await q(`select * from learning_session_apply($1,$2,$3,'practice',$4,$5,'revealed',0,1,'independent',$6,null,false,false,'g2',null,$7,null)`, [user, uuid(), cs, phase, item, iso(atMs), trial])).rows[0].session_id
    const r = (await q(`select * from learning_attempt_record($1,$2,$3,'g2',null,null,null,null,'h','{}',true,10,false,null,$4,$5)`, [user, uuid(), sid, trial, iso(atMs)])).rows[0]
    return r.attempt_id
  }
  const fa = async (attemptId) => (await q('select help_level, timing_uncertain from learning_first_attempts where attempt_id = $1', [attemptId])).rows[0]

  // 1 다른 세션에서 10분 전에 해설을 봤다 → 도움받음
  await reveal(A, 'i1', nowMs - 10 * 60_000)
  const a1 = await judge(A, 'i1', nowMs)
  rec('다른 세션에서 판단 전 해설 열람 → viewed_first(효과 표본 아님)', (await fa(a1)).help_level === 'viewed_first', await fa(a1))
  // 2 판단 뒤 다른 세션에서 해설 → 과거의 실제 독립 시도는 그대로
  // 판단은 곧바로 도착(지연 약 3분 미만 창) · 해설은 그 지연 폭 밖 뒤(서버도 판단을 먼저 받음)
  const a2 = await judge(A, 'i2', nowMs - 3 * 60_000)
  await reveal(A, 'i2', nowMs + 90_000)
  const r2 = await fa(a2)
  rec('판단 뒤 다른 세션 해설 열람 → independent 유지(소급 비독립화 없음)', r2.help_level === 'independent' && r2.timing_uncertain === false, r2)
  // 3 2분 안 → 보류
  await reveal(A, 'i3', nowMs - 60_000)
  const a3 = await judge(A, 'i3', nowMs)
  rec('다른 세션 해설과 2분 안 → timing_uncertain(보류)', (await fa(a3)).timing_uncertain === true, await fa(a3))
  // 4 다른 학습자 · 다른 문항의 해설은 영향 없음
  await reveal(B, 'i4', nowMs - 10 * 60_000)
  await reveal(A, 'other-item', nowMs - 10 * 60_000)
  const a4 = await judge(A, 'i4', nowMs)
  const r4 = await fa(a4)
  rec('다른 학습자 · 다른 문항의 해설은 반영하지 않는다', r4.help_level === 'independent' && r4.timing_uncertain === false, r4)

  // 5 효과 게이트 — 세션을 건너온 도움 표본만이면 분석 완료 거부
  const it = (await q(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('practice','task','m9-t','t','s','in_review','t','t') returning id`)).rows[0].id
  await q(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'B','stated','external','https://e.x/m9','t','t')`, [it])
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [it])
  const app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task','m9','t','t') returning id`, [it])).rows[0].id
  const trial = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [app])).rows[0].id
  await reveal(B, 'g1', nowMs - 20 * 60_000)
  await judge(B, 'g1', nowMs - 5 * 60_000, trial, 'pre')
  await judge(B, 'g2', nowMs - 5 * 60_000, trial, 'post')
  rec('효과 게이트: 사전 표본이 다른 세션 해설 뒤 판단뿐이면 분석 완료 거부', /독립\(independent\)/.test(await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [trial]) ?? ''))
  await judge(A, 'g1', nowMs - 5 * 60_000, trial, 'pre')
  await judge(A, 'g2', nowMs - 5 * 60_000, trial, 'post')
  rec('효과 게이트: 실제 독립 표본이 있으면 분석 완료 허용', !(await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [trial])))

  // 5b 표본 서명 — 분석 때 서명을 남기고, 쓸 때 지금 표본과 같아야 효과 근거로 인정
  const sig = async () => (await q('select sample_signature s, knowledge_trial_sample_signature(id) now from knowledge_trials where id = $1', [trial])).rows[0]
  const s0 = await sig()
  rec('M9-B 분석 완료 때 표본 서명을 남긴다 · 지금 서명과 같다', !!s0.s && s0.s === s0.now, s0)
  // 남는 인원도 최소 표본을 넘게 실제 학습자 C 를 하나 더 둔 검증에서, A 의 사전 표본에 늦은 다른 세션 해설이 도착
  const C = '00000000-0000-4000-8000-0000000000c3'
  { const su3 = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' }); await su3.connect(); await su3.query(`insert into auth.users (id) values ('${C}')`); await su3.end() }
  const trialC = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [app])).rows[0].id
  for (const u of [A, C]) { await judge(u, 'p1', nowMs - 5 * 60_000, trialC, 'pre'); await judge(u, 'p2', nowMs - 5 * 60_000, trialC, 'post') }
  await q("update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1", [trialC])
  await reveal(A, 'p1', nowMs - 30 * 60_000)
  const sc = (await q('select sample_signature s, knowledge_trial_sample_signature(id) now from knowledge_trials where id = $1', [trialC])).rows[0]
  rec('M9-B 늦은 다른 세션 도움으로 표본이 바뀌면(남은 인원이 최소 표본을 넘어도) 서명이 달라진다', sc.s !== sc.now, sc)
  await q('update knowledge_trials set status = $2 where id = $1', [trial, 'stopped']).catch(() => {})
  rec('M9-B 표본이 바뀐 검증으로는 효과 판정 거부(재분석 필요)', /재분석해야 한다/.test((await err("update knowledge_items set efficacy = 'supported', updated_by = 't' where id = $1", [it])) ?? ''))

  // 6 학습자 읽기 권한 유지
  const as = async (uid, sql) => { const c = await pool.connect(); try { await c.query('begin'); await c.query('set local role authenticated'); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]); const r = await c.query(sql); await c.query('rollback'); return { ok: true, rows: r.rows } } catch (e) { await c.query('rollback').catch(() => {}); return { ok: false, err: e.message } } finally { c.release() } }
  const mine = await as(A, 'select user_id, help_level from learning_first_attempts')
  rec('학습자 — 첫 시도 뷰 본인 행만', mine.ok && mine.rows.length > 0 && mine.rows.every((r) => r.user_id === A), mine.err ?? mine.rows.length)

  // 7 되돌리기
  const full = M(M9)
  const rb = full.slice(full.indexOf('-- ── 되돌리기')).split(/\r?\n/).filter((l) => l.startsWith('-- ') && !l.startsWith('-- ──') && !l.startsWith('-- 검증')).map((l) => l.slice(3)).join('\n')
  const rbErr = await err(rb)
  rec('되돌리기 블록이 그대로 실행된다', !rbErr, rbErr)
  rec('되돌린 뒤 — 세션 간 도움은 다시 반영 안 됨(M8 동작)', (await fa(a1)).help_level === 'independent')
  await pool.end()
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await cluster.stop()
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
