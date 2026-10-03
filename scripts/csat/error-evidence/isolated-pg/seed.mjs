// scripts/csat/error-evidence/isolated-pg/seed.mjs
// 테스트 데이터 — 학습자 4 · 판정자 A/B · adjudicator · 관리자 · 외부인, 시험 1회(45문항), TEST taxonomy(v9.0)
import { as } from './lib.mjs'

export const U = {
  L1: '00000000-0000-4000-8000-000000000001',
  L2: '00000000-0000-4000-8000-000000000002',
  L3: '00000000-0000-4000-8000-000000000003',
  L4: '00000000-0000-4000-8000-000000000004',   // 전부 ② 입력 학습자
  L5: '00000000-0000-4000-8000-000000000005',   // 동시성 삭제 시나리오용 예비 학습자
  RA: '00000000-0000-4000-8000-0000000000a1',
  RB: '00000000-0000-4000-8000-0000000000b1',
  ADJ: '00000000-0000-4000-8000-0000000000c1',
  ADM: '00000000-0000-4000-8000-0000000000d1',
  OUT: '00000000-0000-4000-8000-0000000000e1',
}
export const learner = (uid) => ({ role: 'authenticated', uid })
export const SERVICE = { role: 'service_role' }
export const ANON = { role: 'anon' }
export const EXAM = 'M2409'
export const TAX = 'v9.0'   // TEST taxonomy — 검증 종료 후 클러스터째 폐기
export const TRAP_MAP = 'v0.1:' + 'a'.repeat(64)
export const answerOf = (n) => (n % 5) + 1
export const WRONG = Array.from({ length: 12 }, (_, i) => 18 + i)    // 18~29 오답
export const CONTROL = [30, 31, 32, 33]                             // 정답 대조
export const passageOf = (n) => `The first sentence of passage ${n} sets the topic. The second sentence adds detail. The third sentence concludes the argument.`

export async function seedBase(admin) {
  await admin.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])`, [Object.values(U), Object.keys(U).map((k) => `${k}@test`)])
  await admin.query(`insert into public.user_profiles (user_id, role) values ($1, 'admin')`, [U.ADM])
  await admin.query(`insert into public.csat_exams (id, label, kind, year, month, exam_year, has_answer_key) values ($1, '2024학년도 9월 모의평가', 'mock', 2024, 9, 2023, true)`, [EXAM])
  for (let n = 1; n <= 45; n++) {
    const reading = n >= 18
    await admin.query(
      `insert into public.csat_items (id, exam_id, no, section, stem, passage, choices, answer, body_ok) values ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [`${EXAM}#${n}`, EXAM, n, reading ? '독해' : '듣기', `Question ${n}: choose the best answer.`, reading ? passageOf(n) : null,
        JSON.stringify([`alpha ${n}`, `beta ${n}`, `gamma ${n}`, `delta ${n}`, `epsilon ${n}`]), answerOf(n)],
    )
    await admin.query(`insert into public.csat_dx_answer_key (exam_id, no, answers, points, source) values ($1, $2, $3, 2, 'test')`, [EXAM, n, [answerOf(n)]])
    if (reading) for (let o = 1; o <= 5; o++) if (o !== answerOf(n)) await admin.query(`insert into public.csat_dx_option_trap (item_id, option_no, trap_key, source) values ($1, $2, '부분 사실', 'analysis')`, [`${EXAM}#${n}`, o])
  }
}

/** 학습자 세션 하나(앱의 기록 저장 경로를 흉내 — 슈퍼유저로 직접 넣는다). chosenOf(n) → 고른 번호 */
export async function addSession(admin, uid, chosenOf, mode = 'live') {
  const { rows } = await admin.query(
    `insert into public.csat_dx_session (user_id, exam_id, mode, taken_at, client_key, raw_score) values ($1, $2, $3, '2026-10-01', gen_random_uuid(), 50) returning id`,
    [uid, mode === 'diagnostic' ? null : EXAM, mode],
  )
  const sid = rows[0].id
  for (let n = 1; n <= 45; n++) {
    const c = chosenOf(n)
    await admin.query(`insert into public.csat_dx_response (session_id, item_no, item_id, chosen_option, is_correct) values ($1, $2, $3, $4, $5)`,
      [sid, n, `${EXAM}#${n}`, c, c === answerOf(n)])
  }
  return sid
}
export const normalChoice = (n) => (WRONG.includes(n) ? (answerOf(n) % 5) + 1 : answerOf(n))

