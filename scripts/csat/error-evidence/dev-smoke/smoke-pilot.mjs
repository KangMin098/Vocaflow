// scripts/csat/error-evidence/dev-smoke/smoke-pilot.mjs
//
// 오답 원인 Pilot 데이터 모델(20261005130000_csat_ec_pilot_evidence) — **개발 Supabase DB** 의 실제 PostgREST · Auth · RLS 경계 smoke(2026-10-05 사용자 지시 9–16항).
// SQL 함수 동작은 격리 PostgreSQL 하네스(../isolated-pg · run-pilot 273/273)가 검증했다. 여기서는 앱과 같은 경로의 역할 전달 · 권한 · 무결성만 본다.
//
// 테스트 데이터
//   · 계정 ec-pilot-<run>-<역할>@example.com — 끝나면 지운다(응답 · 과정 증거 · probe · 경계 관찰 · 판정 · AI 실행은 cascade).
//   · taxonomy v99.1(note 「TEST」) · 코드 7 · 경계 2 · 검수 회차는 설계상 지울 수 없다(append-only) — 남는다. 다시 실행하면 v99.1 은 재사용한다.
//     주의: 경계 행이 남으므로 rollback-pilot.sql 은 이 행을 정리하기 전에는 거부한다(의도된 안전장치).
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/error-evidence/dev-smoke/smoke-pilot.mjs

import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const DEV_REF = 'jajenrevcbmrpaliomxv'
const TAX = 'v99.1'
const BKEY = 'r.inference__v.wrong_sense'          // provisional · probe
const BKEY_ACC = 'e.option_check__s.modifier_scope' // accepted · probe 없음
const PROBE = 'test_boundary_probe'
const TRAP_MAP = 'v0.1:1a90a6611e0cbc02e48e17db439a9fa9e61e608d84fb1d1f9307555a76096358'
const EXAM = '2019'
const WRONG = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
const CONTROL = [28, 29, 30, 31]
const TAKEN_AT = '2026-10-05'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY, DB_URL = process.env.SUPABASE_DB_URL
if (!URL_ || !ANON || !SERVICE || !DB_URL) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
if (!URL_.includes(DEV_REF) || !DB_URL.includes(DEV_REF)) { console.error(`개발 프로젝트(${DEV_REF})가 아니다 — 중단`); process.exit(2) }

const results = []
const record = (area, name, ok, detail) => {
  results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
}
const denied = (r) => !!r.error
const perm = (r) => r.error?.code === '42501'
const why = (r) => r.error ? `${r.error.code} ${r.error.message}` : `rows ${r.data?.length ?? JSON.stringify(r.data)}`
const rejects = (r, re) => !!r.error && (!re || re.test(r.error.message))
const opt = { auth: { persistSession: false, autoRefreshToken: false } }

const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const svc = createClient(URL_, SERVICE, opt)
const anon = createClient(URL_, ANON, opt)

const run = randomUUID().slice(0, 8)
const users = {}
const counts = async () => (await db.query(`select (select count(*) from public.csat_dx_session)::int s, (select count(*) from public.csat_dx_response)::int r`)).rows[0]
const mapCounts = async () => (await db.query(`select coalesce(sum(n_live_tup), 0)::bigint n, md5(string_agg(relname || ':' || n_tup_ins || ':' || n_tup_upd || ':' || n_tup_del, ',' order by relname)) h
  from pg_stat_user_tables where relname like 'csat\\_map\\_%'`)).rows[0]
const before = await counts()
const mapBefore = await mapCounts()

async function makeUser(role) {
  const email = `ec-pilot-${run}-${role.toLowerCase()}@example.com`, password = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'csat_ec pilot dev smoke' } })
  if (error) throw new Error(`계정 생성 실패(${role}): ${error.message}`)
  const client = createClient(URL_, ANON, opt)
  const { error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw new Error(`로그인 실패(${role}): ${se.message}`)
  users[role] = { id: data.user.id, client }
}

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

