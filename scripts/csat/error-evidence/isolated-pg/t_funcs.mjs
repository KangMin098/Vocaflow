// scripts/csat/error-evidence/isolated-pg/t_funcs.mjs
// 함수별 경계 — NULL · 없는 ID · 권한 · 상태 · 중복 · 재시도 · 품질 · 적격 · 표본
import { as, record } from './lib.mjs'
import { EXAM, SERVICE, TAX, TRAP_MAP, U, WRONG, learner } from './seed.mjs'

const ADM = learner(U.ADM)
const fails = (r, re) => !r.ok && (!re || re.test(r.err))
const NIL = '00000000-0000-4000-8000-00000000ffff'

export default async function funcs(admin, ctx) {
  const { app, S } = ctx
  const L1 = learner(U.L1), L4 = learner(U.L4)

  // ── 학습자 RPC ──
  let r = await as(app, L1, `select public.csat_ec_confirm_session(null, true, true)`)
  record('함수', 'confirm_session — NULL 세션 거부', fails(r, /자기 기록만/), r.err)
  r = await as(app, L1, `select public.csat_ec_confirm_session($1, true, true)`, [NIL])
  record('함수', 'confirm_session — 없는 세션 거부', fails(r, /자기 기록만/), r.err)
  r = await as(app, L1, `select public.csat_ec_confirm_session($1, true, true)`, [S.L2])
  record('함수', 'confirm_session — 타인 세션 거부', fails(r, /자기 기록만/), r.err)
  r = await as(app, L1, `select public.csat_ec_confirm_session($1, false, true)`, [S.L1])
  record('함수', 'confirm_session — 「응시 안 함 · 선지별 판단」 모순 거부', fails(r, /check/i), r.err)
  r = await as(app, L4, `select public.csat_ec_confirm_session($1, true, true) as rev`, [S.L4])
  const r2 = await as(app, L4, `select public.csat_ec_confirm_session($1, true, false) as rev`, [S.L4])
  record('함수', 'confirm_session — 재호출은 새 revision(덮어쓰지 않음)', r.ok && r2.ok && Number(r2.rows[0].rev) === Number(r.rows[0].rev) + 1, [r.rows?.[0], r2.rows?.[0]])
  const conf = (await admin.query(`select revision, judged_each, answers_hash from public.csat_ec_session_confirmation where session_id = $1 order by revision`, [S.L4])).rows
  const expectedHash = (await admin.query(`select encode(extensions.digest(string_agg(item_no::text || ':' || coalesce(chosen_option::text, '-'), ',' order by item_no), 'sha256'), 'hex') h from public.csat_dx_response where session_id = $1`, [S.L4])).rows[0].h
  record('함수', 'confirm_session — 답안 해시는 서버 계산값', conf.every((c) => c.answers_hash === expectedHash), conf.length)

  r = await as(app, L1, `select public.csat_ec_add_process_evidence($1, 18::smallint, 'reason', '{}'::jsonb)`, [NIL])
  record('함수', 'add_process_evidence — 없는 세션 거부', fails(r, /자기 응답에만/), r.err)
  r = await as(app, L4, `select public.csat_ec_add_process_evidence($1, 18::smallint, 'reason', '{}'::jsonb)`, [S.L4])
  record('함수', 'add_process_evidence — reason 빈 객체 거부(CHECK 가 NULL 로 통과하지 않음)', fails(r, /check/i), r.err)
  r = await as(app, L4, `select public.csat_ec_add_process_evidence($1, 18::smallint, 'blocked_span', '{"part":"passage"}'::jsonb)`, [S.L4])
  record('함수', 'add_process_evidence — blocked_span 필수 키 누락 거부', fails(r), r.err)
  r = await as(app, L4, `select public.csat_ec_add_process_evidence($1, 18::smallint, 'blocked_span', $2::jsonb)`, [S.L4, JSON.stringify({ item_id: `${EXAM}#19`, part: 'passage', sentence: 0, start: 0, end: 5 })])
  record('함수', 'add_process_evidence — 다른 문항 위치 거부', fails(r, /이 응답의 문항이 아니다/), r.err)
  r = await as(app, L4, `select public.csat_ec_add_process_evidence($1, 18::smallint, 'blocked_span', $2::jsonb)`, [S.L4, JSON.stringify({ item_id: `${EXAM}#18`, part: 'passage', sentence: 0, start: 0, end: 99999 })])
  record('함수', 'add_process_evidence — 원문 범위 밖 거부', fails(r, /범위 밖/), r.err)
  r = await as(app, L4, `select public.csat_ec_add_process_evidence($1, 18::smallint, 'blocked_span', $2::jsonb)`, [S.L4, JSON.stringify({ item_id: `${EXAM}#18`, part: 'option', option: 9, sentence: 0, start: 0, end: 3 })])
  record('함수', 'add_process_evidence — 없는 선지 번호 거부', fails(r), r.err)
  const first = await as(app, L4, `select public.csat_ec_add_process_evidence($1, 20::smallint, 'reason', '{"text":"첫 번째 이유를 적었습니다"}'::jsonb) as id`, [S.L4])
  const fix = first.ok && await as(app, L4, `select public.csat_ec_add_process_evidence($1, 20::smallint, 'reason', '{"text":"정정한 이유를 적었습니다"}'::jsonb, $2) as id`, [S.L4, first.rows[0].id])
  const fix2 = first.ok && await as(app, L4, `select public.csat_ec_add_process_evidence($1, 20::smallint, 'reason', '{"text":"두 번째 가지 정정"}'::jsonb, $2) as id`, [S.L4, first.rows[0].id])
  record('함수', 'add_process_evidence — 정정은 supersede(원래 행 남음) · 같은 행 두 번 정정 거부', first.ok && fix.ok && fails(fix2, /duplicate|unique/), [first.err, fix.err, fix2.err])
  const kindSwap = first.ok && await as(app, L4, `select public.csat_ec_add_process_evidence($1, 20::smallint, 'note', '{"text":"종류를 바꾼 정정"}'::jsonb, $2)`, [S.L4, fix.rows[0].id])
  record('함수', 'add_process_evidence — 다른 종류로 정정 거부', fails(kindSwap, /같은 종류/), kindSwap.err)

  r = await as(app, L4, `select public.csat_ec_add_student_claim($1, 18::smallint, $2, 'word', 'S.core', null)`, [S.L4, TAX])
  record('함수', 'add_student_claim — 범주와 세부 코드 불일치 거부', fails(r, /맞지 않는다/), r.err)
  r = await as(app, L4, `select public.csat_ec_add_student_claim($1, 18::smallint, $2, 'unsure', 'V.word_sense', null)`, [S.L4, TAX])
  record('함수', 'add_student_claim — 「잘 모르겠음」에 코드 거부', fails(r, /맞지 않는다/), r.err)
  const L1correct = 30
  r = await as(app, L1, `select public.csat_ec_add_student_claim($1, $2::smallint, $3, 'word', null, null)`, [S.L1, L1correct, TAX])
  record('함수', 'add_student_claim — 정답 문항 거부(오답에만)', fails(r, /자기 오답에만/), r.err)
  const c1 = await as(app, L4, `select public.csat_ec_add_student_claim($1, 19::smallint, $2, 'word', null, null) as id`, [S.L4, TAX])
  const c2 = await as(app, L4, `select public.csat_ec_add_student_claim($1, 19::smallint, $2, 'flow', null, null) as id`, [S.L4, TAX])
  record('함수', 'add_student_claim — supersede 없이 두 번째 활성 보고 거부', c1.ok && fails(c2, /duplicate|unique/), [c1.err, c2.err])

  // ── AI ──
  r = await as(app, SERVICE, `select public.csat_ec_ai_export($1, 18::smallint)`, [S.L4])
  record('품질', 'ai_export — 전부 ② 기록(rq-1 excluded) 거부', fails(r, /Pilot 적격/), r.err)
  r = await as(app, SERVICE, `select public.csat_ec_ai_export($1, 18::smallint)`, [NIL])
  record('함수', 'ai_export — 없는 세션 거부', fails(r, /Pilot 적격/), r.err)
  const x = await as(app, SERVICE, `select public.csat_ec_ai_export($1, 18::smallint) as x`, [S.L1])
  const run = { session_id: S.L1, item_no: 18, taxonomy_version: TAX, model: 'test-model', prompt_version: 'p1', analyzer_version: 'a1',
    quality_rule_version: 'rq-1', choice_trap_map: TRAP_MAP, input_hash: x.rows?.[0]?.x?.input_hash, input_refs: {}, outcome: 'proposed', output: { raw: 'ok' } }
  const claims = [{ code: 'S.modifier_scope', role: 'primary', confidence: 'medium', evidence: { summary: '수식 범위를 잘못 잡은 것으로 보인다', text_refs: [{ where: 'passage', quote: 'The second sentence adds detail' }] } }]
  const imp = (rn, cl) => as(app, SERVICE, `select public.csat_ec_ai_import($1::jsonb, $2::jsonb) as id`, [JSON.stringify(rn), JSON.stringify(cl)])
  const retry = await imp(run, claims)
  const existing = (await admin.query(`select id from public.csat_ec_ai_run where session_id = $1 and item_no = 18`, [S.L1])).rows
  record('함수', 'ai_import — 같은 입력 · 판정기 재시도는 같은 id(멱등)', retry.ok && existing.length === 1 && Number(retry.rows[0].id) === Number(existing[0].id), retry.err ?? retry.rows)
  const diff = await imp(run, [{ ...claims[0], code: 'S.core' }])
  record('함수', 'ai_import — 같은 키 다른 claim 거부', fails(diff, /다른 결과/), diff.err)
  const badQuote = await imp({ ...run, model: 'm2' }, [{ ...claims[0], evidence: { summary: '원문에 없는 인용을 단 근거', text_refs: [{ where: 'passage', quote: 'this sentence does not exist' }] } }])
  record('함수', 'ai_import — 원문에 없는 인용 거부', fails(badQuote, /인용/), badQuote.err)
  const wrongWhere = await imp({ ...run, model: 'm3' }, [{ ...claims[0], evidence: { summary: '출처를 선지로 잘못 단 인용', text_refs: [{ where: 'option:1', quote: 'The second sentence adds detail' }] } }])
  record('함수', 'ai_import — 출처를 틀리게 단 인용 거부', fails(wrongWhere, /인용/), wrongWhere.err)
  const twoPrimary = await imp({ ...run, model: 'm4' }, [claims[0], { ...claims[0], code: 'S.core' }])
  record('함수', 'ai_import — primary 2개 거부', fails(twoPrimary), twoPrimary.err)
  const bCode = await imp({ ...run, model: 'm5' }, [{ ...claims[0], code: 'B.guess' }])
  record('함수', 'ai_import — B(행동) 코드 거부', fails(bCode, /V\/S\/R\/E/), bCode.err)
  const noCauseWithClaim = await imp({ ...run, model: 'm6', outcome: 'no_cause' }, claims)
  record('함수', 'ai_import — 원인 없음 실행에 claim 거부', fails(noCauseWithClaim, /claim 이 없어야/), noCauseWithClaim.err)
  const noCause = await imp({ ...run, model: 'm7', outcome: 'no_cause' }, [])
  record('함수', 'ai_import — 원인 없음(claim 0) 정상 기록', noCause.ok, noCause.err)
  const staleHash = await imp({ ...run, model: 'm8', input_hash: 'f'.repeat(64) }, claims)
  record('함수', 'ai_import — 지금 입력과 다른 해시 거부', fails(staleHash, /입력 해시/), staleHash.err)
  const draftTax = await imp({ ...run, model: 'm9', taxonomy_version: 'v8.0' }, claims)
  record('함수', 'ai_import — 봉인 안 된 taxonomy 거부', fails(draftTax, /봉인된 taxonomy/), draftTax.err)

  // ── 회차 RPC ──
  r = await as(app, learner(U.OUT), `select public.csat_ec_round_create($1, 'rq-1', $2, '{}')`, [TAX, TRAP_MAP])
  record('함수', 'round_create — 비관리자 거부', fails(r, /관리자만/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-2', $2, '{}')`, [TAX, TRAP_MAP])
  record('함수', 'round_create — 모르는 품질 규칙 거부', fails(r, /rq-1/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', 'v0.1:abc', '{}')`, [TAX])
  record('함수', 'round_create — choice_trap_map 형식 거부', fails(r, /형식/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_create(null, 'rq-1', $1, '{}')`, [TRAP_MAP])
  record('함수', 'round_create — NULL taxonomy 거부', fails(r), r.err)
  const rd = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{"min_learners":1,"min_wrong":1,"min_control":0}') as id`, [TAX, TRAP_MAP])
  const round2 = Number(rd.rows[0].id)
  r = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [round2, JSON.stringify([{ session_id: NIL, item_no: 18 }])])
  record('함수', 'round_set_targets — 없는 응답 거부', fails(r, /없는 응답/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [999999, '[]'])
  record('함수', 'round_set_targets — 없는 회차 거부', fails(r, /없는 회차/), r.err)
  // 작은 표본(학습자 1 · 오답 3) — eligibility 로 낮춰도 DB 상수에 걸린다
  const small = WRONG.slice(0, 3).map((n) => ({ session_id: S.L1, item_no: n }))
  await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [round2, JSON.stringify(small)])
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [round2, uid, slot])
  r = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [round2])
  record('표본', 'eligibility 로 승인 규모를 낮춰도 시작 거부(학습자 1 · 오답 3)', fails(r, /표본 구성/), r.err)
  // 품질 게이트 — 전부 ② 기록을 대상으로
  const rd3 = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}') as id`, [TAX, TRAP_MAP])
  const round3 = Number(rd3.rows[0].id)
  const withBulk = [...ctx.refs.slice(0, 47), { session_id: S.L4, item_no: 18 }]
  await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [round3, JSON.stringify(withBulk)])
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [round3, uid, slot])
  r = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [round3])
  record('품질', '전부 ② 기록이 섞인 회차 시작 거부', fails(r, /Pilot 적격/), r.err)
  const dupT = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb) as n`, [round3, JSON.stringify([...ctx.refs, ctx.refs[0]])])
  record('표본', 'set_targets — 중복 대상은 하나로 합쳐 저장', dupT.ok && Number(dupT.rows[0].n) === 48, dupT.rows?.[0] ?? dupT.err)
  r = await as(app, ADM, `select public.csat_ec_round_assign($1, $2, 'A')`, [round3, U.L1])
  record('함수', 'round_assign — 대상 학생을 판정자로 거부', fails(r, /자기 응답|duplicate|unique/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_assign($1, $2, 'A')`, [round3, NIL])
  record('함수', 'round_assign — 없는 사용자 거부', fails(r, /없는 사용자/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_advance($1, 'reveal')`, [round3])
  record('함수', 'round_advance — 허용 안 된 목표 상태 거부', fails(r, /갈 수 없는 상태/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_advance($1, 'closed')`, [round3])
  record('함수', 'round_advance — draft 에서 closed(건너뛰기) 거부', fails(r, /전이|합의/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST 취소')`, [round3])
  record('함수', 'round_advance — draft 취소', r.ok, r.err)
  ctx.cancelledRound = round3
  // 회차 취소 사유 기록
  const why = (await admin.query(`select status, cancel_reason from public.csat_ec_review_round where id = $1`, [round3])).rows[0]
  record('함수', '취소 사유가 남는다', why.status === 'cancelled' && why.cancel_reason === 'TEST 취소', why)
}
