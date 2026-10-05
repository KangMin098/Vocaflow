// scripts/csat/error-evidence/isolated-pg/t_capture.mjs
// 학생 증거 수집 지원(20261005150000_csat_ec_capture_support.sql) — interpretation 3상태 · 재시도 멱등(확인 · 증거) · probe 세션 상한(동시 제출) · 권한
// t_pilot 뒤에 돈다(봉인된 경계 taxonomy v9.8 · L1 의 probe 2개를 이어 쓴다).
import { as, record } from './lib.mjs'
import { ANON, SERVICE, U, WRONG, learner } from './seed.mjs'
import { fails, ok } from './t_flow.mjs'

const TAX = 'v9.8'
const BKEY = 'r.inference__v.word_sense'
const PROBE = 'r6_derivation_probe'
const probe = (over = {}) => ({ probe_key: PROBE, probe_version: 'p1', taxonomy_version: TAX, boundary_key: BKEY, prompt_hash: 'b'.repeat(64), option: 'C', skipped: false, ...over })

export default async function capture(admin, ctx) {
  const { app, S } = ctx
  const L1 = learner(U.L1)
  await admin.query(`update public.csat_ec_review_round set status = 'cancelled', cancelled_at = now(), cancel_reason = 'capture-test' where status not in ('closed', 'cancelled')`)
  const pe = (who, no, kind, value, sup = null) => as(app, who, `select public.csat_ec_add_process_evidence($1, $2::smallint, $3, $4::jsonb, $5) id`, [S.L1, no, kind, JSON.stringify(value), sup])
  const n = WRONG[5]

  // ── interpretation 3상태 ──
  const a = await pe(L1, n, 'interpretation', { state: 'answered', text: '그 낱말을 결과라는 뜻으로 읽었습니다' })
  const u = await pe(L1, n, 'interpretation', { state: 'unknown' })
  const k = await pe(L1, WRONG[6], 'interpretation', { state: 'skipped' })
  record('capture', 'interpretation — answered · unknown · skipped 저장', ok(a) && ok(u) && ok(k), [a.err, u.err, k.err])
  const uText = await pe(L1, n, 'interpretation', { state: 'unknown', text: '모름' })
  record('capture', 'unknown 에 글 거부', fails(uText, /interpretation_check/), uText.err)
  const aEmpty = await pe(L1, n, 'interpretation', { state: 'answered', text: '  ' })
  record('capture', 'answered 빈 글 거부', fails(aEmpty, /interpretation_check/), aEmpty.err)
  const bad = await pe(L1, n, 'interpretation', { state: 'maybe' })
  record('capture', '없는 상태 거부', fails(bad, /interpretation_check/), bad.err)
  const badType = await pe(L1, n, 'interpretation', { state: 1, text: 'x' })
  record('capture', '상태가 글자가 아니면 거부', fails(badType, /interpretation_check/), badType.err)
  const legacy = await pe(L1, WRONG[7], 'interpretation', { text: '옛 형식 해석 — 상태 없음' })
  record('capture', '옛 형식 {text} = answered 로 허용(호환)', ok(legacy), legacy.err)

  // ── 재시도 멱등 — 증거 ──
  const reason = { text: '앞 문장과 같은 방향이라고 생각해서 골랐어요' }
  const r1 = await pe(L1, n, 'reason', reason), r2 = await pe(L1, n, 'reason', { text: reason.text })
  const nReason = Number((await admin.query(`select count(*) c from public.csat_ec_process_evidence where session_id = $1 and item_no = $2 and kind = 'reason' and value = $3::jsonb`, [S.L1, n, JSON.stringify(reason)])).rows[0].c)
  record('capture', '같은 증거 재전송 — 같은 id · 1행', ok(r1) && ok(r2) && r1.rows[0].id === r2.rows[0].id && nReason === 1, { nReason })
  const keyOrder = await pe(L1, n, 'interpretation', { text: '그 낱말을 결과라는 뜻으로 읽었습니다', state: 'answered' })
  record('capture', '키 순서만 다른 같은 값 — 같은 id(jsonb 의미 비교)', ok(keyOrder) && keyOrder.rows[0].id === a.rows[0].id, keyOrder.rows?.[0])
  const c1 = await pe(L1, n, 'category', { group: 'evidence' }), c2 = await pe(L1, n, 'category', { group: 'evidence' })
  record('capture', 'category 재전송 — 같은 id', ok(c1) && ok(c2) && c1.rows[0].id === c2.rows[0].id)
  const fix = await pe(L1, n, 'reason', reason, r1.rows?.[0]?.id)
  record('capture', '정정(supersedes)은 같은 값이어도 새 행', ok(fix) && fix.rows[0].id !== r1.rows[0].id, fix.err)
  const claims = Number((await admin.query(`select count(*) c from public.csat_ec_claim where session_id = $1 and source = 'student'`, [S.L1])).rows[0].c)
  const claimsAfter = Number((await admin.query(`select count(*) c from public.csat_ec_claim where session_id = $1 and source = 'student'`, [S.L1])).rows[0].c)
  record('capture', 'category(evidence · choice) 저장이 원인 claim 을 만들지 않음', claims === claimsAfter && ok(await pe(L1, n, 'category', { group: 'choice' })) &&
    Number((await admin.query(`select count(*) c from public.csat_ec_claim where session_id = $1 and source = 'student'`, [S.L1])).rows[0].c) === claims)

  // ── 재시도 멱등 — 확인 ──
  const revs = async () => Number((await admin.query(`select count(*) c from public.csat_ec_session_confirmation where session_id = $1`, [S.L1])).rows[0].c)
  const before = await revs()
  const cf1 = await as(app, L1, `select public.csat_ec_confirm_session($1, true, true) r`, [S.L1])
  const cf2 = await as(app, L1, `select public.csat_ec_confirm_session($1, true, true) r`, [S.L1])
  const after = await revs()
  record('capture', '같은 확인 재전송 — 같은 revision · 행 그대로(최신이 같으면)', ok(cf1) && ok(cf2) && cf1.rows[0].r === cf2.rows[0].r && after <= before + 1, { before, after, r: [cf1.rows?.[0]?.r, cf2.rows?.[0]?.r] })
  const cf3 = await as(app, L1, `select public.csat_ec_confirm_session($1, true, false) r`, [S.L1])
  record('capture', '다른 확인은 새 revision', ok(cf3) && cf3.rows[0].r === cf2.rows[0].r + 1, cf3.err)
  await as(app, L1, `select public.csat_ec_confirm_session($1, true, true)`, [S.L1])

  // ── probe 세션 상한 ──
  for (const no of [WRONG[8], WRONG[9], WRONG[10], WRONG[11]])
    await as(app, SERVICE, `select public.csat_ec_add_detector_signal($1, $2::smallint, $3, $4, 'det-1', true, '{}')`, [S.L1, no, TAX, BKEY])
  const roots = async () => Number((await admin.query(`select count(*) c from public.csat_ec_process_evidence where session_id = $1 and kind = 'targeted_probe' and supersedes_id is null`, [S.L1])).rows[0].c)
  const base = await roots()   // t_pilot 이 남긴 첫 응답 2개(정정 행 제외)
  const apr = (no, cap, value = probe()) => as(app, L1, `select public.csat_ec_add_probe_response($1, $2::smallint, $3::jsonb, $4) id`, [S.L1, no, JSON.stringify(value), cap])
  const over = await apr(WRONG[8], base)
  record('capture', `상한(${base}) 도달 — 새 probe 거부`, fails(over, /상한/), over.err)
  const p1 = await apr(WRONG[8], base + 1)
  record('capture', '상한 안 — 저장', ok(p1), p1.err)
  const again = await apr(WRONG[8], base + 1, probe({ option: 'A' }))
  record('capture', '같은 attempt · probe 재제출 — 첫 응답 id 반환(상한에 걸리지 않음 · 선택 덮지 않음)', ok(again) && again.rows[0].id === p1.rows[0].id
    && (await admin.query(`select value->>'option' o from public.csat_ec_process_evidence where id = $1`, [p1.rows[0].id])).rows[0].o === 'C', again.err)
  const nullCap = await apr(WRONG[9], null, probe({ option: null, skipped: true }))
  record('capture', '상한 null(미정) — 저장 · 건너뜀도 누계에 든다', ok(nullCap) && (await roots()) === base + 2, nullCap.err)
  const cap = base + 3
  const [x, y] = await Promise.all([apr(WRONG[10], cap), apr(WRONG[11], cap)])
  record('capture', `서로 다른 문항 동시 제출 · 상한 ${cap} — 하나만 저장`, [x, y].filter((r) => r.ok).length === 1 && (await roots()) === cap, { x: x.err, y: y.err })
  const notRequired = await apr(WRONG[4], null)   // 신호 없는 문항
  record('capture', '요구되지 않은 attempt 의 probe 거부(add_probe_response 경유도)', fails(notRequired, /요구된 probe|자기/), notRequired.err)

  // ── 권한 ──
  const other = await as(app, learner(U.L2), `select public.csat_ec_add_probe_response($1, $2::smallint, $3::jsonb, null)`, [S.L1, WRONG[10], JSON.stringify(probe())])
  record('capture', 'add_probe_response — 다른 학습자 거부', fails(other, /자기 기록/), other.err)
  const an = await as(app, ANON, `select public.csat_ec_add_probe_response($1, $2::smallint, $3::jsonb, null)`, [S.L1, WRONG[10], JSON.stringify(probe())])
  record('capture', 'add_probe_response — anon 거부', fails(an, /permission denied/), an.err)
  const sv = await as(app, SERVICE, `select public.csat_ec_add_probe_response($1, $2::smallint, $3::jsonb, null)`, [S.L1, WRONG[10], JSON.stringify(probe())])
  record('capture', 'add_probe_response — service_role 거부', fails(sv, /permission denied/), sv.err)
  const negCap = await apr(WRONG[10], -1)
  record('capture', '음수 상한 거부', fails(negCap, /0 이상/), negCap.err)
  const ev = await admin.query(`insert into public.funnel_events (event) values ('csat_ec_capture_opened'), ('csat_ec_capture_finished') returning id`).then(() => true, () => false)
  const evBad = await admin.query(`insert into public.funnel_events (event) values ('csat_ec_capture_typo')`).then(() => true, () => false)
  record('capture', '이벤트 허용 목록 — 새 2종 허용 · 오타 거부', ev && !evBad)
  await admin.query(`delete from public.funnel_events where event like 'csat_ec_capture_%'`)
}
