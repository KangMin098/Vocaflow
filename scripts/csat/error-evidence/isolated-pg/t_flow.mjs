// scripts/csat/error-evidence/isolated-pg/t_flow.mjs
// 기본 흐름 + 수명주기(blind review) — 다른 테스트가 재사용하는 준비 함수도 여기
import { as, conn, record } from './lib.mjs'
import { ANON, CONTROL, EXAM, SERVICE, TAX, TRAP_MAP, U, WRONG, addSession, aiJudge, learner, learnerEvidence, normalChoice, seedBase, seedTaxonomy } from './seed.mjs'

const ADM = learner(U.ADM)
export const ok = (r) => r.ok
export const fails = (r, re) => !r.ok && (!re || re.test(r.err))

export async function prepare(admin) {
  const owner = conn('postgres', 'postgres')
  const app = conn('authenticator', 'auth')
  await seedBase(admin)
  const S = {}
  for (const k of ['L1', 'L2', 'L3', 'L5']) S[k] = await addSession(admin, U[k], normalChoice)
  S.L4 = await addSession(admin, U.L4, () => 2)   // 전부 ②
  await seedTaxonomy(owner)
  return { owner, app, S }
}

export async function flow(admin, ctx) {
  const { app, S } = ctx
  // 봉인 전에는 학생 보고 거부(봉인 taxonomy 만)
  const pre = await as(app, learner(U.L1), `select public.csat_ec_add_student_claim($1, 18::smallint, $2, 'sentence', null, null)`, [S.L1, TAX])
  record('함수', 'add_student_claim — 봉인 전 taxonomy 거부', fails(pre, /봉인된 taxonomy/), pre.err)

  // 봉인: 비관리자 거부 → 관리자 성공 → 두 번째 거부
  const sealOut = await as(app, learner(U.OUT), `select public.csat_ec_taxonomy_seal($1)`, [TAX])
  record('함수', 'taxonomy_seal — 비관리자 거부', fails(sealOut, /관리자만/), sealOut.err)
  const seal = await as(app, ADM, `select public.csat_ec_taxonomy_seal($1) as h`, [TAX])
  record('함수', 'taxonomy_seal — 관리자 봉인', ok(seal), seal.ok ? seal.rows[0].h : seal.err)
  const seal2 = await as(app, ADM, `select public.csat_ec_taxonomy_seal($1)`, [TAX])
  record('함수', 'taxonomy_seal — 재봉인(중복) 거부', fails(seal2, /draft 버전만/), seal2.err)
  const sealNull = await as(app, ADM, `select public.csat_ec_taxonomy_seal(null)`)
  record('함수', 'taxonomy_seal — NULL 거부', fails(sealNull), sealNull.err)
  const sealMissing = await as(app, ADM, `select public.csat_ec_taxonomy_seal('v8.8')`)
  record('함수', 'taxonomy_seal — 없는 버전 거부', fails(sealMissing, /draft 버전만/), sealMissing.err)
  ctx.sealHash = seal.ok ? seal.rows[0].h : null

  // 학습자 증거
  for (const k of ['L1', 'L2', 'L3', 'L5']) {
    const e = await learnerEvidence(app, U[k], S[k])
    record('함수', `학습자 RPC(확인 · 과정 증거 · 범주 보고) — ${k}`, e.errors.length === 0, e.errors.slice(0, 3))
  }
  // AI 판정(오답만)
  let aiErr = []
  for (const k of ['L1', 'L2', 'L3', 'L5']) for (const n of WRONG) { const r = await aiJudge(app, S[k], n); if (!r.ok) aiErr.push([k, n, r.err]) }
  record('함수', 'AI export · import — 48건(학습자 4)', aiErr.length === 0, aiErr.slice(0, 3))

  // 회차
  const rc = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}'::jsonb) as id`, [TAX, TRAP_MAP])
  record('함수', 'round_create — 관리자', ok(rc), rc.err)
  ctx.round = rc.ok ? Number(rc.rows[0].id) : null
  const refs = []
  for (const k of ['L1', 'L2', 'L3']) for (const n of [...WRONG, ...CONTROL]) refs.push({ session_id: S[k], item_no: n })
  ctx.refs = refs
  ctx.refsL5 = refs.filter((r) => r.session_id !== S.L3).concat([...WRONG, ...CONTROL].map((n) => ({ session_id: S.L5, item_no: n })))
  const st = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb) as n`, [ctx.round, JSON.stringify(refs)])
  record('함수', 'round_set_targets — 48 대상(오답 36 · 대조 12)', ok(st) && Number(st.rows[0].n) === 48, st.ok ? st.rows[0] : st.err)
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) {
    const a = await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [ctx.round, uid, slot])
    record('함수', `round_assign — ${slot}`, ok(a), a.err)
  }
  return ctx
}

export async function lifecycle(admin, ctx) {
  const { app, S, round } = ctx
  const RA = learner(U.RA), RB = learner(U.RB), ADJ = learner(U.ADJ)
  // draft: blind 판정 거부 · 대상 변경 가능(같은 대상 다시)
  const qDraft = await as(app, RA, `select * from public.csat_ec_blind_queue($1)`, [round])
  record('수명주기', 'draft — blind 큐 비어 있음(blind_review 아님)', ok(qDraft) && qDraft.rows.length === 0, qDraft.err ?? qDraft.rows.length)
  const re = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [round, JSON.stringify(ctx.refs)])
  record('수명주기', 'draft — 대상 다시 설정 가능', ok(re), re.err)

  const start = await as(app, ADM, `select public.csat_ec_round_start_blind($1) as h`, [round])
  record('수명주기', 'blind 시작', ok(start), start.ok ? start.rows[0].h : start.err)
  if (!start.ok) return ctx

  // blind 뒤 금지
  const t1 = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [round, JSON.stringify(ctx.refs.slice(1))])
  record('수명주기', 'blind 뒤 — 대상 변경 거부', fails(t1, /draft 회차만/), t1.err)
  const t2 = await as(app, ADM, `select public.csat_ec_round_assign($1, $2, 'A')`, [round, U.OUT])
  record('수명주기', 'blind 뒤 — 판정자 추가 거부', fails(t2), t2.err)
  for (const [col, val] of [['taxonomy_version', `'v9.0'`], ['quality_rule_version', `'rq-2'`], ['choice_trap_map', `'v0.2:${'b'.repeat(64)}'`], ['targets', `'[]'::jsonb`], ['targets_hash', `'x'`]]) {
    let r
    try { await admin.query(`update public.csat_ec_review_round set ${col} = ${val} where id = $1`, [round]); r = { ok: true } } catch (e) { r = { ok: false, err: e.message } }
    const expectFail = col !== 'taxonomy_version'   // 같은 값으로 갱신은 변경이 아니다
    record('수명주기', `blind 뒤 — ${col} 직접 UPDATE(슈퍼유저) ${expectFail ? '거부' : '같은 값 통과'}`, expectFail ? fails(r, /봉인/) : ok(r), r.err)
  }
  const canonical = await (async () => { try { await admin.query(`update public.csat_ec_process_evidence set value = '{}' where true`); return { ok: true } } catch (e) { return { ok: false, err: e.message } } })()
  record('수명주기', 'blind 뒤 — 과정 증거(판정 입력) UPDATE 거부', fails(canonical, /덧붙이기 전용/), canonical.err)
  const learnerAdd = await as(app, learner(U.L1), `select public.csat_ec_add_process_evidence($1, 18::smallint, 'note', '{"text":"추가 메모"}'::jsonb)`, [S.L1])
  record('수명주기', 'blind 뒤 — 학습자 증거 추가 거부', fails(learnerAdd, /검수 중/), learnerAdd.err)

  // blind 큐 — A 의 자료에 AI · 범주 보고 · 다른 판정 없음
  const qa = await as(app, RA, `select * from public.csat_ec_blind_queue($1)`, [round])
  const leak = qa.ok && qa.rows.some((r) => JSON.stringify(r.process_evidence).includes('category') || JSON.stringify(r).includes('S.modifier_scope'))
  record('blind', 'A 의 blind 큐 — 48행 · AI · 범주 보고 없음', ok(qa) && qa.rows.length === 48 && !leak, qa.err ?? qa.rows.length)
  const qOut = await as(app, learner(U.OUT), `select * from public.csat_ec_blind_queue($1)`, [round])
  record('blind', '배정 안 된 사용자 blind 큐 거부', fails(qOut, /배정된 회차가 아니다/), qOut.err)
  const qAdm = await as(app, ADM, `select * from public.csat_ec_blind_queue($1)`, [round])
  record('blind', '관리자도 배정 없이는 blind 큐 거부', fails(qAdm, /배정된 회차가 아니다/), qAdm.err)
  const qAdj = await as(app, ADJ, `select * from public.csat_ec_blind_queue($1)`, [round])
  record('blind', 'adjudicator 는 blind 큐 거부(A · B 만)', fails(qAdj, /배정된 회차가 아니다/), qAdj.err)

  // A 만 제출 → 공개 · 조회 불가
  const submit = (actor, sid, n, outcome = 'code', primary = 'S.modifier_scope') =>
    as(app, actor, `select public.csat_ec_submit_blind($1, $2, $3::smallint, $4, $5, '{}', '{}', 'TEST 판정') as id`, [round, sid, n, outcome, outcome === 'code' ? primary : null])
  let aErr = []
  for (const r of ctx.refs) { const x = await submit(RA, r.session_id, r.item_no); if (!x.ok) aErr.push(x.err) }
  record('blind', 'A 전체 제출 48건', aErr.length === 0, aErr.slice(0, 2))
  const dup = await submit(RA, ctx.refs[0].session_id, ctx.refs[0].item_no)
  record('함수', 'submit_blind — 같은 대상 중복 제출 거부', fails(dup, /duplicate key|unique/), dup.err)
  const vA = await as(app, RA, `select public.csat_ec_reveal_view($1)`, [round])
  record('blind', 'A 제출 후 — A 의 reveal_view 거부(B 판정 · AI 비공개)', fails(vA, /아직 공개 전/), vA.err)
  const vB = await as(app, RB, `select public.csat_ec_reveal_view($1)`, [round])
  record('blind', 'A 제출 후 — B 의 reveal_view 거부(A 판정 · AI 비공개)', fails(vB, /아직 공개 전/), vB.err)
  const directJ = await as(app, RB, `select count(*) from public.csat_ec_judgment`)
  record('blind', 'B 의 판정 표 직접 조회 거부', fails(directJ, /permission denied/), directJ.err)
  const early = await as(app, ADM, `select public.csat_ec_round_reveal($1)`, [round])
  record('blind', 'B 미제출 — reveal 거부', fails(early, /A · B blind 판정/), early.err)

  // B 제출(대상 일부는 A 와 다르게 — 합의 대상)
  let bErr = []
  for (const [i, r] of ctx.refs.entries()) { const x = await submit(RB, r.session_id, r.item_no, i < 3 ? 'insufficient_evidence' : 'code'); if (!x.ok) bErr.push(x.err) }
  record('blind', 'B 전체 제출 48건(3건은 A 와 불일치)', bErr.length === 0, bErr.slice(0, 2))
  const vB2 = await as(app, RB, `select public.csat_ec_reveal_view($1)`, [round])
  record('blind', 'A · B 모두 제출 · reveal 전 — 자동 공개 없음', fails(vB2, /아직 공개 전/), vB2.err)
  const rv = await as(app, ADM, `select public.csat_ec_round_reveal($1)`, [round])
  record('수명주기', 'reveal — 필수 판정 모두 있을 때 성공', ok(rv), rv.err)
  const rv2 = await as(app, ADM, `select public.csat_ec_round_reveal($1)`, [round])
  record('함수', 'round_reveal — 재호출 거부', fails(rv2, /blind 단계가 아니다/), rv2.err)
  const lateBlind = await submit(RA, ctx.refs[1].session_id, ctx.refs[1].item_no)
  record('blind', 'reveal 뒤 blind 제출 거부', fails(lateBlind, /blind 단계가 아니다|duplicate/), lateBlind.err)
  const view = await as(app, RA, `select public.csat_ec_reveal_view($1) as v`, [round])
  const v = view.ok ? view.rows[0].v : null
  record('수명주기', 'reveal 뒤 — 비교 자료(판정 96 · claim 72)', ok(view) && v.judgments.length === 96 && v.claims.length === 72, view.ok ? { j: v.judgments.length, c: v.claims.length } : view.err)

  // verify — 봉인된 claim 마다 A · B
  const claimIds = v ? v.claims.map((c) => c.id) : []
  let vErr = []
  for (const cid of claimIds) for (const actor of [RA, RB]) {
    const x = await as(app, actor, `select public.csat_ec_submit_verify($1, $2, 'accept', 'TEST 동의')`, [round, cid]); if (!x.ok) vErr.push(x.err)
  }
  record('수명주기', `verify 제출 ${claimIds.length * 2}건`, vErr.length === 0, vErr.slice(0, 2))
  const vOut = await as(app, learner(U.OUT), `select public.csat_ec_submit_verify($1, $2, 'accept', 'x')`, [round, claimIds[0]])
  record('함수', 'submit_verify — 비배정 거부', fails(vOut, /배정된 판정자가 아니다/), vOut.err)
  const vFake = await as(app, RA, `select public.csat_ec_submit_verify($1, gen_random_uuid(), 'accept', 'x')`, [round])
  record('함수', 'submit_verify — 없는 claim 거부', fails(vFake), vFake.err)

  const { material } = await import('./t_p1fix.mjs')
  await material(admin, ctx)
  const adv = await as(app, ADM, `select public.csat_ec_round_advance($1, 'adjudication')`, [round])
  record('수명주기', 'adjudication 진입(verify 완료)', ok(adv), adv.err)
  const closeEarly = await as(app, ADM, `select public.csat_ec_round_advance($1, 'closed')`, [round])
  record('수명주기', '불일치 3건 합의 전 closed 거부', fails(closeEarly, /합의 판정이 없어/), closeEarly.err)
  const before = (await admin.query(`select id, outcome, primary_code, note from public.csat_ec_judgment where round_id = $1 and phase = 'blind' order by id`, [round])).rows
  let adjErr = []
  for (const r of ctx.refs.slice(0, 3)) {
    const x = await as(app, ADJ, `select public.csat_ec_submit_adjudication($1, $2, $3::smallint, 'code', 'S.modifier_scope', '{}', '{}', 'TEST 합의')`, [round, r.session_id, r.item_no])
    if (!x.ok) adjErr.push(x.err)
  }
  record('수명주기', '합의 판정 3건', adjErr.length === 0, adjErr)
  const adjDup = await as(app, ADJ, `select public.csat_ec_submit_adjudication($1, $2, $3::smallint, 'code', 'S.modifier_scope', '{}', '{}', 'x')`, [round, ctx.refs[0].session_id, ctx.refs[0].item_no])
  record('함수', 'submit_adjudication — 같은 응답 중복 거부', fails(adjDup, /duplicate key|unique/), adjDup.err)
  const adjByA = await as(app, RA, `select public.csat_ec_submit_adjudication($1, $2, $3::smallint, 'code', 'S.modifier_scope', '{}', '{}', 'x')`, [round, ctx.refs[5].session_id, ctx.refs[5].item_no])
  record('함수', 'submit_adjudication — A 판정자 거부', fails(adjByA, /adjudicator/), adjByA.err)
  const after = (await admin.query(`select id, outcome, primary_code, note from public.csat_ec_judgment where round_id = $1 and phase = 'blind' order by id`, [round])).rows
  record('수명주기', '합의 뒤 최초 A · B blind 행 그대로', JSON.stringify(before) === JSON.stringify(after), { before: before.length, after: after.length })
  const close = await as(app, ADM, `select public.csat_ec_round_advance($1, 'closed')`, [round])
  record('수명주기', 'closed', ok(close), close.err)
  let upd
  try { await admin.query(`update public.csat_ec_review_round set status = 'cancelled', cancelled_at = now() where id = $1`, [round]); upd = { ok: true } } catch (e) { upd = { ok: false, err: e.message } }
  record('수명주기', 'closed 뒤 상태 변경(취소) 거부', fails(upd, /끝난 회차/), upd.err)
  let jUpd
  try { await admin.query(`update public.csat_ec_judgment set note = 'x' where round_id = $1`, [round]); jUpd = { ok: true } } catch (e) { jUpd = { ok: false, err: e.message } }
  record('수명주기', 'closed 뒤 판정 UPDATE 거부', fails(jUpd, /덧붙이기 전용/), jUpd.err)
  return ctx
}