let roundPre = null, roundAll = null
try {
  // ── 0. 준비 ────────────────────────────────────────────────────────────────
  for (const role of ['L1', 'L2', 'L3', 'RA', 'RB', 'ADJ', 'ADM']) await makeUser(role)
  await db.query(`insert into public.user_profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin'`, [users.ADM.id])
  const legacyHash = (await db.query(`select definitions_hash h from public.csat_ec_taxonomy_version where version = 'v99.0'`)).rows[0]?.h

  const tv = (await db.query(`select status from public.csat_ec_taxonomy_version where version = $1`, [TAX])).rows[0]
  if (!tv) {
    await db.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, 'TEST — Pilot 데이터 모델 개발 DB smoke 전용(2026-10-05). Pilot · 학습자 화면에서 쓰지 않는다')`, [TAX])
    for (const [code, axis, group, status] of [['V.word_sense', 'V', 'word', 'active'], ['V.wrong_sense', 'V', 'word', 'active'], ['V.old_sense', 'V', 'word', 'deprecated'],
      ['S.modifier_scope', 'S', 'sentence', 'active'], ['R.inference', 'R', 'flow', 'active'], ['R.main_idea', 'R', 'flow', 'active'], ['E.option_check', 'E', 'choice', 'active']])
      await db.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group, status) values ($1, $2, $3, $2, 'TEST 정의', 'TEST 포함', 'TEST 제외', $4, $5)`, [TAX, code, axis, group, status])
  }
  const boundaryCount = Number((await db.query(`select count(*) n from public.csat_ec_boundary where version = $1`, [TAX])).rows[0].n)
  if (!tv) {
    // 경계 — 순서 · 키 · probe 규칙(draft 에서 DB 제약이 지킨다). 거부되는 형태를 먼저 시도한다(트랜잭션마다 단독)
    const tryIns = async (sql, args) => { try { await db.query(sql, args); return null } catch (e) { return e.message } }
    const rev = await tryIns(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 'v.wrong_sense__r.inference', 'V.wrong_sense', 'R.inference', 'provisional', 'TEST 역순')`, [TAX])
    record('boundary', '역순 쌍 거부(code_a < code_b)', !!rev, rev)
    const accProbe = await tryIns(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, probe_key, decision_note) values ($1, $2, 'E.option_check', 'S.modifier_scope', 'accepted', 'x_probe', 'TEST accepted + probe')`, [TAX, BKEY_ACC])
    record('boundary', 'accepted 경계에 probe 연결 거부', !!accProbe, accProbe)
    const badFk = await tryIns(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 'r.inference__v.typo', 'R.inference', 'V.typo', 'accepted', 'TEST 없는 코드')`, [TAX])
    record('boundary', '사전에 없는 코드 경계 거부(FK)', !!badFk, badFk)
    await db.query(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, probe_key, decision_note, provenance) values
      ($1, $2, 'R.inference', 'V.wrong_sense', 'provisional', $3, 'TEST provisional 경계', '{"test": "dev smoke"}'),
      ($1, $4, 'E.option_check', 'S.modifier_scope', 'accepted', null, 'TEST accepted 경계', '{"test": "dev smoke"}')`, [TAX, BKEY, PROBE, BKEY_ACC])
    record('boundary', 'provisional(+probe) · accepted 경계 저장', true)
  }
  const L1 = users.L1.client, L2 = users.L2.client, RA = users.RA.client, RB = users.RB.client, ADJ = users.ADJ.client, ADM = users.ADM.client

  // 봉인 — 경계 포함 해시 · 기존 v99.0 해시 불변
  if (!tv || tv.status === 'draft') {
    record('boundary', 'taxonomy_seal — 학습자 거부', denied(await L1.rpc('csat_ec_taxonomy_seal', { p_version: TAX })))
    const seal = await ADM.rpc('csat_ec_taxonomy_seal', { p_version: TAX })
    const expect = (await db.query(`select encode(extensions.digest(
        (select string_agg(to_jsonb(c)::text, chr(10) order by c.code) from public.csat_ec_code c where c.version = $1)
        || chr(10) || '--boundaries--' || chr(10)
        || (select string_agg((to_jsonb(b) - 'created_at')::text, chr(10) order by b.boundary_key) from public.csat_ec_boundary b where b.version = $1), 'sha256'), 'hex') h`, [TAX])).rows[0].h
    record('boundary', 'taxonomy_seal — 관리자 성공 · 해시에 경계 포함(재계산 일치)', !seal.error && seal.data === expect, seal.error?.message ?? { got: seal.data, expect })
  } else {
    record('boundary', `v99.1 재사용(이미 봉인 · 경계 ${boundaryCount})`, boundaryCount === 2)
  }
  const legacyRecalc = (await db.query(`select encode(extensions.digest((select string_agg(to_jsonb(c)::text, chr(10) order by c.code) from public.csat_ec_code c where c.version = 'v99.0'), 'sha256'), 'hex') h`)).rows[0].h
  record('boundary', '경계 없는 기존 v99.0 — 저장 해시 = 이전 공식 재계산', legacyHash === legacyRecalc && !!legacyHash, { legacyHash, legacyRecalc })
  const modSealed = await db.query(`update public.csat_ec_boundary set decision_note = 'x' where version = $1 and boundary_key = $2`, [TAX, BKEY]).then(() => null, (e) => e.message)
  record('boundary', '봉인 뒤 경계 수정 거부', /봉인/.test(modSealed ?? ''), modSealed)
  const addSealed = await db.query(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 'r.main_idea__v.word_sense', 'R.main_idea', 'V.word_sense', 'accepted', 'x')`, [TAX]).then(() => null, (e) => e.message)
  record('boundary', '봉인 뒤 경계 추가 거부', /봉인/.test(addSealed ?? ''), addSealed)
  const delSealed = await db.query(`delete from public.csat_ec_boundary where version = $1 and boundary_key = $2`, [TAX, BKEY_ACC]).then(() => null, (e) => e.message)
  record('boundary', '봉인 뒤 경계 삭제 거부', /봉인/.test(delSealed ?? ''), delSealed)

  // 학습 기록 · 확인 · 과정 증거(Pilot 적격)
  const key = (await db.query(`select array_agg(answers[1] order by no) k from public.csat_dx_answer_key where exam_id = $1`, [EXAM])).rows[0].k
  const items = Object.fromEntries((await db.query(`select split_part(id, '#', 2)::int no, id from public.csat_items where id like $1`, [`${EXAM}#%`])).rows.map((r) => [r.no, r.id]))
  const stemLen = Object.fromEntries((await db.query(`select split_part(id, '#', 2)::int no, length(stem) n from public.csat_items where id like $1`, [`${EXAM}#%`])).rows.map((r) => [r.no, r.n]))
  const S = {}
  for (const L of ['L1', 'L2', 'L3']) S[L] = await recordSession(users[L].id, key, items)
  const evErr = []
  for (const L of ['L1', 'L2', 'L3']) {
    const c = users[L].client
    const cf = await c.rpc('csat_ec_confirm_session', { p_session: S[L], p_took_exam: true, p_judged_each: true }); if (cf.error) evErr.push([L, 'confirm', cf.error.message])
    for (const n of [...WRONG, ...CONTROL]) {
      const r = await c.rpc('csat_ec_add_process_evidence', { p_session: S[L], p_item_no: n, p_kind: 'reason', p_value: { text: `${n}번에서 이 선지를 고른 이유를 적었습니다` } })
      if (r.error) evErr.push([L, n, 'reason', r.error.message])
      if (WRONG.includes(n)) {
        const b = await c.rpc('csat_ec_add_process_evidence', { p_session: S[L], p_item_no: n, p_kind: 'blocked_span', p_value: { item_id: items[n], part: 'stem', option: null, sentence: 0, start: 0, end: Math.min(10, stemLen[n]) } })
        if (b.error) evErr.push([L, n, 'span', b.error.message])
      }
    }
  }
  record('준비', '학습자 3 · 확인 · 과정 증거(Pilot 적격) 저장', evErr.length === 0, evErr.slice(0, 3))
  const n0 = WRONG[0], n1 = WRONG[1], n2 = WRONG[2]

  // ── 1. 경계 정의 · 관찰 표 — PostgREST 직접 접근 ──────────────────────────────
  const bRead = await L1.from('csat_ec_boundary').select('boundary_key,status,probe_key').eq('version', TAX)
  record('table RLS', 'csat_ec_boundary — 학습자 읽기(공개 정의)', !bRead.error && bRead.data.length === 2, why(bRead))
  record('table RLS', 'csat_ec_boundary — anon SELECT 거부', perm(await anon.from('csat_ec_boundary').select('version').limit(1)))
  record('table RLS', 'csat_ec_boundary — service_role SELECT 거부(GRANT 없음)', perm(await svc.from('csat_ec_boundary').select('version').limit(1)))
  record('table RLS', 'csat_ec_boundary — 학습자 INSERT 거부', perm(await L1.from('csat_ec_boundary').insert({ version: TAX, boundary_key: 'x', code_a: 'a', code_b: 'b', status: 'accepted', decision_note: 'x' })))
  record('table RLS', 'csat_ec_boundary — 학습자 UPDATE 거부', perm(await L1.from('csat_ec_boundary').update({ decision_note: 'x' }).eq('version', TAX)))
  record('table RLS', 'csat_ec_boundary — 관리자 DELETE 거부', perm(await ADM.from('csat_ec_boundary').delete().eq('version', TAX)))
  for (const [who, c] of [['학습자', L1], ['판정자', RA], ['관리자', ADM], ['anon', anon], ['service_role', svc]]) {
    const r = await c.from('csat_ec_boundary_signal').select('id').limit(1)
    record('table RLS', `csat_ec_boundary_signal — ${who} SELECT 거부(RPC 전용)`, perm(r), why(r))
  }
  record('table RLS', 'csat_ec_boundary_signal — service_role INSERT 거부', perm(await svc.from('csat_ec_boundary_signal').insert({ session_id: S.L1, item_no: n0, taxonomy_version: TAX, boundary_key: BKEY, boundary_status: 'provisional', source: 'detector', detector_version: 'x', probe_required: true })))
  record('table RLS', 'csat_ec_boundary_signal — 학습자 INSERT 거부', perm(await L1.from('csat_ec_boundary_signal').insert({ session_id: S.L1, item_no: n0, taxonomy_version: TAX, boundary_key: BKEY, boundary_status: 'provisional', source: 'detector', detector_version: 'x', probe_required: true })))

  // ── 2. 탐지기 경계 관찰(service_role) ───────────────────────────────────────
  const sig = (sess, no, bk, probe, ver = 'det-smoke-1') => ({ p_session: sess, p_item_no: no, p_taxonomy: TAX, p_boundary_key: bk, p_detector_version: ver, p_probe_required: probe, p_evidence_ids: [] })
  record('signal', 'add_detector_signal — 학습자 거부', denied(await L1.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, BKEY, true))))
  record('signal', 'add_detector_signal — 관리자(authenticated) 거부', denied(await ADM.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, BKEY, true))))
  record('signal', 'add_detector_signal — anon 거부', denied(await anon.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, BKEY, true))))
  const dAcc = await svc.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, BKEY_ACC, true))
  record('signal', 'accepted 경계에 probe 요구 거부', rejects(dAcc, /probe/), dAcc.error?.message)
  const dNone = await svc.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, 'r.main_idea__v.word_sense', false))
  record('signal', '사전에 없는 경계 관찰 거부', denied(dNone), dNone.error?.message)
  const dVer = await svc.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, BKEY, true, ' '))
  record('signal', '탐지기 버전 없으면 거부', rejects(dVer, /탐지기 버전/), dVer.error?.message)
  const d0 = await svc.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, BKEY, true))
  const d0b = await svc.rpc('csat_ec_add_detector_signal', sig(S.L1, n0, BKEY_ACC, false))
  const d1 = await svc.rpc('csat_ec_add_detector_signal', sig(S.L1, n1, BKEY, true))
  const d2 = await svc.rpc('csat_ec_add_detector_signal', sig(S.L2, n0, BKEY, true))
  record('signal', 'add_detector_signal — service_role 성공(한 응답에 경계 2개 · 다른 응답 2)', !d0.error && !d0b.error && !d1.error && !d2.error, [d0, d0b, d1, d2].map((r) => r.error?.message ?? r.data))
  const sigRows = (await db.query(`select source, boundary_status, probe_required, detector_version from public.csat_ec_boundary_signal where session_id = $1 and item_no = $2 order by id`, [S.L1, n0])).rows
  record('signal', '관찰 행 — 출처 detector · 상태 스냅샷 · probe 필요 여부', sigRows.length === 2 && sigRows.every((r) => r.source === 'detector' && r.detector_version === 'det-smoke-1')
    && sigRows[0].boundary_status === 'provisional' && sigRows[0].probe_required && sigRows[1].boundary_status === 'accepted' && !sigRows[1].probe_required, sigRows)
  const sigUpd = await db.query(`update public.csat_ec_boundary_signal set probe_required = false where session_id = $1`, [S.L1]).then(() => null, (e) => e.message)
  record('signal', '관찰 UPDATE 거부(덧붙이기 전용)', !!sigUpd, sigUpd)

  // ── 3. 대기 probe · probe 응답 · interpretation(학습자) ───────────────────────
  const pp = await L1.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })
  record('probe', 'my_pending_probes — 본인: probe 요구된 응답 2(n0 · n1)만', !pp.error && pp.data.length === 2 && pp.data.every((r) => r.probe_key === PROBE && r.boundary_key === BKEY), pp.error?.message ?? pp.data)
  const ppOther = await L2.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })
  record('probe', 'my_pending_probes — 다른 학습자 세션은 0행', !ppOther.error && ppOther.data.length === 0, why(ppOther))
  record('probe', 'my_pending_probes — anon 거부', denied(await anon.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })))
  record('probe', 'my_pending_probes — service_role 거부', denied(await svc.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })))
  const promptHash = createHash('sha256').update('TEST probe 문구 v1').digest('hex')
  const probeVal = (opt, skipped = false, extra = {}) => ({ probe_key: PROBE, probe_version: '1.0.0', taxonomy_version: TAX, boundary_key: BKEY, prompt_hash: promptHash, option: opt, skipped, ...extra })
  const pe = (c, sess, no, kind, value, sup = null) => c.rpc('csat_ec_add_process_evidence', { p_session: sess, p_item_no: no, p_kind: kind, p_value: value, p_supersedes: sup })
  const pr = await pe(L1, S.L1, n0, 'targeted_probe', probeVal('B'))
  record('probe', 'targeted_probe — 본인 · 요구된 응답에 선택지 글자 저장', !pr.error, pr.error?.message)
  const prRow = pr.data && (await db.query(`select value from public.csat_ec_process_evidence where id = $1`, [pr.data])).rows[0]?.value
  record('probe', 'probe 행 — 원인 라벨 없음(선택지 글자 · probe 판 · prompt_hash 만)', prRow && prRow.option === 'B' && !/R\.inference|V\.wrong_sense|cause|code/.test(JSON.stringify(prRow)), prRow)
  const dup = await pe(L1, S.L1, n0, 'targeted_probe', probeVal('A'))
  record('probe', '같은 attempt · 같은 probe 두 번째 응답 거부', denied(dup), dup.error?.message)
  const sup = await pe(L1, S.L1, n0, 'targeted_probe', probeVal('A'), pr.data)
  record('probe', 'supersede 정정 성공(첫 응답은 하나)', !sup.error, sup.error?.message)
  const notReq = await pe(L1, S.L1, n2, 'targeted_probe', probeVal('A'))
  record('probe', '요구되지 않은 attempt 의 probe 거부', rejects(notReq, /요구된 probe/), notReq.error?.message)
  const wrongKey = await pe(L1, S.L1, n1, 'targeted_probe', { ...probeVal('A'), probe_key: 'other_probe' })
  record('probe', '경계의 probe_key 와 다른 probe 거부', rejects(wrongKey, /미해결 경계/), wrongKey.error?.message)
  const accB = await pe(L1, S.L1, n1, 'targeted_probe', { ...probeVal('A'), boundary_key: BKEY_ACC })
  record('probe', 'accepted 경계의 probe 거부', rejects(accB, /미해결 경계/), accB.error?.message)
  const bad = await pe(L1, S.L1, n1, 'targeted_probe', { ...probeVal('AB') })
  record('probe', '형식 위반(선택지 두 글자) 거부', denied(bad), bad.error?.message)
  const badSkip = await pe(L1, S.L1, n1, 'targeted_probe', probeVal('A', true))
  record('probe', '건너뜀인데 선택 있음 거부', denied(badSkip), badSkip.error?.message)
  const other = await pe(L2, S.L1, n1, 'targeted_probe', probeVal('A'))
  record('probe', '다른 학습자 응답에 probe 거부', denied(other), other.error?.message)
  record('probe', 'anon probe 거부', denied(await pe(anon, S.L1, n1, 'targeted_probe', probeVal('A'))))
  record('probe', 'service_role probe 거부(실행 권한 없음)', denied(await pe(svc, S.L1, n1, 'targeted_probe', probeVal('A'))))
  const skip = await pe(L1, S.L1, n1, 'targeted_probe', probeVal(null, true))
  record('probe', 'skip 저장(이벤트로 남음)', !skip.error, skip.error?.message)
  const pp2 = await L1.rpc('csat_ec_my_pending_probes', { p_session: S.L1 })
  record('probe', '응답 · 건너뜀 뒤 대기 probe 0', !pp2.error && pp2.data.length === 0, why(pp2))
  const it = await pe(L1, S.L1, n0, 'interpretation', { text: '이 문장을 원인이 아니라 결과로 읽었습니다' })
  record('interpretation', 'interpretation 저장', !it.error, it.error?.message)
  const itEmpty = await pe(L1, S.L1, n0, 'interpretation', { text: '   ' })
  record('interpretation', '빈 interpretation 거부', denied(itEmpty), itEmpty.error?.message)
  const itLong = await pe(L1, S.L1, n0, 'interpretation', { text: 'x'.repeat(501) })
  record('interpretation', '500자 초과 interpretation 거부', denied(itLong), itLong.error?.message)
  const ownRows = await L1.from('csat_ec_process_evidence').select('kind,user_id').eq('session_id', S.L1).in('kind', ['targeted_probe', 'interpretation'])
  const otherRows = await L2.from('csat_ec_process_evidence').select('kind').eq('session_id', S.L1).in('kind', ['targeted_probe', 'interpretation'])
  record('RLS', '본인 probe · interpretation 읽기 · 다른 학습자 0행', !ownRows.error && ownRows.data.length === 4 && ownRows.data.every((r) => r.user_id === users.L1.id) && !otherRows.error && otherRows.data.length === 0,
    { own: ownRows.data?.length, other: otherRows.data?.length })
  record('RLS', 'anon 과정 증거 SELECT 거부', perm(await anon.from('csat_ec_process_evidence').select('kind').limit(1)))

  // ── 4. 회차 증거 범위 — pre_probe · all ──────────────────────────────────────
  const rcArgs = (profile) => ({ p_taxonomy: TAX, p_quality_rule: 'rq-1', p_choice_trap_map: TRAP_MAP, p_eligibility: { test: `pilot dev smoke ${profile}` }, p_evidence_profile: profile })
  record('round', 'round_create(5인자) — 학습자 거부', denied(await L1.rpc('csat_ec_round_create', rcArgs('pre_probe'))))
  record('round', 'round_create(5인자) — service_role 거부', denied(await svc.rpc('csat_ec_round_create', rcArgs('pre_probe'))))
  const badProf = await ADM.rpc('csat_ec_round_create', rcArgs('post_only'))
  record('round', 'round_create — 없는 증거 범위 거부', rejects(badProf, /증거 범위/), badProf.error?.message)
  roundPre = (await ADM.rpc('csat_ec_round_create', rcArgs('pre_probe'))).data
  roundAll = (await ADM.rpc('csat_ec_round_create', rcArgs('all'))).data
  record('round', 'pre_probe · all 회차 생성', !!roundPre && !!roundAll, { roundPre, roundAll })
  const refs = ['L1', 'L2', 'L3'].flatMap((L) => [...WRONG, ...CONTROL].map((n) => ({ session_id: S[L], item_no: n })))
  const stP = await ADM.rpc('csat_ec_round_set_targets', { p_round: roundPre, p_refs: refs })
  const stA = await ADM.rpc('csat_ec_round_set_targets', { p_round: roundAll, p_refs: [{ session_id: S.L1, item_no: n0 }] })
  record('round', 'set_targets 성공(pre 42 · all 1)', stP.data === 42 && stA.data === 1, [stP.error?.message ?? stP.data, stA.error?.message ?? stA.data])
  const tgt = async (rid) => (await db.query(`select t from public.csat_ec_review_round r, jsonb_array_elements(r.targets) t where r.id = $1 and t->>'session_id' = $2 and (t->>'item_no')::int = $3`, [rid, S.L1, n0])).rows[0]?.t
  const tPre = await tgt(roundPre), tAll = await tgt(roundAll)
  const probeIds = (await db.query(`select array_agg(id::text) ids from public.csat_ec_process_evidence where session_id = $1 and item_no = $2 and kind = 'targeted_probe'`, [S.L1, n0])).rows[0].ids
  const legacy = (await db.query(`select public.csat_ec_judgment_input_hash($1, $2::smallint) h`, [S.L1, n0])).rows[0].h
  record('pre/all', 'pre_probe 봉인 증거에 probe 없음 · all 에는 있음', !tPre.process_evidence_ids.some((x) => probeIds.includes(x)) && tAll.process_evidence_ids.some((x) => probeIds.includes(x)),
    { pre: tPre.process_evidence_ids.length, all: tAll.process_evidence_ids.length, probe: probeIds.length })
  record('pre/all', 'pre_probe · all 입력 해시가 다름', tPre.input_hash !== tAll.input_hash, { pre: tPre.input_hash, all: tAll.input_hash })
  record('pre/all', "all 회차 해시 = 이전 공식(2인자) 그대로", tAll.input_hash === legacy, { all: tAll.input_hash, legacy })
  const chg = await db.query(`update public.csat_ec_review_round set evidence_profile = 'all' where id = $1`, [roundPre]).then(() => null, (e) => e.message)
  record('pre/all', '대상을 채운 뒤 증거 범위 변경 거부', /증거 범위/.test(chg ?? ''), chg)
  const exPre = await svc.rpc('csat_ec_ai_export', { p_round: roundPre, p_session: S.L1, p_item_no: n0 })
  const exAll = await svc.rpc('csat_ec_ai_export', { p_round: roundAll, p_session: S.L1, p_item_no: n0 })
  const kinds = (ex) => (ex.data?.canonical_input?.process_evidence ?? []).map((e) => e[1])
  record('pre/all', 'ai_export — pre_probe 입력에 probe 없음 · all 입력에 있음 · 해시는 봉인값과 같음',
    !exPre.error && !exAll.error && !kinds(exPre).includes('targeted_probe') && kinds(exAll).includes('targeted_probe') && exPre.data.input_hash === tPre.input_hash && exAll.data.input_hash === tAll.input_hash,
    { pre: kinds(exPre), all: kinds(exAll), err: exPre.error?.message ?? exAll.error?.message })
  record('pre/all', 'ai_export — 학생 범주 · 사람 판정 · 식별자 없음', !['claims', 'judgments', 'user_id', 'session_id'].some((k) => k in (exPre.data?.canonical_input ?? {})))

  // ── 5. AI 파이프라인 — 새 outcome · 후보 · 경계 관찰 ─────────────────────────
  const tx = await svc.rpc('csat_ec_ai_taxonomy', { p_version: TAX })
  record('AI', 'ai_taxonomy — 경계 2 포함 · 폐기 코드 제외', !tx.error && tx.data.boundaries.length === 2 && !tx.data.codes.some((c) => c.code === 'V.old_sense'), tx.error?.message)
  const quote = (exPre.data?.canonical_input?.stem ?? '').slice(0, 8)
  const claim = (code, role = 'candidate') => ({ code, role, confidence: 'medium', evidence: { summary: 'TEST 두 후보 모두 최소 증거가 있다', text_refs: [{ where: 'stem', quote }] } })
  const aiRun = (outcome, model, extra = {}) => ({ session_id: S.L1, item_no: n0, taxonomy_version: TAX, model, prompt_version: 'p-pilot', analyzer_version: 'a-pilot',
    quality_rule_version: 'rq-1', choice_trap_map: TRAP_MAP, input_hash: exPre.data?.input_hash, outcome, output: { raw: 'TEST pilot smoke' }, ...extra })
  const imp = (outcome, model, claims, extra) => svc.rpc('csat_ec_ai_import', { p_round: roundPre, p_run: aiRun(outcome, model, extra), p_claims: claims })
  const aOne = await imp('multiple_plausible', 'm-one', [claim('R.inference')])
  record('AI', 'multiple_plausible — 후보 1개 거부', rejects(aOne, /후보 2개 이상/), aOne.error?.message)
  const aPrim = await imp('multiple_plausible', 'm-prim', [claim('R.inference', 'primary'), claim('V.wrong_sense')])
  record('AI', 'multiple_plausible — primary 섞임 거부', rejects(aPrim, /primary 없음/), aPrim.error?.message)
  const aTypo = await imp('multiple_plausible', 'm-typo', [claim('R.inferense'), claim('V.wrong_sense')])
  record('AI', '사전에 없는 후보 코드(오타) 거부', rejects(aTypo, /사전에 없거나/), aTypo.error?.message)
  const aOld = await imp('multiple_plausible', 'm-old', [claim('V.old_sense'), claim('R.inference')])
  record('AI', '폐기된 후보 코드 거부', rejects(aOld, /폐기/), aOld.error?.message)
  const aBad = await imp('maybe', 'm-bad', [])
  record('AI', 'invalid outcome 거부', denied(aBad), aBad.error?.message)
  record('AI', 'ai_import — 관리자(authenticated) 거부', denied(await ADM.rpc('csat_ec_ai_import', { p_round: roundPre, p_run: aiRun('inconsistent_evidence', 'm-adm'), p_claims: [] })))
  const aMp = await imp('multiple_plausible', 'm-mp', [claim('R.inference'), claim('V.wrong_sense')], { boundary_signals: [{ boundary_key: BKEY, probe_required: true }] })
  const aMpRow = !aMp.error && (await db.query(`select (select array_agg(role || ':' || code order by code) from public.csat_ec_claim where ai_run_id = $1) c,
      (select count(*)::int from public.csat_ec_boundary_signal where ai_run_id = $1 and source = 'ai_run' and probe_required) s`, [aMp.data])).rows[0]
  record('AI', 'multiple_plausible 저장 — candidate 2 · primary 없음 · 경계 관찰(ai_run)', !!aMpRow && aMpRow.c.length === 2 && aMpRow.c.every((x) => x.startsWith('candidate:')) && aMpRow.s === 1, aMp.error?.message ?? aMpRow)
  const aInc = await imp('inconsistent_evidence', 'm-inc', [])
  record('AI', 'inconsistent_evidence 저장(후보 0)', !aInc.error, aInc.error?.message)
  const aFail = await imp('failed', 'm-fail', [], { failure: 'TEST', boundary_signals: [{ boundary_key: BKEY }] })
  record('AI', '실패 실행의 경계 관찰 거부', rejects(aFail, /실패한 실행/), aFail.error?.message)
  const aProp = await svc.rpc('csat_ec_ai_import', { p_round: roundPre, p_run: { ...aiRun('proposed', 'm-prop'), session_id: S.L2, input_hash: (await svc.rpc('csat_ec_ai_export', { p_round: roundPre, p_session: S.L2, p_item_no: n0 })).data?.input_hash },
    p_claims: [claim('S.modifier_scope', 'primary')] })
  record('AI', '기존 proposed(identified) 경로 그대로', !aProp.error, aProp.error?.message)
  record('AI', 'service_role — 판정 표 직접 SELECT 거부(사람 판정 못 읽음)', perm(await svc.from('csat_ec_judgment').select('id').limit(1)))
  record('AI', 'service_role — claim 표 직접 SELECT 거부(학생 범주 못 읽음)', perm(await svc.from('csat_ec_claim').select('id').limit(1)))
  await ADM.rpc('csat_ec_round_set_targets', { p_round: roundPre, p_refs: refs })   // AI 실행 · claim 연결을 다시 봉인 대상에

  // ── 6. blind 판정 — 새 outcome · 후보 무결성 · 경계 연결 ─────────────────────
  for (const [role, slot] of [['RA', 'A'], ['RB', 'B'], ['ADJ', 'adjudicator']]) {
    const a = await ADM.rpc('csat_ec_round_assign', { p_round: roundPre, p_reviewer: users[role].id, p_slot: slot, p_pre_disclosed: [] })
    if (a.error) record('judgment', `round_assign ${slot}`, false, a.error.message)
  }
  const sb = await ADM.rpc('csat_ec_round_start_blind', { p_round: roundPre })
  record('judgment', 'pre_probe 회차 blind 시작(probe 있는 응답 포함)', !sb.error, sb.error?.message)
  const subm = (c, outcome, primary, cands, bkeys = [], probe = false, no = n0, sess = S.L1) => c.rpc('csat_ec_submit_blind', { p_round: roundPre, p_session: sess, p_item_no: no,
    p_outcome: outcome, p_primary: primary, p_contributing: [], p_excluded: [], p_note: 'TEST pilot smoke 판정', p_candidates: cands, p_boundary_keys: bkeys, p_probe_required: probe })
  const neg = [
    ['multiple_plausible + primary 거부', await subm(RA, 'multiple_plausible', 'R.inference', ['R.inference', 'V.wrong_sense'])],
    ['multiple_plausible 후보 1개 거부', await subm(RA, 'multiple_plausible', null, ['R.inference'])],
    ['inconsistent_evidence 후보 1개 거부', await subm(RA, 'inconsistent_evidence', null, ['R.inference'])],
    ['사전에 없는 후보 코드(오타) 거부', await subm(RA, 'multiple_plausible', null, ['R.inferense', 'V.wrong_sense'])],
    ['다른 taxonomy 판본(v99.0)에만 있는 후보 거부', await subm(RA, 'multiple_plausible', null, ['B.guess', 'R.inference'])],
    ['폐기된 후보 코드 거부', await subm(RA, 'multiple_plausible', null, ['V.old_sense', 'R.inference'])],
    ['중복 후보 거부', await subm(RA, 'multiple_plausible', null, ['R.inference', 'R.inference'])],
    ['identified(code)에 후보 거부', await subm(RA, 'code', 'R.inference', ['R.inference', 'V.wrong_sense'])],
    ['invalid outcome 거부', await subm(RA, 'maybe', null, [])],
    ['사전에 없는 경계 연결 거부', await subm(RA, 'multiple_plausible', null, ['R.inference', 'V.wrong_sense'], ['r.main_idea__v.word_sense'])],
    ['학습자 판정 거부', await subm(L1, 'multiple_plausible', null, ['R.inference', 'V.wrong_sense'])],
    ['관리자(미배정) 판정 거부', await subm(ADM, 'multiple_plausible', null, ['R.inference', 'V.wrong_sense'])],
    ['anon 판정 거부', await subm(anon, 'multiple_plausible', null, ['R.inference', 'V.wrong_sense'])],
  ]
  for (const [name, r] of neg) record('judgment', name, denied(r), r.error?.message)
  const jA = await subm(RA, 'multiple_plausible', null, ['V.wrong_sense', 'R.inference'], [BKEY, BKEY_ACC], true)
  const jARow = !jA.error && (await db.query(`select j.outcome, j.primary_code, j.contributing_codes, j.candidate_codes,
      (select array_agg(s.boundary_key || ':' || s.probe_required order by s.boundary_key) from public.csat_ec_boundary_signal s where s.judgment_id = j.id and s.source = 'judgment') sig
      from public.csat_ec_judgment j where j.id = $1`, [jA.data])).rows[0]
  record('judgment', 'multiple_plausible 저장 — primary 없음 · contributing 빈 · 후보 2 · 경계 2개 연결(probe 는 provisional 에만)',
    !!jARow && jARow.primary_code === null && jARow.contributing_codes.length === 0 && jARow.candidate_codes.length === 2
      && JSON.stringify(jARow.sig) === JSON.stringify([`${BKEY_ACC}:false`, `${BKEY}:true`]), jA.error?.message ?? jARow)
  const jB = await subm(RB, 'inconsistent_evidence', null, ['R.inference', 'V.wrong_sense'])
  record('judgment', 'inconsistent_evidence 저장(후보 2)', !jB.error, jB.error?.message)
  const jB0 = await subm(RB, 'inconsistent_evidence', null, [], [], false, n1)
  record('judgment', 'inconsistent_evidence 저장(후보 0)', !jB0.error, jB0.error?.message)
  const old8 = await RA.rpc('csat_ec_submit_blind', { p_round: roundPre, p_session: S.L1, p_item_no: n1, p_outcome: 'code', p_primary: 'S.modifier_scope', p_contributing: [], p_excluded: [], p_note: 'TEST 8인자' })
  // 2026-10-06 G2(20261006100000): 8인자 구판은 앱 호출부가 없어 보존하되 authenticated EXECUTE 를 회수했다 — 검수자 호출은 거부돼야 한다
  record('judgment', '기존 8인자 submit_blind(code) — 검수자 호출 거부(G2 회수)', perm(old8), old8.error?.message)
  const old8n = await RA.rpc('csat_ec_submit_blind', { p_round: roundPre, p_session: S.L1, p_item_no: n2, p_outcome: 'no_cause', p_primary: null, p_contributing: [], p_excluded: [], p_note: 'TEST 8인자' })
  record('judgment', '기존 8인자 submit_blind(no_cause) — 검수자 호출 거부(G2 회수)', perm(old8n), old8n.error?.message)
  record('judgment', '판정 표 직접 — 판정자 SELECT 거부', perm(await RA.from('csat_ec_judgment').select('id').limit(1)))
  record('judgment', '판정 표 직접 — 판정자 UPDATE 거부', perm(await RA.from('csat_ec_judgment').update({ note: 'x' }).eq('round_id', roundPre)))
  const jUpd = await db.query(`update public.csat_ec_judgment set candidate_codes = '{}' where id = $1`, [jA.data]).then(() => null, (e) => e.message)
  record('judgment', '판정 UPDATE 거부(postgres 도 — 덧붙이기 전용)', !!jUpd, jUpd)
  const qbB = await RB.rpc('csat_ec_blind_queue', { p_round: roundPre })
  record('judgment', 'B blind_queue — A 판정 · 후보 · 경계 관찰이 안 보임', !qbB.error && qbB.data.every((r) => !('candidate_codes' in r) && !('boundary' in r) && Object.keys(r).length === 10), qbB.error?.message)
  record('judgment', 'attach_judgment_boundaries 직접 호출 — 판정자 거부(내부 함수)', denied(await RA.rpc('csat_ec_attach_judgment_boundaries', { p_judgment: jA.data, p_boundary_keys: [BKEY], p_probe_required: true })))
  record('judgment', 'csat_ec_outcomes 직접 호출 — 거부(내부 함수)', denied(await RA.rpc('csat_ec_outcomes', { p_scope: 'judgment' })))

  // ── 7. 학습 지도 · 트리거 ───────────────────────────────────────────────────
  const trg = (await db.query(`select tgrelid::regclass::text t, tgname, p.proname from pg_trigger g join pg_proc p on p.oid = g.tgfoid
      where not tgisinternal and tgrelid in ('public.csat_ec_boundary'::regclass, 'public.csat_ec_boundary_signal'::regclass) order by 1, 2`)).rows
  // 감지기(20261006120000)가 적용됐으면 신호 표에 수집 종료 가드(거부만 하는 트리거)가 하나 더 있다 — 이름을 정확히 고정한다
  const detector = (await db.query(`select to_regclass('public.csat_ec_detector_run') is not null d`)).rows[0].d
  const want = ['csat_ec_boundary_guard', 'csat_ec_boundary_signal_guard', 'csat_ec_boundary_signal_no_update', ...(detector ? ['csat_ec_capture_write_guard'] : [])].sort()
  record('Learning Map', '새 표 트리거 = 가드뿐(학습 지도 갱신 경로 없음)', JSON.stringify(trg.map((r) => r.tgname).sort()) === JSON.stringify(want) && trg.every((r) => r.proname.startsWith('csat_ec_') && /guard|forbid_update/.test(r.proname)), trg)
  const mapAfter = await mapCounts()
  record('Learning Map', 'csat_map_* 표 행 · 쓰기 통계 변화 없음', mapAfter.n === mapBefore.n && mapAfter.h === mapBefore.h, { before: mapBefore, after: mapAfter })

  results.push({ area: 'meta', rounds: [roundPre, roundAll], judgments: [jA.data, jB.data] })
} catch (e) {
  record('실행', '예외', false, e.message)
} finally {
  await cleanup()
  const after = await counts()
  record('정리', '기존 세션 · 응답 수 불변', after.s === before.s && after.r === before.r, { before, after })
  const left = (await db.query(`select
      (select count(*) from public.csat_ec_claim)::int claim, (select count(*) from public.csat_ec_process_evidence)::int pe,
      (select count(*) from public.csat_ec_session_confirmation)::int conf, (select count(*) from public.csat_ec_ai_run)::int ai,
      (select count(*) from public.csat_ec_judgment)::int j, (select count(*) from public.csat_ec_boundary_signal)::int sig,
      (select count(*) from public.csat_ec_review_assignment where reviewer_id is not null)::int live_assign,
      (select count(*) from auth.users where email like 'ec-pilot-%')::int smoke_users,
      (select count(*) from public.csat_ec_review_round where id = any($1::bigint[]) and status not in ('closed', 'cancelled'))::int open_rounds`, [[roundPre, roundAll].filter(Boolean)])).rows[0]
  record('정리', '테스트 계정 · 증거 · probe · 경계 관찰 · 판정 · AI 0 · 열린 회차 0 (TEST taxonomy v99.1 · 경계 · 회차만 남음)',
    left.claim + left.pe + left.conf + left.ai + left.j + left.sig + left.live_assign + left.smoke_users + left.open_rounds === 0, left)
  await db.end()
  const failed = results.filter((r) => r.ok === false)
  fs.writeFileSync(path.join(DIR, 'results-pilot.json'), JSON.stringify({ ranAt: TAKEN_AT, run, pass: results.filter((r) => r.ok).length, fail: failed.length, results }, null, 2) + '\n')
  console.log(`\n합계 PASS ${results.filter((r) => r.ok).length} · FAIL ${failed.length}`)
  process.exitCode = failed.length ? 1 : 0
}
