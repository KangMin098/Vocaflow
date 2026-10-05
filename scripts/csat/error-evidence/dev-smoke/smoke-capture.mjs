// scripts/csat/error-evidence/dev-smoke/smoke-capture.mjs
//
// 학생 증거 수집(20261005150000_csat_ec_capture_support + 앱 수집 화면)의 **개발 Supabase DB** smoke — 앱과 같은 supabase-js 경로(학습자 로그인 · service_role).
// 수집 화면이 부르는 RPC 를 같은 순서로 부른다: 확인 → 고른 이유 · 막힌 곳 · 해석(3상태) · 학생 범주 → (탐지기 관찰) → 대기 질문 → 질문 응답 · 건너뜀.
// 회차는 만들지 않는다(실제 taxonomy v0.1 아래 TEST 회차를 남기지 않게) — pre_probe/all 은 판정 입력 해시 함수로 직접 비교한다.
// 테스트 계정 ec-capture-<run>-*@example.com 은 끝나면 지운다(응답 · 증거 · 관찰 cascade).
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/error-evidence/dev-smoke/smoke-capture.mjs

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const DEV_REF = 'jajenrevcbmrpaliomxv'
const TAX = 'v0.1', BKEY = 'r.inference__v.wrong_sense', PROBE = 'r6_derivation_probe'
const EXAM = '2019', WRONG = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27], TAKEN_AT = '2026-10-05'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY, DB_URL = process.env.SUPABASE_DB_URL
if (!URL_ || !ANON || !SERVICE || !DB_URL) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
if (!URL_.includes(DEV_REF) || !DB_URL.includes(DEV_REF)) { console.error(`개발 프로젝트(${DEV_REF})가 아니다 — 중단`); process.exit(2) }

