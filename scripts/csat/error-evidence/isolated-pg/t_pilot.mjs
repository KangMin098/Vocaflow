// scripts/csat/error-evidence/isolated-pg/t_pilot.mjs
// Pilot 데이터 모델(20261005130000_csat_ec_pilot_evidence.sql) — outcome 확장 · 경계 · 경계 관찰 · probe 증거 · 증거 범위(pre_probe) · 후보 집합
import { as, record } from './lib.mjs'
import { EXAM, TRAP_MAP, U, WRONG, learner, passageOf, SERVICE } from './seed.mjs'
import { fails, ok } from './t_flow.mjs'

const ADM = learner(U.ADM)
const TAX = 'v9.8'   // 경계를 가진 TEST taxonomy(다른 테스트와 겹치지 않는 번호)
const BKEY = 'r.inference__v.word_sense'
const PROBE = 'r6_derivation_probe'
const H64 = 'a'.repeat(64)
const probeValue = (over = {}) => ({ probe_key: PROBE, probe_version: 'p1', taxonomy_version: TAX, boundary_key: BKEY, prompt_hash: H64, option: 'B', skipped: false, ...over })

export default async function pilot(admin, ctx) {
  const { app, owner, S } = ctx
  const tryOwner = async (sql, params = []) => { try { await owner.query(sql, params); return { ok: true } } catch (e) { return { ok: false, err: e.message } } }

  // 앞선 테스트가 열어 둔 회차는 닫는다(검수 중 응답에는 증거를 더할 수 없다)
  await admin.query(`update public.csat_ec_review_round set status = 'cancelled', cancelled_at = now(), cancel_reason = 'pilot-test' where status not in ('closed', 'cancelled')`)

  // ── outcome 단일 원천 ──
  const vals = (await admin.query(`select public.csat_ec_outcomes('judgment') j, public.csat_ec_outcomes('ai_run') a`)).rows[0]
  record('pilot', 'outcome 허용값 — 기존 값 유지 + multiple_plausible · inconsistent_evidence',
    ['code', 'no_cause', 'insufficient_evidence', 'no_fitting_code', 'multiple_plausible', 'inconsistent_evidence'].every((x) => vals.j.includes(x))
    && ['proposed', 'failed', 'multiple_plausible', 'inconsistent_evidence'].every((x) => vals.a.includes(x)), vals)
  const badRun = await tryOwner(`insert into public.csat_ec_ai_run (session_id, item_no, taxonomy_version, model, prompt_version, analyzer_version, quality_rule_version, choice_trap_map, round_id, input_hash, canonical_input, outcome, output)
     select $1, 18, 'v9.0', 'm', 'p', 'a', 'rq-1', $2, (select min(id) from public.csat_ec_review_round), encode(extensions.digest('{}'::jsonb::text, 'sha256'), 'hex'), '{}'::jsonb, 'identified_typo', '{}'::jsonb`, [S.L1, TRAP_MAP])
  record('pilot', '잘못된 outcome 거부(CHECK)', !badRun.ok && /outcome_check/.test(badRun.err), badRun.err)

  // ── 경계 사전 ──
  await owner.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, 'TEST — 경계 검증')`, [TAX])
  for (const [code, axis, group] of [['V.word_sense', 'V', 'word'], ['V.unknown_word', 'V', 'word'], ['R.inference', 'R', 'flow'], ['S.core', 'S', 'sentence'], ['E.option_check', 'E', 'choice']])
    await owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ($1, $2, $3, $2, 'd', 'i', 'e', $4)`, [TAX, code, axis, group])
  const bIns = await tryOwner(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, probe_key, decision_note) values ($1, $2, 'R.inference', 'V.word_sense', 'provisional', $3, 'TEST')`, [TAX, BKEY, PROBE])
  record('pilot', '경계 추가(draft · 순서 고정 키)', bIns.ok, bIns.err)
  const bRev = await tryOwner(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 'v.word_sense__r.inference', 'V.word_sense', 'R.inference', 'accepted', 'x')`, [TAX])
  record('pilot', '역순 경계 거부(같은 경계 중복 방지)', !bRev.ok, bRev.err)
  const bKey = await tryOwner(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 'wrong_key', 'S.core', 'V.word_sense', 'accepted', 'x')`, [TAX])
  record('pilot', '키 형식 불일치 거부', !bKey.ok, bKey.err)
  const bFk = await tryOwner(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 'r.nope__v.word_sense', 'R.nope', 'V.word_sense', 'accepted', 'x')`, [TAX])
  record('pilot', '사전에 없는 코드의 경계 거부(FK)', !bFk.ok, bFk.err)
  const bProbe = await tryOwner(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, probe_key, decision_note) values ($1, 's.core__v.word_sense', 'S.core', 'V.word_sense', 'accepted', 'p', 'x')`, [TAX])
  record('pilot', 'accepted 경계에 probe 거부', !bProbe.ok, bProbe.err)
  await owner.query(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 's.core__v.word_sense', 'S.core', 'V.word_sense', 'accepted', 'TEST accepted')`, [TAX])

  // ── 봉인: 경계 포함 해시 · 봉인 뒤 수정 차단 · 경계 없는 버전 해시 공식 불변 ──
  const seal = await as(app, ADM, `select public.csat_ec_taxonomy_seal($1) h`, [TAX])
  const re = (await admin.query(`select encode(extensions.digest(
      coalesce((select string_agg(to_jsonb(c)::text, chr(10) order by c.code) from public.csat_ec_code c where c.version = $1), '')
      || chr(10) || '--boundaries--' || chr(10) || (select string_agg((to_jsonb(b) - 'created_at')::text, chr(10) order by b.boundary_key) from public.csat_ec_boundary b where b.version = $1),
      'sha256'), 'hex') h`, [TAX])).rows[0].h
  record('pilot', '봉인 해시 = 코드 + 경계 재계산값', seal.ok && seal.rows[0].h === re, seal.err ?? seal.rows[0].h.slice(0, 12))
  const old = (await admin.query(`select v.definitions_hash = encode(extensions.digest(coalesce(string_agg(to_jsonb(c)::text, chr(10) order by c.code), ''), 'sha256'), 'hex') same
      from public.csat_ec_taxonomy_version v join public.csat_ec_code c on c.version = v.version where v.version = 'v9.0' group by v.definitions_hash`)).rows[0]
  record('pilot', '경계 없는 기존 봉인(v9.0) 해시 = 이전 공식', old?.same === true, old)
  for (const [k, sql] of [
    ['경계 수정', `update public.csat_ec_boundary set status = 'accepted', probe_key = null where version = '${TAX}'`],
    ['경계 추가', `insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ('${TAX}', 'e.option_check__v.word_sense', 'E.option_check', 'V.word_sense', 'accepted', 'x')`],
    ['경계 삭제', `delete from public.csat_ec_boundary where version = '${TAX}'`],
  ]) { const r = await tryOwner(sql); record('pilot', `봉인 뒤 ${k} 거부`, !r.ok && /봉인된 taxonomy/.test(r.err), r.err) }

  // ── 탐지기 관찰 → probe ──
  const n = WRONG[0]
  const sigBad = await as(app, SERVICE, `select public.csat_ec_add_detector_signal($1, $2::smallint, $3, $4, 'det-1', true, '{}')`, [S.L1, n, TAX, 's.core__v.word_sense'])
  record('pilot', 'probe 없는 accepted 경계에 probe 요구 거부', fails(sigBad, /미해결 경계에서만/), sigBad.err)
  const probeEarly = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'targeted_probe', $3::jsonb)`, [S.L1, n, JSON.stringify(probeValue())])
  record('pilot', '요구받지 않은 probe 응답 거부(질문 없음 ≠ 건너뜀)', fails(probeEarly, /요구된 probe/), probeEarly.err)
  const sig = await as(app, SERVICE, `select public.csat_ec_add_detector_signal($1, $2::smallint, $3, $4, 'det-1', true, '{}') id`, [S.L1, n, TAX, BKEY])
  record('pilot', '탐지기 관찰 기록(service_role)', ok(sig), sig.err)
  const sigLearner = await as(app, learner(U.L1), `select public.csat_ec_add_detector_signal($1, $2::smallint, $3, $4, 'det-1', true, '{}')`, [S.L1, n, TAX, BKEY])
  record('pilot', '학습자는 관찰을 직접 만들 수 없다', fails(sigLearner, /permission denied/), sigLearner.err)
  const pend = await as(app, learner(U.L1), `select * from public.csat_ec_my_pending_probes($1)`, [S.L1])
  const pendOther = await as(app, learner(U.L2), `select * from public.csat_ec_my_pending_probes($1)`, [S.L1])
  record('pilot', '대기 probe — 본인에게만 보인다', ok(pend) && pend.rows.length === 1 && pend.rows[0].probe_key === PROBE && ok(pendOther) && pendOther.rows.length === 0, [pend.rows, pendOther.rows])
  const pr = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'targeted_probe', $3::jsonb) id`, [S.L1, n, JSON.stringify(probeValue())])
  record('pilot', 'probe 응답 저장(선택지 글자만)', ok(pr), pr.err)
  const dup = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'targeted_probe', $3::jsonb)`, [S.L1, n, JSON.stringify(probeValue({ option: 'A' }))])
  record('pilot', '같은 attempt × probe 중복 거부', fails(dup, /csat_ec_process_probe_once|duplicate/), dup.err)
  const fix = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'targeted_probe', $3::jsonb, $4) id`, [S.L1, n, JSON.stringify(probeValue({ option: 'A' })), pr.rows?.[0]?.id])
  record('pilot', 'probe 정정은 supersede 로(원래 행 보존)', ok(fix) && Number((await admin.query(`select count(*) c from public.csat_ec_process_evidence where kind = 'targeted_probe' and session_id = $1`, [S.L1])).rows[0].c) === 2, fix.err)
  const badShape = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'targeted_probe', $3::jsonb)`, [S.L1, WRONG[1], JSON.stringify(probeValue({ option: null, skipped: false }))])
  record('pilot', '건너뜀 표시 없이 선택 없는 probe 거부(CHECK)', !badShape.ok, badShape.err)
  // 건너뜀
  await as(app, SERVICE, `select public.csat_ec_add_detector_signal($1, $2::smallint, $3, $4, 'det-1', true, '{}')`, [S.L1, WRONG[1], TAX, BKEY])
  const skip = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'targeted_probe', $3::jsonb) id`, [S.L1, WRONG[1], JSON.stringify(probeValue({ option: null, skipped: true }))])
  record('pilot', '건너뜀도 증거로 보존(skipped · 선택 없음)', ok(skip), skip.err)
  const interp = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'interpretation', $3::jsonb)`, [S.L1, n, JSON.stringify({ text: '그 문장을 이렇게 이해했습니다' })])
  const interpBad = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'interpretation', $3::jsonb)`, [S.L1, n, JSON.stringify({ text: '' })])
  record('pilot', 'interpretation 저장 · 빈 해석 거부', ok(interp) && !interpBad.ok, [interp.err, interpBad.err])
  // 교차 계정
  const readOther = await as(app, learner(U.L2), `select count(*) c from public.csat_ec_process_evidence where kind = 'targeted_probe'`)
  const writeOther = await as(app, learner(U.L2), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'targeted_probe', $3::jsonb)`, [S.L1, WRONG[2], JSON.stringify(probeValue())])
  record('pilot', '다른 학습자의 probe 읽기 0행 · 쓰기 거부', ok(readOther) && Number(readOther.rows[0].c) === 0 && fails(writeOther, /자기 응답/), [readOther.rows, writeOther.err])
  const sigRead = await as(app, learner(U.L1), `select count(*) from public.csat_ec_boundary_signal`)
  const svcSig = await as(app, SERVICE, `select count(*) from public.csat_ec_boundary_signal`)
  record('pilot', '경계 관찰 표 직접 읽기 — 학습자 · service_role 모두 권한 없음', fails(sigRead, /permission denied/) && fails(svcSig, /permission denied/), [sigRead.err, svcSig.err])
  const sigUpd = await tryOwner(`update public.csat_ec_boundary_signal set probe_required = false`)
  record('pilot', '경계 관찰은 덧붙이기 전용(UPDATE 거부)', !sigUpd.ok && /덧붙이기 전용/.test(sigUpd.err), sigUpd.err)

  // ── 증거 범위: 같은 응답을 probe 전 · 후로 ──
  const hashes = (await admin.query(`select public.csat_ec_judgment_input_hash($1, $2::smallint) h2, public.csat_ec_judgment_input_hash($1, $2::smallint, 'all') ha,
      public.csat_ec_judgment_input_hash($1, $2::smallint, 'pre_probe') hp,
      (select jsonb_agg(e.id) from public.csat_ec_valid_process_evidence($1, $2::smallint, 'pre_probe') e where e.kind = 'targeted_probe') probe_in_pre`, [S.L1, n])).rows[0]
  record('pilot', "'all' 해시 = 기존 2인자 해시(기존 회차 호환) · 'pre_probe' 는 다르고 probe 를 뺀다",
    hashes.h2 === hashes.ha && hashes.hp !== hashes.ha && hashes.probe_in_pre === null, hashes)

  const refs = ctx.refs
  const mk = async (profile) => {
    const rc = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}'::jsonb, $3) id`, [TAX, TRAP_MAP, profile])
    if (!rc.ok) return { err: rc.err }
    const id = Number(rc.rows[0].id)
    const st = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [id, JSON.stringify(refs)])
    return { id, err: st.err }
  }
  const pre = await mk('pre_probe'); const post = await mk('all')
  const tg = async (id) => (await admin.query(`select t from public.csat_ec_review_round r, jsonb_array_elements(r.targets) t where r.id = $1 and (t->>'session_id')::uuid = $2 and (t->>'item_no')::int = $3`, [id, S.L1, n])).rows[0]?.t
  const tPre = await tg(pre.id), tPost = await tg(post.id)
  const probeIds = (await admin.query(`select array_agg(id::text) a from public.csat_ec_process_evidence where kind = 'targeted_probe' and session_id = $1 and item_no = $2`, [S.L1, n])).rows[0].a
  record('pilot', 'pre_probe 회차 봉인 대상 — probe 증거 id 없음 · post(all) 회차 — 유효 probe 포함 · 두 입력 해시 다름',
    tPre && tPost && !tPre.process_evidence_ids.some((x) => probeIds.includes(x)) && tPost.process_evidence_ids.some((x) => probeIds.includes(x)) && tPre.input_hash !== tPost.input_hash,
    { pre: pre.err, post: post.err, preIds: tPre?.process_evidence_ids?.length, postIds: tPost?.process_evidence_ids?.length })
  const profUpd = await tryOwner(`update public.csat_ec_review_round set evidence_profile = 'all' where id = $1`, [pre.id])
  record('pilot', '대상을 채운 뒤 증거 범위 변경 거부', !profUpd.ok && /증거 범위/.test(profUpd.err), profUpd.err)

  // ── AI: multiple_plausible 후보 · 경계 관찰(draft pre_probe 회차) ──
  const ex = await as(app, SERVICE, `select public.csat_ec_ai_export($1, $2, $3::smallint) x`, [pre.id, S.L1, n])
  const q = passageOf(n).slice(4, 30)
  const claim = (code) => ({ code, role: 'candidate', confidence: 'medium', evidence: { summary: '두 후보 모두 최소 증거가 있다', text_refs: [{ where: 'passage', quote: q }] } })
  const run = (outcome, claims, extra = {}) => as(app, SERVICE, `select public.csat_ec_ai_import($1, $2::jsonb, $3::jsonb) id`, [pre.id,
    JSON.stringify({ session_id: S.L1, item_no: n, taxonomy_version: TAX, choice_trap_map: TRAP_MAP, quality_rule_version: 'rq-1', model: `m-${outcome}`, prompt_version: 'p', analyzer_version: 'a',
      input_hash: ex.rows?.[0]?.x?.input_hash, outcome, output: {}, ...extra }), JSON.stringify(claims)])
  const one = await run('multiple_plausible', [claim('V.word_sense')])
  record('pilot', 'AI multiple_plausible — 후보 1개 거부', fails(one, /후보 2개 이상/), one.err)
  const withPrimary = await run('multiple_plausible', [{ ...claim('V.word_sense'), role: 'primary' }, claim('R.inference')])
  record('pilot', 'AI multiple_plausible — primary 섞임 거부', fails(withPrimary, /primary 없음/), withPrimary.err)
  const mp = await run('multiple_plausible', [claim('V.word_sense'), claim('R.inference')], { boundary_signals: [{ boundary_key: BKEY, probe_required: true }] })
  const mpRows = mp.ok && (await admin.query(`select (select array_agg(role) from public.csat_ec_claim where ai_run_id = $1) roles,
      (select count(*) from public.csat_ec_boundary_signal where ai_run_id = $1 and probe_required) sig`, [mp.rows[0].id])).rows[0]
  record('pilot', 'AI multiple_plausible — 후보 2 · primary 없음 · 경계 관찰(probe 필요) 저장', ok(mp) && mpRows.roles.every((r) => r === 'candidate') && Number(mpRows.sig) === 1, mp.err ?? mpRows)
  const inc = await run('inconsistent_evidence', [])
  record('pilot', 'AI inconsistent_evidence — 후보 없이 저장(원인 특정 안 한 충돌)', ok(inc), inc.err)
  const failSig = await run('failed', [], { failure: 'x', boundary_signals: [{ boundary_key: BKEY }] })
  record('pilot', '실패 실행의 경계 관찰 거부', fails(failSig, /실패한 실행/), failSig.err)

  // ── 판정: multiple · inconsistent 저장(pre_probe 회차 blind) ──
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [pre.id, uid, slot])
  await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [pre.id, JSON.stringify(refs)])
  const sb = await as(app, ADM, `select public.csat_ec_round_start_blind($1) h`, [pre.id])
  record('pilot', 'pre_probe 회차 blind 시작(probe 있는 응답 포함 · 무결성 유지)', ok(sb), sb.err)
  const subm = (uid, outcome, primary, cands, bkeys, probe = false) => as(app, learner(uid),
    `select public.csat_ec_submit_blind($1, $2, $3::smallint, $4, $5, '{}'::text[], '{}'::text[], 'note', $6::text[], $7::text[], $8) id`, [pre.id, S.L1, n, outcome, primary, cands, bkeys, probe])
  const bad1 = await subm(U.RA, 'multiple_plausible', 'V.word_sense', ['V.word_sense', 'R.inference'], [])
  record('pilot', '판정 multiple_plausible + primary 거부', !bad1.ok, bad1.err)
  const bad2 = await subm(U.RA, 'multiple_plausible', null, ['V.word_sense'], [])
  record('pilot', '판정 multiple_plausible 후보 1개 거부', !bad2.ok && /candidates_check/.test(bad2.err), bad2.err)
  const bad3 = await subm(U.RA, 'code', 'V.word_sense', ['R.inference', 'S.core'], [])
  record('pilot', 'identified(code) 에 후보 거부', !bad3.ok && /candidates_check/.test(bad3.err), bad3.err)
  const mA = await subm(U.RA, 'multiple_plausible', null, ['V.word_sense', 'R.inference'], [BKEY], true)
  const mARow = mA.ok && (await admin.query(`select j.primary_code, j.candidate_codes, (select count(*) from public.csat_ec_boundary_signal s where s.judgment_id = j.id and s.probe_required) sig from public.csat_ec_judgment j where j.id = $1`, [mA.rows[0].id])).rows[0]
  record('pilot', '판정 multiple_plausible — primary 없음 · 후보 2 · 경계 관찰 연결', ok(mA) && mARow.primary_code === null && mARow.candidate_codes.length === 2 && Number(mARow.sig) === 1, mA.err ?? mARow)
  const iB = await subm(U.RB, 'inconsistent_evidence', null, ['V.word_sense', 'R.inference'], [BKEY])
  record('pilot', '판정 inconsistent_evidence — 충돌 후보 저장', ok(iB), iB.err)
  const old8 = await as(app, learner(U.RB), `select public.csat_ec_submit_blind($1, $2, $3::smallint, 'code', 'S.core', '{}'::text[], '{}'::text[], 'old api')`, [pre.id, S.L1, WRONG[3]])
  record('pilot', '기존 8인자 submit_blind 그대로 동작(후보 · 경계 없음)', ok(old8), old8.err)
  const jUpd = await tryOwner(`update public.csat_ec_judgment set candidate_codes = '{}' where id = $1`, [mA.rows?.[0]?.id ?? 0])
  record('pilot', '판정은 덮어쓰지 않는다(UPDATE 거부)', !jUpd.ok, jUpd.err)
  // 학습 지도와 연결 없음 — 경계 · 판정 표에 트리거로 다른 표를 바꾸는 경로가 없다
  const trg = (await admin.query(`select tgname from pg_trigger where not tgisinternal and tgrelid in ('public.csat_ec_boundary'::regclass, 'public.csat_ec_boundary_signal'::regclass)`)).rows.map((r) => r.tgname).sort()
  record('pilot', '새 표의 트리거는 가드뿐(다른 표 · 학습 지도 갱신 없음)', JSON.stringify(trg) === JSON.stringify(['csat_ec_boundary_guard', 'csat_ec_boundary_signal_guard', 'csat_ec_boundary_signal_no_update']), trg)
  ctx.pilotRounds = { pre: pre.id, post: post.id }
}
