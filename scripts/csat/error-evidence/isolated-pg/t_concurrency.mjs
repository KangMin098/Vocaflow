// scripts/csat/error-evidence/isolated-pg/t_concurrency.mjs
// 동시성 — 실제 두 연결의 겹친 트랜잭션. 교착(40P01) · 중복 · 잘못된 전이 · 조기 노출 · 부분 커밋을 본다
import { as, openTx, record, sleep } from './lib.mjs'
import { TAX, TRAP_MAP, U, learner } from './seed.mjs'

const ADM = learner(U.ADM), RA = learner(U.RA), RB = learner(U.RB), ADJ = learner(U.ADJ)
const deadlock = (r) => r && !r.ok && (r.code === '40P01' || /deadlock/i.test(r.err))
const SUBMIT = `select public.csat_ec_submit_blind($1, $2, $3::smallint, 'code', 'S.modifier_scope', '{}', '{}', 'TEST') as id`

async function newRound(app, refs) {
  const rc = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}') as id`, [TAX, TRAP_MAP])
  if (!rc.ok) throw new Error('round_create ' + rc.err)
  const id = Number(rc.rows[0].id)
  const st = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [id, JSON.stringify(refs)])
  if (!st.ok) throw new Error('set_targets ' + st.err)
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [id, uid, slot])
  const sb = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [id])
  if (!sb.ok) throw new Error('start_blind ' + sb.err)
  return id
}
const submitAll = async (app, actor, round, refs) => { for (const r of refs) await as(app, actor, SUBMIT, [round, r.session_id, r.item_no]) }
/** tx 를 열고 첫 문장을 실행한 채로 둔다 → 두 번째 연결 시작 → 첫 tx 커밋 → 두 번째 결과 */
async function overlap(app, actor1, sql1, p1, actor2, sql2, p2, holdMs = 400) {
  const t1 = await openTx(app, actor1)
  const r1 = await t1.try(sql1, p1)
  const p = as(app, actor2, sql2, p2)
  await sleep(holdMs)
  if (r1.ok) await t1.commit(); else await t1.rollback()
  const r2 = await p
  return { r1, r2 }
}

