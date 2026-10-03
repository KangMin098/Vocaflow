// scripts/csat/error-evidence/dev-smoke/smoke.mjs
//
// 오답 원인 Evidence — **개발 Supabase DB** 의 실제 PostgREST · Auth · RLS 경계 smoke test(2026-10-03 사용자 지시).
// SQL 함수 자체 동작은 격리 PostgreSQL 하네스(../isolated-pg, 225/225)가 이미 검증했다. 여기서는 전송 · 역할 전달 · RPC 노출 · RLS 만 본다.
//
// 호출 경로: 앱과 같은 @supabase/supabase-js — anon 키 + 테스트 계정 로그인(authenticated) · service_role 키(AI 파이프라인 · 앱 서버).
// SQL 직접 접속(postgres)은 다음에만 쓴다: TEST taxonomy 시드(앱에 시드 경로가 없다 — 마이그레이션 자리) · 테스트 관리자 역할 부여 · 사후 읽기 확인.
//
// 테스트 데이터
//   · 계정: ec-smoke-<run>-<역할>@example.com — 끝나면 auth admin API 로 지운다(학습자 기록 · 증거 · 판정은 ON DELETE CASCADE).
//   · taxonomy v99.0(note 「TEST」) · 검수 회차는 설계상 지울 수 없다(append-only) — 남고, note · cancel_reason 으로 식별한다.
//   · 기존 학습자 세션 · 응답은 읽기만 한다(시작 · 끝 개수 비교).
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/error-evidence/dev-smoke/smoke.mjs
//   (먼저 이 폴더에서: printf '{ "private": true, "type": "module" }\n' > package.json && npm i pg @supabase/supabase-js@2.104)

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const DEV_REF = 'jajenrevcbmrpaliomxv'   // vocaflow-dev — 다른 프로젝트면 실행하지 않는다
const TAX = 'v99.0'
const TRAP_MAP = 'v0.1:1a90a6611e0cbc02e48e17db439a9fa9e61e608d84fb1d1f9307555a76096358'
const EXAM = '2019'
const WRONG = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27]   // 학습자마다 오답 10 → 3명 30
const CONTROL = [28, 29, 30, 31]                          // 정답 대조 4 → 3명 12
const TAKEN_AT = '2026-10-03'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY, DB_URL = process.env.SUPABASE_DB_URL
if (!URL_ || !ANON || !SERVICE || !DB_URL) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
if (!URL_.includes(DEV_REF) || !DB_URL.includes(DEV_REF)) { console.error(`개발 프로젝트(${DEV_REF})가 아니다 — 중단`); process.exit(2) }

const TABLES = ['csat_ec_taxonomy_version', 'csat_ec_code', 'csat_ec_ai_run', 'csat_ec_claim', 'csat_ec_review_round',
  'csat_ec_review_assignment', 'csat_ec_judgment', 'csat_ec_session_confirmation', 'csat_ec_process_evidence']
const OWN_READ = ['csat_ec_session_confirmation', 'csat_ec_process_evidence', 'csat_ec_claim']
const DICT_READ = ['csat_ec_taxonomy_version', 'csat_ec_code']

const results = []
const record = (area, name, ok, detail) => {
  results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
}
const denied = (r) => !!r.error   // PostgREST 거부(권한 · 함수 예외)
const opt = { auth: { persistSession: false, autoRefreshToken: false } }

const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const svc = createClient(URL_, SERVICE, opt)
const anon = createClient(URL_, ANON, opt)

const run = randomUUID().slice(0, 8)
const users = {}   // 역할 → { id, client }
const counts = async () => (await db.query(`select (select count(*) from public.csat_dx_session)::int s, (select count(*) from public.csat_dx_response)::int r`)).rows[0]
const before = await counts()

async function makeUser(role) {
  const email = `ec-smoke-${run}-${role.toLowerCase()}@example.com`, password = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'csat_ec dev smoke' } })
  if (error) throw new Error(`계정 생성 실패(${role}): ${error.message}`)
  const client = createClient(URL_, ANON, opt)
  const { error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw new Error(`로그인 실패(${role}): ${se.message}`)
  users[role] = { id: data.user.id, client }
}