/** TEST taxonomy 를 draft 로 만들고 코드를 넣는다(소유자 postgres — 시드 마이그레이션 자리) */
export async function seedTaxonomy(owner, version = TAX) {
  await owner.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, 'TEST taxonomy — 격리 검증 전용')`, [version])
  const codes = [
    ['V.word_sense', 'V', 'word'], ['V.unknown_word', 'V', 'word'], ['S.modifier_scope', 'S', 'sentence'], ['S.core', 'S', 'sentence'],
    ['R.main_idea', 'R', 'flow'], ['R.inference', 'R', 'flow'], ['E.option_check', 'E', 'choice'], ['E.evidence_location', 'E', 'evidence'],
    ['B.guess', 'B', null], ['X.time_pressure', 'X', 'time'],
  ]
  for (const [code, axis, group] of codes)
    await owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ($1, $2, $3, $2, 'TEST 정의', 'TEST 포함', 'TEST 제외', $4)`, [version, code, axis, group])
}

/** 학습자가 RPC 로 확인 · 과정 증거 · 범주 보고를 남긴다 */
export async function learnerEvidence(pool, uid, sid) {
  const L = learner(uid)
  const out = { errors: [] }
  const c = await as(pool, L, `select public.csat_ec_confirm_session($1, true, true) as rev`, [sid])
  if (!c.ok) out.errors.push(['confirm', c.err])
  for (const n of [...WRONG, ...CONTROL]) {
    const r = await as(pool, L, `select public.csat_ec_add_process_evidence($1, $2::smallint, 'reason', $3::jsonb) as id`, [sid, n, JSON.stringify({ text: `문항 ${n} 에서 이 선지를 고른 이유를 적었습니다` })])
    if (!r.ok) out.errors.push(['reason', n, r.err])
    if (WRONG.includes(n)) {
      const b = await as(pool, L, `select public.csat_ec_add_process_evidence($1, $2::smallint, 'blocked_span', $3::jsonb) as id`,
        [sid, n, JSON.stringify({ item_id: `${EXAM}#${n}`, part: 'passage', sentence: 1, start: 0, end: 20 })])
      if (!b.ok) out.errors.push(['span', n, b.err])
      const cl = await as(pool, L, `select public.csat_ec_add_student_claim($1, $2::smallint, $3, 'sentence', null, null) as id`, [sid, n, TAX])
      if (!cl.ok) out.errors.push(['claim', n, cl.err])
    }
  }
  return out
}

/** AI 파이프라인(service_role): export → taxonomy → import (오답만) */
export async function aiJudge(pool, sid, n) {
  const ex = await as(pool, SERVICE, `select public.csat_ec_ai_export($1, $2::smallint) as x`, [sid, n])
  if (!ex.ok) return ex
  const x = ex.rows[0].x
  const run = { session_id: sid, item_no: n, taxonomy_version: TAX, model: 'test-model', prompt_version: 'p1', analyzer_version: 'a1',
    quality_rule_version: 'rq-1', choice_trap_map: TRAP_MAP, input_hash: x.input_hash, input_refs: { item_id: x.item_id }, outcome: 'proposed', output: { raw: 'ok' } }
  const claims = [{ code: 'S.modifier_scope', role: 'primary', confidence: 'medium',
    evidence: { summary: '수식 범위를 잘못 잡은 것으로 보인다', text_refs: [{ where: 'passage', quote: 'The second sentence adds detail' }] } }]
  return as(pool, SERVICE, `select public.csat_ec_ai_import($1::jsonb, $2::jsonb) as id`, [JSON.stringify(run), JSON.stringify(claims)])
}