export default async function concurrency(admin, ctx) {
  const { app } = ctx
  const refs = ctx.refs
  const count = async (sql, params) => Number((await admin.query(sql, params)).rows[0].n)

  // 1. A · B 동시 제출(같은 대상) + 같은 판정자 동시 중복 제출
  {
    const round = await newRound(app, refs)
    const t = refs[0]
    const [a, b] = await Promise.all([as(app, RA, SUBMIT, [round, t.session_id, t.item_no]), as(app, RB, SUBMIT, [round, t.session_id, t.item_no])])
    record('동시성', '1a. A · B 같은 대상 동시 제출 — 둘 다 성공', a.ok && b.ok, [a.err, b.err])
    const t2 = refs[1]
    const [x, y] = await Promise.all([as(app, RA, SUBMIT, [round, t2.session_id, t2.item_no]), as(app, RA, SUBMIT, [round, t2.session_id, t2.item_no])])
    const n = await count(`select count(*) n from public.csat_ec_judgment where round_id = $1 and session_id = $2 and item_no = $3 and reviewer_key = $4`, [round, t2.session_id, t2.item_no, 'user:' + U.RA])
    record('동시성', '1b. 같은 판정자 동시 중복 제출 — 1행만', n === 1 && (x.ok !== y.ok) && !deadlock(x) && !deadlock(y), { n, x: x.err, y: y.err })
    ctx.raceRound1 = round
  }

  // 2. 마지막 제출과 reveal 겹침 — 제출이 회차 공유 잠금을 쥔 동안 reveal 은 기다렸다가 완전한 상태에서만 성공
  {
    const round = await newRound(app, refs)
    await submitAll(app, RA, round, refs)
    await submitAll(app, RB, round, refs.slice(0, -1))
    const last = refs[refs.length - 1]
    const { r1, r2 } = await overlap(app, RB, SUBMIT, [round, last.session_id, last.item_no], ADM, `select public.csat_ec_round_reveal($1)`, [round])
    const blindAfter = await count(`select count(*) n from public.csat_ec_judgment j join public.csat_ec_review_round r on r.id = j.round_id where j.round_id = $1 and j.phase = 'blind' and j.created_at > r.revealed_at`, [round])
    record('동시성', '2a. 마지막 제출(진행 중) + reveal — reveal 은 기다린 뒤 성공 · 공개 뒤 blind 행 0', r1.ok && r2.ok && blindAfter === 0 && !deadlock(r2), { r1: r1.err, r2: r2.err, blindAfter })
    // 반대 순서: reveal 이 먼저 회차를 쥐면(판정 미완) → reveal 실패 · 제출은 그 뒤 정상
    const round2 = await newRound(app, refs)
    await submitAll(app, RA, round2, refs)
    await submitAll(app, RB, round2, refs.slice(0, -1))
    const [rv, sb] = await Promise.all([as(app, ADM, `select public.csat_ec_round_reveal($1)`, [round2]), as(app, RB, SUBMIT, [round2, last.session_id, last.item_no])])
    const st = (await admin.query(`select status from public.csat_ec_review_round where id = $1`, [round2])).rows[0].status
    const total = await count(`select count(*) n from public.csat_ec_judgment where round_id = $1 and phase = 'blind'`, [round2])
    const consistent = (rv.ok && st === 'reveal' && total === 96) || (!rv.ok && st === 'blind_review' && sb.ok && total === 96)
    record('동시성', '2b. reveal · 마지막 제출 동시 — 결과 일관(완전할 때만 공개)', consistent && !deadlock(rv) && !deadlock(sb), { rv: rv.err, sb: sb.err, st, total })
    ctx.raceRound2 = round
  }

  // 3. reveal 두 번 동시
  {
    const round = await newRound(app, refs)
    await submitAll(app, RA, round, refs); await submitAll(app, RB, round, refs)
    const rs = await Promise.all([1, 2].map(() => as(app, ADM, `select public.csat_ec_round_reveal($1)`, [round])))
    record('동시성', '3. reveal 동시 2회 — 정확히 1회 성공', rs.filter((r) => r.ok).length === 1 && !rs.some(deadlock), rs.map((r) => r.err))
    // 4. adjudication 중복 동시
    const view = await as(app, RA, `select public.csat_ec_reveal_view($1) as v`, [round])
    for (const c of view.rows[0].v.claims) for (const a of [RA, RB]) await as(app, a, `select public.csat_ec_submit_verify($1, $2, 'accept', 'x')`, [round, c.id])
    await as(app, ADM, `select public.csat_ec_round_advance($1, 'adjudication')`, [round])
    const t = refs[0]
    const adj = await Promise.all([1, 2].map(() => as(app, ADJ, `select public.csat_ec_submit_adjudication($1, $2, $3::smallint, 'code', 'S.modifier_scope', '{}', '{}', 'x')`, [round, t.session_id, t.item_no])))
    const n = await count(`select count(*) n from public.csat_ec_judgment where round_id = $1 and phase = 'adjudication'`, [round])
    record('동시성', '4. 합의 판정 동시 중복 — 1행만', n === 1 && adj.filter((r) => r.ok).length === 1 && !adj.some(deadlock), { n, errs: adj.map((r) => r.err) })
  }

  // 6. 회차 취소와 제출 겹침(양방향)
  {
    const round = await newRound(app, refs)
    const t = refs[2]
    const a = await overlap(app, RA, SUBMIT, [round, t.session_id, t.item_no], ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [round])
    const st = (await admin.query(`select status from public.csat_ec_review_round where id = $1`, [round])).rows[0].status
    record('동시성', '6a. 제출 진행 중 취소 — 제출 커밋 뒤 취소 성공', a.r1.ok && a.r2.ok && st === 'cancelled', { r1: a.r1.err, r2: a.r2.err, st })
    const round2 = await newRound(app, refs)
    const b = await overlap(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [round2], RA, SUBMIT, [round2, t.session_id, t.item_no])
    const n = await count(`select count(*) n from public.csat_ec_judgment where round_id = $1`, [round2])
    record('동시성', '6b. 취소 진행 중 제출 — 제출 거부 · 판정 0행', b.r1.ok && !b.r2.ok && n === 0 && !deadlock(b.r2), { r2: b.r2.err, n })
  }

  // 7. 같은 학생 보고 동시 생성(supersede 없음) — 하나만
  {
    const sid = ctx.S.L4
    const L4 = learner(U.L4)
    const rs = await Promise.all([1, 2].map((i) => as(app, L4, `select public.csat_ec_add_student_claim($1, 22::smallint, $2, $3, null, null)`, [sid, TAX, i === 1 ? 'word' : 'flow'])))
    const n = await count(`select count(*) n from public.csat_ec_claim where session_id = $1 and item_no = 22 and supersedes_id is null`, [sid])
    record('동시성', '7. 같은 응답 학생 보고 동시 생성 — 활성 1행', n === 1 && rs.filter((r) => r.ok).length === 1 && !rs.some(deadlock), { n, errs: rs.map((r) => r.err) })
  }

  // 8. taxonomy 봉인 동시 + 봉인과 코드 추가 경쟁
  {
    await ctx.owner.query(`insert into public.csat_ec_taxonomy_version (version) values ('v9.1')`)
    await ctx.owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.1', 'V.word_sense', 'V', 'x', 'x', 'x', 'x', 'word')`)
    const rs = await Promise.all([1, 2].map(() => as(app, ADM, `select public.csat_ec_taxonomy_seal('v9.1') as h`)))
    record('동시성', '8a. 봉인 동시 2회 — 1회만 성공', rs.filter((r) => r.ok).length === 1 && !rs.some(deadlock), rs.map((r) => r.err))
    await ctx.owner.query(`insert into public.csat_ec_taxonomy_version (version) values ('v9.2')`)
    await ctx.owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.2', 'V.word_sense', 'V', 'x', 'x', 'x', 'x', 'word')`)
    const ownerTx = await ctx.owner.connect()
    await ownerTx.query('begin')
    await ownerTx.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.2', 'S.core', 'S', 'x', 'x', 'x', 'x', 'sentence')`)
    const sealP = as(app, ADM, `select public.csat_ec_taxonomy_seal('v9.2') as h`)
    await sleep(400)
    await ownerTx.query('commit'); ownerTx.release()
    const seal = await sealP
    const recomputed = (await admin.query(`select encode(extensions.digest(coalesce(string_agg(to_jsonb(c)::text, chr(10) order by c.code), ''), 'sha256'), 'hex') h, count(*) n from public.csat_ec_code c where c.version = 'v9.2'`)).rows[0]
    record('동시성', '8b. 코드 추가(진행 중) + 봉인 — 봉인은 기다리고, 해시에 추가된 코드가 포함', seal.ok && seal.rows[0].h === recomputed.h && Number(recomputed.n) === 2, { seal: seal.err ?? seal.rows[0].h.slice(0, 12), n: recomputed.n })
    let late
    try { await ctx.owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.2', 'R.main_idea', 'R', 'x', 'x', 'x', 'x', 'flow')`); late = { ok: true } } catch (e) { late = { ok: false, err: e.message } }
    record('동시성', '8c. 봉인 뒤 코드 추가 거부', !late.ok && /봉인/.test(late.err), late.err)
  }

  // 5. 학습자 기록 삭제와 판정 제출 겹침(양방향) — 데이터를 지우므로 마지막
  {
    const round = await newRound(app, refs)
    const t3 = refs.find((r) => r.session_id === ctx.S.L3)
    const del = `delete from public.csat_dx_session where id = $1`
    // 5a. 제출이 먼저 세션 공유 잠금 → 삭제는 기다림 → 제출 커밋 후 삭제 → 그 판정 연쇄 삭제 · 회차 취소
    const a = await overlap(app, RA, SUBMIT, [round, t3.session_id, t3.item_no], learner(U.L3), del, [ctx.S.L3])
    const st = (await admin.query(`select status, cancel_reason from public.csat_ec_review_round where id = $1`, [round])).rows[0]
    const left = await count(`select count(*) n from public.csat_ec_judgment where session_id = $1`, [ctx.S.L3])
    record('동시성', '5a. 제출(진행 중) + 학습자 기록 삭제 — 교착 없음 · 삭제 성공 · 회차 취소 · 그 학생 판정 0', a.r1.ok && a.r2.ok && st.status === 'cancelled' && left === 0 && !deadlock(a.r2),
      { r1: a.r1.err, r2: a.r2.err, st, left })
    // 5b. 반대 순서 — 학습자 L5 기록 삭제가 먼저 세션을 쥐고, 그동안 제출 → 제출은 기다렸다가 거부
    const round2 = await newRound(app, ctx.refsL5)
    const t5 = ctx.refsL5.find((r) => r.session_id === ctx.S.L5)
    const b = await overlap(app, learner(U.L5), del, [ctx.S.L5], RA, SUBMIT, [round2, t5.session_id, t5.item_no])
    const st2 = (await admin.query(`select status, cancel_reason from public.csat_ec_review_round where id = $1`, [round2])).rows[0]
    const other = await count(`select count(*) n from public.csat_ec_process_evidence where session_id = any($1::uuid[])`, [[ctx.S.L1, ctx.S.L2]])
    record('동시성', '5b. 학습자 기록 삭제(진행 중) + 제출 — 교착 없음 · 제출 거부 · 회차 취소 · 다른 학생 증거 유지', b.r1.ok && !b.r2.ok && !deadlock(b.r2) && st2.status === 'cancelled' && other > 0,
      { r2: b.r2.err, st2, other })
  }
}
