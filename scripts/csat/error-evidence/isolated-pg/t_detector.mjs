// scripts/csat/error-evidence/isolated-pg/t_detector.mjs
// G4 경계 감지기(20261006120000_csat_ec_boundary_detector.sql) — 결정론 감지 · 증거 부족 · 멱등 · 정정 재평가(취소 · obsolete · 재출현)
// · 정오 무관(정답 · 오답 P/N 쌍) · AI/판정 출처 대기 제외 · 수집 종료 뒤 거부 · 판정/원인/숙달 쓰기 0 · 데이터 구동(다른 경계 키) · 자유서술 슬롯 · 권한.
// t_reveal 뒤에 돈다(Reveal Gate 객체 · 관리자 · 시험 데이터를 쓴다). 경계 키 · probe 키는 이 파일의 픽스처일 뿐이다(감지기는 데이터에서 읽는다).
import { as, record } from './lib.mjs'
import { ANON, EXAM, SERVICE, U, answerOf, learner } from './seed.mjs'
import { fails, ok } from './t_flow.mjs'

const TA = 'v0.7', TB = 'v0.6', TF = 'v0.5'
const BK_VW = 'r.inference__v.wrong_sense', BK_SC = 'r.inference__s.core', BK_ES = 'e.option_check__s.modifier_scope', BK_F = 'r.inference__v.wrong_sense'
const D = Object.fromEntries(['A', 'B', 'C', 'W', 'E', 'F', 'G', 'H', 'X'].map((k, i) => [k, `00000000-0000-4000-8000-0000000d00${String(i + 10)}`]))
const H64 = 'c'.repeat(64)
const TARGETS = [18, 19, 20, 21, 22, 23, 24, 25]