/** 앱 서버와 같은 경로(service_role → csat_dx_record_session)로 시험 1회 기록 */
async function recordSession(uid, key, items) {
  const responses = key.map((k, i) => {
    const no = i + 1
    const chosen = WRONG.includes(no) ? (k % 5) + 1 : k
    return { item_no: no, item_id: items[no] ?? null, chosen_option: chosen, is_correct: chosen === k, confidence: 'sure' }
  })
  const raw = responses.filter((r) => r.is_correct).length * 2
  const { data, error } = await svc.rpc('csat_dx_record_session', {
    p_session: { user_id: uid, exam_id: EXAM, mode: 'live', taken_at: TAKEN_AT, total_minutes: 70, entered_by: 'learner', client_key: randomUUID(), raw_score: raw, grade: null },
    p_responses: responses,
  })
  if (error) throw new Error(`기록 저장 실패: ${error.message}`)
  return data
}

let cleanupDone = false
async function cleanup() {
  if (cleanupDone) return
  cleanupDone = true
  for (const [role, u] of Object.entries(users)) {
    const { error } = await svc.auth.admin.deleteUser(u.id)
    if (error) console.error(`계정 삭제 실패(${role}): ${error.message}`)
  }
}

try {
  // ── 준비 ───────────────────────────────────────────────────────────────────
  for (const role of ['L1', 'L2', 'L3', 'RA', 'RB', 'ADJ', 'ADM']) await makeUser(role)
  await db.query(`insert into public.user_profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin'`, [users.ADM.id])
  const exists = (await db.query(`select 1 from public.csat_ec_taxonomy_version where version = $1`, [TAX])).rowCount
  if (!exists) {
    await db.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, 'TEST — 개발 DB smoke 전용(2026-10-03). Pilot · 학습자 화면에서 쓰지 않는다')`, [TAX])
    for (const [code, axis, group] of [['V.word_sense', 'V', 'word'], ['S.modifier_scope', 'S', 'sentence'], ['R.main_idea', 'R', 'flow'],
      ['E.option_check', 'E', 'choice'], ['B.guess', 'B', null], ['X.time_pressure', 'X', 'time']])
      await db.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ($1, $2, $3, $2, 'TEST 정의', 'TEST 포함', 'TEST 제외', $4)`, [TAX, code, axis, group])
  }

  const key = (await db.query(`select array_agg(answers[1] order by no) k from public.csat_dx_answer_key where exam_id = $1`, [EXAM])).rows[0].k
  const items = Object.fromEntries((await db.query(`select split_part(id, '#', 2)::int no, id from public.csat_items where id like $1`, [`${EXAM}#%`])).rows.map((r) => [r.no, r.id]))
  const stemLen = Object.fromEntries((await db.query(`select split_part(id, '#', 2)::int no, length(stem) n from public.csat_items where id like $1`, [`${EXAM}#%`])).rows.map((r) => [r.no, r.n]))
  const S = {}
  for (const L of ['L1', 'L2', 'L3']) S[L] = await recordSession(users[L].id, key, items)
  const L1 = users.L1.client, L2 = users.L2.client, RA = users.RA.client, RB = users.RB.client, ADJ = users.ADJ.client, ADM = users.ADM.client

  // ── 1. 학습자 RPC — 정상 · 남의 기록 · anon ────────────────────────────────
  const n0 = WRONG[0]
  record('learner RPC', 'confirm_session — 본인 성공', !denied(await L1.rpc('csat_ec_confirm_session', { p_session: S.L1, p_took_exam: true, p_judged_each: true })))
  record('learner RPC', 'confirm_session — 다른 학습자 기록 거부', denied(await L2.rpc('csat_ec_confirm_session', { p_session: S.L1, p_took_exam: true, p_judged_each: true })))
  record('learner RPC', 'confirm_session — anon 거부', denied(await anon.rpc('csat_ec_confirm_session', { p_session: S.L1, p_took_exam: true, p_judged_each: true })))
  record('learner RPC', 'confirm_session — 판정자(남) 거부', denied(await RA.rpc('csat_ec_confirm_session', { p_session: S.L1, p_took_exam: true, p_judged_each: true })))
  const pe = { p_session: S.L1, p_item_no: n0, p_kind: 'note', p_value: { text: '다른 학습자가 쓰려는 메모입니다' } }
  record('learner RPC', 'add_process_evidence — 다른 학습자 응답 거부', denied(await L2.rpc('csat_ec_add_process_evidence', pe)))
  record('learner RPC', 'add_process_evidence — anon 거부', denied(await anon.rpc('csat_ec_add_process_evidence', pe)))
  record('learner RPC', 'add_process_evidence — service_role 거부(실행 권한 없음)', denied(await svc.rpc('csat_ec_add_process_evidence', pe)))

  // 학습자 3명: 확인 · 고른 이유 · (오답) 막힌 곳 · L1 오답 하나에 범주 보고
  const evErr = []
  for (const L of ['L1', 'L2', 'L3']) {
    const c = users[L].client
    if (L !== 'L1') { const r = await c.rpc('csat_ec_confirm_session', { p_session: S[L], p_took_exam: true, p_judged_each: true }); if (r.error) evErr.push([L, 'confirm', r.error.message]) }
    for (const n of [...WRONG, ...CONTROL]) {
      const r = await c.rpc('csat_ec_add_process_evidence', { p_session: S[L], p_item_no: n, p_kind: 'reason', p_value: { text: `${n}번에서 이 선지를 고른 이유를 적었습니다` } })
      if (r.error) evErr.push([L, n, 'reason', r.error.message])
      if (WRONG.includes(n)) {
        const b = await c.rpc('csat_ec_add_process_evidence', { p_session: S[L], p_item_no: n, p_kind: 'blocked_span',
          p_value: { item_id: items[n], part: 'stem', option: null, sentence: 0, start: 0, end: Math.min(10, stemLen[n]) } })
        if (b.error) evErr.push([L, n, 'span', b.error.message])
      }
    }
  }
  record('learner RPC', 'add_process_evidence — 본인 응답 84건 성공(고른 이유 42 · 막힌 곳 30 + 확인 3)', evErr.length === 0, evErr.slice(0, 3))
  const claimArgs = { p_session: S.L1, p_item_no: n0, p_taxonomy: TAX, p_group: 'sentence', p_code: 'S.modifier_scope', p_supersedes: null }
  record('learner RPC', 'add_student_claim — 봉인 전 taxonomy 거부', denied(await L1.rpc('csat_ec_add_student_claim', claimArgs)))
  record('admin RPC', 'taxonomy_seal — 학습자 거부', denied(await L1.rpc('csat_ec_taxonomy_seal', { p_version: TAX })))
  record('admin RPC', 'taxonomy_seal — anon 거부', denied(await anon.rpc('csat_ec_taxonomy_seal', { p_version: TAX })))
  const seal = await ADM.rpc('csat_ec_taxonomy_seal', { p_version: TAX })
  record('admin RPC', 'taxonomy_seal — 관리자 성공(TEST v99.0)', !seal.error && /^[0-9a-f]{64}$/.test(seal.data), seal.error?.message)
  const cl = await L1.rpc('csat_ec_add_student_claim', claimArgs)
  record('learner RPC', 'add_student_claim — 본인 오답 성공', !cl.error, cl.error?.message)
  record('learner RPC', 'add_student_claim — 다른 학습자 거부', denied(await L2.rpc('csat_ec_add_student_claim', claimArgs)))
  record('learner RPC', 'add_student_claim — anon 거부', denied(await anon.rpc('csat_ec_add_student_claim', claimArgs)))

  // ── 2. 표 RLS — PostgREST 직접 접근 ─────────────────────────────────────────
  // 거부는 「권한 없음(42501)」으로만 인정한다 — 열 이름 오류 등 다른 오류를 통과로 세지 않게
  const COL = { csat_ec_taxonomy_version: 'note', csat_ec_code: 'label', csat_ec_ai_run: 'model', csat_ec_claim: 'code', csat_ec_review_round: 'cancel_reason',
    csat_ec_review_assignment: 'slot', csat_ec_judgment: 'note', csat_ec_session_confirmation: 'took_exam', csat_ec_process_evidence: 'kind' }
  const perm = (r) => r.error?.code === '42501'
  const why = (r) => r.error ? `${r.error.code} ${r.error.message}` : `rows ${r.data?.length}`
  for (const t of TABLES) {
    const col = COL[t], val = t === 'csat_ec_session_confirmation' ? false : 'TEST'
    const a = await anon.from(t).select(col).limit(1)
    record('table RLS', `${t} — anon SELECT 거부`, perm(a), why(a))
    const s = await svc.from(t).select(col).limit(1)
    record('table RLS', `${t} — service_role SELECT 거부(GRANT 없음)`, perm(s), why(s))
    const si = await svc.from(t).insert({ [col]: val })
    record('table RLS', `${t} — service_role INSERT 거부`, perm(si), why(si))
    const sd = await svc.from(t).delete().not(col, 'is', null)
    record('table RLS', `${t} — service_role DELETE 거부`, perm(sd), why(sd))
    const li = await L1.from(t).insert({ [col]: val })
    record('table RLS', `${t} — learner INSERT 거부`, perm(li), why(li))
    const lu = await L1.from(t).update({ [col]: val }).not(col, 'is', null)
    record('table RLS', `${t} — learner UPDATE 거부`, perm(lu), why(lu))
    const ld = await L1.from(t).delete().not(col, 'is', null)
    record('table RLS', `${t} — learner DELETE 거부`, perm(ld), why(ld))
    if (!OWN_READ.includes(t) && !DICT_READ.includes(t)) {
      const r = await RA.from(t).select(col).limit(1)
      record('table RLS', `${t} — authenticated(판정자) SELECT 거부(RPC 전용)`, perm(r), why(r))
    }
  }
  for (const t of OWN_READ) {
    const own = await L1.from(t).select('*').eq('session_id', S.L1)
    const other = await L2.from(t).select('*').eq('session_id', S.L1)
    const all = await L2.from(t).select('user_id')
    record('table RLS', `${t} — 본인 행 읽기 · 남의 행 0`, !own.error && own.data.length > 0 && !other.error && other.data.length === 0
      && all.data.every((r) => r.user_id === users.L2.id), { own: own.data?.length, other: other.data?.length, l2All: all.data?.length })
  }
  for (const t of DICT_READ) {
    const r = await L1.from(t).select('*').eq(t === 'csat_ec_code' ? 'version' : 'version', TAX)
    record('table RLS', `${t} — 로그인 사용자 사전 읽기`, !r.error && r.data.length > 0)
  }

  // ── 3. GraphQL — 「스키마에 보인다」와 「남의 행을 읽는다」는 다르다 ──────────
  const gql = async (token, query) => {
    const res = await fetch(`${URL_}/graphql/v1`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
    return res.json()
  }
  const tokenOf = async (c) => (await c.auth.getSession()).data.session.access_token
  const q = (name) => `{ ${name}(first: 100) { edges { node { session_id user_id } } } }`
  let gName = 'csat_ec_process_evidenceCollection'
  let g1 = await gql(await tokenOf(L1), q(gName))
  if (g1.errors) { gName = 'csatEcProcessEvidenceCollection'; g1 = await gql(await tokenOf(L1), q(gName).replace('session_id user_id', 'sessionId userId')) }
  const gEdges = (g) => g.data?.[gName]?.edges ?? null
  const g2 = await gql(await tokenOf(L2), gName.startsWith('csat_') ? q(gName) : q(gName).replace('session_id user_id', 'sessionId userId'))
  const gA = await gql(ANON, gName.startsWith('csat_') ? q(gName) : q(gName).replace('session_id user_id', 'sessionId userId'))
  const uidOf = (e) => e.node.user_id ?? e.node.userId
  record('GraphQL', '로그인 학습자 — 자기 과정 증거만', gEdges(g1) && gEdges(g1).length > 0 && gEdges(g1).every((e) => uidOf(e) === users.L1.id), { n: gEdges(g1)?.length, err: g1.errors?.[0]?.message })
  record('GraphQL', '다른 학습자 — L1 행 0(자기 행만)', gEdges(g2) && gEdges(g2).every((e) => uidOf(e) === users.L2.id), { n: gEdges(g2)?.length, err: g2.errors?.[0]?.message })
  record('GraphQL', 'anon — 표가 스키마에 없음(조회 오류)', !!gA.errors || gEdges(gA) === null, gA.errors?.[0]?.message)
  const gJ = await gql(await tokenOf(RA), `{ csat_ec_judgmentCollection(first: 1) { edges { node { id } } } }`)
  record('GraphQL', '판정 표 — 로그인 사용자 스키마에 없음', !!gJ.errors, gJ.errors?.[0]?.message)

  // ── 4. 회차 · AI · blind · reveal · 합의 ──────────────────────────────────
  const rc = await ADM.rpc('csat_ec_round_create', { p_taxonomy: TAX, p_quality_rule: 'rq-1', p_choice_trap_map: TRAP_MAP, p_eligibility: { test: 'dev smoke' } })
  record('admin RPC', 'round_create — 관리자 성공', !rc.error, rc.error?.message)
  const round = rc.data
  const rcArgs = { p_taxonomy: TAX, p_quality_rule: 'rq-1', p_choice_trap_map: TRAP_MAP, p_eligibility: {} }
  record('admin RPC', 'round_create — 학습자 거부', denied(await L1.rpc('csat_ec_round_create', rcArgs)))
  record('admin RPC', 'round_create — 판정자 거부', denied(await RA.rpc('csat_ec_round_create', rcArgs)))
  record('admin RPC', 'round_create — anon 거부', denied(await anon.rpc('csat_ec_round_create', rcArgs)))
  record('admin RPC', 'round_create — service_role 거부(실행 권한 없음)', denied(await svc.rpc('csat_ec_round_create', rcArgs)))
  const refs = ['L1', 'L2', 'L3'].flatMap((L) => [...WRONG, ...CONTROL].map((n) => ({ session_id: S[L], item_no: n })))
  const st = await ADM.rpc('csat_ec_round_set_targets', { p_round: round, p_refs: refs })
  record('admin RPC', 'round_set_targets — 관리자 성공(42)', !st.error && st.data === 42, st.error?.message ?? st.data)
  record('admin RPC', 'round_set_targets — 학습자 거부', denied(await L1.rpc('csat_ec_round_set_targets', { p_round: round, p_refs: refs })))

  // AI 파이프라인(service_role)
  const exArgs = { p_round: round, p_session: S.L1, p_item_no: n0 }
  const ex = await svc.rpc('csat_ec_ai_export', exArgs)
  record('AI RPC', 'ai_export — service_role 성공', !ex.error && /^[0-9a-f]{64}$/.test(ex.data?.input_hash ?? ''), ex.error?.message)
  record('AI RPC', 'ai_export — 관리자(authenticated) 거부', denied(await ADM.rpc('csat_ec_ai_export', exArgs)))
  record('AI RPC', 'ai_export — anon 거부', denied(await anon.rpc('csat_ec_ai_export', exArgs)))
  const ci = ex.data?.canonical_input ?? {}
  record('AI RPC', 'ai_export — 사람 판정 · 학생 범주 보고 · 학생 식별자 없음', !('claims' in ci) && !('judgments' in ci) && !('user_id' in ci) && !('session_id' in ci)
    && (ci.process_evidence ?? []).every((e) => e[1] !== 'category'), Object.keys(ci))
  const tx = await svc.rpc('csat_ec_ai_taxonomy', { p_version: TAX })
  record('AI RPC', 'ai_taxonomy — service_role 성공 · B/X 제외', !tx.error && (tx.data?.codes ?? []).every((c) => 'VSRE'.includes(c.axis)), tx.error?.message)
  const quote = (ex.data?.canonical_input?.stem ?? '').slice(0, 8)
  const aiRun = { session_id: S.L1, item_no: n0, taxonomy_version: TAX, model: 'smoke-model', prompt_version: 'p-smoke', analyzer_version: 'a-smoke',
    quality_rule_version: 'rq-1', choice_trap_map: TRAP_MAP, input_hash: ex.data?.input_hash, outcome: 'proposed', output: { raw: 'TEST smoke' } }
  const aiClaims = [{ code: 'S.modifier_scope', role: 'primary', confidence: 'medium', evidence: { summary: 'TEST smoke 제안 — 수식 범위 해석', text_refs: [{ where: 'stem', quote }] } }]
  record('AI RPC', 'ai_import — 관리자(authenticated) 거부', denied(await ADM.rpc('csat_ec_ai_import', { p_round: round, p_run: aiRun, p_claims: aiClaims })))
  const im = await svc.rpc('csat_ec_ai_import', { p_round: round, p_run: aiRun, p_claims: aiClaims })
  record('AI RPC', 'ai_import — service_role 성공', !im.error, im.error?.message)
  await ADM.rpc('csat_ec_round_set_targets', { p_round: round, p_refs: refs })   // AI 실행 · claim 연결을 다시 봉인 대상에

  for (const [role, slot] of [['RA', 'A'], ['RB', 'B'], ['ADJ', 'adjudicator']]) {
    const a = await ADM.rpc('csat_ec_round_assign', { p_round: round, p_reviewer: users[role].id, p_slot: slot, p_pre_disclosed: [] })
    if (a.error) record('admin RPC', `round_assign ${slot}`, false, a.error.message)
  }
  record('admin RPC', 'round_assign — 판정자 거부', denied(await RA.rpc('csat_ec_round_assign', { p_round: round, p_reviewer: users.RA.id, p_slot: 'A', p_pre_disclosed: [] })))
  record('admin RPC', 'round_start_blind — 판정자 거부', denied(await RA.rpc('csat_ec_round_start_blind', { p_round: round })))
  const sb = await ADM.rpc('csat_ec_round_start_blind', { p_round: round })
  record('admin RPC', 'round_start_blind — 관리자 성공(학습자 3 · 오답 30 · 대조 12)', !sb.error, sb.error?.message)

  // blind: A 의 큐
  const qa = await RA.rpc('csat_ec_blind_queue', { p_round: round })
  const cols = qa.data?.[0] ? Object.keys(qa.data[0]).sort() : []
  const expectCols = ['answer', 'choices', 'chosen_option', 'item_id', 'item_no', 'my_judged', 'passage', 'process_evidence', 'session_id', 'stem'].sort()
  record('blind', 'A blind_queue — 42 대상 · 열이 정해진 것뿐(AI · 학생 범주 · 다른 판정 없음)', !qa.error && qa.data.length === 42 && JSON.stringify(cols) === JSON.stringify(expectCols), qa.error?.message ?? cols)
  record('blind', 'A blind_queue — 과정 증거에 범주 보고 없음', !qa.error && qa.data.every((r) => r.process_evidence.every((p) => p.kind !== 'category')))
  record('blind', 'blind_queue — 학습자 거부', denied(await L1.rpc('csat_ec_blind_queue', { p_round: round })))
  record('blind', 'blind_queue — 배정 없는 관리자 거부', denied(await ADM.rpc('csat_ec_blind_queue', { p_round: round })))
  record('blind', 'blind_queue — adjudicator 거부(blind 판정자 아님)', denied(await ADJ.rpc('csat_ec_blind_queue', { p_round: round })))
  record('blind', 'blind_queue — anon 거부', denied(await anon.rpc('csat_ec_blind_queue', { p_round: round })))

  const sub = async (c, t, code) => c.rpc('csat_ec_submit_blind', { p_round: round, p_session: t.session_id, p_item_no: t.item_no,
    p_outcome: code ? 'code' : 'no_cause', p_primary: code, p_contributing: [], p_excluded: [], p_note: 'TEST smoke 판정' })
  const disagree = qa.data[0]
  let bErr = 0
  for (const t of qa.data) { const r = await sub(RA, t, t === disagree ? 'S.modifier_scope' : null); if (r.error) bErr++ }
  record('blind', 'A submit_blind 42 성공', bErr === 0, bErr)
  record('blind', 'submit_blind — 학습자 거부', denied(await sub(L1, disagree, null)))
  record('blind', 'submit_blind — 관리자(미배정) 거부', denied(await sub(ADM, disagree, null)))
  // A 가 제출한 뒤에도 B 는 A 판정을 볼 수 없다
  const qb = await RB.rpc('csat_ec_blind_queue', { p_round: round })
  record('blind', 'B blind_queue — A 제출 뒤에도 A 판정이 안 보임(my_judged=false 만)', !qb.error && qb.data.every((r) => r.my_judged === false && Object.keys(r).length === 10))
  const rvA = await RA.rpc('csat_ec_reveal_view', { p_round: round })
  record('blind', 'reveal_view — 공개 전 A 거부', denied(rvA))
  record('blind', 'reveal_view — 공개 전 B 거부', denied(await RB.rpc('csat_ec_reveal_view', { p_round: round })))
  record('blind', 'round_material — 공개 전 adjudicator 거부', denied(await ADJ.rpc('csat_ec_round_material', { p_round: round })))
  record('blind', 'judgment 표 직접 — A 거부', denied(await RA.from('csat_ec_judgment').select('*').eq('round_id', round)))
  record('blind', 'ai_run 표 직접 — A 거부', denied(await RA.from('csat_ec_ai_run').select('*')))
  record('blind', 'round_reveal — B 판정 없이 거부', denied(await ADM.rpc('csat_ec_round_reveal', { p_round: round })))
  bErr = 0
  for (const t of qb.data) { const r = await sub(RB, t, null); if (r.error) bErr++ }
  record('blind', 'B submit_blind 42 성공', bErr === 0, bErr)
  record('blind', 'round_reveal — 판정자 거부', denied(await RA.rpc('csat_ec_round_reveal', { p_round: round })))
  const rv = await ADM.rpc('csat_ec_round_reveal', { p_round: round })
  record('blind', 'round_reveal — 관리자 성공', !rv.error, rv.error?.message)
  const view = await RA.rpc('csat_ec_reveal_view', { p_round: round })
  const vj = view.data?.judgments ?? [], vc = view.data?.claims ?? []
  record('reveal', 'reveal_view — 공개 뒤 A 가 두 판정(84) · 봉인 claim(AI 1 · 학생 1) 봄', !view.error && vj.length === 84 && vc.filter((c) => c.source === 'ai').length === 1 && vc.filter((c) => c.source === 'student').length === 1,
    view.error?.message ?? { j: vj.length, c: vc.length })
  record('reveal', 'reveal_view — 공개 뒤에도 학습자 거부', denied(await L1.rpc('csat_ec_reveal_view', { p_round: round })))
  record('reveal', 'reveal_view — 공개 뒤에도 미배정 관리자 거부', denied(await ADM.rpc('csat_ec_reveal_view', { p_round: round })))
  const mat = await ADJ.rpc('csat_ec_round_material', { p_round: round })
  record('reveal', 'round_material — 공개 뒤 adjudicator 성공', !mat.error && mat.data.length === 42, mat.error?.message)
  for (const c of vc) for (const R of [RA, RB]) {
    const v = await R.rpc('csat_ec_submit_verify', { p_round: round, p_claim: c.id, p_verdict: 'unsure', p_note: 'TEST smoke 검증' })
    if (v.error) record('reveal', 'submit_verify', false, v.error.message)
  }
  record('reveal', 'submit_verify — 학습자 거부', denied(await L1.rpc('csat_ec_submit_verify', { p_round: round, p_claim: vc[0]?.id, p_verdict: 'accept', p_note: 'x' })))
  const adv = await ADM.rpc('csat_ec_round_advance', { p_round: round, p_to: 'adjudication', p_reason: null })
  record('adjudication', 'round_advance → adjudication — 관리자 성공', !adv.error, adv.error?.message)
  const adjArgs = { p_round: round, p_session: disagree.session_id, p_item_no: disagree.item_no, p_outcome: 'no_cause', p_primary: null, p_contributing: [], p_excluded: [], p_note: 'TEST smoke 합의' }
  record('adjudication', 'submit_adjudication — 판정자 A 거부', denied(await RA.rpc('csat_ec_submit_adjudication', adjArgs)))
  record('adjudication', 'submit_adjudication — 관리자(미배정) 거부', denied(await ADM.rpc('csat_ec_submit_adjudication', adjArgs)))
  const adj = await ADJ.rpc('csat_ec_submit_adjudication', adjArgs)
  record('adjudication', 'submit_adjudication — adjudicator 성공', !adj.error, adj.error?.message)
  record('adjudication', 'round_advance — 판정자 거부', denied(await RA.rpc('csat_ec_round_advance', { p_round: round, p_to: 'closed', p_reason: null })))
  const close = await ADM.rpc('csat_ec_round_advance', { p_round: round, p_to: 'closed', p_reason: null })
  record('adjudication', 'round_advance → closed — 관리자 성공', !close.error, close.error?.message)

  // ── 5. 응답 삭제 트리거 — 열린 회차가 취소되는가(테스트 학습자 계정 삭제 경로) ─────
  const r2 = (await ADM.rpc('csat_ec_round_create', { ...rcArgs, p_eligibility: { test: 'dev smoke — 응답 삭제 트리거' } })).data
  await ADM.rpc('csat_ec_round_set_targets', { p_round: r2, p_refs: [{ session_id: S.L3, item_no: WRONG[0] }] })
  const { error: de } = await svc.auth.admin.deleteUser(users.L3.id)
  const r2s = (await db.query(`select status, cancel_reason from public.csat_ec_review_round where id = $1`, [r2])).rows[0]
  record('trigger', '테스트 학습자 계정 삭제 → 응답 cascade 삭제 → 열린 회차 취소(target_deleted)', !de && r2s.status === 'cancelled' && r2s.cancel_reason === 'target_deleted', { err: de?.message, ...r2s })
  delete users.L3
  const r1s = (await db.query(`select status from public.csat_ec_review_round where id = $1`, [round])).rows[0]
  record('trigger', '닫힌 회차는 대상 삭제에도 그대로(closed)', r1s.status === 'closed', r1s)

  results.push({ area: 'meta', rounds: [round, r2] })
} catch (e) {
  record('실행', '예외', false, e.message)
} finally {
  await cleanup()
  const after = await counts()
  record('정리', '기존 세션 · 응답 수 불변', after.s === before.s && after.r === before.r, { before, after })
  const left = (await db.query(`select
      (select count(*) from public.csat_ec_claim)::int claim, (select count(*) from public.csat_ec_process_evidence)::int pe,
      (select count(*) from public.csat_ec_session_confirmation)::int conf, (select count(*) from public.csat_ec_ai_run)::int ai,
      (select count(*) from public.csat_ec_judgment)::int j, (select count(*) from public.csat_ec_review_round)::int rounds,
      (select count(*) from public.csat_ec_review_assignment where reviewer_id is not null)::int live_assign,
      (select count(*) from auth.users where email like 'ec-smoke-%')::int smoke_users`)).rows[0]
  record('정리', '테스트 계정 · 학습자 증거 · 판정 0 (회차 · TEST taxonomy 만 남음)', left.claim + left.pe + left.conf + left.ai + left.j + left.live_assign + left.smoke_users === 0, left)
  await db.end()
  const failed = results.filter((r) => r.ok === false)
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify({ ranAt: TAKEN_AT, run, pass: results.filter((r) => r.ok).length, fail: failed.length, results }, null, 2) + '\n')
  console.log(`\n합계 PASS ${results.filter((r) => r.ok).length} · FAIL ${failed.length}`)
  process.exitCode = failed.length ? 1 : 0
}