const results = []
const record = (area, name, ok, detail) => { results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`) }
const denied = (r) => !!r.error
const opt = { auth: { persistSession: false, autoRefreshToken: false } }
const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const svc = createClient(URL_, SERVICE, opt), anon = createClient(URL_, ANON, opt)
const run = randomUUID().slice(0, 8)
const users = {}
const counts = async () => (await db.query(`select (select count(*) from public.csat_dx_session)::int s, (select count(*) from public.csat_dx_response)::int r`)).rows[0]
const before = await counts()

async function makeUser(role) {
  const email = `ec-capture-${run}-${role.toLowerCase()}@example.com`, password = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'csat_ec capture dev smoke' } })
  if (error) throw new Error(`계정 생성 실패(${role}): ${error.message}`)
  const client = createClient(URL_, ANON, opt)
  const { error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw new Error(`로그인 실패(${role}): ${se.message}`)
  users[role] = { id: data.user.id, client }
}
async function recordSession(uid, key, items) {
  const responses = key.map((k, i) => {
    const no = i + 1, chosen = WRONG.includes(no) ? (k % 5) + 1 : k
    return { item_no: no, item_id: items[no] ?? null, chosen_option: chosen, is_correct: chosen === k, confidence: 'sure' }
  })
  const { data, error } = await svc.rpc('csat_dx_record_session', {
    p_session: { user_id: uid, exam_id: EXAM, mode: 'live', taken_at: TAKEN_AT, total_minutes: 70, entered_by: 'learner', client_key: randomUUID(), raw_score: responses.filter((r) => r.is_correct).length * 2, grade: null },
    p_responses: responses,
  })
  if (error) throw new Error(`기록 저장 실패: ${error.message}`)
  return data
}

try {
  const tax = (await db.query(`select status, definitions_hash from public.csat_ec_taxonomy_version where version = $1`, [TAX])).rows[0]
  if (tax?.status !== 'sealed') throw new Error('v0.1 seed 가 봉인돼 있지 않다')
  for (const role of ['L1', 'L2']) await makeUser(role)
  const key = (await db.query(`select array_agg(answers[1] order by no) k from public.csat_dx_answer_key where exam_id = $1`, [EXAM])).rows[0].k
  const items = Object.fromEntries((await db.query(`select split_part(id, '#', 2)::int no, id from public.csat_items where id like $1`, [`${EXAM}#%`])).rows.map((r) => [r.no, r.id]))
  const S = { L1: await recordSession(users.L1.id, key, items), L2: await recordSession(users.L2.id, key, items) }
  const L1 = users.L1.client, L2 = users.L2.client
  const [n0, n1, n2, n3] = WRONG
  const pe = (c, no, kind, value, sup = null) => c.rpc('csat_ec_add_process_evidence', { p_session: S.L1, p_item_no: no, p_kind: kind, p_value: value, p_supersedes: sup })

  // ── 확인 — 재전송 멱등 ──
  const c1 = await L1.rpc('csat_ec_confirm_session', { p_session: S.L1, p_took_exam: true, p_judged_each: true })
  const c2 = await L1.rpc('csat_ec_confirm_session', { p_session: S.L1, p_took_exam: true, p_judged_each: true })
  const nConf = (await db.query(`select count(*)::int n from public.csat_ec_session_confirmation where session_id = $1`, [S.L1])).rows[0].n
  record('확인', '같은 확인 재전송 — 같은 revision · 1행', !c1.error && !c2.error && c1.data === c2.data && nConf === 1, { c1: c1.data, c2: c2.data, nConf })
  record('확인', '다른 학습자 기록 확인 거부', denied(await L2.rpc('csat_ec_confirm_session', { p_session: S.L1, p_took_exam: true, p_judged_each: true })))

  // ── 증거 — 고른 이유 · 막힌 곳 · 해석 3상태 · 학생 범주 ──
  const reason = { text: `${n0}번은 앞 문장과 같은 방향이라 이 선지를 골랐어요` }
  const r1 = await pe(L1, n0, 'reason', reason), r2 = await pe(L1, n0, 'reason', { text: reason.text })
  record('증거', '고른 이유 재전송 — 같은 id(행이 늘지 않음)', !r1.error && r1.data === r2.data, [r1.error?.message, r2.error?.message])
  const passage = (await db.query(`select passage from public.csat_items where id = $1`, [items[n0]])).rows[0].passage
  const end = passage.search(/[.!?](\s|$)/) + 1
  const bs = await pe(L1, n0, 'blocked_span', { item_id: items[n0], part: 'passage', option: null, sentence: 0, start: 0, end })
  record('증거', '막힌 곳(지문 첫 문장 — 서버 계산 범위 형식) 저장', !bs.error, bs.error?.message)
  const ia = await pe(L1, n0, 'interpretation', { state: 'answered', text: '그 표현을 원래 뜻 그대로 받아들였어요' })
  const iu = await pe(L1, n1, 'interpretation', { state: 'unknown' })
  const is = await pe(L1, n2, 'interpretation', { state: 'skipped' })
  record('해석', 'answered · unknown · skipped 저장', !ia.error && !iu.error && !is.error, [ia.error?.message, iu.error?.message, is.error?.message])
  const states = (await db.query(`select item_no, value->>'state' s from public.csat_ec_process_evidence where session_id = $1 and kind = 'interpretation' order by item_no`, [S.L1])).rows
  record('해석', '3상태가 DB 에서 구분된다(모름 ≠ 건너뜀)', JSON.stringify(states.map((r) => r.s)) === JSON.stringify(['answered', 'unknown', 'skipped']), states)
  record('해석', 'unknown 에 글 거부', denied(await pe(L1, n1, 'interpretation', { state: 'unknown', text: '모름' })))
  record('해석', '없는 상태 거부', denied(await pe(L1, n1, 'interpretation', { state: 'maybe' })))
  const claimsBefore = (await db.query(`select count(*)::int n from public.csat_ec_claim where session_id = $1`, [S.L1])).rows[0].n
  const ge = await pe(L1, n0, 'category', { group: 'evidence' }), gc = await pe(L1, n1, 'category', { group: 'choice' })
  const claimsAfter = (await db.query(`select count(*)::int n from public.csat_ec_claim where session_id = $1`, [S.L1])).rows[0].n
  record('범주', 'evidence · choice 저장 — 원인 claim 0(E.evidence_location · E.task_misread · E.option_mismatch 자동 생성 없음)', !ge.error && !gc.error && claimsBefore === 0 && claimsAfter === 0, { claimsBefore, claimsAfter })
  record('증거', '다른 학습자 응답에 증거 거부', denied(await L2.rpc('csat_ec_add_process_evidence', { p_session: S.L1, p_item_no: n0, p_kind: 'reason', p_value: { text: '남의 기록에 쓰려는 이유입니다' } })))
  record('증거', 'anon 거부', denied(await anon.rpc('csat_ec_add_process_evidence', { p_session: S.L1, p_item_no: n0, p_kind: 'reason', p_value: { text: '익명이 쓰려는 이유입니다' } })))
  const elig = (await db.query(`select public.csat_ec_pilot_eligible($1, $2::smallint) e`, [S.L1, n0])).rows[0].e
  record('적격', '확인 · 고른 이유 · 막힌 곳을 갖춘 오답 attempt = Pilot 적격', elig === true, elig)

  // ── 탐지기 관찰 → 대기 질문 → 응답 ──
  const preBefore = (await db.query(`select public.csat_ec_judgment_input_hash($1, $2::smallint, 'pre_probe') h`, [S.L1, n0])).rows[0].h
  const allBefore = (await db.query(`select public.csat_ec_judgment_input_hash($1, $2::smallint, 'all') h`, [S.L1, n0])).rows[0].h
  for (const no of [n0, n1, n2]) {
    const d = await svc.rpc('csat_ec_add_detector_signal', { p_session: S.L1, p_item_no: no, p_taxonomy: TAX, p_boundary_key: BKEY, p_detector_version: 'smoke-capture', p_probe_required: true, p_evidence_ids: [] })
    if (d.error) record('관찰', `탐지기 관찰(service_role) ${no}`, false, d.error.message)
  }
  const pend = await L1.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })
  record('질문', '대기 질문 — 관찰된 3문항 · v0.1 · r6_derivation_probe', !pend.error && pend.data.length === 3 && pend.data.every((p) => p.taxonomy_version === TAX && p.probe_key === PROBE), pend.error?.message ?? pend.data)
  const pendOther = await L2.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })
  record('질문', '다른 학습자 — 0행', !pendOther.error && pendOther.data.length === 0)
  const pendNone = await L1.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })
  record('질문', '관찰 없는 문항은 대기 목록에 없다', !pendNone.error && !pendNone.data.some((p) => p.item_no === n3))
  const pv = (option) => ({ probe_key: PROBE, probe_version: '1.0.0', taxonomy_version: TAX, boundary_key: BKEY, prompt_hash: 'c'.repeat(64), option, skipped: option === null })
  const apr = (c, no, option, cap = null) => c.rpc('csat_ec_add_probe_response', { p_session: S.L1, p_item_no: no, p_value: pv(option), p_session_cap: cap })
  const p1 = await apr(L1, n0, 'B')
  record('질문', '응답 저장 — 선택지 글자만(원인 이름 없음)', !p1.error, p1.error?.message)
  const row = (await db.query(`select value from public.csat_ec_process_evidence where id = $1`, [p1.data])).rows[0]?.value
  record('질문', '저장된 응답 = 글자 · 판 · 해시 · skipped(원인 코드 없음)', row?.option === 'B' && row?.skipped === false && !/V\.wrong_sense|R\.inference/.test(JSON.stringify(row)), row)
  const p1b = await apr(L1, n0, 'A')
  record('질문', '중복 제출 — 첫 응답 id 반환 · 선택 덮지 않음', !p1b.error && p1b.data === p1.data && (await db.query(`select value->>'option' o from public.csat_ec_process_evidence where id = $1`, [p1.data])).rows[0].o === 'B', p1b.error?.message)
  const sk = await apr(L1, n1, null)
  record('질문', '건너뜀 — 이벤트로 저장(skipped · 선택 없음)', !sk.error, sk.error?.message)
  const capped = await apr(L1, n2, 'C', 2)
  record('질문', '세션 상한(2) — 세 번째 질문 거부', denied(capped) && /상한/.test(capped.error?.message ?? ''), capped.error?.message)
  const notReq = await apr(L1, n3, 'A')
  record('질문', '요구되지 않은 질문 응답 거부', denied(notReq), notReq.error?.message)
  record('질문', '다른 학습자 응답 거부', denied(await apr(L2, n2, 'A')))
  record('질문', 'anon 거부', denied(await apr(anon, n2, 'A')))
  const pend2 = await L1.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })
  record('질문', '응답 · 건너뜀 뒤 대기 1(n2)만', !pend2.error && pend2.data.length === 1 && pend2.data[0].item_no === n2, pend2.data)

  // ── pre_probe / all ──
  const preAfter = (await db.query(`select public.csat_ec_judgment_input_hash($1, $2::smallint, 'pre_probe') h`, [S.L1, n0])).rows[0].h
  const allAfter = (await db.query(`select public.csat_ec_judgment_input_hash($1, $2::smallint, 'all') h`, [S.L1, n0])).rows[0].h
  record('pre/all', 'probe 응답 뒤 pre_probe 해시 그대로 · all 해시 바뀜 · 둘이 다름', preBefore === preAfter && allBefore !== allAfter && preAfter !== allAfter, { preBefore, preAfter, allBefore, allAfter })
  const kinds = (await db.query(`select public.csat_ec_canonical_input($1, $2::smallint, 'pre_probe') p, public.csat_ec_canonical_input($1, $2::smallint, 'all') a`, [S.L1, n0])).rows[0]
  const k = (ci) => (ci.process_evidence ?? []).map((e) => e[1])
  record('pre/all', 'pre_probe 입력 = 해석 포함 · probe 없음 / all = 둘 다', k(kinds.p).includes('interpretation') && !k(kinds.p).includes('targeted_probe') && k(kinds.a).includes('interpretation') && k(kinds.a).includes('targeted_probe'), { pre: k(kinds.p), all: k(kinds.a) })
} catch (e) {
  record('실행', '예외', false, e.message)
} finally {
  for (const [role, u] of Object.entries(users)) { const { error } = await svc.auth.admin.deleteUser(u.id); if (error) console.error(`계정 삭제 실패(${role}): ${error.message}`) }
  const after = await counts()
  record('정리', '기존 세션 · 응답 수 불변', after.s === before.s && after.r === before.r, { before, after })
  const left = (await db.query(`select (select count(*) from public.csat_ec_process_evidence)::int pe, (select count(*) from public.csat_ec_boundary_signal)::int sig,
      (select count(*) from public.csat_ec_session_confirmation)::int conf, (select count(*) from auth.users where email like 'ec-capture-%')::int u`)).rows[0]
  record('정리', '테스트 계정 · 증거 · 관찰 · 확인 0', left.pe + left.sig + left.conf + left.u === 0, left)
  await db.end()
  const fail = results.filter((r) => !r.ok)
  fs.writeFileSync(path.join(DIR, 'results-capture.json'), JSON.stringify({ ranAt: TAKEN_AT, run, pass: results.length - fail.length, fail: fail.length, results }, null, 2) + '\n')
  console.log(`\n합계 PASS ${results.length - fail.length} · FAIL ${fail.length}`)
  process.exitCode = fail.length ? 1 : 0
}
