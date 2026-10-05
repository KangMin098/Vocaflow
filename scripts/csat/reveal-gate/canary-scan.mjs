// scripts/csat/reveal-gate/canary-scan.mjs
//
// Reveal Gate Layer B — 동적 canary 검사 + 행동 oracle 검사(개발 DB · 20261005170000 ① · 20261005170100 ② 적용 뒤).
//   TEST 시험(TEST_EC_CANARY)에 고유 canary(해설 · 근거 · 유형 사례 문자열)와 정답을 심고, 참가자 capture 를 held 로 만든 뒤
//   참가자 · 다른 계정(비참가자)의 학습자 JWT 로 manifest.json 의 모든 DB 관계(PostgREST · GraphQL)와 학습자 RPC 를 호출한다.
//   실패: canary 문자열 · TEST 시험 정답 · 정오 · 점수가 응답에 있음 / 정오 oracle(맞힌 · 틀린 문항의 응답이 다름) / 비공개 스키마 호출 성공.
//   앱 경로(API · 페이지)는 --app <기준 URL> 을 주면 함께 본다(앱 gate 구현 뒤).
// 정리: TEST 시험 · 계정 · capture 를 지운다(capture 는 관리자 종료 뒤 — 묘비를 남기지 않게). 감사 이벤트 행은 남는다(meta.test = canary).
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/reveal-gate/canary-scan.mjs [--app http://localhost:3100]

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const require = createRequire(path.join(REPO, 'scripts/csat/error-evidence/dev-smoke/package.json'))
const pg = require('pg')
const { createClient } = require('@supabase/supabase-js')
const DEV_REF = 'jajenrevcbmrpaliomxv'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY, DB_URL = process.env.SUPABASE_DB_URL
if (!URL_ || !ANON || !SERVICE || !DB_URL) { console.error('환경 변수 없음'); process.exit(2) }
if (!URL_.includes(DEV_REF) || !DB_URL.includes(DEV_REF)) { console.error('개발 프로젝트가 아니다 — 중단'); process.exit(2) }
const APP = process.argv.includes('--app') ? process.argv[process.argv.indexOf('--app') + 1] : null
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'))

const EXAM = 'TEST_EC_CANARY', TYPE = 'TEST-CANARY-TYPE', TAX = 'v0.1'
const CANARY = `CANARY-${randomUUID().slice(0, 8)}`
const ANSWER = (n) => ((n * 3) % 5) + 1
const NOS = [18, 19, 20, 21, 22]
const results = []
const record = (area, name, ok, detail) => { results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`) }
const opt = { auth: { persistSession: false, autoRefreshToken: false } }
const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const svc = createClient(URL_, SERVICE, opt)
const users = {}
async function makeUser(role, admin = false) {
  const email = `ec-canary-${CANARY.slice(7)}-${role.toLowerCase()}@example.com`, password = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'reveal gate canary' } })
  if (error) throw error
  if (admin) await db.query(`insert into public.user_profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin'`, [data.user.id])
  const c = createClient(URL_, ANON, opt)
  const { error: se } = await c.auth.signInWithPassword({ email, password })
  if (se) throw se
  const session = (await c.auth.getSession()).data.session
  users[role] = { id: data.user.id, client: c, token: session.access_token, session }
}
const leaks = (payload) => {
  const s = JSON.stringify(payload ?? null)
  return s.includes(CANARY)
}

try {
  if ((await db.query(`select 1 from supabase_migrations.schema_migrations where version = '20261005170000'`)).rowCount === 0) throw new Error('Reveal Gate ① 가 적용되지 않았다 — 적용 뒤 실행')
  // ── 준비: TEST 시험 · canary ──
  await db.query(`insert into public.csat_exams (id, label, kind, year, month, exam_year, has_answer_key, organizer) values ($1, 'TEST canary(Reveal Gate)', 'mock', 2099, 1, 2099, true, 'kice')`, [EXAM])
  for (const n of NOS) {
    await db.query(`insert into public.csat_items (id, exam_id, no, section, stem, passage, choices, answer, type_id, body_ok) values ($1, $2, $3, '독해', 'TEST stem', 'TEST passage one. TEST passage two.', $4, $5, $6, true)`,
      [`${EXAM}#${n}`, EXAM, n, JSON.stringify(['a', 'b', 'c', 'd', 'e']), ANSWER(n), TYPE])
    await db.query(`insert into public.csat_dx_answer_key (exam_id, no, answers, points, source) values ($1, $2, $3, 2, 'test')`, [EXAM, n, [ANSWER(n)]])
    await db.query(`insert into public.csat_item_analyses (item_id, status, choice_analysis, answer_locus, solve_procedure) values ($1, 'published', $2, $2, $2)`, [`${EXAM}#${n}`, JSON.stringify({ canary: CANARY })])
    await db.query(`insert into public.csat_item_skeletons (item_id, exam_id, data) values ($1, $2, $3) on conflict do nothing`, [`${EXAM}#${n}`, EXAM, JSON.stringify({ canary: CANARY })]).catch(() => {})
  }
  await db.query(`insert into public.csat_type_reports (type_id, status, failure_modes, open_questions) values ($1, 'published', $2, $2) on conflict do nothing`, [TYPE, JSON.stringify({ canary: CANARY })]).catch(() => {})
  for (const r of ['P', 'N', 'ADM']) await makeUser(r, r === 'ADM')

  // 참가자 P — 저장 + held(같은 서비스 RPC), 비참가자 N — 같은 시험 저장(보류 행 없음)
  const responses = NOS.map((n, i) => ({ item_no: n, item_id: `${EXAM}#${n}`, chosen_option: i % 2 ? ANSWER(n) : (ANSWER(n) % 5) + 1, is_correct: Boolean(i % 2) }))
  const rec = (uid, participant) => svc.rpc('csat_ec_record_session_held', { p_session: { user_id: uid, exam_id: EXAM, mode: 'live', taken_at: '2026-10-05', client_key: randomUUID(), raw_score: 4 },
    p_responses: responses, p_participant: participant, p_taxonomy: TAX, p_config: { test: CANARY }, p_targets: NOS, p_evidence_eligible: true })
  const rp = await rec(users.P.id, true), rn = await rec(users.N.id, false)
  record('준비', '참가자 held · 비참가자 같은 시험 저장', !rp.error && rp.data.held === true && !rn.error && rn.data.held === false, [rp.error?.message, rn.error?.message])
  const sidP = rp.data?.session_id, sidN = rn.data?.session_id

  // ── Layer B: 모든 관계를 두 계정으로 ──
  for (const who of ['P', 'N']) {
    const c = users[who].client
    for (const rel of Object.keys(manifest.db_relations)) {
      // 전체 페이지(1000행씩) — 권한 거부(42501)만 정상 거부로 보고, 그 밖의 오류는 검사 실패로 센다
      const rows = []; let r = { data: [], error: null }
      for (let from = 0; from < 200000; from += 1000) {
        r = await c.from(rel).select('*').range(from, from + 999)
        if (r.error || !r.data?.length) break
        rows.push(...r.data); if (r.data.length < 1000) break
      }
      if (r.error && r.error.code !== '42501') { record('canary', `${who} · ${rel} — 조회 오류(검사 미실행)`, false, { code: r.error.code, msg: r.error.message }); continue }
      r = { ...r, data: rows }
      const testRows = (r.data ?? []).filter((x) => JSON.stringify(x).includes(EXAM) || [sidP, sidN].includes(x.session_id) || [sidP, sidN].includes(x.id))
      const answerLeak = testRows.some((x) => x.answer != null || x.is_correct != null || x.raw_score != null || x.correct != null)
      record('canary', `${who} · ${rel}`, !leaks(r.data) && !answerLeak, { err: r.error?.code, rows: r.data?.length, testRows: testRows.length, answerLeak })
    }
    // GraphQL — 같은 데이터를 다른 길로
    const gql = await fetch(`${URL_}/graphql/v1`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${users[who].token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ csat_items_publicCollection(filter: { exam_id: { eq: "${EXAM}" } }) { edges { node { id answer } } } csat_item_analysesCollection(first: 50) { edges { node { item_id choice_analysis } } } }` }) }).then((x) => x.json())
    const gEdges = gql.data?.csat_items_publicCollection?.edges ?? []
    // 오류면 검사가 실행되지 않은 것 — 실패로 센다(빈 결과를 통과로 보지 않는다)
    record('canary', `${who} · GraphQL 정답 · 해설`, !gql.errors && !leaks(gql) && gEdges.length === 5 && gEdges.every((e) => e.node.answer == null), { errors: gql.errors?.[0]?.message, n: gEdges.length })
    // 학습자 RPC
    for (const [fn, args] of [['csat_ec_my_pending_probes', { p_session: who === 'P' ? sidP : sidN }], ['csat_ec_my_process_evidence', { p_session: who === 'P' ? sidP : sidN }],
      ['csat_ec_my_capture_state', { p_session: sidP }]]) {
      const r = await c.rpc(fn, args)
      record('canary', `${who} · rpc ${fn}`, !leaks(r.data) && !/is_correct|raw_score|answer"/.test(JSON.stringify(r.data ?? '')), r.error?.message)
    }
    // 비공개 스키마 — REST 로 부를 수 없어야
    const priv = await c.schema('csat_ec_private').rpc('exam_answer_embargoed', { p_exam: EXAM })
    record('canary', `${who} · 비공개 스키마 RPC 호출 불가`, !!priv.error, priv.error?.message ?? priv.data)
  }

  // ── 행동 oracle: 맞힌 문항 · 틀린 문항에 같은 호출 → 같은 응답이어야 ──
  const oracleFns = Object.entries(manifest.db_functions).filter(([, v]) => v.oracle).map(([k]) => k)
  for (const fn of oracleFns) {
    if (fn !== 'csat_ec_add_student_claim') { record('oracle', `${fn} — 호출 인자 정의 필요`, false, '새 oracle 함수 — 이 스크립트에 인자를 더한다'); continue }
    const call = (no) => users.P.client.rpc(fn, { p_session: sidP, p_item_no: no, p_taxonomy: TAX, p_group: 'word', p_code: null, p_supersedes: null })
    const wrong = await call(NOS[0]), right = await call(NOS[1])   // 18 오답 · 19 정답
    const shape = (r) => JSON.stringify({ ok: !r.error, code: r.error?.code, msg: r.error?.message, status: r.status })
    const rows = (await db.query(`select count(*)::int n from public.csat_ec_claim where session_id = $1`, [sidP])).rows[0].n
    record('oracle', `${fn} — 오답 · 정답 문항 응답 동일 · 행 생성 없음`, shape(wrong) === shape(right) && rows === 0, { wrong: shape(wrong), right: shape(right), rows })
  }
  const nonP = await users.N.client.rpc('csat_ec_add_student_claim', { p_session: sidN, p_item_no: NOS[0], p_taxonomy: TAX, p_group: 'word', p_code: null, p_supersedes: null })
  const nonP2 = await users.N.client.rpc('csat_ec_add_student_claim', { p_session: sidN, p_item_no: NOS[1], p_taxonomy: TAX, p_group: 'word', p_code: null, p_supersedes: null })
  record('oracle', '비참가자(다른 계정)도 보류 시험에서 add_student_claim 응답 동일', JSON.stringify([!nonP.error, nonP.error?.message]) === JSON.stringify([!nonP2.error, nonP2.error?.message]), [nonP.error?.message, nonP2.error?.message])

  // ── 앱 경로(선택) ──
  if (APP) {
    for (const who of ['P', 'N']) {
      // @supabase/ssr 세션 쿠키: 값 = 'base64-' + base64url(JSON(session)), 3180자 넘으면 .0 · .1 … 로 나뉜다
      const raw = 'base64-' + Buffer.from(JSON.stringify(users[who].session)).toString('base64url')
      const name = `sb-${DEV_REF}-auth-token`
      const parts = raw.length <= 3180 ? [[name, raw]] : Array.from({ length: Math.ceil(raw.length / 3180) }, (_, i) => [`${name}.${i}`, raw.slice(i * 3180, (i + 1) * 3180)])
      const cookie = parts.map(([k, v]) => `${k}=${v}`).join('; ')
      const authProbe = await fetch(`${APP}/api/csat/diagnosis/sessions/${who === 'P' ? sidP : sidN}/result`, { headers: { cookie }, redirect: 'manual' })
      if (authProbe.status === 401) { record('app', `${who} · 앱 세션 인증 실패 — 앱 경로 검사 미실행`, false, { status: 401 }); continue }
      for (const p of [`/api/csat/lecture?item=${encodeURIComponent(`${EXAM}#18`)}`, `/api/csat/diagnosis/sessions/${who === 'P' ? sidP : sidN}/result`, `/csat/item/${encodeURIComponent(`${EXAM}-18`)}`, '/csat/dissect', '/csat']) {
        const res = await fetch(APP + p, { headers: { cookie }, redirect: 'manual' })
        const body = await res.text()
        // 로그인 리다이렉트(3xx → /login)는 인증 실패라 통과로 보지 않는다
        const redirectedToLogin = res.status >= 300 && res.status < 400 && /\/login/.test(res.headers.get('location') ?? '')
        record('app', `${who} · ${p}`, !redirectedToLogin && !body.includes(CANARY) && !/"raw"\s*:\s*\d/.test(body), { status: res.status, cache: res.headers.get('cache-control') })
      }
    }
  } else record('app', '앱 경로 검사 생략(--app 없음) — 앱 gate 구현 뒤 필수', true)
} catch (e) {
  record('실행', '예외', false, e.message)
} finally {
  // 정리 — 관리자 종료(묘비 없이) → 계정 삭제 → TEST 시험 삭제
  try {
    if (users.ADM && users.P) await users.ADM.client.rpc('csat_ec_capture_close', { p_user: users.P.id, p_exam: EXAM, p_reason: `canary 검사 정리 ${CANARY}` })
  } catch {}
  for (const u of Object.values(users)) await svc.auth.admin.deleteUser(u.id).catch(() => {})
  await db.query(`delete from public.csat_type_reports where type_id = $1`, [TYPE]).catch(() => {})
  await db.query(`delete from public.csat_dx_answer_key where exam_id = $1`, [EXAM]).catch(() => {})
  await db.query(`delete from public.csat_exams where id = $1`, [EXAM]).catch((e) => record('정리', 'TEST 시험 삭제', false, e.message))
  const left = (await db.query(`select (select count(*) from public.csat_ec_capture_tombstone where exam_id = $1 and closed_at is null)::int t, (select count(*) from public.csat_items where exam_id = $1)::int i`, [EXAM])).rows[0]
  record('정리', 'TEST 시험 · 활성 묘비 0', left.t === 0 && left.i === 0, left)
  await db.end()
  const fail = results.filter((r) => !r.ok)
  fs.writeFileSync(path.join(HERE, 'results-canary.json'), JSON.stringify({ ranAt: new Date().toISOString(), canary: CANARY, pass: results.length - fail.length, fail: fail.length, results }, null, 1) + '\n')
  console.log(`\n합계 PASS ${results.length - fail.length} · FAIL ${fail.length}`)
  process.exitCode = fail.length ? 1 : 0
}
