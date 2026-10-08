// scripts/knowledge/g2-m8-test.mjs
//
// M8(_pending_20261008180000_learning_help_timing) 격리 PostgreSQL 검증(2026-10-08) — **공유 개발 DB 를 쓰지 않는다.**
// 적용된 160000 까지 올린 뒤(그 전에 도움 받은 세션 하나를 만들어 백필 확인) M8 을 얹고 단언한다:
//   과소 집계(판단 뒤 도움) · 오염(도움 뒤 판단) · 동률 · 늦게 온 더 이른 도움 · 시각 불확실(2분 안 · 기기 시계 미래) · 재전송 ·
//   효과 게이트 보류 · 두 연결 동시 도움 노출 · 표본 고정 · 세션 synthetic 불변 · 학습자 읽기 · 되돌리기 실행.
//   node scripts/knowledge/g2-m8-test.mjs [--pg-dir <isolated-pg 경로>]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const PG_DIR = process.argv.includes('--pg-dir') ? process.argv[process.argv.indexOf('--pg-dir') + 1] : 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
const M8_FILE = '_pending_20261008180000_learning_help_timing.sql'
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 220) : ''}`) }
const uuid = () => crypto.randomUUID()

const applied = fs.readFileSync(path.join(REPO, 'supabase/migrations/20261008160000_learning_sessions_integrated.sql'))
rec('적용된 160000 파일은 그대로(sha256 8d1d0624…)', crypto.createHash('sha256').update(applied).digest('hex').startsWith('8d1d06249b8d649442da4cd007a857b65668dc7a56f42824fcd94aefc21327b5'))
console.log(`M8 sha256 ${crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'supabase/migrations', M8_FILE))).digest('hex')}`)

const cluster = await startCluster()
const USERS = ['a1', 'b2', 'c3', 'd4', 'e5'].map((s) => `00000000-0000-4000-8000-0000000000${s}`)
const [A, B, C, D, E] = USERS
try {
  const su = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
  await su.connect()
  await su.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await su.query('alter role postgres set search_path = public, extensions')
  await su.query(`insert into auth.users (id) values ${USERS.map((u) => `('${u}')`).join(',')}`)
  await su.end()
  const pool = conn('postgres', 'postgres')
  const q = async (sql, params = []) => { const c = await pool.connect(); try { return await c.query(sql, params) } finally { c.release() } }
  const err = async (sql, params = []) => { try { await q(sql, params); return null } catch (e) { return e.message } }
  for (const f of ['20260919120000_methodology_intelligence.sql', '20260928120000_knowledge_registry.sql', '20260928130000_knowledge_evidence_invariants.sql',
    '20260928140000_knowledge_evidence_concurrency.sql', '20260928150000_knowledge_regrade_locks_items.sql', '20261001120000_knowledge_evidence_version.sql',
    '20261001130000_knowledge_evidence_observed.sql', '20261008120000_knowledge_vnext.sql', '20261008140000_knowledge_review_cascade_guard.sql',
    '20261008150000_knowledge_statement_review_fix.sql', '_pending_20261008170000_knowledge_trial_evidence_guard.sql']) await q(M(f))
  // funnel_events CHECK 은 160000 이 다시 건다 — 기존 행을 비워 둔다(이 하네스의 관심 밖)
  await q('delete from funnel_events')
  await q(M('20261008160000_learning_sessions_integrated.sql'))

  // 160000 상태에서 만든 기존 기록 — 백필 · 행 보존 확인용
  const sess = (user, cs, help, at, extra = {}) => q(`select * from learning_session_apply($1,$2,$3,'theater','practice','2022#20','revealed',0,1,$4,$5,null,false,$6,'claim-support',null,$7,null)`,
    [user, uuid(), cs, help, at, extra.synthetic ?? false, extra.trial ?? null])
  const att = (user, mut, sid, at, extra = {}) => q(`select * from learning_attempt_record($1,$2,$3,'claim-support',null,null,null,null,'h',$4,true,10,$5,null,$6,$7)`,
    [user, mut, sid, JSON.stringify(extra.resp ?? { claim: 1 }), extra.synthetic ?? false, extra.trial ?? null, at])
  const csOld = uuid()
  const old = (await sess(A, csOld, 'viewed_first', '2026-10-01T08:00:00Z')).rows[0]
  await att(A, uuid(), old.session_id, '2026-10-01T08:01:00Z')
  const before = (await q('select count(*)::int s, (select count(*)::int from learning_task_attempts) a, (select count(*)::int from learning_mutations) m from learning_sessions')).rows[0]

  { const sql = M(M8_FILE); try { await q(sql) } catch (e) { throw new Error(`M8: ${e.message} @ ${sql.slice(Math.max(0, (e.position ?? 1) - 120), (e.position ?? 1) + 40)}`) } }
  rec('160000 위에 M8 적용', true)
  const afterRows = (await q('select count(*)::int s, (select count(*)::int from learning_task_attempts) a, (select count(*)::int from learning_mutations) m from learning_sessions')).rows[0]
  rec('기존 세션 · 시도 · 원장 행 수 그대로', JSON.stringify(before) === JSON.stringify(afterRows), afterRows)
  const bf = (await q('select help_received_at, revealed_at from learning_sessions where id = $1', [old.session_id])).rows[0]
  rec('백필 — 도움 받은 기존 세션의 help_received_at = revealed_at', bf.help_received_at?.toISOString() === bf.revealed_at.toISOString(), bf)
  rec('기존 시도 received_at = NULL(소급 없음)', (await q('select count(*)::int n from learning_task_attempts where received_at is not null')).rows[0].n === 0)

  const fa = async (sid) => (await q('select help_level, after_viewed_first, timing_uncertain from learning_first_attempts where session_id = $1', [sid])).rows[0]
  const mk = async (user, item) => {
    const cs = uuid()
    return { cs, sess: (help, at) => q(`select * from learning_session_apply($1,$2,$3,'theater','practice',$4,'revealed',0,1,$5,$6,null,false,false,'claim-support',null,null,null)`, [user, uuid(), cs, item, help, at]) }
  }

  // M8-A 과소 집계 — 독립 판단(09:01) 뒤 해설 먼저(09:10)가 와도 그 판단은 독립
  {
    const s = await mk(B, 'm8a')
    const sid = (await s.sess('independent', '2026-10-02T09:00:00Z')).rows[0].session_id
    await att(B, uuid(), sid, '2026-10-02T09:01:00Z')
    await s.sess('viewed_first', '2026-10-02T09:10:00Z')
    const r = await fa(sid)
    rec('M8-A 판단 뒤 도움 → 첫 시도는 independent · 확실', r.help_level === 'independent' && !r.after_viewed_first && !r.timing_uncertain, r)
    const row = (await q('select help_level from learning_task_attempts where session_id = $1', [sid])).rows[0]
    rec('M8-D 시도 행은 소급 재작성하지 않는다(기록 당시 값 그대로)', row.help_level === 'independent', row)
  }
  // M8-B 오염 — 해설 먼저(09:00) 뒤 판단(09:05)은 viewed_first
  {
    const s = await mk(B, 'm8b')
    const sid = (await s.sess('viewed_first', '2026-10-02T09:00:00Z')).rows[0].session_id
    await att(B, uuid(), sid, '2026-10-02T09:05:00Z')
    const r = await fa(sid)
    rec('M8-B 도움 뒤 판단 → viewed_first', r.help_level === 'viewed_first' && r.after_viewed_first && !r.timing_uncertain, r)
  }
  // 동률 — 같은 시각이면 도움 쪽 · 불확실
  {
    const s = await mk(B, 'tie')
    const sid = (await s.sess('viewed_first', '2026-10-02T09:00:00Z')).rows[0].session_id
    await att(B, uuid(), sid, '2026-10-02T09:00:00Z')
    const r = await fa(sid)
    rec('동률 — 도움 쪽(viewed_first) · 시각 불확실', r.help_level === 'viewed_first' && r.timing_uncertain, r)
  }
  // 2분 안 — 판단(09:00) 이 도움(09:01) 보다 이르지만 기기 시각 오차 범위 → 독립이지만 불확실
  {
    const s = await mk(B, 'near')
    const sid = (await s.sess('independent', '2026-10-02T09:00:00Z')).rows[0].session_id
    await att(B, uuid(), sid, '2026-10-02T09:00:00Z')
    await s.sess('hint', '2026-10-02T09:01:00Z')
    const r = await fa(sid)
    rec('2분 안 도움 노출 → independent 이지만 timing_uncertain', r.help_level === 'independent' && r.timing_uncertain, r)
  }
  // 순서 뒤바뀜 — 09:10 도움이 먼저 도착 · 09:03 hint 가 늦게 도착 → 첫 노출 09:03 · 도움 수준 viewed_first 유지 · 09:05 판단은 도움
  {
    const s = await mk(C, 'ooo')
    const sid = (await s.sess('viewed_first', '2026-10-02T09:10:00Z')).rows[0].session_id
    await s.sess('hint', '2026-10-02T09:03:00Z')
    await att(C, uuid(), sid, '2026-10-02T09:06:00Z')
    const ses = (await q('select help_level, help_received_at from learning_sessions where id = $1', [sid])).rows[0]
    const r = await fa(sid)
    rec('순서 뒤바뀜 — 첫 노출 = 가장 이른 도움(09:03) · 도움 수준 viewed_first', ses.help_received_at.toISOString() === '2026-10-02T09:03:00.000Z' && ses.help_level === 'viewed_first', ses)
    rec('순서 뒤바뀜 — 첫 노출 뒤 판단은 도움(독립 아님)', r.help_level === 'viewed_first', r)
    await s.sess('independent', '2026-10-02T08:00:00Z')
    rec('늦게 온 독립 공개는 첫 노출 시각을 바꾸지 않는다', (await q('select help_received_at from learning_sessions where id = $1', [sid])).rows[0].help_received_at.toISOString() === '2026-10-02T09:03:00.000Z')
  }
  // 기기 시계 미래 — 판단 시각이 서버 수신보다 2분 넘게 뒤
  {
    const s = await mk(C, 'skew')
    const future = new Date(Date.parse((await q('select now() t')).rows[0].t) + 10 * 60_000).toISOString()
    const sid = (await s.sess('independent', future)).rows[0].session_id
    await att(C, uuid(), sid, future)
    const r = await fa(sid)
    rec('기기 시계 미래(+10분) → timing_uncertain', r.help_level === 'independent' && r.timing_uncertain, r)
    const past = new Date(Date.parse((await q('select now() t')).rows[0].t) - 3 * 86_400_000).toISOString()
    const s2 = await mk(C, 'offline')
    const sid2 = (await s2.sess('independent', past)).rows[0].session_id
    await att(C, uuid(), sid2, past)
    rec('오프라인(과거 판단 · 늦은 동기화)은 불확실 아님', !(await fa(sid2)).timing_uncertain)
  }
  // 재전송 — 같은 mutation 은 한 행 · 뷰 한 줄
  {
    const s = await mk(D, 'dup')
    const sid = (await s.sess('independent', '2026-10-02T09:00:00Z')).rows[0].session_id
    const m = uuid()
    await att(D, m, sid, '2026-10-02T09:01:00Z')
    const again = (await att(D, m, sid, '2026-10-02T09:01:00Z')).rows[0]
    rec('재전송 → duplicate · 시도 한 행', again.outcome === 'duplicate' && (await q('select count(*)::int n from learning_task_attempts where session_id = $1', [sid])).rows[0].n === 1)
    rec('재전송 · 다른 판단 시각 → conflict', (await att(D, m, sid, '2026-10-02T09:02:00Z')).rows[0].outcome === 'conflict')
  }
  // 두 연결 동시 도움 노출 — 첫 노출은 가장 이른 값
  {
    const s = await mk(D, 'conc')
    const sid = (await s.sess('independent', '2026-10-02T09:00:00Z')).rows[0].session_id
    const times = Array.from({ length: 12 }, (_, i) => `2026-10-02T09:${String(30 - i).padStart(2, '0')}:00Z`)
    await Promise.all(times.map((t, i) => s.sess(i % 2 ? 'hint' : 'viewed_first', t)))
    const r = (await q('select help_level, help_received_at from learning_sessions where id = $1', [sid])).rows[0]
    rec('동시 12요청 — help_received_at = 가장 이른 노출(09:19) · 도움 수준 viewed_first', r.help_received_at.toISOString() === '2026-10-02T09:19:00.000Z' && r.help_level === 'viewed_first', r)
  }

  // 효과 게이트 — 시각 불확실 표본은 세지 않는다
  const it = (await q(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('practice','task','m8-t','t','s','in_review','t','t') returning id`)).rows[0].id
  await q(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'B','stated','external','https://e.x/m8','t','t')`, [it])
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [it])
  const app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task','m8','t','t') returning id`, [it])).rows[0].id
  const trial = (await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't') returning id`, [app])).rows[0].id
  const tsess = async (user, phase, steps) => {
    const cs = uuid()
    let sid
    for (const [help, at] of steps.reveals) sid = (await q(`select * from learning_session_apply($1,$2,$3,'practice',$4,'x1','revealed',0,1,$5,$6,null,false,false,'g2',null,$7,null)`, [user, uuid(), cs, phase, help, at, trial])).rows[0].session_id
    await q(`select * from learning_attempt_record($1,$2,$3,'g2',null,null,null,null,'h','{}',true,10,false,null,$4,$5)`, [user, uuid(), sid, trial, steps.answered])
    for (const [help, at] of steps.after ?? []) await q(`select * from learning_session_apply($1,$2,$3,'practice',$4,'x1','revealed',0,1,$5,$6,null,false,false,'g2',null,$7,null)`, [user, uuid(), cs, phase, help, at, trial])
    return sid
  }
  const analyze = () => err(`update knowledge_trials set status = 'analyzed', result = 'supported', analyzed_at = now() where id = $1`, [trial])
  // E: 판단 30초 뒤 도움 → 독립이지만 불확실 → 세지 않음
  await tsess(E, 'pre', { reveals: [['independent', '2026-10-05T09:00:00Z']], answered: '2026-10-05T09:00:00Z', after: [['viewed_first', '2026-10-05T09:00:30Z']] })
  await tsess(E, 'post', { reveals: [['independent', '2026-10-05T10:00:00Z']], answered: '2026-10-05T10:00:00Z', after: [['viewed_first', '2026-10-05T10:00:30Z']] })
  rec('게이트 — 불확실 표본만이면 분석 완료 거부(보류)', /독립\(independent\)/.test(await analyze() ?? ''))
  // B: 판단 뒤 30분에 도움 → 확실한 독립(과소 집계였던 경우) → 이제 센다
  const bPre = await tsess(B, 'pre', { reveals: [['independent', '2026-10-05T09:00:00Z']], answered: '2026-10-05T09:00:00Z', after: [['viewed_first', '2026-10-05T09:30:00Z']] })
  await tsess(B, 'post', { reveals: [['independent', '2026-10-05T10:00:00Z']], answered: '2026-10-05T10:00:00Z' })
  rec('게이트 — 판단 뒤 도움 받은 세션의 독립 판단을 센다(과소 집계 회귀)', !(await analyze()))

  // 표본 고정 · synthetic 불변
  rec('M8-E 분석 완료 표본 세션의 help_received_at 변경 거부', /바꿀 수 없다/.test(await err(`update learning_sessions set help_received_at = '2026-10-05T08:00:00Z' where id = $1`, [bPre]) ?? ''))
  rec('M8-E 분석 완료 표본 세션 synthetic 변경 거부(Codex P1)', /합성 표시/.test(await err('update learning_sessions set synthetic = true where id = $1', [bPre]) ?? ''))
  rec('M8-E 표본 밖 세션도 synthetic 불변', /합성 표시/.test(await err('update learning_sessions set synthetic = true where id = $1', [old.session_id]) ?? ''))
  rec('M8-E 분석 완료 표본 시도 synthetic 변경 거부(기존 시도 트리거)', /더하거나 고칠 수 없다/.test(await err('update learning_task_attempts set synthetic = true where session_id = $1', [bPre]) ?? ''))
  rec('M8-E 같은 값 UPDATE(합성 표시 그대로)는 통과', !(await err('update learning_sessions set step = step where id = $1', [old.session_id])))

  // 학습자 읽기 — 뷰가 원장(학습자 읽기 불가)을 읽지 않는다
  const as = async (uid, sql) => { const c = await pool.connect(); try { await c.query('begin'); await c.query('set local role authenticated'); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]); const r = await c.query(sql); await c.query('rollback'); return { ok: true, rows: r.rows } } catch (e) { await c.query('rollback').catch(() => {}); return { ok: false, err: e.message } } finally { c.release() } }
  const mine = await as(B, 'select user_id, timing_uncertain from learning_first_attempts')
  rec('학습자 — 첫 시도 뷰 본인 행만 · timing_uncertain 읽힘', mine.ok && mine.rows.length > 0 && mine.rows.every((r) => r.user_id === B && typeof r.timing_uncertain === 'boolean'), mine.err ?? mine.rows.length)

  // 되돌리기 — 행을 지우지 않고 실행된다
  const full = M(M8_FILE)
  const rb = full.slice(full.indexOf('-- ── 되돌리기')).split(/\r?\n/).filter((l) => l.startsWith('-- ') && !l.startsWith('-- ──') && !l.startsWith('-- 검증')).map((l) => l.slice(3)).join('\n')
  const nBefore = (await q('select count(*)::int n from learning_task_attempts')).rows[0].n
  const rbErr = await err(rb)
  rec('되돌리기 블록이 그대로 실행된다(행 삭제 없이)', !rbErr, rbErr)
  const after = (await q(`select (select count(*)::int from information_schema.columns where (table_name, column_name) in (('learning_sessions','help_received_at'), ('learning_task_attempts','received_at'))) cols,
    (select count(*)::int from information_schema.columns where table_name = 'learning_first_attempts' and column_name = 'timing_uncertain') vcol,
    (select count(*)::int from learning_task_attempts) n, (select prosrc from pg_proc where proname = 'knowledge_trials_analyzed_guard') g`)).rows[0]
  rec('되돌린 뒤 — 새 열 없음 · 시도 행 그대로 · 게이트 160000 본문', after.cols === 0 && after.vcol === 0 && after.n === nBefore && !/timing_uncertain/.test(after.g), { cols: after.cols, vcol: after.vcol, n: after.n })
  const mine2 = await as(B, 'select user_id from learning_first_attempts')
  rec('되돌린 뒤 — 학습자 뷰 읽기 권한 복원', mine2.ok, mine2.err)
  await pool.end()
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await cluster.stop()
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
