// scripts/csat/error-evidence/isolated-pg/t_p2fix.mjs
// Pilot 전 P2 6건 회귀 — 대응표 manifest · 품질 신호 봉인 · AI 입력 서버 구성 · 입력 전문 스냅샷 · 원인/배제 축 모순 · 폐기 코드
import { as, record } from './lib.mjs'
import { SERVICE, TAX, TRAP_MAP, U, learner } from './seed.mjs'

const ADM = learner(U.ADM), RA = learner(U.RA)
const fails = (r, re) => !r.ok && (!re || re.test(r.err))
const tryQ = async (pool, sql, params = []) => { try { await pool.query(sql, params); return { ok: true } } catch (e) { return { ok: false, err: e.message } } }

async function draftRound(app, refs, tax = TAX) {
  const rc = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}') as id`, [tax, TRAP_MAP])
  if (!rc.ok) throw new Error('round_create ' + rc.err)
  const id = Number(rc.rows[0].id)
  const st = await as(app, ADM, `select public.csat_ec_round_set_targets($1, $2::jsonb)`, [id, JSON.stringify(refs)])
  if (!st.ok) throw new Error('set_targets ' + st.err)
  for (const [uid, slot] of [[U.RA, 'A'], [U.RB, 'B'], [U.ADJ, 'adjudicator']]) await as(app, ADM, `select public.csat_ec_round_assign($1, $2, $3)`, [id, uid, slot])
  return id
}
const blind = (app, round, t, outcome, primary, contributing = [], excluded = []) =>
  as(app, RA, `select public.csat_ec_submit_blind($1, $2, $3::smallint, $4, $5, $6, $7, 'TEST')`, [round, t.session_id, t.item_no, outcome, primary, contributing, excluded])

