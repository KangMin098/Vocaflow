// scripts/csat/error-evidence/isolated-pg/t_reveal.mjs
// Reveal Gate(20261005170000_csat_ec_reveal_gate.sql) — 상태 표 · 전이 · 완료 조건 · 시험 단위 전역 보류 · 정책 · 뷰 · oracle · 판정자 마스킹 · 묘비 · 동시성 · 감사 이벤트
import { as, openTx, record } from './lib.mjs'
import { ANON, EXAM, SERVICE, U, WRONG, answerOf, learner } from './seed.mjs'
import { fails, ok } from './t_flow.mjs'

const TAX = 'v0.9'   // 봉인 · TEST 아님(Pilot taxonomy 역할)
const P = { P1: '00000000-0000-4000-8000-0000000000f1', P2: '00000000-0000-4000-8000-0000000000f2', P3: '00000000-0000-4000-8000-0000000000f3', N1: '00000000-0000-4000-8000-0000000000f4' }
const CANARY = 'CANARY-EXPLANATION-7f3a'

export default async function reveal(admin, ctx) {
  const { app, owner } = ctx
  const ADM = learner(U.ADM)
  const tryOwner = async (sql, params = []) => { try { await owner.query(sql, params); return { ok: true } } catch (e) { return { ok: false, err: e.message } } }
  await admin.query(`update public.csat_ec_review_round set status = 'cancelled', cancelled_at = now(), cancel_reason = 'reveal-test' where status not in ('closed', 'cancelled')`)
  await admin.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[]) on conflict do nothing`, [Object.values(P), Object.keys(P).map((k) => `${k}@test`)])

  // 준비 — Pilot taxonomy · 공개 해설(canary) · 뼈대 · 유형 보고서 · 스냅샷
  await owner.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, 'pilot candidate (isolated)')`, [TAX])
  await owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ($1, 'V.word_sense', 'V', 'l', 'd', 'i', 'e', 'word')`, [TAX])
  record('reveal', 'Pilot taxonomy 봉인', ok(await as(app, ADM, `select public.csat_ec_taxonomy_seal($1)`, [TAX])))
  await admin.query(`update public.csat_items set type_id = 'T-INFER' where exam_id = $1 and no between 18 and 24`, [EXAM])
  await admin.query(`insert into public.csat_item_analyses (item_id, status, choice_analysis) select id, 'published', jsonb_build_object('why', $2::text) from public.csat_items where exam_id = $1 and no >= 18`, [EXAM, CANARY])
  await admin.query(`insert into public.csat_item_skeletons (item_id, exam_id, data) select id, exam_id, jsonb_build_object('answer_quote', $2::text) from public.csat_items where exam_id = $1 and no >= 18`, [EXAM, CANARY])
  await admin.query(`insert into public.csat_type_reports (type_id, status, failure_modes) values ('T-INFER', 'published', jsonb_build_object('case', $1::text))`, [CANARY])
  await admin.query(`insert into public.csat_dx_snapshot (user_id, session_id, raw_score) select user_id, id, 50 from public.csat_dx_session where user_id = $1 limit 1`, [U.L2])
  await admin.query(`insert into public.csat_session_attempts (user_id, item_id, correct) values ($1, $2, true)`, [U.L2, `${EXAM}#20`])
  await admin.query(`insert into public.csat_trap_attempts (user_id, item_id, choice, is_correct) values ($1, $2, 3, false)`, [U.L2, `${EXAM}#21`])
  await admin.query(`insert into public.csat_review_queue (user_id, item_id, stage) values ($1, $2, 1)`, [U.L2, `${EXAM}#22`])

  const seen = async (who) => {
    const q = async (sql, p = []) => { const r = await as(app, who, sql, p); return r.ok ? r.rows : `ERR ${r.err}` }
    return {
      analyses: (await q(`select count(*)::int n from public.csat_item_analyses where item_id like $1`, [EXAM + '#%']))[0]?.n,
      answers: (await q(`select count(*) filter (where answer is not null)::int n from public.csat_items_public where exam_id = $1`, [EXAM]))[0]?.n,
      skeletons: (await q(`select count(*)::int n from public.csat_item_skeletons where exam_id = $1`, [EXAM]))[0]?.n,
      report: (await q(`select count(*)::int n from public.csat_type_reports where type_id = 'T-INFER'`))[0]?.n,
      sessions: (await q(`select count(*)::int n from public.csat_dx_session where exam_id = $1`, [EXAM]))[0]?.n,
      responses: (await q(`select count(*)::int n from public.csat_dx_response r join public.csat_dx_session s on s.id = r.session_id where s.exam_id = $1`, [EXAM]))[0]?.n,
      practice: (await q(`select (select count(*) from public.csat_session_attempts) + (select count(*) from public.csat_trap_attempts) + (select count(*) from public.csat_review_queue) n`))[0]?.n,
    }
  }
  const pre = await seen(learner(U.L2))
  record('reveal', '보류 전 — 비참가자가 해설 · 정답 · 뼈대 · 유형 보고 · 본인 기록 · 스냅샷을 본다', pre.analyses > 0 && pre.answers > 0 && pre.skeletons > 0 && pre.report === 1 && pre.sessions > 0 && Number(pre.practice) === 3, pre)

  // ── 생성(원자 · 멱등) ──
  const resp = (choose) => Array.from({ length: 45 }, (_, i) => { const n = i + 1; const c = choose(n); return { item_no: n, item_id: `${EXAM}#${n}`, chosen_option: c, is_correct: c === answerOf(n) } })
  const normal = (n) => (WRONG.includes(n) ? (answerOf(n) % 5) + 1 : answerOf(n))
  const targets = Array.from({ length: 28 }, (_, i) => 18 + i)
  const cfg = { probe_cap: null, probes: [{ key: 'r6_derivation_probe', version: '1.0.0', prompt_hash: 'a'.repeat(64) }] }
  const held = (uid, key, participant, choose = normal, tg = targets, eligible = true) => as(app, SERVICE,
    `select public.csat_ec_record_session_held($1::jsonb, $2::jsonb, $3, $4, $5::jsonb, $6::smallint[], $7) r`,
    [JSON.stringify({ user_id: uid, exam_id: EXAM, mode: 'live', taken_at: '2026-10-05', client_key: key, raw_score: 50 }), JSON.stringify(resp(choose)), participant, TAX, JSON.stringify(cfg), tg, eligible])
  const k1 = '11111111-1111-4111-8111-111111111111'
  const h1 = await held(P.P1, k1, true)
  const h1b = await held(P.P1, k1, true)
  const sid1 = h1.rows?.[0]?.r?.session_id
  const row1 = sid1 && (await admin.query(`select status, cardinality(item_ids) n, cardinality(targets) t, exam_id from public.csat_ec_capture_session where session_id = $1`, [sid1])).rows[0]
  record('reveal', '참가자 저장 — 기록 + held 행 한 트랜잭션 · 문항 45 · 대상 28 봉인', ok(h1) && h1.rows[0].r.held === true && row1?.status === 'held' && row1.n === 45 && row1.t === 28, h1.err ?? row1)
  record('reveal', '같은 client_key 재전송 — 같은 세션 · 같은 행', ok(h1b) && h1b.rows[0].r.session_id === sid1 && Number((await admin.query(`select count(*) n from public.csat_ec_capture_session c join public.csat_dx_session s on s.id = c.session_id where s.user_id = $1`, [P.P1])).rows[0].n) === 1)
  const badTax = await as(app, SERVICE, `select public.csat_ec_record_session_held($1::jsonb, $2::jsonb, true, 'v9.0', '{}'::jsonb, '{}'::smallint[], false)`,
    [JSON.stringify({ user_id: P.P3, exam_id: EXAM, mode: 'live', taken_at: '2026-10-05', client_key: '33333333-3333-4333-8333-333333333333' }), JSON.stringify(resp(normal))])
  record('reveal', 'TEST taxonomy 로는 보류 행을 만들지 않고 기록 저장도 되돌린다(원자)', fails(badTax, /Pilot taxonomy/) &&
    Number((await admin.query(`select count(*) n from public.csat_dx_session where user_id = $1`, [P.P3])).rows[0].n) === 0, badTax.err)
  await owner.query(`insert into public.csat_ec_taxonomy_version (version, note) values ('v99.7', 'sealed without marker') on conflict do nothing`)
  await owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v99.7', 'V.word_sense', 'V', 'l', 'd', 'i', 'e', 'word') on conflict do nothing`)
  await as(app, ADM, `select public.csat_ec_taxonomy_seal('v99.7')`)
  const v99 = await as(app, SERVICE, `select public.csat_ec_record_session_held($1::jsonb, $2::jsonb, true, 'v99.7', '{}'::jsonb, '{}'::smallint[], false)`,
    [JSON.stringify({ user_id: P.P3, exam_id: EXAM, mode: 'live', taken_at: '2026-10-05', client_key: '88888888-8888-4888-8888-888888888888' }), JSON.stringify(resp(normal))])
  record('reveal', '봉인됐지만 TEST 표시 없는 v99.* 도 거부(정규식 [.])', fails(v99, /Pilot taxonomy/), v99.err)
  const learnerCall = await as(app, learner(P.P1), `select public.csat_ec_record_session_held('{}'::jsonb, '[]'::jsonb, true, $1, '{}'::jsonb, '{}'::smallint[], false)`, [TAX])
  record('reveal', 'record_session_held — 학습자 직접 호출 거부(service 전용)', fails(learnerCall, /permission denied/), learnerCall.err)

  // ── 시험 단위 전역 보류 ──
  const during = await seen(learner(U.L2))
  record('reveal', '보류 중 — 비참가자(다른 계정)에게 그 시험의 해설 · 정답 · 뼈대 · 유형 보고 · 본인 기록 · 스냅샷 0', during.analyses === 0 && during.answers === 0 && during.skeletons === 0 && during.report === 0 && during.sessions === 0 && during.responses === 0 && Number(during.practice) === 0, during)
  const mine = await seen(learner(P.P1))
  record('reveal', '보류 중 — 참가자 본인도 직접 조회로 정답 · 정오 0', mine.analyses === 0 && mine.answers === 0 && mine.sessions === 0 && mine.responses === 0, mine)
  const canary = await as(app, learner(U.L2), `select (select string_agg(choice_analysis::text, '') from public.csat_item_analyses) a, (select string_agg(data::text, '') from public.csat_item_skeletons) s, (select string_agg(failure_modes::text, '') from public.csat_type_reports) t`)
  record('reveal', 'canary 문자열이 학습자 조회 어디에도 없다', ok(canary) && !JSON.stringify(canary.rows).includes(CANARY), canary.err)
  const st = await as(app, SERVICE, `select public.csat_ec_reveal_state($1) s, public.csat_ec_embargoed_exams(array[$2]) e, public.csat_ec_embargoed_items(array[$3]) i`, [sid1, EXAM, `${EXAM}#20`])
  record('reveal', '서버 래퍼 — 상태 · 보류 시험 · 보류 문항', ok(st) && st.rows[0].s.status === 'held' && st.rows[0].s.exam_embargoed === true && st.rows[0].e.includes(EXAM) && st.rows[0].i.length === 1, st.err ?? st.rows?.[0])
  const direct = await as(app, learner(P.P1), `select status from public.csat_ec_capture_session`)
  record('reveal', '상태 표 직접 조회 — 학습자 거부', fails(direct, /permission denied/), direct.err)
  const upd = await as(app, learner(P.P1), `update public.csat_ec_capture_session set status = 'completed'`)
  record('reveal', '상태 표 직접 UPDATE — 학습자 거부(devtools 로 completed 불가)', fails(upd, /permission denied/), upd.err)

  // ── 정오 oracle(add_student_claim) — 보류 중에는 맞힌 문항 · 틀린 문항이 같은 오류 ──
  const L1s = ctx.S.L1
  const claim = (no) => as(app, learner(U.L1), `select public.csat_ec_add_student_claim($1, $2::smallint, $3, 'word', null)`, [L1s, no, TAX])
  const wrongC = await claim(WRONG[0]), rightC = await claim(40)
  const ownClaims = await as(app, learner(U.L1), `select count(*)::int n from public.csat_ec_claim where session_id = $1`, [L1s])
  record('reveal', '보류 중 — 본인 학생 claim 행도 안 보인다(오답에만 생김 = 정오)', ok(ownClaims) && ownClaims.rows[0].n === 0, ownClaims.rows?.[0] ?? ownClaims.err)
  record('reveal', 'add_student_claim — 보류 중 오답 · 정답 문항이 같은 오류(oracle 0)', !wrongC.ok && !rightC.ok && wrongC.err === rightC.err, [wrongC.err, rightC.err])

  // ── 판정자 자료 마스킹(비관리자) ──
  const rr = (await admin.query(`select r.id from public.csat_ec_review_round r join public.csat_ec_review_assignment a on a.round_id = r.id where r.revealed_at is not null and a.reviewer_id = $1 limit 1`, [U.RA])).rows[0]
  if (rr) {
    const m = await as(app, learner(U.RA), `select answer, student_category from public.csat_ec_round_material($1)`, [rr.id])
    record('reveal', 'round_material — 비관리자 판정자에게 보류 문항 정답 null · 학생 범주 보고 빈 목록(존재 = 정오)', ok(m) && m.rows.length > 0 && m.rows.every((x) => x.answer === null && JSON.stringify(x.student_category) === '[]'), m.err)
    const v = await as(app, learner(U.RA), `select public.csat_ec_reveal_view($1) v`, [rr.id])
    const vs = JSON.stringify(v.rows?.[0]?.v ?? {})
    record('reveal', 'reveal_view — 해시 없음 · 보류 문항 근거 · 메모 null · 학생 claim 없음', ok(v) && !vs.includes('item_input_hash') && (v.rows[0].v.claims ?? []).every((c) => c.evidence === null && c.source !== 'student'), v.err)
  } else record('reveal', '공개된 판정 회차가 없어 판정자 마스킹 검사 생략', false, '앞선 테스트의 회차가 필요하다')

  // ── 전이 · 완료 조건 ──
  const P1 = learner(P.P1)
  const fin0 = await as(app, P1, `select public.csat_ec_capture_finish($1) r`, [sid1])
  record('reveal', 'held 에서 바로 완료 거부(열기 먼저)', fails(fin0, /수집을 연 뒤/), fin0.err)
  const op = await as(app, P1, `select public.csat_ec_capture_open($1) r`, [sid1]), op2 = await as(app, P1, `select public.csat_ec_capture_open($1) r`, [sid1])
  record('reveal', 'open — held → collecting · 재시도 같은 상태', ok(op) && op.rows[0].r === 'collecting' && ok(op2) && op2.rows[0].r === 'collecting')
  const noConf = await as(app, P1, `select public.csat_ec_capture_finish($1) r`, [sid1])
  record('reveal', '확인 없으면 완료 안 됨(missing confirmation)', ok(noConf) && noConf.rows[0].r.missing === 'confirmation', noConf.err ?? noConf.rows?.[0])
  await as(app, P1, `select public.csat_ec_confirm_session($1, true, true)`, [sid1])
  for (const n of targets.slice(1)) await as(app, P1, `select public.csat_ec_add_process_evidence($1, $2::smallint, 'interpretation', '{"state":"skipped"}'::jsonb)`, [sid1, n])
  const left = await as(app, P1, `select public.csat_ec_capture_finish($1) r`, [sid1])
  record('reveal', '대상 하나라도 해석 없으면 완료 안 됨 · 남은 번호', ok(left) && left.rows[0].r.missing === 'interpretation' && JSON.stringify(left.rows[0].r.remaining) === JSON.stringify([18]), left.rows?.[0])

  // 두 번째 참가자가 같은 시험 collecting
  const h2 = await held(P.P2, '22222222-2222-4222-8222-222222222222', true)
  const sid2 = h2.rows?.[0]?.r?.session_id
  await as(app, learner(P.P2), `select public.csat_ec_capture_open($1)`, [sid2])

  // 완료 vs 마지막 증거 동시 — 둘 다 성공하거나(증거 먼저), 증거가 거부되거나(완료 먼저) — 완료 뒤 행이 생기지 않는다
  await as(app, P1, `select public.csat_ec_add_process_evidence($1, 18::smallint, 'interpretation', '{"state":"unknown"}'::jsonb)`, [sid1])
  const [f, late] = await Promise.all([as(app, P1, `select public.csat_ec_capture_finish($1) r`, [sid1]),
    as(app, P1, `select public.csat_ec_add_process_evidence($1, 19::smallint, 'reason', '{"text":"늦게 온 재시도 이유입니다"}'::jsonb) id`, [sid1])])
  // 순서는 잠금이 정한다 — 쓰기가 먼저면 봉인에 들어가고, 완료가 먼저면 쓰기가 거부된다. 어느 쪽이든 봉인 밖 유효 증거 0
  const sealed = (await admin.query(`select seal from public.csat_ec_capture_session where session_id = $1`, [sid1])).rows[0].seal
  const sealedIds = new Set(Object.values(sealed.evidence ?? {}).flat())
  const valid = (await admin.query(`select e.id from unnest($2::smallint[]) t, public.csat_ec_valid_process_evidence($1, t) e`, [sid1, targets])).rows.map((x) => x.id)
  const outside = valid.filter((id) => !sealedIds.has(id))
  record('reveal', '완료 · 마지막 쓰기 동시 — 봉인 밖 유효 증거 0(쓰기 먼저면 봉인에 포함 · 완료 먼저면 쓰기 거부)', ok(f) && f.rows[0].r.status === 'completed' && outside.length === 0
    && (late.ok ? sealedIds.has(late.rows[0].id) : /수집은 끝났다/.test(late.err)), { late: late.err ?? 'ok', outside })
  const again = await as(app, P1, `select public.csat_ec_capture_finish($1) r`, [sid1])
  record('reveal', 'finish 재시도 — 같은 completed(멱등)', ok(again) && again.rows[0].r.status === 'completed')
  const postWrite = await as(app, P1, `select public.csat_ec_add_process_evidence($1, 20::smallint, 'note', '{"text":"완료 뒤 남기려는 메모"}'::jsonb)`, [sid1])
  record('reveal', '완료 뒤 증거 쓰기 거부', fails(postWrite, /수집은 끝났다/), postWrite.err)
  const postConf = await as(app, P1, `select public.csat_ec_confirm_session($1, true, false)`, [sid1])
  record('reveal', '완료 뒤 확인 변경 거부', fails(postConf, /수집은 끝났다/), postConf.err)
  const seal = (await admin.query(`select seal, counts from public.csat_ec_capture_session where session_id = $1`, [sid1])).rows[0]
  record('reveal', '완료 봉인 — 확인 revision · 대상별 증거 id · 수치', seal.seal.confirmation_revision >= 1 && Object.keys(seal.seal.evidence).length === 28 && seal.counts.targets === 28, seal)
  const back = await tryOwner(`update public.csat_ec_capture_session set status = 'collecting' where session_id = $1`, [sid1])
  record('reveal', 'completed → collecting 역전 거부(트리거)', !back.ok && /끝난 capture/.test(back.err), back.err)

  // P2 가 아직 collecting → 전역 보류 유지
  const still = await seen(learner(U.L2))
  record('reveal', 'P1 완료 · P2 collecting — 보류 유지', still.analyses === 0 && still.answers === 0, still)

  // 관리자 종료(학습자 · 시험 단위) → 보류 해제 · 증거는 미완료로 분리
  const nonAdmin = await as(app, learner(U.RA), `select public.csat_ec_capture_close($1, $2, 'x')`, [P.P2, EXAM])
  record('reveal', 'capture_close — 비관리자 거부', fails(nonAdmin, /관리자만/), nonAdmin.err)
  const noReason = await as(app, ADM, `select public.csat_ec_capture_close($1, $2, ' ')`, [P.P2, EXAM])
  record('reveal', 'capture_close — 사유 없으면 거부', fails(noReason, /사유/), noReason.err)
  const cl = await as(app, ADM, `select public.csat_ec_capture_close($1, $2, '수집 중단(테스트)') n`, [P.P2, EXAM])
  record('reveal', '관리자 종료 — P2 의 그 시험 활성 capture 모두 closed_incomplete', ok(cl) && cl.rows[0].n === 1, cl.err)
  const elig = (await admin.query(`select public.csat_ec_pilot_eligible($1, 18::smallint) e`, [sid2])).rows[0].e
  record('reveal', 'closed_incomplete 세션은 Pilot 적격 아님(판정 · AI 입력에서 분리)', elig === false)
  const lifted = await seen(learner(U.L2))
  record('reveal', '활성 0 — 보류 해제(해설 · 정답 · 본인 기록 다시 보임)', lifted.analyses > 0 && lifted.answers > 0 && lifted.sessions > 0 && Number(lifted.practice) === 3, lifted)

  // 비참가자 · 활성 없음 → 행 없음(기존 동작)
  const n1 = await held(P.N1, '44444444-4444-4444-8444-444444444444', false)
  record('reveal', '비참가자 · 활성 없음 — 보류 행 없음', ok(n1) && n1.rows[0].r.held === false, n1.rows?.[0])

  // 같은 학습자의 같은 시험에 활성 capture 가 있으면 참가자 설정이 꺼져도 새 기록을 보류(재기록 우회 차단)
  const h3 = await held(P.P3, '55555555-5555-4555-8555-555555555555', true)
  const h3b = await held(P.P3, '66666666-6666-4666-8666-666666666666', false, () => 1, [], false)
  record('reveal', '활성 capture 가 있는 학습자 · 시험의 재기록(설정상 비참가자 · 전부 1번) — 그래도 보류', ok(h3b) && h3b.rows[0].r.held === true, h3b.rows?.[0])

  // 묘비 — 계정 삭제 cascade 뒤에도 보류 유지 · 관리자 종료로만 해제
  await admin.query(`delete from auth.users where id = $1`, [P.P3])
  const tomb = (await admin.query(`select id, prior_status from public.csat_ec_capture_tombstone where exam_id = $1 and closed_at is null`, [EXAM])).rows
  const tombSeen = await seen(learner(U.L2))
  record('reveal', '계정 삭제 — 묘비가 남고 보류 유지', tomb.length === 2 && tombSeen.analyses === 0, { tomb, tombSeen })
  const delTomb = await tryOwner(`delete from public.csat_ec_capture_tombstone where id = $1`, [tomb[0]?.id])
  record('reveal', '묘비 삭제 거부', !delTomb.ok, delTomb.err)
  for (const t of tomb) await as(app, ADM, `select public.csat_ec_close_tombstone($1, '계정 삭제 뒤 정리(테스트)')`, [t.id])
  const tombLifted = await seen(learner(U.L2))
  record('reveal', '관리자가 묘비를 닫으면 보류 해제', tombLifted.analyses > 0, tombLifted)

  // ── 구조 가드: 학습자 정책 안의 NOT EXISTS 하위 조회는 그 표의 RLS 로 평가돼 보류 행이 안 보이면 거꾸로 열린다(fail-open · 2026-10-05 실측, 운영 DB 기존 0건) ──
  const notExists = (await admin.query(`select polrelid::regclass::text t, polname from pg_policy
      where polrelid::regclass::text like 'csat%' and pg_get_expr(polqual, polrelid) ilike '%not (exists%'`)).rows
  record('reveal', '학습자 정책에 NOT EXISTS 하위 조회 없음(fail-open 구조 — 정의자 함수로)', notExists.length === 0, notExists)

  // ── client_key 재사용 — 다른 시험 · 다른 답안은 거부(엉뚱한 시험을 봉인하지 않는다) ──
  await admin.query(`insert into public.csat_exams (id, label, kind, year, month, exam_year, has_answer_key) values ('X-OTHER', 'other', 'mock', 2024, 6, 2023, true) on conflict do nothing`)
  const kR = '77777777-7777-4777-8777-777777777777'
  const P4 = '00000000-0000-4000-8000-0000000000f5'
  await admin.query(`insert into auth.users (id, email) values ($1, 'P4@test') on conflict do nothing`, [P4])
  const first = await held(P4, kR, true)
  const otherExam = await as(app, SERVICE, `select public.csat_ec_record_session_held($1::jsonb, $2::jsonb, true, $3, '{}'::jsonb, '{}'::smallint[], false)`,
    [JSON.stringify({ user_id: P4, exam_id: 'X-OTHER', mode: 'live', taken_at: '2026-10-05', client_key: kR }), JSON.stringify(resp(normal)), TAX])
  const otherAns = await held(P4, kR, true, () => 2)
  const rowsP4 = Number((await admin.query(`select count(*) n from public.csat_ec_capture_session c join public.csat_dx_session s on s.id = c.session_id where s.user_id = $1`, [P4])).rows[0].n)
  record('reveal', '같은 client_key 로 다른 시험 · 다른 답안 — 거부 · 봉인 행은 처음 것 하나', ok(first) && fails(otherExam, /같은 기록 키/) && fails(otherAns, /같은 기록 키/) && rowsP4 === 1, [otherExam.err, otherAns.err])

  // ── 관리자 종료 vs 증거 쓰기 겹침 — 종료가 잠금을 쥔 동안 온 쓰기는 종료 커밋 뒤 거부 ──
  const sidP4 = first.rows[0].r.session_id
  await as(app, learner(P4), `select public.csat_ec_capture_open($1)`, [sidP4])
  const adminTx = await openTx(app, ADM)
  const closeRes = await adminTx.try(`select public.csat_ec_capture_close($1, $2, '겹침 테스트') n`, [P4, EXAM])
  const lateWrite = as(app, learner(P4), `select public.csat_ec_add_process_evidence($1, 20::smallint, 'note', '{"text":"종료와 겹친 메모입니다"}'::jsonb)`, [sidP4])
  await new Promise((r) => setTimeout(r, 300))
  await adminTx.commit()
  const lw = await lateWrite
  const after4 = Number((await admin.query(`select count(*) n from public.csat_ec_process_evidence where session_id = $1 and kind = 'note'`, [sidP4])).rows[0].n)
  record('reveal', '관리자 종료(잠금 보유) 중 온 증거 쓰기 — 종료 커밋 뒤 거부 · 행 0', closeRes.ok && fails(lw, /수집은 끝났다/) && after4 === 0, { close: closeRes.err, write: lw.err, after4 })

  // ── 해시 컬럼 · 감사 이벤트 ──
  const hashSel = await as(app, learner(P.P2), `select item_input_hash from public.csat_ec_process_evidence limit 1`)
  const valSel = await as(app, learner(P.P2), `select id, kind, value from public.csat_ec_process_evidence limit 1`)
  record('reveal', 'item_input_hash — 학습자 조회 거부 · 다른 컬럼은 허용', fails(hashSel, /permission denied/) && ok(valSel), [hashSel.err, valSel.err])
  const claimHash = await as(app, learner(U.L1), `select item_input_hash from public.csat_ec_claim limit 1`)
  record('reveal', 'claim.item_input_hash — 학습자 조회 거부', fails(claimHash, /permission denied/), claimHash.err)
  const ev = (await admin.query(`select event, count(*)::int n from public.funnel_events where surface = 'csat_ec' group by 1 order by 1`)).rows
  const evm = Object.fromEntries(ev.map((r) => [r.event, r.n]))
  record('reveal', '감사 이벤트 — 열기 · 끝내기 · 종료가 전이와 함께 기록', evm.csat_ec_capture_opened >= 2 && evm.csat_ec_capture_finished === 1 && evm.csat_ec_capture_closed >= 3, evm)
  // 이벤트 제약은 관례 형식(ARRAY['a'::text …])이어야 다음 마이그레이션 preflight 가 읽는다 — 리터럴('{a,b}')이면 0개
  const feN = Number((await admin.query("select count(*) n from pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') m where conname = 'funnel_events_event_check'")).rows[0].n)
  record('reveal', '이벤트 제약 관례 형식 — 정규식으로 68개(65 + 수집 2 + 종료 1)', feN === 68, feN)
  const evBad = await admin.query(`insert into public.funnel_events (event) values ('csat_ec_capture_typo')`).then(() => true, () => false)
  record('reveal', '이벤트 목록 — closed 추가 · 오타 거부', !evBad)
  const anonState = await as(app, ANON, `select public.csat_ec_my_capture_state($1)`, [sid1])
  record('reveal', 'my_capture_state — anon 거부', fails(anonState, /permission denied/), anonState.err)
  const myState = await as(app, P1, `select public.csat_ec_my_capture_state($1) s`, [sid1])
  const otherState = await as(app, learner(U.L2), `select public.csat_ec_my_capture_state($1) s`, [sid1])
  // ② 회수 — 참가자인데 capture 행이 빠져도 학습자 JWT 로 정오 · 점수 · 스냅샷이 나오지 않는다(fail-closed)
  const rs = await as(app, learner(U.L2), 'select raw_score from public.csat_dx_session limit 1')
  const gr = await as(app, learner(U.L2), 'select grade from public.csat_dx_session limit 1')
  const ic = await as(app, learner(U.L2), 'select is_correct from public.csat_dx_response limit 1')
  const sn = await as(app, learner(U.L2), 'select id from public.csat_dx_snapshot limit 1')
  const ls = await as(app, learner(U.L2), 'select record from public.csat_learner_state limit 1')
  const okCols = await as(app, learner(U.L2), 'select s.id, s.exam_id, r.chosen_option from public.csat_dx_session s join public.csat_dx_response r on r.session_id = s.id limit 1')
  record('reveal', '② 학습자 직접 조회 — 점수 · 등급 · 정오 · 스냅샷 거부, 정답 무관 컬럼은 허용', fails(rs, /permission denied/) && fails(gr, /permission denied/) && fails(ic, /permission denied/) && fails(sn, /permission denied/) && fails(ls, /permission denied/) && ok(okCols), [rs.err, ic.err, sn.err, ls.err, okCols.err])
  record('reveal', 'my_capture_state — 본인만(다른 학습자 null)', ok(myState) && myState.rows[0].s.status === 'completed' && ok(otherState) && otherState.rows[0].s === null)
}
