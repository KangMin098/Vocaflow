// scripts/db/dryrun-detector.mjs
//
// G4 경계 감지기(20261006120000) 드라이런 — 개발 DB 에서 **한 트랜잭션 안에** 마이그레이션을 적용하고, 같은 트랜잭션에서
// 함수 권한 정책 가드(check-function-exec) · 실제 봉인 taxonomy(v0.1) 시나리오 · 롤백 SQL 복원을 본 뒤 **무조건 ROLLBACK** 한다. 커밋 경로가 없다.
// 마이그레이션 · 롤백 파일의 begin; / commit; 줄은 떼고 실행한다(떼지 않으면 commit 이 바깥 트랜잭션을 커밋한다 — 남아 있으면 멈춘다).
// 시나리오 세션 · 증거는 실제 학습자 id(읽기만) 로 트랜잭션 안에서 만들고 함께 사라진다. 경계 키 · probe 키는 DB(v0.1)에서 읽는다.
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/dryrun-detector.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { checkFunctionExec } from './check-function-exec.mjs'
const pg = createRequire(path.resolve('scripts/csat/error-evidence/isolated-pg/package.json'))('pg')

const strip = (sql) => {
  const s = sql.replace(/^\s*(begin|commit)\s*;\s*$/gim, '')
  if (/^\s*commit\b/im.test(s) || /\bcommit\s*;/i.test(s)) throw new Error('commit 문이 남아 있다 — 드라이런을 멈춘다')
  return s
}
const MIG = strip(fs.readFileSync('supabase/migrations/20261006120000_csat_ec_boundary_detector.sql', 'utf8'))
const RB = strip(fs.readFileSync('scripts/db/rollback-20261006120000.sql', 'utf8'))
const man = JSON.parse(fs.readFileSync('scripts/db/function-exec-manifest.json', 'utf8'))
const TAX = 'v0.1'
const out = []
const rec = (name, pass, detail = '') => { out.push({ name, pass: !!pass, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }); console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 260) : ''}`) }

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const fnState = async () => (await c.query(`select p.oid::regprocedure::text sig, md5(p.prosrc) h, array_to_string(array(select x::text from unnest(p.proacl) x order by 1), ',') acl
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('csat_ec_my_pending_probes', 'csat_ec_add_process_evidence') order by 1`)).rows
async function as(role, sub, sql, params = []) {
  await c.query('savepoint a')
  try {
    await c.query(`set local role ${role}`)
    await c.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [sub ?? '', JSON.stringify(sub ? { sub, role } : { role })])
    const r = await c.query(sql, params)
    await c.query('reset role'); await c.query('release savepoint a')
    return { ok: true, rows: r.rows }
  } catch (e) {
    await c.query('rollback to savepoint a'); await c.query('reset role')
    return { ok: false, err: e.message }
  }
}
try {
  await c.query('begin')
  await c.query(`set local lock_timeout = '5s'`)
  await c.query(`set local statement_timeout = '120s'`)
  const fnBefore = await fnState()
  const live = (await c.query(`select (select count(*) from public.csat_ec_capture_session) caps, (select count(*) from public.csat_ec_boundary_signal) sigs,
      (select count(*) from public.csat_ec_judgment) j, (select count(*) from public.csat_ec_claim) cl, (select count(*) from public.csat_learner_state) m, (select count(*) from public.csat_dx_snapshot) sn`)).rows[0]
  await c.query(MIG)
  rec('감지기 마이그레이션 적용(트랜잭션 안)', true, JSON.stringify(live))

  const g = await checkFunctionExec(c, man)
  rec('함수 권한 정책 가드(check-function-exec) — 미분류 · 권한 · 본문 위반 0', g.fails.length === 0, g.fails.slice(0, 5).map((f) => `${f.rule} ${f.sig} ${f.why}`).join(' | ') || `함수 ${g.checked}`)

  // ── 시나리오: 실제 봉인 taxonomy · 실제 학습자 · 실제 시험 ──
  const bnd = (await c.query(`select b.boundary_key, b.probe_key, ca.student_group ga, cb.student_group gb from public.csat_ec_boundary b
      join public.csat_ec_code ca on ca.version = b.version and ca.code = b.code_a join public.csat_ec_code cb on cb.version = b.version and cb.code = b.code_b
      where b.version = $1 and b.status = 'provisional' and b.probe_key is not null order by b.boundary_key limit 1`, [TAX])).rows[0]
  const outside = (await c.query(`select g from unnest(array['word','sentence','flow','evidence','choice','time']) g where g not in ($1, $2) limit 1`, [bnd.ga, bnd.gb])).rows[0].g
  const learner = (await c.query(`select user_id from public.user_profiles where coalesce(role, '') <> 'admin' order by user_id limit 1`)).rows[0].user_id
  const exam = (await c.query(`select i.exam_id from public.csat_items i where i.answer is not null and i.passage is not null group by 1 having count(*) >= 20 order by 1 limit 1`)).rows[0].exam_id
  const items = (await c.query(`select no, id, answer from public.csat_items where exam_id = $1 order by no`, [exam])).rows
  const targets = items.filter((i) => i.answer && i.no >= 18).slice(0, 4).map((i) => i.no)
  const mk = async (key, correct) => {
    const responses = items.map((i) => { const ch = correct ? Number(i.answer) : (Number(i.answer) % 5) + 1; return { item_no: i.no, item_id: i.id, chosen_option: i.answer ? ch : null, is_correct: i.answer ? correct : null } })
    const r = await as('service_role', null, `select public.csat_ec_record_session_held($1::jsonb, $2::jsonb, true, $3, $4::jsonb, $5::smallint[], true) r`,
      [JSON.stringify({ user_id: learner, exam_id: exam, mode: 'live', taken_at: '2026-10-06', client_key: key, raw_score: 0 }), JSON.stringify(responses), TAX,
        JSON.stringify({ probe_cap: null, probes: [{ key: bnd.probe_key, version: '1.0.0', prompt_hash: 'f'.repeat(64) }] }), targets])
    if (!r.ok) throw new Error(`세션 저장 실패: ${r.err}`)
    const sid = r.rows[0].r.session_id
    const o = await as('authenticated', learner, `select public.csat_ec_capture_open($1) s`, [sid])
    if (!o.ok) throw new Error(`수집 열기 실패: ${o.err}`)
    return sid
  }
  const pe = (sid, no, kind, v, sup = null) => as('authenticated', learner, `select public.csat_ec_add_process_evidence($1, $2::smallint, $3, $4::jsonb, $5) id`, [sid, no, kind, JSON.stringify(v), sup])
  const view = async (sid) => {
    const runs = (await c.query(`select item_no, result, boundary_keys, probe_boundary_key from public.csat_ec_detector_run where session_id = $1 order by item_no, id`, [sid])).rows
    const sigs = (await c.query(`select s.item_no, s.boundary_key, s.probe_required, r.reason from public.csat_ec_boundary_signal s left join public.csat_ec_boundary_signal_retraction r on r.signal_id = s.id where s.session_id = $1 order by s.item_no, s.id`, [sid])).rows
    const pend = await as('authenticated', learner, `select item_no, probe_key from public.csat_ec_my_pending_probes($1) order by item_no`, [sid])
    return { runs, sigs, pend: pend.ok ? pend.rows : pend.err }
  }
  const script = async (sid) => {
    const errs = []
    const go = async (...a) => { const r = await pe(sid, ...a); errs.push(r.ok ? 'ok' : r.err); return r }
    const [t1, t2, t3, t4] = targets
    await go(t1, 'category', { group: bnd.ga }); await go(t1, 'interpretation', { state: 'answered', text: '그 낱말을 이런 뜻으로 읽었어요' })
    await go(t2, 'interpretation', { state: 'answered', text: '이렇게 읽었어요' })
    await go(t3, 'category', { group: 'unsure' }); await go(t3, 'interpretation', { state: 'answered', text: '이렇게 읽었어요' })
    await go(t4, 'category', { group: outside }); await go(t4, 'interpretation', { state: 'answered', text: '이렇게 읽었어요' })
    const v1 = await view(sid)
    const cat = (await c.query(`select id from public.csat_ec_process_evidence p where session_id = $1 and item_no = $2 and kind = 'category' and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id)`, [sid, t1])).rows[0].id
    await go(t1, 'category', { group: outside }, cat)
    const v2 = await view(sid)
    return { errs, v1, v2 }
  }
  const sC = await mk('dddddddd-0000-4000-8000-00000000c0c0', true)
  const sW = await mk('dddddddd-0000-4000-8000-00000000c0c1', false)
  const pc = await script(sC), pw = await script(sW)
  const strip2 = (x) => JSON.parse(JSON.stringify(x))
  const t1 = targets[0]
  const v1 = pc.v1
  rec(`v0.1 경계 충족(${bnd.ga}) → 신호 1 · probe 필요 · 대기 probe 1`, v1.sigs.filter((s) => s.item_no === t1).length === 1 && v1.sigs[0].boundary_key === bnd.boundary_key && v1.sigs[0].probe_required
    && v1.pend.length === 1 && v1.pend[0].probe_key === bnd.probe_key, v1)
  const res = (v, no) => v.runs.filter((r) => r.item_no === no).at(-1)?.result
  rec('범주 없음 · unsure → insufficient_evidence · 범주 경계 밖 → no_boundary · 신호 0', res(v1, targets[1]) === 'insufficient_evidence' && res(v1, targets[2]) === 'insufficient_evidence' && res(v1, targets[3]) === 'no_boundary'
    && v1.sigs.every((s) => s.item_no === t1), v1.runs)
  rec('정정으로 경계 소멸 · 미응답 → 신호 cancelled · 대기 0', pc.v2.sigs.filter((s) => s.item_no === t1).at(-1)?.reason === 'cancelled' && pc.v2.pend.length === 0, pc.v2.sigs)
  rec('정답 attempt · 오답 attempt — 결과 · 신호 · 대기 · 오류 동일(오라클 0)', JSON.stringify(strip2(pc)) === JSON.stringify(strip2(pw)) && pc.errs.every((e) => e === 'ok'), { errs: pc.errs, same: JSON.stringify(pc) === JSON.stringify(pw) })
  const rr = await as('service_role', null, `select public.csat_ec_detect_boundaries_rerun($1, $2::smallint) r`, [sC, t1])
  const rr2 = await as('service_role', null, `select public.csat_ec_detect_boundaries_rerun($1, $2::smallint) r`, [sC, t1])
  const after = await view(sC)
  rec('rerun 2회 — 같은 결과 · 실행 기록 · 신호 행 그대로', rr.ok && rr2.ok && rr.rows[0].r === rr2.rows[0].r && after.runs.length === pc.v2.runs.length && after.sigs.length === pc.v2.sigs.length, [rr.err ?? rr.rows[0].r, after.runs.length, pc.v2.runs.length])
  const lDet = await as('authenticated', learner, `select public.csat_ec_detect_boundaries($1, $2::smallint, null)`, [sC, t1])
  const lRe = await as('authenticated', learner, `select public.csat_ec_detect_boundaries_rerun($1, $2::smallint)`, [sC, t1])
  const lRun = await as('authenticated', learner, `select count(*) from public.csat_ec_detector_run`)
  rec('학습자 — 감지 함수 · rerun 호출 불가 · 실행 기록 조회 불가', [lDet, lRe, lRun].every((r) => !r.ok && /permission denied/.test(r.err)), [lDet.err, lRe.err, lRun.err])
  const live2 = (await c.query(`select (select count(*) from public.csat_ec_judgment) j, (select count(*) from public.csat_ec_claim) cl, (select count(*) from public.csat_learner_state) m, (select count(*) from public.csat_dx_snapshot) sn`)).rows[0]
  rec('판정 · claim · 학습 상태 · 스냅샷 행 수 불변', ['j', 'cl', 'm', 'sn'].every((k) => String(live[k]) === String(live2[k])), { live, live2 })

  // ── 롤백 SQL — 시나리오를 걷어 낸 뒤(세이브포인트) 같은 트랜잭션에서 원상 복원 ──
  await c.query('rollback')   // 시나리오 · 적용을 모두 버리고 새로 — 적용 → 롤백 SQL → 비교
  await c.query('begin'); await c.query(`set local lock_timeout = '5s'`)
  const fb = await fnState()
  await c.query(MIG)
  await c.query(RB)
  const fa = await fnState()
  const gone = (await c.query(`select to_regclass('public.csat_ec_detector_run') a, to_regclass('public.csat_ec_boundary_signal_retraction') b,
      (select count(*) from pg_proc where proname in ('csat_ec_detect_boundaries', 'csat_ec_detect_boundaries_rerun', 'csat_ec_process_evidence_detect')) f,
      (select count(*) from pg_trigger where tgname = 'csat_ec_process_evidence_detect' or (tgname = 'csat_ec_capture_write_guard' and tgrelid = 'public.csat_ec_boundary_signal'::regclass)) t`)).rows[0]
  rec('롤백 SQL — 두 함수 정의 · 권한 정확 복원 · 새 객체 0', JSON.stringify(fa) === JSON.stringify(fb) && JSON.stringify(fb) === JSON.stringify(fnBefore) && gone.a === null && gone.b === null && Number(gone.f) === 0 && Number(gone.t) === 0, { fa, gone })
} catch (e) { rec('드라이런', false, e.message) } finally {
  await c.query('rollback').catch(() => {}); await c.end()
  const f = out.filter((x) => !x.pass).length
  fs.mkdirSync('scripts/db/isolated', { recursive: true })
  fs.writeFileSync('scripts/db/isolated/results-dryrun-detector.json', JSON.stringify({ ranAt: new Date().toISOString(), committed: false, pass: out.length - f, fail: f, out }, null, 1))
  console.log(`\n합계 PASS ${out.length - f} · FAIL ${f} · ROLLBACK(커밋 없음)`); process.exitCode = f ? 1 : 0
}