export default async function detector(admin, ctx) {
  const { app, owner } = ctx
  const ADM = learner(U.ADM)
  await admin.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[]) on conflict do nothing`, [Object.values(D), Object.keys(D).map((k) => `det-${k}@test`)])
  const forbidCounts = async () => (await admin.query(`select (select count(*) from public.csat_ec_judgment) j, (select count(*) from public.csat_ec_claim) c, (select count(*) from public.csat_ec_ai_run) a,
      (select count(*) from public.csat_learner_state) m, (select count(*) from public.csat_dx_snapshot) s`)).rows[0]
  const counts0 = await forbidCounts()

  // ── taxonomy 픽스처(봉인 · TEST 아님) ──
  const tax = async (v, codes, bounds) => {
    await owner.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, 'detector fixture (isolated)')`, [v])
    for (const [code, group] of codes)
      await owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ($1, $2, left($2, 1), $2, 'd', 'i', 'e', $3)`, [v, code, group])
    for (const [a, b, status, probe, prov] of bounds)
      await owner.query(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, probe_key, decision_note, provenance) values ($1, lower($2) || '__' || lower($3), $2, $3, $4, $5, 'fixture', $6::jsonb)`,
        [v, a, b, status, probe, JSON.stringify(prov ?? {})])
    return as(app, ADM, `select public.csat_ec_taxonomy_seal($1)`, [v])
  }
  const sA = await tax(TA, [['V.wrong_sense', 'word'], ['R.inference', 'flow'], ['S.core', 'sentence'], ['E.option_check', 'choice']],
    [['R.inference', 'V.wrong_sense', 'provisional', 'pa_probe'], ['R.inference', 'S.core', 'provisional', 'pc_probe'], ['E.option_check', 'S.core', 'accepted', null]])
  const sB = await tax(TB, [['E.option_check', 'choice'], ['S.modifier_scope', 'sentence'], ['V.wrong_sense', 'word']], [['E.option_check', 'S.modifier_scope', 'provisional', 'pb_probe']])
  const sF = await tax(TF, [['V.wrong_sense', 'word'], ['R.inference', 'flow']], [['R.inference', 'V.wrong_sense', 'provisional', 'pf_probe', { detector: { free_text_patterns: ['(', '비유'] } }]])
  record('detector', '픽스처 taxonomy 3개 봉인', ok(sA) && ok(sB) && ok(sF), [sA.err, sB.err, sF.err])

  // ── 세션: 기록 저장(service) → 수집 열기(학습자) ──
  let keyN = 0
  const resp = (choose) => Array.from({ length: 45 }, (_, i) => { const n = i + 1; const c = choose(n); return { item_no: n, item_id: `${EXAM}#${n}`, chosen_option: c, is_correct: c === answerOf(n) } })
  const wrongAll = (n) => (answerOf(n) % 5) + 1
  const mk = async (uid, taxv, probes, choose = wrongAll, targets = TARGETS) => {
    keyN += 1
    const key = `dddddddd-dddd-4ddd-8ddd-${String(keyN).padStart(12, '0')}`
    const cfg = { probe_cap: null, probes: probes.map((k) => ({ key: k, version: '1.0.0', prompt_hash: H64 })) }
    const h = await as(app, SERVICE, `select public.csat_ec_record_session_held($1::jsonb, $2::jsonb, true, $3, $4::jsonb, $5::smallint[], true) r`,
      [JSON.stringify({ user_id: uid, exam_id: EXAM, mode: 'live', taken_at: '2026-10-06', client_key: key, raw_score: 50 }), JSON.stringify(resp(choose)), taxv, JSON.stringify(cfg), targets])
    if (!h.ok) throw new Error(`세션 저장 실패: ${h.err}`)
    const sid = h.rows[0].r.session_id
    const o = await as(app, learner(uid), `select public.csat_ec_capture_open($1) s`, [sid])
    if (!o.ok || o.rows[0].s !== 'collecting') throw new Error(`수집 열기 실패: ${o.err ?? o.rows[0].s}`)
    return sid
  }
  const peErrs = []   // 예상하지 않은 저장 실패(감지기 예외가 증거 저장을 깨면 여기 남는다)
  const pe = async (uid, sid, no, kind, value, sup = null) => {
    const r = await as(app, learner(uid), `select public.csat_ec_add_process_evidence($1, $2::smallint, $3, $4::jsonb, $5) id`, [sid, no, kind, JSON.stringify(value), sup])
    if (!r.ok && !/interpretation_check|수집은 끝났다/.test(r.err)) peErrs.push({ no, kind, err: r.err })
    return r
  }
  const ANS = (t = '그 낱말을 결과라는 뜻으로 읽었습니다') => ({ state: 'answered', text: t })
  const runs = async (sid, no) => (await admin.query(`select result, boundary_keys, probe_boundary_key, input_evidence_ids from public.csat_ec_detector_run where session_id = $1 and item_no = $2 order by id`, [sid, no])).rows
  const sigs = async (sid, no) => (await admin.query(`select s.id, s.boundary_key, s.probe_required, s.source, r.reason from public.csat_ec_boundary_signal s
      left join public.csat_ec_boundary_signal_retraction r on r.signal_id = s.id where s.session_id = $1 and s.item_no = $2 order by s.id`, [sid, no])).rows
  const active = (rows) => rows.filter((r) => r.source === 'detector' && !r.reason)
  const pending = async (uid, sid) => { const r = await as(app, learner(uid), `select item_no, boundary_key, probe_key from public.csat_ec_my_pending_probes($1) order by item_no`, [sid]); return r.ok ? r.rows : `ERR ${r.err}` }
  const last = async (sid, no) => (await runs(sid, no)).at(-1)?.result
  const curId = async (sid, no, kind) => (await admin.query(`select p.id from public.csat_ec_process_evidence p where p.session_id = $1 and p.item_no = $2 and p.kind = $3
      and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id) order by p.created_at desc limit 1`, [sid, no, kind])).rows[0]?.id
  const probeVal = (taxv, bk, key, option = 'B') => ({ probe_key: key, probe_version: '1.0.0', taxonomy_version: taxv, boundary_key: bk, prompt_hash: H64, option, skipped: option === null })
  const apr = (uid, sid, no, v) => as(app, learner(uid), `select public.csat_ec_add_probe_response($1, $2::smallint, $3::jsonb, null) id`, [sid, no, JSON.stringify(v)])

  // ════ 1. 경계 충족 · 증거 부족 · 경계 없음 ════
  const A = D.A, sa = await mk(A, TA, ['pa_probe'])
  await pe(A, sa, 18, 'category', { group: 'word' }); await pe(A, sa, 18, 'interpretation', ANS())
  const s18 = await sigs(sa, 18)
  record('detector', '경계 충족(해석 answered + 범주 ∈ 경계 범주) → 신호 1 · probe 필요 · 대기 probe 1', await last(sa, 18) === 'boundary' && s18.length === 1 && s18[0].boundary_key === BK_VW && s18[0].probe_required
    && JSON.stringify(await pending(A, sa)) === JSON.stringify([{ item_no: 18, boundary_key: BK_VW, probe_key: 'pa_probe' }]), { runs: await runs(sa, 18), s18, p: await pending(A, sa) })
  await pe(A, sa, 19, 'interpretation', ANS())
  await pe(A, sa, 20, 'category', { group: 'unsure' }); await pe(A, sa, 20, 'interpretation', ANS())
  await pe(A, sa, 21, 'category', { group: 'time' }); await pe(A, sa, 21, 'interpretation', ANS())
  await pe(A, sa, 22, 'category', { group: 'word' }); await pe(A, sa, 22, 'interpretation', { state: 'unknown' })
  record('detector', '범주 없음 → insufficient_evidence · 신호 0', await last(sa, 19) === 'insufficient_evidence' && (await sigs(sa, 19)).length === 0, await runs(sa, 19))
  record('detector', '범주 「모름」(unsure) → insufficient_evidence · 신호 0', await last(sa, 20) === 'insufficient_evidence' && (await sigs(sa, 20)).length === 0, await runs(sa, 20))
  record('detector', '범주가 경계 밖(time) → no_boundary · 신호 0', await last(sa, 21) === 'no_boundary' && (await sigs(sa, 21)).length === 0, await runs(sa, 21))
  record('detector', '해석 unknown(범주 word 여도) → insufficient_evidence · 신호 0', await last(sa, 22) === 'insufficient_evidence' && (await sigs(sa, 22)).length === 0, await runs(sa, 22))
  const r30 = await pe(A, sa, 30, 'interpretation', ANS())
  record('detector', '대상 밖 문항 → skipped_not_target · 신호 0', ok(r30) && await last(sa, 30) === 'skipped_not_target' && (await sigs(sa, 30)).length === 0, r30.err)

  // ════ 2. 재실행 멱등 ════
  const n0 = { r: (await runs(sa, 18)).length, s: (await sigs(sa, 18)).length }
  const rr = []
  for (let i = 0; i < 3; i++) rr.push(await as(app, SERVICE, `select public.csat_ec_detect_boundaries_rerun($1, 18::smallint) r`, [sa]))
  await pe(A, sa, 18, 'interpretation', ANS())   // 같은 값 재전송(같은 id — 새 행 없음)
  const n1 = { r: (await runs(sa, 18)).length, s: (await sigs(sa, 18)).length }
  record('detector', '같은 증거로 rerun 3회 + 같은 값 재전송 → 결과 같음 · 실행 기록 · 신호 행 그대로', rr.every((x) => ok(x) && x.rows[0].r === 'boundary') && n0.r === n1.r && n0.s === n1.s, { n0, n1, rr: rr.map((x) => x.err ?? x.rows[0].r) })
  await pe(A, sa, 18, 'reason', { text: '앞 문장과 연결해서 골랐어요' })
  const n2 = { r: (await runs(sa, 18)).length, s: (await sigs(sa, 18)).length }
  record('detector', '증거가 더해지면(이유) 다시 평가 — 경계 그대로면 신호는 늘지 않고 실행 기록만 1행', n2.s === n1.s && n2.r === n1.r + 1 && await last(sa, 18) === 'boundary', { n1, n2 })

  // ════ 3. 정정으로 경계 소멸 · 미응답 → 대기 취소 ════
  await pe(A, sa, 18, 'category', { group: 'time' }, await curId(sa, 18, 'category'))
  const c1 = await sigs(sa, 18)
  record('detector', '정정(범주 word→time)으로 경계 소멸 · 미응답 → 신호 cancelled · 대기 목록에서 사라짐', await last(sa, 18) === 'no_boundary' && c1.length === 1 && c1[0].reason === 'cancelled'
    && (await pending(A, sa)).length === 0, { c1, p: await pending(A, sa) })
  const late = await apr(A, sa, 18, probeVal(TA, BK_VW, 'pa_probe'))
  record('detector', '취소된 질문에 응답 거부', fails(late, /요구된 probe/), late.err)

  // ════ 4. 경계 재출현 → 새 신호 ════
  await pe(A, sa, 18, 'category', { group: 'word' }, await curId(sa, 18, 'category'))
  const c2 = await sigs(sa, 18)
  record('detector', '다시 정정(time→word) → 새 신호(옛 행 보존) · 대기 probe 다시 1', await last(sa, 18) === 'boundary' && c2.length === 2 && active(c2).length === 1 && active(c2)[0].id !== c1[0].id
    && (await pending(A, sa)).length === 1, { c2, p: await pending(A, sa) })

  // ════ 5. 응답 뒤 소멸 → 기록 보존 + obsolete ════
  const ans = await apr(A, sa, 18, probeVal(TA, BK_VW, 'pa_probe'))
  record('detector', '활성 detector 신호의 probe 응답 저장 · 대기 0', ok(ans) && (await pending(A, sa)).length === 0, ans.err)
  await pe(A, sa, 18, 'category', { group: 'time' }, await curId(sa, 18, 'category'))
  const c3 = await sigs(sa, 18)
  const probes18 = Number((await admin.query(`select count(*) n from public.csat_ec_process_evidence where session_id = $1 and item_no = 18 and kind = 'targeted_probe'`, [sa])).rows[0].n)
  record('detector', '응답 뒤 경계 소멸 → 응답 · 신호 행 보존 + obsolete 표시 · 대기 0', c3.length === 2 && c3.at(-1).reason === 'obsolete' && probes18 === 1 && (await pending(A, sa)).length === 0, { c3, probes18 })
  await pe(A, sa, 18, 'category', { group: 'word' }, await curId(sa, 18, 'category'))
  const c4 = await sigs(sa, 18)
  record('detector', 'obsolete 뒤 재출현 → 새 신호 · 이미 답한 질문은 다시 묻지 않음', c4.length === 3 && active(c4).length === 1 && (await pending(A, sa)).length === 0, c4)
  const upd = await (async () => { try { await owner.query(`update public.csat_ec_boundary_signal_retraction set reason = 'cancelled'`); return { ok: true } } catch (e) { return { ok: false, err: e.message } } })()
  const upd2 = await (async () => { try { await owner.query(`update public.csat_ec_detector_run set result = 'no_boundary'`); return { ok: true } } catch (e) { return { ok: false, err: e.message } } })()
  record('detector', '취소 표 · 실행 기록은 덧붙이기 전용(UPDATE 거부)', !upd.ok && !upd2.ok && /덧붙이기 전용/.test(upd.err) && /덧붙이기 전용/.test(upd2.err), [upd.err, upd2.err])

  // ════ 6. 여러 경계 · probe 하나(허용 probe 우선 · 사전순) ════
  await pe(A, sa, 23, 'category', { group: 'flow' }); await pe(A, sa, 23, 'interpretation', ANS())
  const m1 = await sigs(sa, 23)
  record('detector', '범주 flow → 경계 2 신호 · probe 는 허용 목록(pa_probe)에 있는 경계 하나만', m1.length === 2 && m1.filter((x) => x.probe_required).map((x) => x.boundary_key).join() === BK_VW, m1)
  const sb2 = await mk(D.B, TA, ['pa_probe', 'pc_probe'])
  await pe(D.B, sb2, 18, 'category', { group: 'flow' }); await pe(D.B, sb2, 18, 'interpretation', ANS())
  const m2 = await sigs(sb2, 18)
  record('detector', '둘 다 허용이면 사전순 첫 경계(r.inference__s.core)에만 probe', m2.length === 2 && m2.filter((x) => x.probe_required).map((x) => x.boundary_key).join() === BK_SC, m2)
  const sb3 = await mk(D.H, TA, [])
  await pe(D.H, sb3, 18, 'category', { group: 'word' }); await pe(D.H, sb3, 18, 'interpretation', ANS())
  const m3 = await sigs(sb3, 18)
  record('detector', '허용 probe 없는 capture → 신호는 남고 probe 요구 없음(문구 없는 질문을 띄우지 않음)', m3.length === 1 && !m3[0].probe_required && (await pending(D.H, sb3)).length === 0, m3)

  // ════ 7. 정오 무관 — 같은 증거 · 정답 attempt 와 오답 attempt ════
  const sc = await mk(D.C, TA, ['pa_probe'], (n) => answerOf(n))
  const sw = await mk(D.W, TA, ['pa_probe'], wrongAll)
  const correctness = (await admin.query(`select session_id, bool_and(is_correct) a, bool_or(is_correct) o from public.csat_dx_response where session_id = any($1::uuid[]) and item_no = any($2::smallint[]) group by 1`, [[sc, sw], TARGETS])).rows
  const script = async (uid, sid) => {
    const errs = []
    const go = async (no, kind, v) => { const r = await pe(uid, sid, no, kind, v); errs.push(r.ok ? 'ok' : r.err) }
    await go(18, 'category', { group: 'word' }); await go(18, 'interpretation', ANS())
    await go(19, 'interpretation', ANS())
    await go(20, 'category', { group: 'unsure' }); await go(20, 'interpretation', ANS())
    await go(21, 'category', { group: 'time' }); await go(21, 'interpretation', ANS())
    await go(22, 'interpretation', { state: 'answered', text: '' })   // 형식 오류
    await go(30, 'interpretation', ANS())                              // 대상 밖
    const fix = await pe(uid, sid, 18, 'category', { group: 'time' }, await curId(sid, 18, 'category')); errs.push(fix.ok ? 'ok' : fix.err)
    const back = await pe(uid, sid, 18, 'category', { group: 'word' }, await curId(sid, 18, 'category')); errs.push(back.ok ? 'ok' : back.err)
    const view = {}
    for (const no of [18, 19, 20, 21, 22, 30]) view[no] = { runs: (await runs(sid, no)).map((r) => [r.result, r.boundary_keys, r.probe_boundary_key, r.input_evidence_ids.length]),
      sigs: (await sigs(sid, no)).map((s) => [s.boundary_key, s.probe_required, s.reason]) }
    return { errs, view, pending: (await pending(uid, sid)) }
  }
  const pc = await script(D.C, sc), pw = await script(D.W, sw)
  record('detector', '정답 attempt · 오답 attempt 쌍 — 결과 · 신호 · 대기 probe · 오류가 같다(오라클 0)',
    correctness.length === 2 && correctness.some((r) => r.a) && correctness.some((r) => !r.o)
    && JSON.stringify(pc) === JSON.stringify(pw) && pc.view[18].sigs.length === 2, { correctness, pc, pw: JSON.stringify(pc) === JSON.stringify(pw) ? 'same' : pw })

  // ════ 8. AI · 판정 출처 신호는 대기 probe 가 아니다 ════
  const ids = (await admin.query(`select (select min(id) from public.csat_ec_ai_run) a, (select min(id) from public.csat_ec_judgment) j`)).rows[0]
  const c8 = await admin.connect()
  try {
    // 픽스처만 — 다른 응답의 AI 실행 · 판정 id 를 이 응답에 붙이려고 트리거(무결성 가드)를 잠시 끈 세션에서 넣는다
    await c8.query(`set session_replication_role = replica`)
    await c8.query(`insert into public.csat_ec_boundary_signal (session_id, item_no, taxonomy_version, boundary_key, boundary_status, source, ai_run_id, probe_required) values ($1, 24, $2, $3, 'provisional', 'ai_run', $4, true)`, [sa, TA, BK_VW, ids.a])
    await c8.query(`insert into public.csat_ec_boundary_signal (session_id, item_no, taxonomy_version, boundary_key, boundary_status, source, judgment_id, probe_required) values ($1, 25, $2, $3, 'provisional', 'judgment', $4, true)`, [sa, TA, BK_VW, ids.j])
  } finally { await c8.query(`set session_replication_role = origin`); c8.release() }
  const p8 = await pending(A, sa)
  const a24 = await apr(A, sa, 24, probeVal(TA, BK_VW, 'pa_probe'))
  const a25 = await apr(A, sa, 25, probeVal(TA, BK_VW, 'pa_probe'))
  record('detector', 'ai_run · judgment 출처 probe_required 신호 → 대기 probe 0 · 응답도 거부', Array.isArray(p8) && !p8.some((x) => [24, 25].includes(x.item_no)) && fails(a24, /요구된 probe/) && fails(a25, /요구된 probe/), { p8, a24: a24.err, a25: a25.err })

  // ════ 9. 수집 종료 뒤 새 신호 거부 ════
  const se = await mk(D.E, TA, ['pa_probe'])
  await pe(D.E, se, 18, 'interpretation', ANS())
  const cl = await as(app, ADM, `select public.csat_ec_capture_close($1, $2, 'detector test') n`, [D.E, EXAM])
  const eSig = await as(app, SERVICE, `select public.csat_ec_add_detector_signal($1, 18::smallint, $2, $3, 'bd-0.1.0', true, '{}')`, [se, TA, BK_VW])
  const eRe = await as(app, SERVICE, `select public.csat_ec_detect_boundaries_rerun($1, 18::smallint)`, [se])
  const eEv = await pe(D.E, se, 18, 'category', { group: 'word' })
  record('detector', 'closed_incomplete 뒤 — detector 신호 · rerun · 증거 모두 거부 · 신호 0', ok(cl) && fails(eSig, /수집은 끝났다/) && fails(eRe, /수집 중인 기록만/) && fails(eEv, /수집은 끝났다/) && (await sigs(se, 18)).length === 0,
    [cl.err, eSig.err, eRe.err, eEv.err])
  const sf = await mk(D.F, TA, ['pa_probe'], wrongAll, [18, 19])
  await as(app, learner(D.F), `select public.csat_ec_confirm_session($1, true, true)`, [sf])
  await pe(D.F, sf, 18, 'category', { group: 'word' }); await pe(D.F, sf, 18, 'interpretation', ANS()); await pe(D.F, sf, 19, 'interpretation', { state: 'skipped' })
  const pBefore = await pending(D.F, sf)
  const fin = await as(app, learner(D.F), `select public.csat_ec_capture_finish($1) r`, [sf])
  const fSig = await as(app, SERVICE, `select public.csat_ec_add_detector_signal($1, 19::smallint, $2, $3, 'bd-0.1.0', false, '{}')`, [sf, TA, BK_VW])
  const fRe = await as(app, SERVICE, `select public.csat_ec_detect_boundaries_rerun($1, 18::smallint)`, [sf])
  const fAns = await apr(D.F, sf, 18, probeVal(TA, BK_VW, 'pa_probe'))
  record('detector', 'completed 뒤 — 대기 probe 0(미응답은 묻지 않음) · 새 신호 · rerun · 응답 거부 · 신호 행 그대로',
    pBefore.length === 1 && ok(fin) && fin.rows[0].r.status === 'completed' && (await pending(D.F, sf)).length === 0 && fails(fSig, /수집은 끝났다/) && fails(fRe, /수집 중인 기록만/) && fails(fAns, /수집은 끝났다|요구된/)
    && (await sigs(sf, 18)).length === 1 && (await sigs(sf, 19)).length === 0, { pBefore, fin: fin.err ?? fin.rows[0].r, fSig: fSig.err, fRe: fRe.err, fAns: fAns.err })
  // held(열기 전) — 기록 저장만 하고 열지 않은 세션
  const heldKey = 'eeeeeeee-eeee-4eee-8eee-000000000001'
  const hh = await as(app, SERVICE, `select public.csat_ec_record_session_held($1::jsonb, $2::jsonb, true, $3, '{"probes":[{"key":"pa_probe","version":"1.0.0"}]}'::jsonb, $4::smallint[], true) r`,
    [JSON.stringify({ user_id: D.X, exam_id: EXAM, mode: 'live', taken_at: '2026-10-06', client_key: heldKey, raw_score: 50 }), JSON.stringify(resp(wrongAll)), TA, TARGETS])
  const shd = hh.rows?.[0]?.r?.session_id
  await pe(D.X, shd, 18, 'category', { group: 'word' }); await pe(D.X, shd, 18, 'interpretation', ANS())
  record('detector', 'held(수집 열기 전) → skipped_not_collecting · 신호 0', ok(hh) && await last(shd, 18) === 'skipped_not_collecting' && (await sigs(shd, 18)).length === 0, hh.err ?? await runs(shd, 18))
  const noCap = ctx.S.L2
  await pe(U.L2, noCap, 40, 'interpretation', ANS())
  record('detector', 'capture 없는 기록 → skipped_no_capture · 신호 0', await last(noCap, 40) === 'skipped_no_capture' && (await sigs(noCap, 40)).length === 0, await runs(noCap, 40))

  // ════ 10. 데이터 구동 — 다른 taxonomy · 다른 경계 키 · 다른 probe 로도 같은 동작 ════
  const sbB = await mk(D.B, TB, ['pb_probe'])
  await pe(D.B, sbB, 18, 'category', { group: 'choice' }); await pe(D.B, sbB, 18, 'interpretation', ANS())
  await pe(D.B, sbB, 19, 'category', { group: 'word' }); await pe(D.B, sbB, 19, 'interpretation', ANS())
  const b18 = await sigs(sbB, 18)
  record('detector', '다른 경계(e.option_check__s.modifier_scope · pb_probe) — 범주 choice 감지 · word 는 no_boundary', b18.length === 1 && b18[0].boundary_key === BK_ES && b18[0].probe_required
    && await last(sbB, 19) === 'no_boundary' && JSON.stringify((await pending(D.B, sbB)).map((x) => x.probe_key)) === '["pb_probe"]', { b18, r19: await runs(sbB, 19) })

  // ════ 11. 자유서술 예외 슬롯 — 봉인된 경계 메타데이터의 패턴이 있을 때만 ════
  const sfF = await mk(D.G, TF, ['pf_probe'])
  await pe(D.G, sfF, 18, 'interpretation', ANS('비유로 쓰인 표현이라 그렇게 읽었어요'))
  await pe(D.G, sfF, 19, 'interpretation', ANS('그냥 그렇게 읽었어요'))
  await pe(D.G, sfF, 20, 'category', { group: 'unsure' }); await pe(D.G, sfF, 20, 'interpretation', ANS('비유인 것 같았어요'))
  const f18 = await sigs(sfF, 18)
  record('detector', '자유서술 슬롯 — 범주 없음 + 패턴 일치 → 감지 · 불일치 → insufficient · 잘못된 패턴은 무시', f18.length === 1 && f18[0].boundary_key === BK_F
    && await last(sfF, 19) === 'insufficient_evidence' && await last(sfF, 20) === 'boundary', { f18, r19: await runs(sfF, 19), r20: await runs(sfF, 20) })
  const sA2 = await mk(D.G, TA, ['pa_probe'])
  await pe(D.G, sA2, 18, 'interpretation', ANS('비유로 쓰인 표현이라 그렇게 읽었어요'))
  record('detector', '패턴 메타데이터 없는 taxonomy(v0.1 seed 와 같은 형태) → 같은 글이어도 insufficient(슬롯 비활성)', await last(sA2, 18) === 'insufficient_evidence' && (await sigs(sA2, 18)).length === 0, await runs(sA2, 18))

  // ════ 12. 권한 ════
  const lDet = await as(app, learner(A), `select public.csat_ec_detect_boundaries($1, 18::smallint, null)`, [sa])
  const sDet = await as(app, SERVICE, `select public.csat_ec_detect_boundaries($1, 18::smallint, null)`, [sa])
  const lRe = await as(app, learner(A), `select public.csat_ec_detect_boundaries_rerun($1, 18::smallint)`, [sa])
  const aRe = await as(app, ANON, `select public.csat_ec_detect_boundaries_rerun($1, 18::smallint)`, [sa])
  const lTrg = await as(app, learner(A), `select public.csat_ec_process_evidence_detect()`)
  const lRun = await as(app, learner(A), `select count(*) from public.csat_ec_detector_run`)
  const lRet = await as(app, learner(A), `select count(*) from public.csat_ec_boundary_signal_retraction`)
  const sRun = await as(app, SERVICE, `select count(*) from public.csat_ec_detector_run`)
  record('detector', '권한 — 감지 함수: 학습자 · service 모두 직접 호출 불가 · rerun: 학습자 · anon 불가 · 실행 기록/취소 표: 학습자 · service 조회 불가',
    [lDet, sDet, lRe, aRe, lRun, lRet, sRun].every((r) => fails(r, /permission denied/)) && !lTrg.ok, [lDet, sDet, lRe, aRe, lTrg, lRun, lRet, sRun].map((r) => r.err))
  const acl = (await admin.query(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') au, has_function_privilege('anon', p.oid, 'execute') an, has_function_privilege('service_role', p.oid, 'execute') sv
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('csat_ec_detect_boundaries', 'csat_ec_process_evidence_detect', 'csat_ec_detect_boundaries_rerun', 'csat_ec_my_pending_probes', 'csat_ec_add_process_evidence') order by 1`)).rows
  const want = { csat_ec_add_process_evidence: [true, false, false], csat_ec_detect_boundaries: [false, false, false], csat_ec_detect_boundaries_rerun: [false, false, true], csat_ec_my_pending_probes: [true, false, false], csat_ec_process_evidence_detect: [false, false, false] }
  record('detector', '함수 EXECUTE = manifest class(OWNER_ONLY · TRIGGER_ONLY · SERVICE_ONLY · AUTH_SELF_RPC ×2) · PUBLIC 없음', acl.length === 5 && acl.every((r) => JSON.stringify([r.au, r.an, r.sv]) === JSON.stringify(want[r.proname])), acl)

  // ════ 13. 감지기 본문 — 금지 입력 · 쓰기 대상 · 하드코딩 ════
  const defs = (await admin.query(`select string_agg(pg_get_functiondef(p.oid), chr(10)) d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('csat_ec_detect_boundaries', 'csat_ec_process_evidence_detect', 'csat_ec_detect_boundaries_rerun')`)).rows[0].d
  const body = defs.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
  const forbidden = [/\bis_correct\b/, /\bchosen_option\b/, /\banswer\b/, /csat_items\b/, /csat_dx_response/, /csat_dx_snapshot/, /csat_dx_answer_key/, /csat_ec_judgment/, /csat_ec_ai_run/, /csat_ec_claim/, /csat_ec_item_input_hash/, /csat_learner_state/]
    .filter((re) => re.test(body)).map(String)
  const writes = [...body.matchAll(/\b(insert\s+into|update|delete\s+from)\s+public\.(\w+)/gi)].map((m) => m[2])
  const literals = [...body.matchAll(/'(word|sentence|flow|evidence|choice|time)'|[a-z]\.[a-z_]+__[a-z]\.[a-z_]+|'[VSREBX]\.[a-z_]+'|'(?!targeted_probe')[a-z0-9_]*_probe'/g)].map((m) => m[0])
  record('detector', '감지기 본문 — 정오 · 정답 · 판정 · AI · 숙달 표 읽기 0 · 쓰기는 실행 기록 · 신호 · 취소 표만 · 경계/범주/코드/probe 리터럴 0',
    forbidden.length === 0 && writes.length > 0 && writes.every((t) => ['csat_ec_detector_run', 'csat_ec_boundary_signal', 'csat_ec_boundary_signal_retraction'].includes(t)) && literals.length === 0, { forbidden, writes, literals })

  // ════ 14. 판정 · 원인 · 숙달 쓰기 0 ════
  const counts1 = await forbidCounts()
  record('detector', '감지 · probe 전 과정에서 판정 · claim · AI 실행 · 학습 상태 · 스냅샷 행 수 불변', JSON.stringify(counts0) === JSON.stringify(counts1), { counts0, counts1 })
  const trg = (await admin.query(`select tgrelid::regclass::text t, tgname from pg_trigger where not tgisinternal and tgfoid in (select oid from pg_proc where proname = 'csat_ec_process_evidence_detect')`)).rows
  record('detector', '감지 트리거는 과정 증거 표 하나에만', trg.length === 1 && trg[0].t === 'csat_ec_process_evidence', trg)

  record('detector', '감지기 때문에 실패한 증거 저장 0(형식 오류 · 종료 뒤 거부 외)', peErrs.length === 0, peErrs.slice(0, 5))

  // 정리 — 이 파일이 연 수집을 닫는다(열린 수집은 시험 단위 보류라 뒤 테스트의 정답 · 범주 보고를 막는다)
  for (const uid of Object.values(D)) await as(app, ADM, `select public.csat_ec_capture_close($1, $2, 'detector test cleanup')`, [uid, EXAM])
  const open = Number((await admin.query(`select count(*) n from public.csat_ec_capture_session c join public.csat_dx_session s on s.id = c.session_id where s.user_id = any($1::uuid[]) and c.status in ('held', 'collecting')`, [Object.values(D)])).rows[0].n)
  record('detector', '정리 — 이 테스트의 수집 모두 종료', open === 0, open)
}
