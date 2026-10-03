// scripts/csat/error-evidence/isolated-pg/t_delete.mjs
// 삭제 경계 — 학습자 기록 삭제 · 계정 삭제 · 판정자 계정 삭제 · 관리자 계정 삭제. 시스템 데이터 · 다른 학생 데이터는 남아야 한다
import { as, record } from './lib.mjs'
import { U, learner } from './seed.mjs'

export default async function del(admin, ctx) {
  const { S } = ctx
  const n = async (sql, p = []) => Number((await admin.query(sql, p)).rows[0].n)
  const snapshot = async () => ({
    tax: await n(`select count(*) n from public.csat_ec_taxonomy_version`), code: await n(`select count(*) n from public.csat_ec_code`),
    rounds: await n(`select count(*) n from public.csat_ec_review_round`), asg: await n(`select count(*) n from public.csat_ec_review_assignment`),
    L2pe: await n(`select count(*) n from public.csat_ec_process_evidence where session_id = $1`, [S.L2]),
    L2claim: await n(`select count(*) n from public.csat_ec_claim where session_id = $1`, [S.L2]),
    L2run: await n(`select count(*) n from public.csat_ec_ai_run where session_id = $1`, [S.L2]),
    L2judg: await n(`select count(*) n from public.csat_ec_judgment where session_id = $1`, [S.L2]),
    L2conf: await n(`select count(*) n from public.csat_ec_session_confirmation where session_id = $1`, [S.L2]),
  })
  // 열린 회차 하나(L1 이 대상) — 삭제 뒤 취소되어야
  const open = (await admin.query(`select id from public.csat_ec_review_round where status not in ('closed', 'cancelled') order by id`)).rows.map((r) => Number(r.id))
  const closed = (await admin.query(`select id from public.csat_ec_review_round where status = 'closed'`)).rows.map((r) => Number(r.id))
  const before = await snapshot()
  const L1before = {
    pe: await n(`select count(*) n from public.csat_ec_process_evidence where session_id = $1`, [S.L1]),
    judg: await n(`select count(*) n from public.csat_ec_judgment where session_id = $1`, [S.L1]),
  }

  // 3. 판정자 계정 삭제 — 배정 reviewer_id 만 NULL, 판정 행 · reviewer_key 그대로
  const jBefore = await n(`select count(*) n from public.csat_ec_judgment where reviewer_key = $1`, ['user:' + U.RB])
  let r
  try { await admin.query(`delete from auth.users where id = $1`, [U.RB]); r = { ok: true } } catch (e) { r = { ok: false, err: e.message } }
  const asg = (await admin.query(`select count(*) filter (where reviewer_id is null) nulls, count(*) n from public.csat_ec_review_assignment where reviewer_key = $1`, ['user:' + U.RB])).rows[0]
  const jAfter = await n(`select count(*) n from public.csat_ec_judgment where reviewer_key = $1`, ['user:' + U.RB])
  record('삭제', '판정자 계정 삭제 — 성공 · 배정 reviewer_id NULL · 판정 행 그대로', r.ok && Number(asg.nulls) === Number(asg.n) && Number(asg.n) > 0 && jAfter === jBefore && jBefore > 0, { err: r.err, asg, jBefore, jAfter })

  // 4. 관리자(회차 생성자) 계정 삭제 — 닫힌 회차여도 created_by NULL 로 통과
  try { await admin.query(`delete from auth.users where id = $1`, [U.ADM]); r = { ok: true } } catch (e) { r = { ok: false, err: e.message } }
  const cb = await n(`select count(*) n from public.csat_ec_review_round where created_by is not null`)
  record('삭제', '회차 생성자 계정 삭제 — 성공(닫힌 회차 포함) · created_by NULL', r.ok && cb === 0, r.err ?? cb)

  // 1. 학습자가 자기 기록 삭제(앱의 deleteExamSession 경로 — RLS 로 자기 세션 삭제)
  r = await as(ctx.app, learner(U.L1), `delete from public.csat_dx_session where id = $1`, [S.L1])
  if (r.ok && !r.count) r = { ok: false, err: "삭제된 행 0(RLS)" }
  record('삭제', '학습자 기록 삭제 — 트리거가 삭제를 막지 않는다', r.ok, r.err)
  const L1after = {
    pe: await n(`select count(*) n from public.csat_ec_process_evidence where session_id = $1`, [S.L1]),
    claim: await n(`select count(*) n from public.csat_ec_claim where session_id = $1`, [S.L1]),
    run: await n(`select count(*) n from public.csat_ec_ai_run where session_id = $1`, [S.L1]),
    judg: await n(`select count(*) n from public.csat_ec_judgment where session_id = $1`, [S.L1]),
    conf: await n(`select count(*) n from public.csat_ec_session_confirmation where session_id = $1`, [S.L1]),
  }
  record('삭제', '그 학생의 증거 · claim · AI 실행 · 판정 · 확인은 연쇄 삭제', Object.values(L1after).every((v) => v === 0) && L1before.pe > 0 && L1before.judg > 0, { before: L1before, after: L1after })
  const after = await snapshot()
  record('삭제', 'taxonomy · 코드 사전 · 회차 · 배정은 그대로', after.tax === before.tax && after.code === before.code && after.rounds === before.rounds && after.asg === before.asg, { before, after })
  record('삭제', '다른 학생(L2)의 증거 · claim · AI 실행 · 판정 · 확인 그대로', ['L2pe', 'L2claim', 'L2run', 'L2judg', 'L2conf'].every((k) => after[k] === before[k] && before[k] > 0), { before, after })
  const openAfter = (await admin.query(`select id, status, cancel_reason from public.csat_ec_review_round where id = any($1::bigint[])`, [open])).rows
  record('삭제', '그 학생이 대상인 열린 회차는 취소(target_deleted)', openAfter.every((x) => x.status === 'cancelled'), openAfter)
  const closedAfter = (await admin.query(`select id, status from public.csat_ec_review_round where id = any($1::bigint[])`, [closed])).rows
  record('삭제', '닫힌 회차는 상태 그대로(그 학생 판정 행만 학습자 삭제권으로 사라짐 — 설계대로)', closedAfter.every((x) => x.status === 'closed'), closedAfter)

  // 2. 계정 삭제(auth.users) — L2 의 연쇄 삭제 경로
  try { await admin.query(`delete from auth.users where id = $1`, [U.L2]); r = { ok: true } } catch (e) { r = { ok: false, err: e.message } }
  const L2gone = await n(`select (select count(*) from public.csat_ec_process_evidence where user_id = $1) + (select count(*) from public.csat_ec_claim where user_id = $1) + (select count(*) from public.csat_ec_session_confirmation where user_id = $1) n`, [U.L2])
  record('삭제', '학습자 계정 삭제 — 성공 · 그 학생 행 0', r.ok && L2gone === 0, r.err ?? L2gone)

}
