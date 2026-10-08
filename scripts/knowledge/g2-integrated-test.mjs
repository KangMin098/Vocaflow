// scripts/knowledge/g2-integrated-test.mjs
//
// G2 통합 SQL(_pending_20261008160000) 격리 PostgreSQL 검증(2026-10-08) — **공유 개발 DB 를 쓰지 않는다.**
// 등록부 7 + vNext(120000) + 가드(140000 · 150000) + 후보(170000) + funnel_events(현재 68종 CHECK · 기존 행) 위에 통합 SQL 을 올리고,
// 세션 소유 · 공개 · 상속 · 모순 거부 · 멱등(중복 · 충돌) · **두 연결 동시 요청** · 첫 시도 · 해설 먼저/뒤 · 효과 게이트 · 이벤트 목록 · 권한을 단언한다.
//   node scripts/knowledge/g2-integrated-test.mjs [--pg-dir <isolated-pg 경로>]
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const PG_DIR = process.argv.includes('--pg-dir') ? process.argv[process.argv.indexOf('--pg-dir') + 1] : 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 220) : ''}`) }
const OLD68 = ['catalog_viewed', 'csat_atlas_scoped', 'csat_drill_answered', 'csat_drill_finished', 'csat_dx_attempt_saved', 'csat_dx_habit_answered', 'csat_dx_history_compared', 'csat_dx_profile_saved', 'csat_dx_test_submitted', 'csat_dx_viewed', 'csat_ec_capture_closed', 'csat_ec_capture_finished', 'csat_ec_capture_opened', 'csat_evidence_opened', 'csat_home_viewed', 'csat_item_back', 'csat_lecture_ended', 'csat_lecture_played', 'csat_map_goal_set', 'csat_map_node_opened', 'csat_map_task_toggled', 'csat_map_viewed', 'csat_overlay_answered', 'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_revealed', 'csat_paper_read', 'csat_path_chosen', 'csat_plan_ordered', 'csat_plan_speed_set', 'csat_resume_clicked', 'csat_review_done', 'csat_review_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_finished', 'csat_session_marked', 'csat_session_started', 'csat_space_opened', 'csat_space_scoped', 'csat_trap_opened', 'csat_workspace_created', 'csat_workspace_edited', 'csat_workspace_opened', 'csat_workspace_session_started', 'csat_workspace_suggestion_applied', 'fit_analyzed', 'fit_level_moved', 'fit_share_opened', 'fit_shared', 'fit_sheet_opened', 'fit_signup_clicked', 'fit_viewed', 'fit_worksheet_printed', 'hub_hero_moved', 'hub_promo_clicked', 'invite_shared', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached', 'landing_viewed', 'screen_viewed', 'teacher_hub_view', 'video_completed', 'video_started', 'volume_previewed', 'wayfinder_cta_clicked', 'wayfinder_opened']

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
    '20261008150000_knowledge_statement_review_fix.sql', '_pending_20261008170000_knowledge_trial_evidence_guard.sql']) await q(M(f))
  // funnel_events — 개발 DB 와 같은 68종 CHECK 와 기존 행(대표 이벤트)
  // bootstrap 의 funnel_events 에 개발 DB 의 현재 68종 CHECK 를 다시 건다(실측 2026-10-08)
  await q(`delete from funnel_events`)
  await q(`alter table funnel_events drop constraint funnel_events_event_check`)
  await q(`alter table funnel_events add constraint funnel_events_event_check check (event in (${OLD68.map((e) => `'${e}'`).join(',')}))`)
  await q(`insert into funnel_events (event) select unnest($1::text[])`, [OLD68])
  { const sql = M('_pending_20261008160000_learning_sessions_integrated.sql'); try { await q(sql) } catch (e) { throw new Error(`통합 SQL: ${e.message} @ ${sql.slice(Math.max(0, (e.position ?? 1) - 120), (e.position ?? 1) + 40)}`) } }
  rec('기존 스키마 전부 + 통합 SQL 적용', true)

  const t0 = '2026-10-01T09:00:00Z'
  const sess = (user, mut, cs, stage, extra = {}) => q(`select * from learning_session_apply($1,$2,$3,'theater','post','2022#20',$4,$5,10,$6,$7,null,false,false,'claim-support',null,null,$8)`,
    [user, mut, cs, stage, extra.step ?? 0, extra.help ?? null, extra.at ?? t0, extra.expl ?? null])
  const att = (user, mut, sid, extra = {}) => q(`select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,$4,null,'h',$5,$6,30,$7,null,$8,$9)`,
    [user, mut, sid, extra.help ?? null, JSON.stringify(extra.resp ?? { claim: 1 }), extra.correct ?? true, extra.synthetic ?? false, extra.trial ?? null, extra.at ?? '2026-10-01T09:05:00Z'])
  const uuid = () => crypto.randomUUID()

  // 세션 · 소유 · 멱등
  const cs1 = uuid(), m1 = uuid()
  const s1 = (await sess(A, m1, cs1, 'open')).rows[0]
  rec('세션 열기 → applied', s1.outcome === 'applied' && !!s1.session_id)
  rec('같은 세션 변경 재전송 → duplicate · 같은 세션', (await sess(A, m1, cs1, 'open')).rows[0].outcome === 'duplicate')
  const conflictCs = uuid()
  rec('같은 mutation id · 다른 내용 → conflict · 빈 세션 없음', (await sess(A, m1, conflictCs, 'open')).rows[0].outcome === 'conflict'
    && (await q(`select count(*)::int n from learning_sessions where client_session_id = $1`, [conflictCs])).rows[0].n === 0)
  rec('공개 전 시도 거부', /not revealed/.test(await err(`select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,null,null,'h','{}',true,1,false,null,null,$4)`, [A, uuid(), s1.session_id, t0]) ?? ''))
  await sess(A, uuid(), cs1, 'revealed', { help: 'independent', at: '2026-10-01T09:01:00Z' })
  rec('남의 세션에 시도 거부', /does not belong/.test(await err(`select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,null,null,'h','{}',true,1,false,null,null,$4)`, [B, uuid(), s1.session_id, t0]) ?? ''))
  rec('세션과 다른 도움 수준 거부(B7 — 서버 검증 유지)', /contradicts/.test(await err(`select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,'hint',null,'h','{}',true,1,false,null,null,$4)`, [A, uuid(), s1.session_id, t0]) ?? ''))
  const ma = uuid()
  const a1 = (await att(A, ma, s1.session_id)).rows[0]
  const row = (await q(`select activity, phase, item_ref, help_level, task_key from learning_task_attempts where id = $1`, [a1.attempt_id])).rows[0]
  rec('시도가 세션 값을 상속(activity · phase · item · help · task)', a1.outcome === 'inserted' && row.activity === 'theater' && row.phase === 'post' && row.item_ref === '2022#20' && row.help_level === 'independent' && row.task_key === 'claim-support', row)
  rec('시도 재전송 → duplicate(한 행)', (await att(A, ma, s1.session_id)).rows[0].outcome === 'duplicate' && (await q(`select count(*)::int n from learning_task_attempts where client_mutation_id = $1`, [ma])).rows[0].n === 1)
  rec('같은 키 · 다른 응답 → conflict(덮지 않음)', (await att(A, ma, s1.session_id, { resp: { claim: 2 } })).rows[0].outcome === 'conflict')

  // M6 첫 기록 뒤 세션 도움 수준이 올라가도 같은 재전송은 duplicate(생략 · 명시 둘 다) — 요청 원문 비교(Codex P1)
  {
    const cs7 = uuid()
    const s7 = (await sess(A, uuid(), cs7, 'revealed', { help: 'independent', at: '2026-10-07T10:00:00Z' })).rows[0]
    const m7a = uuid(), m7b = uuid()
    await att(A, m7a, s7.session_id)
    await q("select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,'independent',null,'h','{}',true,1,false,null,null,'2026-10-07T10:01:00Z')", [A, m7b, s7.session_id])
    await sess(A, uuid(), cs7, 'revealed', { help: 'viewed_first', at: '2026-10-07T10:02:00Z' })
    rec('M6 세션 도움 수준 상승 뒤 재전송(도움 생략) → duplicate', (await att(A, m7a, s7.session_id)).rows[0].outcome === 'duplicate')
    rec('M6 세션 도움 수준 상승 뒤 재전송(도움 명시) → duplicate(모순 예외 아님)', (await q("select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,'independent',null,'h','{}',true,1,false,null,null,'2026-10-07T10:01:00Z')", [A, m7b, s7.session_id])).rows[0].outcome === 'duplicate')
    rec('M6 새 id 로 옛 도움 수준을 보내면 여전히 거부', /contradicts/.test(await err("select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,'independent',null,'h','{}',true,1,false,null,null,'2026-10-07T10:03:00Z')", [A, uuid(), s7.session_id]) ?? ''))
  }
  // M7 합성 세션 + 합성 아님 시도 → 거부 · 뷰는 세션 합성을 반영
  {
    const cs8 = uuid()
    const s8 = (await q("select * from learning_session_apply($1,$2,$3,'theater','post','2022#98','revealed',0,10,'independent','2026-10-07T11:00:00Z',null,false,true,'claim-support',null,null,null)", [A, uuid(), cs8]).catch((e) => ({ rows: [{ err: e.message }] }))).rows[0]
    if (s8.err) rec('M7 합성 세션 만들기', false, s8.err)
    else {
      rec('M7 합성 세션에 합성 아님 시도 거부', /contradicts/.test(await err("select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,null,null,'h','{}',true,1,false,null,null,'2026-10-07T11:01:00Z')", [A, uuid(), s8.session_id]) ?? ''))
      await q("select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,null,null,'h','{}',true,1,true,null,null,'2026-10-07T11:02:00Z')", [A, uuid(), s8.session_id])
      await q(`update learning_task_attempts set synthetic = false where session_id = '${s8.session_id}'`)
      rec('M7 뷰 — 세션이 합성이면 시도 표시와 무관하게 합성', (await q('select bool_and(synthetic) b from learning_first_attempts where session_id = $1', [s8.session_id])).rows[0].b === true)
    }
  }
  // 두 연결 동시 요청(B6′) — 같은 mutation id 를 두 트랜잭션이 동시에: 하나 inserted · 하나 duplicate · 행 1
  const mc = uuid()
  const c1 = await pool.connect(), c2 = await pool.connect()
  try {
    await c1.query('begin'); await c2.query('begin')
    const call = (c) => c.query(`select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,null,null,'h','{"claim":1}',true,30,false,null,null,'2026-10-01T09:06:00Z')`, [A, mc, s1.session_id])
    const r1 = await call(c1)
    const p2 = call(c2)  // c1 이 키를 잡고 있어 기다린다
    await new Promise((r) => setTimeout(r, 300))
    await c1.query('commit')
    const r2 = await p2
    await c2.query('commit')
    const outs = [r1.rows[0].outcome, r2.rows[0].outcome].sort()
    rec('동시 같은 요청 2개 → inserted 1 · duplicate 1 · 행 1', JSON.stringify(outs) === JSON.stringify(['duplicate', 'inserted'])
      && (await q(`select count(*)::int n from learning_task_attempts where client_mutation_id = $1`, [mc])).rows[0].n === 1, outs)
  } finally { c1.release(); c2.release() }
  // 동시 다른 요청 2개 → 둘 다 inserted
  {
    const d1 = await pool.connect(), d2 = await pool.connect()
    try {
      await d1.query('begin'); await d2.query('begin')
      const call = (c, m, at) => c.query(`select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,null,null,'h','{"claim":3}',false,30,false,null,null,$4)`, [A, m, s1.session_id, at])
      const [x, y] = await Promise.all([call(d1, uuid(), '2026-10-01T09:07:00Z'), call(d2, uuid(), '2026-10-01T09:08:00Z')])
      await d1.query('commit'); await d2.query('commit')
      rec('동시 다른 요청 2개 → 둘 다 inserted', x.rows[0].outcome === 'inserted' && y.rows[0].outcome === 'inserted')
    } finally { d1.release(); d2.release() }
  }

  // 첫 시도 = 판단 시각 순(늦게 들어온 이른 판단이 첫 시도)
  const cs2 = uuid()
  const s2 = (await sess(B, uuid(), cs2, 'revealed', { help: 'independent', at: '2026-10-02T09:00:00Z' })).rows[0]
  await att(B, uuid(), s2.session_id, { at: '2026-10-02T09:10:00Z', correct: false })
  const early = (await att(B, uuid(), s2.session_id, { at: '2026-10-02T09:05:00Z', correct: true, resp: { claim: 9 } })).rows[0]
  const first = (await q(`select attempt_id from learning_first_attempts where user_id = $1`, [B])).rows
  rec('첫 시도 = 판단 시각이 가장 이른 것(늦게 동기화돼도)', first.length === 1 && String(first[0].attempt_id) === String(early.attempt_id))

  // 해설 먼저 · 해설 뒤(B8 · M1 · M2)
  const cs3 = uuid()
  const s3 = (await sess(A, uuid(), cs3, 'revealed', { help: 'viewed_first', at: '2026-10-03T09:00:00Z' })).rows[0]
  await q(`update learning_sessions set item_ref = '2022#21' where id = $1`, [s3.session_id])
  await att(A, uuid(), s3.session_id, { at: '2026-10-03T09:02:00Z' })
  rec('해설 먼저 본 세션의 판단 → after_viewed_first', (await q(`select after_viewed_first from learning_first_attempts where session_id = $1`, [s3.session_id])).rows[0]?.after_viewed_first === true)
  const cs4 = uuid()
  const s4 = (await sess(A, uuid(), cs4, 'revealed', { help: 'independent', at: '2026-10-04T09:00:00Z' })).rows[0]
  await q(`update learning_sessions set item_ref = '2022#22' where id = $1`, [s4.session_id])
  await sess(A, uuid(), cs4, 'revealed', { help: 'independent', at: '2026-10-04T09:03:00Z', expl: '2026-10-04T09:03:00Z' })
  await sess(A, uuid(), cs4, 'revealed', { help: 'independent', at: '2026-10-04T09:04:00Z', expl: '2026-10-04T09:09:00Z' })
  // M5a 늦게 도착한 더 이른 열람이 이긴다
  await sess(A, uuid(), cs4, 'revealed', { help: 'independent', at: '2026-10-04T09:04:30Z', expl: '2026-10-04T09:02:00Z' })
  rec('M1 · M5a 해설 열람 시각 = 가장 이른 시각(도착순 아님)', (await q(`select explanation_viewed_at at from learning_sessions where id = $1`, [s4.session_id])).rows[0].at.toISOString() === '2026-10-04T09:02:00.000Z')
  await att(A, uuid(), s4.session_id, { at: '2026-10-04T09:05:00Z' })
  rec('M2 해설 뒤 판단 → after_explanation', (await q(`select after_explanation from learning_first_attempts where session_id = $1`, [s4.session_id])).rows[0]?.after_explanation === true)

  // M5a 늦게 도착한 더 이른 「해설 먼저」 공개가 이긴다
  const cs5 = uuid()
  const s5 = (await sess(B, uuid(), cs5, 'revealed', { help: 'independent', at: '2026-10-07T09:10:00Z' })).rows[0]
  await sess(B, uuid(), cs5, 'revealed', { help: 'viewed_first', at: '2026-10-07T09:05:00Z' })
  const r5 = (await q(`select help_level, revealed_at from learning_sessions where id = $1`, [s5.session_id])).rows[0]
  rec('M5a 공개 시각 = 가장 이른 공개 · 도움 수준 viewed_first(늦게 온 이른 해설 먼저)', r5.help_level === 'viewed_first' && r5.revealed_at.toISOString() === '2026-10-07T09:05:00.000Z', r5)
  // M5a′ 두 기기가 한 세션을 공유 — 09:20 해설 먼저가 먼저 도착하고 09:10 독립 공개가 늦게 와도 도움 수준은 viewed_first(G2 심사 P1)
  const cs6 = uuid()
  const s6 = (await sess(B, uuid(), cs6, 'revealed', { help: 'viewed_first', at: '2026-10-07T09:20:00Z' })).rows[0]
  await sess(B, uuid(), cs6, 'revealed', { help: 'independent', at: '2026-10-07T09:10:00Z' })
  const r6 = (await q('select help_level, revealed_at from learning_sessions where id = $1', [s6.session_id])).rows[0]
  rec('M5a′ 도움 수준 = 더 많이 도움받은 쪽 · 공개 시각 = 가장 이른 것', r6.help_level === 'viewed_first' && r6.revealed_at.toISOString() === '2026-10-07T09:10:00.000Z', r6)
  await sess(B, uuid(), cs6, 'revealed', { help: 'hint', at: '2026-10-07T09:30:00Z' })
  rec('M5a′ 덜 도움받은 값(hint)이 와도 viewed_first 유지', (await q('select help_level from learning_sessions where id = $1', [s6.session_id])).rows[0].help_level === 'viewed_first')

  // M3 효과 게이트 — 실제 독립 첫 시도만 센다
  const it = (await q(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('practice','task','g2-t','t','s','in_review','t','t') returning id`)).rows[0].id
  await q(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'B','stated','external','https://e.x/g2','t','t')`, [it])
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [it])
  const app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task','g2','t','t') returning id`, [it])).rows[0].id
  const trial = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [app])).rows[0].id
  const tsess = async (user, phase, help, item, expl) => {
    const cs = uuid()
    const sid = (await q(`select * from learning_session_apply($1,$2,$3,'practice',$4,$5,'revealed',0,1,$6,'2026-10-05T09:00:00Z',null,false,false,'g2',null,$7,$8)`, [user, uuid(), cs, phase, item, help, trial, expl])).rows[0].session_id
    await q(`select * from learning_attempt_record($1,$2,$3,'g2',null,null,null,null,'h','{}',true,10,false,null,$4,'2026-10-05T09:01:00Z')`, [user, uuid(), sid, trial])
  }
  await tsess(A, 'pre', 'viewed_first', 'x1', null)
  await tsess(A, 'post', 'independent', 'x1', '2026-10-05T09:00:30Z')
  rec('M3 해설 먼저 · 해설 뒤 판단만 있으면 분석 완료 거부', /첫 시도/.test(await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [trial]) ?? ''))
  const C = '00000000-0000-4000-8000-0000000000c3'
  { const su2 = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' }); await su2.connect(); await su2.query(`insert into auth.users (id) values ('${C}')`); await su2.end() }
  await tsess(C, 'pre', 'hint', 'x1', null)
  await tsess(C, 'post', 'hint', 'x1', null)
  rec('M5c 힌트 사용 기록은 독립 표본이 아니다 — 분석 완료 거부', /독립\(independent\)/.test(await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [trial]) ?? ''))
  await tsess(B, 'pre', 'independent', 'x1', null)
  await tsess(B, 'post', 'independent', 'x1', null)
  rec('M3 실제 독립 첫 시도(사전 · 사후 각 1)면 분석 완료 허용', !(await err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [trial])))
  // M5d 분석 완료 뒤 표본 고정
  const bSess = (await q(`select a.session_id from learning_task_attempts a where a.trial_id = $1 and a.user_id = $2 limit 1`, [trial, B])).rows[0].session_id
  rec('M5d 분석 완료 뒤 표본 세션의 해설 시각 변경 거부', /바꿀 수 없다/.test(await err(`update learning_sessions set explanation_viewed_at = '2026-10-05T08:00:00Z' where id = $1`, [bSess]) ?? ''))
  rec('M5d 검증 없는 더 이른 시도로 표본 첫 시도 바꾸기 거부', /이른 시도는 넣을 수 없다/.test(await err(`select * from learning_attempt_record($1,$2,null,'g2','practice','pre','independent','x1','h','{}',true,5,false,null,null,'2026-10-05T08:00:00Z')`, [B, uuid()]) ?? ''))
  rec('M5d 표본보다 늦은 다른 시도는 허용(반복 시도)', !(await err(`select * from learning_attempt_record($1,$2,null,'g2','practice','pre','independent','x1','h','{}',true,5,false,null,null,'2026-10-05T10:00:00Z')`, [B, uuid()])))
  rec('M5d 분석 완료 뒤 그 검증에 시도 추가 거부', /더하거나 고칠 수 없다/.test(await err(`select * from learning_attempt_record($1,$2,null,'g2','practice','pre','independent','x9','h','{}',true,5,false,null,$3,'2026-10-05T08:00:00Z')`, [B, uuid(), trial]) ?? ''))

  // 이벤트 허용 목록
  rec('이벤트 — 기존 68종 행 그대로 · 기존 이벤트 계속 허용', (await q(`select count(*)::int n from funnel_events`)).rows[0].n === 68 && !(await err(`insert into funnel_events (event) values ('csat_map_viewed')`)))
  rec('이벤트 — 새 기출 13 · knowledge 2 허용', !(await err(`insert into funnel_events (event) values ('csat_item_opened'), ('csat_learning_error'), ('knowledge_task_submitted')`)))
  rec('이벤트 — 목록 밖 거부', !!(await err(`insert into funnel_events (event) values ('not_an_event')`)))
  rec('phase review 허용', !(await err(`select * from learning_session_apply($1,$2,$3,'theater','review','2022#20','open',0,1,null,'2026-10-06T09:00:00Z')`, [A, uuid(), uuid()])))

  // 권한 — 학습자 키
  const as = async (uid, sql) => { const c = await pool.connect(); try { await c.query('begin'); await c.query('set local role authenticated'); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]); const r = await c.query(sql); await c.query('rollback'); return { ok: true, rows: r.rows } } catch (e) { await c.query('rollback').catch(() => {}); return { ok: false, err: e.message } } finally { c.release() } }
  const own = await as(A, `select user_id from learning_sessions`)
  rec('학습자 — 세션은 본인 행만', own.ok && own.rows.length > 0 && own.rows.every((r) => r.user_id === A), own.err ?? own.rows.length)
  rec('학습자 — 세션 직접 쓰기 거부', !(await as(A, `insert into learning_sessions (user_id, client_session_id, activity, item_ref, started_at, last_active_at) values ('${A}', gen_random_uuid(), 'theater', 'x', now(), now())`)).ok)
  rec('학습자 — 멱등 원장 읽기 거부', !(await as(A, `select * from learning_mutations`)).ok)
  rec('학습자 — 기록 RPC 실행 거부', !(await as(A, `select * from learning_attempt_record('${A}', gen_random_uuid(), null, 'x', null, null, null, null, 'h', '{}', true, 1, false, null, null, now())`)).ok)
  const fa = await as(B, `select user_id from learning_first_attempts`)
  rec('학습자 — 첫 시도 뷰도 본인 행만(security_invoker + 시도 표 RLS)', fa.ok && fa.rows.every((r) => r.user_id === B), fa.err ?? fa.rows.length)
  // M5e 되돌리기 블록을 실제로 실행 — 새 행을 먼저 치운 뒤(전제 조건)
  await q(`delete from funnel_events where event <> all ($1::text[])`, [OLD68])
  await q(`delete from learning_task_attempts`)
  await q(`delete from learning_sessions`)
  await q(`delete from knowledge_trials`)
  const full = M('_pending_20261008160000_learning_sessions_integrated.sql')
  const rb = full.slice(full.indexOf('-- ── 되돌리기')).split(/\r?\n/).filter((l) => l.startsWith('-- ') && !l.startsWith('-- ──') && !l.startsWith('-- 전제') && !l.startsWith('-- 검증')).map((l) => l.slice(3)).join('\n')
  const rbErr = await err(rb)
  rec('M5e 되돌리기 블록이 그대로 실행된다', !rbErr, rbErr)
  const after = (await q(`select to_regclass('public.learning_sessions') s, to_regclass('public.learning_mutations') m, (select count(*)::int from information_schema.columns where table_name='learning_task_attempts' and column_name in ('session_id','client_mutation_id')) cols, (select prosrc from pg_proc where proname='knowledge_trials_analyzed_guard') g`)).rows[0]
  rec('M5e 되돌린 뒤 — 새 표 · 열 없음 · 효과 게이트 원래 본문', after.s === null && after.m === null && after.cols === 0 && /from public\.learning_task_attempts where trial_id = new\.id and phase = 'pre'/.test(after.g), { s: after.s, m: after.m, cols: after.cols })
  rec('M5e 되돌린 뒤 — 이벤트 68종 CHECK(새 이벤트 거부 · 기존 허용)', !!(await err(`insert into funnel_events (event) values ('csat_item_opened')`)) && !(await err(`insert into funnel_events (event) values ('csat_map_viewed')`)))
  await pool.end()
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await cluster.stop()
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
