// scripts/csat/error-evidence/isolated-pg/t_p1fix.mjs
// 최종 리뷰 P1 2건 회귀 — 판정자 자기 응답 우회 · 시작 중 대상 교체 경합
import { as, openTx, record, sleep } from './lib.mjs'
import { TAX, TRAP_MAP, U, addSession, learner, normalChoice } from './seed.mjs'

const ADM = learner(U.ADM)

async function draftWithReviewers(app, refs) {
  const id = Number((await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}') as id`, [TAX, TRAP_MAP])).rows[0].id)
  await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [id, JSON.stringify(refs)])
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [id, uid, slot])
  return id
}

export default async function p1fix(admin, ctx) {
  const { app } = ctx
  const raSession = await addSession(admin, U.RA, normalChoice)
  // (a) 배정 뒤 판정자 본인 응답을 대상에 추가
  const r1 = await draftWithReviewers(app, ctx.refs)
  const a = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [r1, JSON.stringify([...ctx.refs, { session_id: raSession, item_no: 18 }])])
  record('P1 수정', '(a) 배정 뒤 판정자 자기 응답을 대상에 추가 — 거부', !a.ok && /자기 응답/.test(a.err), a.err)
  // (b) 대상을 직접 고쳐 우회(슈퍼유저 UPDATE — draft 라 트리거는 통과) → blind 시작에서 거부
  await admin.query(`update public.csat_ec_review_round set targets = targets || jsonb_build_array(jsonb_build_object('session_id', $2::uuid, 'item_no', 18)) where id = $1`, [r1, raSession])
  const b = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [r1])
  record('P1 수정', '(b) 대상을 직접 바꿔 판정자 응답을 넣어도 — blind 시작 거부', !b.ok && /자기 응답|적격|표본/.test(b.err), b.err)
  // (c) 시작과 대상 교체 경합 — 교체(tx1)가 회차를 쥔 동안 시작(tx2) → 교체 커밋 뒤 시작은 「대상이 바뀌었다」로 거부
  const r2 = await draftWithReviewers(app, ctx.refs)
  const tx1 = await openTx(app, ADM)
  const set = await tx1.try(`select public.csat_ec_round_set_targets($1, $2::jsonb)`, [r2, JSON.stringify(ctx.refsL5)])
  const startP = as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [r2])
  await sleep(500)
  await tx1.commit()
  const c = await startP
  const st = (await admin.query(`select status, targets_hash from public.csat_ec_review_round where id = $1`, [r2])).rows[0]
  record('P1 수정', '(c) 시작 중 대상 교체 — 시작 거부 · 회차 draft 유지 · 교착 없음', set.ok && !c.ok && /대상이 바뀌었다/.test(c.err) && st.status === 'draft' && st.targets_hash === null && c.code !== '40P01',
    { set: set.err, start: c.err, st })
  const retry = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [r2])
  record('P1 수정', '(c) 다시 시도하면 새 대상으로 정상 시작', retry.ok, retry.err)
  await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [r1])
  await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [r2])
}

export async function material(admin, ctx) {
  const { app, round } = ctx
  const ADJ = learner(U.ADJ), RA = learner(U.RA), OUT = learner(U.OUT)
  const m = await as(app, ADJ, `select * from public.csat_ec_round_material($1)`, [round])
  const row = m.ok ? m.rows[0] : null
  record('P1 수정', 'adjudicator — 공개 뒤 원자료(문항 · 정답 · 고른 답 · 봉인 증거 · 학생 범주) 조회', m.ok && m.rows.length === 48 && row.stem && row.answer && row.process_evidence.length > 0, m.err ?? m.rows.length)
  const o = await as(app, OUT, `select * from public.csat_ec_round_material($1)`, [round])
  record('P1 수정', '원자료 — 비배정 거부', !o.ok && /배정된 회차가 아니다/.test(o.err), o.err)
  const blindRound = await draftWithReviewers(app, ctx.refs)
  const sb = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [blindRound])
  const early = await as(app, RA, `select * from public.csat_ec_round_material($1)`, [blindRound])
  const earlyAdj = await as(app, ADJ, `select * from public.csat_ec_round_material($1)`, [blindRound])
  record('P1 수정', '원자료 — blind 진행 중(공개 전) 회차는 A · adjudicator 모두 거부', sb.ok && !early.ok && /공개 전/.test(early.err) && !earlyAdj.ok && /공개 전/.test(earlyAdj.err), [sb.err, early.err, earlyAdj.err])
  await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [blindRound])
}