export default async function p2fix(admin, ctx) {
  const { app, owner, S } = ctx

  // ── P2-1 대응표 manifest ──
  let r = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}')`, [TAX, 'v0.1:' + 'b'.repeat(64)])
  record('P2-1', '형식은 맞지만 승인 안 된 해시 — 회차 생성 거부', fails(r, /승인된 선지 함정 대응표/), r.err)
  r = await as(app, ADM, `select public.csat_ec_round_create($1, 'rq-1', $2, '{}')`, [TAX, 'v0.2:1a90a6611e0cbc02e48e17db439a9fa9e61e608d84fb1d1f9307555a76096358'])
  record('P2-1', '버전만 바꾼 값 — 거부', fails(r, /승인된 선지 함정 대응표/), r.err)
  const d1 = await draftRound(app, ctx.refs)
  await admin.query(`update public.csat_ec_review_round set choice_trap_map = $2 where id = $1`, [d1, 'v0.1:' + 'c'.repeat(64)])
  r = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [d1])
  record('P2-1', 'draft 에서 대응표를 바꿔 넣어도 — blind 시작 거부', fails(r, /승인된 선지 함정 대응표/), r.err)
  await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [d1])

  // ── P2-2 품질 신호 봉인 ──
  const t0 = (await admin.query(`select r.targets->0 as t, public.csat_ec_record_quality_rq1_signals((r.targets->0->>'session_id')::uuid) as now from public.csat_ec_review_round r where r.id = $1`, [ctx.round])).rows[0]
  const keys = ['rule', 'answered', 'dominant_option', 'dominant_count', 'dominant_ratio', 'longest_streak', 'distinct_options', 'status']
  record('P2-2', '봉인 대상에 rq-1 신호 전부(답한 수 · 최빈 번호 · 비율 · 최장 연속 · 종류 · 판정)', keys.every((k) => k in t0.t.quality) && JSON.stringify(t0.t.quality) === JSON.stringify(t0.now), t0.t.quality)

  // ── P2-3 AI 입력 서버 구성 ──
  const run = ctx.aiRun, claims = ctx.aiClaims, rq = ctx.aiRound
  const imp = (rn, cl, round = rq) => as(app, SERVICE, `select public.csat_ec_ai_import($1, $2::jsonb, $3::jsonb) as id`, [round, JSON.stringify(rn), JSON.stringify(cl)])
  r = await imp({ ...run, session_id: S.L2, model: 'inj1' }, claims)
  record('P2-3', '회차 대상이 아닌 다른 학생 응답 주입 — 거부', fails(r, /대상이 아니다/), r.err)
  r = await imp({ ...run, item_no: 19, model: 'inj2' }, claims)
  record('P2-3', '같은 학생의 대상 아닌 문항 주입 — 거부', fails(r, /대상이 아니다/), r.err)
  r = await imp({ ...run, taxonomy_version: 'v8.0', model: 'inj3' }, claims)
  record('P2-3', '다른 taxonomy 주입 — 거부', fails(r, /회차 값과 같아야/), r.err)
  r = await imp({ ...run, choice_trap_map: 'v0.1:' + 'd'.repeat(64), model: 'inj4' }, claims)
  record('P2-3', '다른 대응표 주입 — 거부', fails(r, /회차 값과 같아야/), r.err)
  r = await imp({ ...run, model: 'inj5' }, claims, ctx.round)
  record('P2-3', '이미 시작된(닫힌) 회차로 적재 — 거부', fails(r, /draft 회차/), r.err)
  r = await imp({ ...run, model: 'inj6', canonical_input: { stem: '주입한 원문' }, input_refs: { process_evidence_ids: ['00000000-0000-4000-8000-000000000000'] } }, claims)
  const stored = r.ok ? (await admin.query(`select canonical_input = public.csat_ec_canonical_input(session_id, item_no) as same, canonical_input::text like '%주입한%' as injected from public.csat_ec_ai_run where id = $1`, [r.rows[0].id])).rows[0] : null
  record('P2-3', '호출자가 보낸 입력 전문 · 증거 참조는 무시 — 서버가 만든 전문만 저장', r.ok && stored.same && !stored.injected, r.err ?? stored)

  // ── P2-4 입력 전문 스냅샷 ──
  const runs = (await admin.query(`select id, canonical_input, input_hash, encode(extensions.digest(canonical_input::text, 'sha256'), 'hex') = input_hash as ok from public.csat_ec_ai_run`)).rows
  record('P2-4', `모든 AI 실행(${runs.length}) — 전문 보존 · 해시 = sha256(전문)`, runs.length > 0 && runs.every((x) => x.ok && x.canonical_input.stem && Array.isArray(x.canonical_input.process_evidence)), runs.filter((x) => !x.ok).length)
  const pii = runs.filter((x) => /session_id|user_id/.test(JSON.stringify(x.canonical_input)))
  record('P2-4', '전문에 학생 · 세션 식별자 없음(최소 입력)', pii.length === 0, pii.length)
  r = await tryQ(admin, `update public.csat_ec_ai_run set canonical_input = '{}' where id = $1`, [runs[0].id])
  record('P2-4', '전문 UPDATE 거부(불변)', fails(r, /덧붙이기 전용/), r.err)
  r = await tryQ(admin, `insert into public.csat_ec_ai_run (session_id, item_no, taxonomy_version, model, prompt_version, analyzer_version, quality_rule_version, choice_trap_map, round_id, input_hash, canonical_input, outcome, output)
                         select session_id, item_no, taxonomy_version, 'x', 'x', 'x', 'rq-1', choice_trap_map, round_id, repeat('e', 64), canonical_input, 'no_cause', '{}' from public.csat_ec_ai_run where id = $1`, [runs[0].id])
  record('P2-4', '해시와 전문이 다른 행 — CHECK 로 거부(직접 INSERT 도)', fails(r, /check/i), r.err)

  // ── P2-5 원인 · 배제 축 모순 ──
  const d5 = await draftRound(app, ctx.refs)
  const sb = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [d5])
  const tg = ctx.refs
  const cases = [
    ['primary 와 같은 축 배제', blind(app, d5, tg[0], 'code', 'S.modifier_scope', [], ['S']), false],
    ['contributing 과 같은 축 배제', blind(app, d5, tg[1], 'code', 'V.word_sense', ['S.core'], ['S']), false],
    ['근거 부족 + 배제', blind(app, d5, tg[2], 'insufficient_evidence', null, [], ['V']), false],
    ['원인 없음 + 배제', blind(app, d5, tg[3], 'no_cause', null, [], ['R']), false],
    ['B(행동) 원인 + 역량 4축 모두 배제 — 허용', blind(app, d5, tg[4], 'code', 'B.guess', [], ['V', 'S', 'R', 'E']), true],
    ['S 원인 + 다른 축 배제 — 허용', blind(app, d5, tg[5], 'code', 'S.modifier_scope', [], ['V', 'R']), true],
    ['원인 없음 · 배제 없음 — 허용', blind(app, d5, tg[6], 'no_cause', null, [], []), true],
  ]
  for (const [name, p, allowed] of cases) {
    const x = await p
    record('P2-5', `${name}`, sb.ok && (allowed ? x.ok : fails(x, /배제/)), x.err ?? 'ok')
  }
  await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [d5])

  // ── P2-6 폐기 코드 ──
  await owner.query(`insert into public.csat_ec_taxonomy_version (version, note) values ('v9.5', 'TEST — 폐기 코드 검증')`)
  for (const [code, axis, group, status] of [['S.modifier_scope', 'S', 'sentence', 'active'], ['S.core', 'S', 'sentence', 'deprecated'], ['V.word_sense', 'V', 'word', 'active'], ['B.guess', 'B', null, 'active']])
    await owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group, status) values ('v9.5', $1, $2, $1, 'd', 'i', 'e', $3, $4)`, [code, axis, group, status])
  await as(app, ADM, `select public.csat_ec_taxonomy_seal('v9.5')`)
  const tx = await as(app, SERVICE, `select public.csat_ec_ai_taxonomy('v9.5') as t`)
  record('P2-6', 'AI 사전에 폐기 코드 없음', tx.ok && !JSON.stringify(tx.rows[0].t).includes('S.core'), tx.err)
  const d6 = await draftRound(app, ctx.refs, 'v9.5')
  const t6 = ctx.refs[0]
  const ex6 = await as(app, SERVICE, `select public.csat_ec_ai_export($1, $2, $3::smallint) as x`, [d6, t6.session_id, t6.item_no])
  const run6 = { session_id: t6.session_id, item_no: t6.item_no, taxonomy_version: 'v9.5', model: 'dep', prompt_version: 'p1', analyzer_version: 'a1', quality_rule_version: 'rq-1', choice_trap_map: TRAP_MAP, input_hash: ex6.rows?.[0]?.x?.input_hash, outcome: 'proposed', output: {} }
  r = await imp(run6, [{ ...claims[0], code: 'S.core' }], d6)
  record('P2-6', 'AI 신규 제안에 폐기 코드 — 거부', fails(r, /폐기된 코드/), r.err)
  r = await as(app, learner(U.L4), `select public.csat_ec_add_student_claim($1, 23::smallint, 'v9.5', 'sentence', 'S.core', null)`, [S.L4])
  record('P2-6', '학생 보고에 폐기 코드 — 거부', fails(r, /맞지 않는다/), r.err)
  const sb6 = await as(app, ADM, `select public.csat_ec_round_start_blind($1)`, [d6])
  const dep = await blind(app, d6, ctx.refs[0], 'code', 'S.core')
  const depC = await blind(app, d6, ctx.refs[1], 'code', 'S.modifier_scope', ['S.core'])
  const act = await blind(app, d6, ctx.refs[2], 'code', 'S.modifier_scope')
  record('P2-6', '판정 primary 에 폐기 코드 — 거부', sb6.ok && fails(dep, /폐기된 코드/), [sb6.err, dep.err])
  record('P2-6', '판정 contributing 에 폐기 코드 — 거부', fails(depC, /폐기된 코드|사전에 없거나/), depC.err)
  record('P2-6', '활성 코드 판정 — 허용', act.ok, act.err)
  const past = (await admin.query(`select count(*) n from public.csat_ec_judgment where taxonomy_version = $1`, [TAX])).rows[0].n
  record('P2-6', '과거(v9.0) 판정 참조 유지', Number(past) > 0, past)
  await as(app, ADM, `select public.csat_ec_round_advance($1, 'cancelled', 'TEST')`, [d6])
}
