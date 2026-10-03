// scripts/csat/error-evidence/isolated-pg/t_hash.mjs
// 정규화 해시 — 의미 없는 차이는 같은 해시, 의미 변화는 다른 해시. 회차 진행 중 입력 변경 감지(P2-13)
import { as, record } from './lib.mjs'
import { EXAM, TAX, TRAP_MAP, U, WRONG, addSession, learner, learnerEvidence, normalChoice } from './seed.mjs'

const ADM = learner(U.ADM), RA = learner(U.RA)
const L6 = '00000000-0000-4000-8000-000000000006'

export default async function hash(admin, ctx) {
  const { app } = ctx
  const ih = async (sid, n) => (await admin.query(`select public.csat_ec_item_input_hash($1, $2::smallint) h`, [sid, n])).rows[0].h
  const jh = async (sid, n) => (await admin.query(`select public.csat_ec_judgment_input_hash($1, $2::smallint) h`, [sid, n])).rows[0].h

  await admin.query(`insert into auth.users (id) values ($1)`, [L6])
  const sid = await addSession(admin, L6, normalChoice)
  await learnerEvidence(app, L6, sid)
  const n = WRONG[0]
  const h0 = await ih(sid, n), j0 = await jh(sid, n)
  record('해시', '같은 입력 두 번 계산 — 같은 값', h0 === (await ih(sid, n)) && j0 === (await jh(sid, n)))

  // 의미 없는 차이 — 행 순서 · JSON 키 순서 · 공백 · UUID 표기
  await admin.query(`delete from public.csat_dx_option_trap where item_id = $1`, [`${EXAM}#${n}`])
  for (const o of [5, 4, 3, 2, 1]) if (o !== (n % 5) + 1) await admin.query(`insert into public.csat_dx_option_trap (item_id, option_no, trap_key, source) values ($1, $2, '부분 사실', 'analysis')`, [`${EXAM}#${n}`, o])
  record('해시', '선지 함정 행 입력 순서 바뀜 — 같은 해시', h0 === (await ih(sid, n)))
  const k = (await admin.query(`select encode(extensions.digest(jsonb_build_array('{"b":1, "a":[1,2]}'::jsonb)::text, 'sha256'), 'hex') x, encode(extensions.digest(jsonb_build_array('{ "a" : [1,2],"b":1 }'::jsonb)::text, 'sha256'), 'hex') y`)).rows[0]
  record('해시', 'JSON 키 순서 · 구문 공백 — jsonb 정규화로 같은 해시', k.x === k.y)
  const u = (await admin.query(`select upper($1::text)::uuid = $1::uuid as same`, [sid])).rows[0].same
  record('해시', 'UUID 대소문자 표기 — uuid 형으로 같은 값', u === true)

  // 의미 변화 — 고른 답 · 선지 함정 · 문항 원문 · 과정 증거
  await admin.query(`update public.csat_dx_response set chosen_option = (chosen_option % 5) + 1 where session_id = $1 and item_no = $2`, [sid, n])
  const h1 = await ih(sid, n)
  record('해시', '고른 답 변경 — 다른 해시', h1 !== h0)
  await admin.query(`update public.csat_dx_response set chosen_option = $3 where session_id = $1 and item_no = $2`, [sid, n, normalChoice(n)])
  record('해시', '고른 답 되돌림 — 원래 해시로 복원', (await ih(sid, n)) === h0)
  await admin.query(`update public.csat_dx_option_trap set trap_key = '반대 진술' where item_id = $1 and option_no = (select min(option_no) from public.csat_dx_option_trap where item_id = $1)`, [`${EXAM}#${n}`])
  const h2 = await ih(sid, n)
  record('해시', '선지 함정 값 변경 — 다른 해시', h2 !== h0)
  // 공용 문항이라 되돌린다(안 되돌리면 그 문항의 모든 학습자 과정 증거가 「작성 당시 문항과 다름」으로 무효가 된다 — 설계대로)
  const otherBefore = (await admin.query(`select count(*) n from public.csat_ec_valid_process_evidence($1, $2::smallint)`, [ctx.S.L2, n])).rows[0].n
  await admin.query(`update public.csat_dx_option_trap set trap_key = '부분 사실' where item_id = $1`, [`${EXAM}#${n}`])
  const otherAfter = (await admin.query(`select count(*) n from public.csat_ec_valid_process_evidence($1, $2::smallint)`, [ctx.S.L2, n])).rows[0].n
  record('해시', '문항 태깅이 바뀐 동안 다른 학습자 과정 증거 무효 → 되돌리면 다시 유효', Number(otherBefore) === 0 && Number(otherAfter) > 0 && (await ih(sid, n)) === h0, { otherBefore, otherAfter })
  const jBefore = await jh(sid, n)
  await as(app, learner(L6), `select public.csat_ec_add_process_evidence($1, $2::smallint, 'note', '{"text":"메모를 하나 더 남깁니다"}'::jsonb)`, [sid, n])
  record('해시', '과정 증거 추가 — 판정 입력 해시 변경', (await jh(sid, n)) !== jBefore)
  const ws1 = (await admin.query(`select encode(extensions.digest(jsonb_build_array('a b')::text, 'sha256'), 'hex') x, encode(extensions.digest(jsonb_build_array('a  b')::text, 'sha256'), 'hex') y`)).rows[0]
  record('해시', '글자 값 안 공백 차이 — 다른 해시(학생 글 · 원문은 의미가 있는 값으로 본다)', ws1.x !== ws1.y)

  // 회차 targets_hash — 같은 대상 · 같은 상태면 같은 해시, 대상이 다르면 다른 해시
  // (AI 판정은 회차 단위라 AI 를 돌린 회차와 안 돌린 회차는 대상 정보가 다르다 — 같은 조건의 새 draft 들로 비교)
  const mk = async (refs) => {
    const id = Number((await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}') as id`, [TAX, TRAP_MAP])).rows[0].id)
    await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [id, JSON.stringify(refs)])
    return id
  }
  const ra = await mk(ctx.refs), rb = await mk([...ctx.refs].reverse()), rc2 = await mk(ctx.refs.slice(1))
  const th = async (id) => (await admin.query(`select encode(extensions.digest(targets::text, 'sha256'), 'hex') h from public.csat_ec_review_round where id = $1`, [id])).rows[0].h
  const [ha, hb, hc] = [await th(ra), await th(rb), await th(rc2)]
  record('해시', '같은 대상(입력 순서만 다름) — 대상 해시 같음 · 대상이 다르면 다름', ha === hb && ha !== hc, { ha: ha.slice(0, 10), hb: hb.slice(0, 10), hc: hc.slice(0, 10) })
  for (const id of [ra, rb, rc2]) await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [id])

  // P2-13 — 회차 진행 중 문항 원문 직접 UPDATE: 반드시 감지 · 조용히 진행 안 함 · 취소 사유 기록
  const rc = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}') as id`, [TAX, TRAP_MAP])
  const round = Number(rc.rows[0].id)
  await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [round, JSON.stringify(ctx.refs)])
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [round, uid, slot])
  const sb = await as(app, ADM, `select public.csat_ec_round_start_blind($1) as h`, [round])
  const t = ctx.refs[0]
  const item = `${EXAM}#${t.item_no}`
  const orig = (await admin.query(`select stem from public.csat_items where id = $1`, [item])).rows[0].stem
  await admin.query(`update public.csat_items set stem = stem || ' (수정됨)' where id = $1`, [item])
  const sub = await as(app, RA, `select public.csat_ec_submit_blind($1, $2, $3::smallint, 'code', 'S.modifier_scope', '{}', '{}', 'x')`, [round, t.session_id, t.item_no])
  const q = await as(app, RA, `select * from public.csat_ec_blind_queue($1)`, [round])
  const rv = await as(app, ADM, `select public.csat_ec_round_reveal($1)`, [round])
  record('입력 변경', '회차 중 문항 원문 UPDATE — 제출 거부(감지)', sb.ok && !sub.ok && /바뀌었다/.test(sub.err), sub.err)
  record('입력 변경', '회차 중 문항 원문 UPDATE — blind 큐도 자료 제공 중단', !q.ok && /바뀐 회차/.test(q.err), q.err)
  record('입력 변경', '회차 중 문항 원문 UPDATE — 공개 거부(정상 결과처럼 진행 안 함)', !rv.ok, rv.err)
  const cancel = await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'input_changed')`, [round])
  const why = (await admin.query(`select status, cancel_reason from public.csat_ec_review_round where id = $1`, [round])).rows[0]
  record('입력 변경', '취소 사유가 감사 기록으로 남음', cancel.ok && why.status === 'cancelled' && why.cancel_reason === 'input_changed', why)
  await admin.query(`update public.csat_items set stem = $2 where id = $1`, [item, orig])
}
