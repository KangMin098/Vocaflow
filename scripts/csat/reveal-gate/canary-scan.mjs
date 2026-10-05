// scripts/csat/reveal-gate/canary-scan.mjs
//
// Reveal Gate Layer B — 동적 canary 검사 + 행동 oracle 검사(개발 DB · 20261005170000 ① · 20261005170100 ② 적용 뒤).
//   TEST 시험(TEST_EC_CANARY)에 고유 canary(해설 · 근거 · 유형 사례 문자열)와 정답을 운영 제약대로 심고(3인 검수 pass 뒤 발행),
//   참가자 capture 를 held 로 만든 뒤 참가자(P) · 다른 계정 비참가자(N) · anon 으로 manifest.json 의 **모든** DB 관계(허용 컬럼만 —
//   컬럼 권한에서 자동으로 읽는다) · GraphQL · **모든** 학습자 표면 함수(시그니처에서 인자를 자동 생성)를 호출한다.
//   실패: canary · TEST 시험 정답 · 정오 · 점수가 응답에 있음 / 예상 밖 오류(검사 미실행) / 정오 oracle / 비공개 스키마 호출 성공.
//   앱 경로(--app <URL>, 앱 gate 구현 뒤 필수): 보류 응답 계약 = HTTP 423 · { held: 'exam_embargo' } 만 통과(400 · 404 · 로그인 리다이렉트는 실패).
// 정리: 관리자 종료(묘비 없이) → 계정 · TEST 시험 · 유형 삭제. 감사 이벤트 행은 남는다(meta 에 canary).
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

// 운영 시험 id 제약(모의 = M + 숫자 4자리 · kice · 고3)을 만족하는 충돌 없는 TEST 시험(2099년)
const EXAM = 'M2099', TYPE = 'TEST-CANARY-TYPE', TAX = 'v0.1'
const CANARY = `CANARY-${randomUUID().slice(0, 8)}`
const ANSWER = (n) => ((n * 3) % 5) + 1
const NOS = [18, 19, 20, 21, 22]
const results = []
const record = (area, name, ok, detail) => { results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`) }
const opt = { auth: { persistSession: false, autoRefreshToken: false } }
const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const svc = createClient(URL_, SERVICE, opt)
const anonClient = createClient(URL_, ANON, opt)
const users = {}
const owned = { exam: false, type: false }   // 이번 실행이 만든 것만 지운다(이미 있던 같은 id 는 건드리지 않는다)
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
const leaks = (payload) => JSON.stringify(payload ?? null).includes(CANARY)
// RPC 응답의 정답 · 정오 필드 — 재귀로 모든 위치의 값을 본다(null 이 하나 있어도 다른 행의 값을 놓치지 않게)
const RPC_SENSITIVE = ['answer', 'answers', 'is_correct', 'correct', 'raw_score', 'answer_key', 'wrong']
function sensitiveValues(x, out = []) {
  if (Array.isArray(x)) for (const v of x) sensitiveValues(v, out)
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (RPC_SENSITIVE.includes(k) && v != null) out.push(k); sensitiveValues(v, out) }
  return out
}

// 학습자가 SELECT 할 수 있는 컬럼(표 단위 권한이면 전부) — 컬럼 권한이 일부만인 표를 「SELECT * 거부 = 통과」로 세지 않게
async function learnerColumns(rel, role = 'authenticated') {
  const { rows } = await db.query(`select a.attname c from pg_attribute a where a.attrelid = ('public.' || $1)::regclass and a.attnum > 0 and not a.attisdropped
                                      and has_column_privilege($2, a.attrelid, a.attnum, 'SELECT') order by a.attnum`, [rel, role])
  return rows.map((r) => r.c)
}
// 함수 인자 자동 생성(타입 · 이름 기반) — 학습자 표면 함수를 빠짐없이 부른다
async function functionSignatures(name) {
  const { rows } = await db.query(`select p.proargnames n, array(select format_type(t, null) from unnest(p.proargtypes) t) t
                                     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1`, [name])
  return rows.map((r) => (r.n ?? []).slice(0, r.t.length).map((n, i) => [n, r.t[i]]))
}
function argFor(name, type, ctx) {
  if (/session/.test(name) && type === 'uuid') return ctx.session
  if (/user/.test(name) && type === 'uuid') return ctx.user
  if (/exam/.test(name)) return EXAM
  if (/item_no|no$/.test(name)) return 18
  if (/taxonomy/.test(name)) return TAX
  return ({ uuid: ctx.session, text: 'x', smallint: 18, integer: 1, bigint: 1, boolean: false, jsonb: {}, 'text[]': [], 'smallint[]': [], 'uuid[]': [] })[type] ?? null
}

try {
  if ((await db.query(`select 1 from supabase_migrations.schema_migrations where version = '20261005170000'`)).rowCount === 0) throw new Error('Reveal Gate ① 가 적용되지 않았다 — 적용 뒤 실행')
  // ── 준비: TEST 유형 · 시험 · 문항 · 정답표 · 분석(3인 pass 검수 뒤 발행) · 뼈대 · 유형 보고 ──
  // 존재 확인을 먼저 — 있으면 지우지 않고 멈춘다. 소유는 각 insert 가 성공한 뒤에만 기록(실패 시 남의 것을 정리하지 않게)
  if ((await db.query(`select 1 from public.csat_exams where id = $1`, [EXAM])).rowCount) throw new Error(`${EXAM} 가 이미 있다 — 이전 검사 정리가 안 됐다(지우지 않고 멈춘다)`)
  if ((await db.query(`select 1 from public.csat_types where id = $1`, [TYPE])).rowCount) throw new Error(`${TYPE} 가 이미 있다 — 지우지 않고 멈춘다`)
  await db.query(`insert into public.csat_types (id, name, section) values ($1, 'TEST canary 유형', '독해')`, [TYPE])
  owned.type = true
  await db.query(`insert into public.csat_exams (id, label, kind, year, month, exam_year, has_answer_key, organizer, grade) values ($1, 'TEST canary(Reveal Gate)', 'mock', 2099, 1, 2098, true, 'kice', 3)`, [EXAM])
  owned.exam = true
  for (const n of NOS) {
    const id = `${EXAM}#${n}`
    await db.query(`insert into public.csat_items (id, exam_id, no, section, stem, passage, choices, answer, type_id, body_ok) values ($1, $2, $3, '독해', 'TEST stem', 'TEST passage one. TEST passage two.', $4, $5, $6, true)`,
      [id, EXAM, n, JSON.stringify(['a', 'b', 'c', 'd', 'e']), ANSWER(n), TYPE])
    await db.query(`insert into public.csat_dx_answer_key (exam_id, no, answers, points, source) values ($1, $2, $3, 2, 'test')`, [EXAM, n, [ANSWER(n)]])
    const a = (await db.query(`insert into public.csat_item_analyses (item_id, status, measured_ability, design_intent, choice_analysis, answer_locus, solve_procedure)
                                values ($1, 'draft', $2, $2, $3, $3, $3) returning id`, [id, `TEST ${CANARY}`, JSON.stringify({ canary: CANARY })])).rows[0].id
    for (const persona of ['setter', 'analyst', 'tutor']) await db.query(`insert into public.csat_analysis_reviews (analysis_id, persona, verdict) values ($1, $2, 'pass')`, [a, persona])
    await db.query(`update public.csat_item_analyses set status = 'published' where id = $1`, [a])
    // 뼈대는 운영 제약상 학평 문항(H…)만 — 수능형 TEST 시험에는 넣지 않는다(뼈대 보류는 격리 PG t_reveal 이 검증)
  }
  await db.query(`insert into public.csat_type_reports (type_id, status, failure_modes, open_questions) values ($1, 'published', $2, $2)`, [TYPE, JSON.stringify({ canary: CANARY })])
  const ready = (await db.query(`select (select count(*) from public.csat_item_analyses where item_id like $1 and status = 'published')::int a`, [`${EXAM}#%`])).rows[0]
  record('준비', 'canary fixture 발행 완료(분석 5)', ready.a === 5, ready)
  for (const r of ['P', 'N', 'ADM']) await makeUser(r, r === 'ADM')

  const responses = NOS.map((n, i) => ({ item_no: n, item_id: `${EXAM}#${n}`, chosen_option: i % 2 ? ANSWER(n) : (ANSWER(n) % 5) + 1, is_correct: Boolean(i % 2) }))
  const rec = (uid, participant) => svc.rpc('csat_ec_record_session_held', { p_session: { user_id: uid, exam_id: EXAM, mode: 'live', taken_at: '2026-10-05', client_key: randomUUID(), raw_score: 4 },
    p_responses: responses, p_participant: participant, p_taxonomy: TAX, p_config: { test: CANARY }, p_targets: NOS, p_evidence_eligible: true })
  const rp = await rec(users.P.id, true), rn = await rec(users.N.id, false)
  record('준비', '참가자 held · 비참가자 같은 시험 저장', !rp.error && rp.data.held === true && !rn.error && rn.data.held === false, [rp.error?.message, rn.error?.message])
  const sid = { P: rp.data?.session_id, N: rn.data?.session_id }

  // ── Layer B: 관계 — 허용 컬럼만, 전체 페이지 ──
  const actors = [['P', users.P.client, { session: sid.P, user: users.P.id }], ['N', users.N.client, { session: sid.N, user: users.N.id }], ['anon', anonClient, { session: sid.P, user: users.P.id }]]
  for (const [who, c] of actors) {
    for (const rel of Object.keys(manifest.db_relations)) {
      const cols = await learnerColumns(rel, who === 'anon' ? 'anon' : 'authenticated')
      if (cols.length === 0) { record('canary', `${who} · ${rel} — 학습자 SELECT 컬럼 없음(회수)`, true); continue }
      // 관리자 전용 표 — 학습자 전체 조회는 정책이 행마다 관리자 함수를 평가해 statement timeout 이 난다(데이터는 안 나온다).
      // 동적 대신 정적으로: 학습자에게 열린 SELECT 정책이 모두 관리자 조건뿐인지 확인한다
      if (manifest.db_relations[rel].class === 'ADMIN_ONLY' || rel === 'csat_dcp_items') {
        const pol = (await db.query(`select pg_get_expr(polqual, polrelid) q from pg_policy where polrelid = ('public.' || $1)::regclass and polcmd in ('r', '*')`, [rel])).rows
        const adminOnly = pol.length > 0 && pol.every((p) => /is_admin(_or_curator)?\(\)/.test(p.q ?? '') && !/auth\.uid\(\)\s*=|=\s*\(\s*select auth\.uid/i.test(p.q ?? ''))
        record('canary', `${who} · ${rel} — 관리자 전용 정책(정적 확인)`, adminOnly, pol.map((p) => p.q))
        continue
      }
      const rows = []; let r = { error: null }
      for (let from = 0; from < 200000; from += 1000) {
        r = await c.from(rel).select(cols.join(',')).range(from, from + 999)
        if (r.error || !r.data?.length) break
        rows.push(...r.data); if (r.data.length < 1000) break
      }
      if (r.error && !(who === 'anon' && r.error.code === '42501')) { record('canary', `${who} · ${rel} — 조회 오류(검사 미실행)`, false, { code: r.error.code, msg: r.error.message }); continue }
      const testRows = rows.filter((x) => JSON.stringify(x).includes(EXAM) || Object.values(sid).includes(x.session_id) || Object.values(sid).includes(x.id))
      // 관계별 민감 컬럼(매니페스트) — 공개 학년(grade) 같은 같은 이름의 무관 컬럼을 오탐하지 않게
      const sensitive = manifest.db_relations[rel].sensitive_columns ?? []
      const answerLeak = testRows.filter((x) => sensitive.some((f) => x[f] != null))
      record('canary', `${who} · ${rel}`, !leaks(rows) && answerLeak.length === 0, { rows: rows.length, testRows: testRows.length, answerLeak: answerLeak.length })
    }
    // GraphQL — 이 역할에게 노출된 csat 컬렉션을 introspection 으로 **자동** 수집해 모두 조회한다(이름을 손으로 고르지 않는다)
    const gq = async (query) => fetch(`${URL_}/graphql/v1`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${who === 'anon' ? ANON : users[who].token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }) }).then((x) => x.json())
    const intro = await gq(`{ __type(name: "Query") { fields { name type { name ofType { name } } } } }`)
    if (intro.errors) record('canary', `${who} · GraphQL introspection — 검사 미실행`, false, intro.errors[0]?.message)
    const collections = (intro.data?.__type?.fields ?? []).filter((f) => /^csat.*Collection$/i.test(f.name))
    for (const col of collections) {
      const typeName = col.type?.name ?? col.type?.ofType?.name
      const conn = await gq(`{ __type(name: "${typeName}") { fields { name type { ofType { ofType { ofType { name } } } } } } }`)
      const nodeType = (await gq(`{ __type(name: "${typeName.replace(/Connection$/, '')}") { fields { name type { kind name ofType { kind name } } } } }`)).data?.__type
      const scalars = (nodeType?.fields ?? []).filter((f) => ['SCALAR', 'ENUM'].includes(f.type.kind) || ['SCALAR', 'ENUM'].includes(f.type.ofType?.kind)).map((f) => f.name)
      if (!scalars.length) { record('canary', `${who} · GraphQL ${col.name} — 필드 수집 실패(검사 미실행)`, false, conn.errors?.[0]?.message); continue }
      const res = await gq(`{ ${col.name}(first: 1000) { edges { node { ${scalars.join(' ')} } } } }`)
      const nodes = (res.data?.[col.name]?.edges ?? []).map((e) => e.node)
      const sensitive = Object.values(manifest.db_relations).flatMap((v) => v.sensitive_columns ?? [])
      const tests = nodes.filter((n) => JSON.stringify(n).includes(EXAM))
      const hit = tests.filter((n) => Object.entries(n).some(([k, v]) => sensitive.some((s) => k.toLowerCase() === s.replace(/_/g, '').toLowerCase() || k === s) && v != null))
      record('canary', `${who} · GraphQL ${col.name}`, !res.errors && !leaks(res) && hit.length === 0, { errors: res.errors?.[0]?.message, nodes: nodes.length, tests: tests.length, hit: hit.length })
    }
    record('canary', `${who} · GraphQL 노출 csat 컬렉션 ${collections.length}개 검사`, !intro.errors, collections.map((c) => c.name))

    // 학습자 표면 함수 전부 — 매니페스트의 호출 계약(call · args)대로. 계약이 없는 함수는 「미검사」로 실패
    //   read = 성공해야 · write = 결과 무관(노출 · 정답 필드 없음) · refuse = 거부해야 · none = 사유와 함께 명시 제외
    const ctx = actors.find((a) => a[0] === who)[2]
    for (const [fn, meta] of Object.entries(manifest.db_functions)) {
      if (meta.class === 'TRIGGER_FN') continue
      // 명시 제외(쓰기 부작용)는 **모든 주체**에 먼저 적용 — anon 단계에서 무시하고 호출하던 결함(2026-10-05 실측: 스냅샷 1행 생성)
      if (meta.call === 'none') { record('rpc', `${who} · ${fn} — 명시 제외: ${meta.call_reason}`, !!meta.call_reason); continue }
      // anon: 학습자 · 판정자 · 관리자 · oracle 표면은 거부여야 한다. 운영 메타(OPS_META)는 원래 계약대로(정답 없음 — 공개 여부는 별도 권한 점검)
      const call = who === 'anon' ? (meta.class === 'OPS_META' ? 'any' : 'refuse') : meta.call
      if (!call) { record('rpc', `${who} · ${fn} — 호출 계약 없음(미검사)`, false, '매니페스트에 call · args 를 정의한다'); continue }
      const sigs = await functionSignatures(fn)
      for (const sig of sigs) {
        const fill = (v) => (v === '{SESSION}' ? ctx.session : v === '{UUID}' ? randomUUID() : v)
        const args = meta.args && typeof meta.args === 'object'
          ? Object.fromEntries(Object.entries(meta.args).filter(([k]) => sig.some(([n]) => n === k)).map(([k, v]) => [k, fill(v)]))
          : Object.fromEntries(sig.map(([n, t]) => [n, argFor(n, t, ctx)]))
        const r = await c.rpc(fn, args)
        const hits = sensitiveValues(r.data)
        const ok = call === 'refuse' ? !!r.error
          : call === 'read' ? !r.error && !leaks(r.data) && hits.length === 0
          : !leaks(r.data) && !leaks(r.error) && hits.length === 0   // write · any — 결과는 무관, 노출만 본다(oracle 은 아래에서)
        record('rpc', `${who} · ${fn}(${sig.map((s) => s[1]).join(',')}) [${call}]`, ok, { err: r.error?.message?.slice(0, 120), hits })
      }
    }
    if (who !== 'anon') {
      const priv = await c.schema('csat_ec_private').rpc('exam_answer_embargoed', { p_exam: EXAM })
      record('canary', `${who} · 비공개 스키마 RPC 호출 불가`, !!priv.error, priv.error?.message ?? priv.data)
    }
  }

  // ── 행동 oracle: 맞힌 · 틀린 문항에 같은 호출 → 같은 응답 · 행 생성 없음 ──
  for (const [fn] of Object.entries(manifest.db_functions).filter(([, v]) => v.oracle)) {
    for (const who of ['P', 'N']) {
      const call = (no) => users[who].client.rpc(fn, { p_session: sid[who], p_item_no: no, p_taxonomy: TAX, p_group: 'word', p_code: null, p_supersedes: null })
      const wrong = await call(NOS[0]), right = await call(NOS[1])   // 18 오답 · 19 정답
      const shape = (r) => JSON.stringify({ ok: !r.error, code: r.error?.code, msg: r.error?.message, status: r.status, data: r.data ?? null })   // 값까지(같은 상태로 다른 값을 돌려주는 oracle)
      const rows = (await db.query(`select count(*)::int n from public.csat_ec_claim where session_id = $1`, [sid[who]])).rows[0].n
      record('oracle', `${who} · ${fn} — 오답 · 정답 응답 동일 · 행 생성 없음`, shape(wrong) === shape(right) && rows === 0, { wrong: shape(wrong), right: shape(right), rows })
    }
  }

  // ── 앱 경로(앱 gate 구현 뒤) ──
  if (APP) {
    for (const who of ['P', 'N']) {
      const raw = 'base64-' + Buffer.from(JSON.stringify(users[who].session)).toString('base64url')
      const name = `sb-${DEV_REF}-auth-token`
      const parts = raw.length <= 3180 ? [[name, raw]] : Array.from({ length: Math.ceil(raw.length / 3180) }, (_, i) => [`${name}.${i}`, raw.slice(i * 3180, (i + 1) * 3180)])
      const cookie = parts.map(([k, v]) => `${k}=${v}`).join('; ')
      const probe = await fetch(`${APP}/api/csat/diagnosis/sessions/${sid[who]}/result`, { headers: { cookie }, redirect: 'manual' })
      if (probe.status === 401 || (probe.status >= 300 && probe.status < 400)) { record('app', `${who} · 앱 세션 인증 실패 — 앱 경로 검사 미실행`, false, { status: probe.status }); continue }
      // 매니페스트의 정답 민감 · 정오 경로 **전부** — 요청 fixture(probe)가 없는 민감 경로는 그 자체로 실패(미검사 금지)
      const fill = (s) => s.replaceAll('{SLUG}', `${EXAM}-18`).replaceAll('{SESSION}', sid[who]).replaceAll('{EXAM}', EXAM).replaceAll('{UUID}', randomUUID()).replaceAll('{WORKSPACE}', randomUUID())
      const fillBody = (b) => b && JSON.parse(fill(JSON.stringify(b)).replace('"{CHOICES}"', JSON.stringify(Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, i + 1 >= 18 && i + 1 <= 22 ? 1 : null])))))
      const sensitive = (v) => ['ANSWER_SENSITIVE', 'CORRECTNESS', 'CORRECTNESS_OWN_PRIOR'].includes(v.class)
      const entries = [...Object.entries(manifest.app_api).map(([k, v]) => ['api', k, v]), ...Object.entries(manifest.app_pages).map(([k, v]) => ['page', k, v])]
      for (const [kind, key, v] of entries.filter(([, , x]) => sensitive(x))) {
        if (!v.probe) { record('app', `${who} · ${key} — 요청 fixture 없음(미검사)`, false, '매니페스트에 probe 를 정의한다'); continue }
        const url = APP + (kind === 'api' ? '/api/' + fill(v.probe.path ?? key) : fill(v.probe.path))
        const res = await fetch(url, { method: v.probe.method, headers: { cookie, 'Content-Type': 'application/json' }, body: v.probe.body ? JSON.stringify(fillBody(v.probe.body)) : undefined, redirect: 'manual' })
        const body = await res.text()
        let parsed = null; try { parsed = JSON.parse(body) } catch {}
        const redirected = res.status >= 300 && res.status < 400
        const noStore = (res.headers.get('cache-control') ?? '').includes('no-store')
        // HTML · RSC 페이로드 — 보류 시험 문항 id 앞뒤 400자 안에 정답 · 정오 · 점수 값이 있으면 노출
        const near = []
        for (let i = body.indexOf(EXAM + '#'); i >= 0; i = body.indexOf(EXAM + '#', i + 1)) {
          const win = body.slice(Math.max(0, i - 400), i + 400)
          for (const key of ['"answer":', '\\"answer\\":', '"is_correct":', '"correct":', '"raw":', '"wrong":']) {
            const j = win.indexOf(key)
            if (j >= 0 && !win.slice(j + key.length, j + key.length + 4).startsWith('null')) near.push(key)
          }
        }
        const ok = !redirected && !body.includes(CANARY) && near.length === 0 && (
          v.probe.expect === 'embargo' ? res.status === 423 && parsed?.held === 'exam_embargo' && noStore
          : v.probe.expect === 'held' ? res.ok && parsed?.held != null && parsed?.raw === undefined && parsed?.wrong === undefined
          // no_canary — 유효한 정상 응답(2xx)이어야 실행된 검사다(401 · 404 · 5xx 는 미실행으로 실패). JSON 이면 정답 · 정오 필드도 본다
          : res.status >= 200 && res.status < 300 && sensitiveValues(parsed).length === 0)
        record('app', `${who} · ${kind} ${key} (${v.probe.expect})`, ok, { status: res.status, held: parsed?.held, noStore })
      }
    }
  } else record('app', '앱 경로 검사 생략(--app 없음) — 앱 gate 구현 뒤 필수 · 미실행은 통과가 아니다', true)
} catch (e) {
  record('실행', '예외', false, e.message)
} finally {
  try { if (users.ADM && users.P) await users.ADM.client.rpc('csat_ec_capture_close', { p_user: users.P.id, p_exam: EXAM, p_reason: `canary 검사 정리 ${CANARY}` }) } catch {}
  for (const u of Object.values(users)) await svc.auth.admin.deleteUser(u.id).catch(() => {})
  if (owned.type) await db.query(`delete from public.csat_type_reports where type_id = $1`, [TYPE]).catch(() => {})
  if (owned.exam) {
    await db.query(`delete from public.csat_dx_answer_key where exam_id = $1`, [EXAM]).catch(() => {})
    await db.query(`delete from public.csat_exams where id = $1`, [EXAM]).catch((e) => record('정리', 'TEST 시험 삭제', false, e.message))
  }
  if (owned.type) await db.query(`delete from public.csat_types where id = $1`, [TYPE]).catch(() => {})
  const left = (await db.query(`select (select count(*) from public.csat_ec_capture_tombstone where exam_id = $1 and closed_at is null)::int t, (select count(*) from public.csat_items where exam_id = $1)::int i`, [EXAM])).rows[0]
  record('정리', 'TEST 시험 · 활성 묘비 0', left.t === 0 && left.i === 0, left)
  await db.end()
  const fail = results.filter((r) => !r.ok)
  fs.writeFileSync(path.join(HERE, 'results-canary.json'), JSON.stringify({ ranAt: new Date().toISOString(), canary: CANARY, pass: results.length - fail.length, fail: fail.length, results }, null, 1) + '\n')
  console.log(`\n합계 PASS ${results.length - fail.length} · FAIL ${fail.length}`)
  process.exitCode = fail.length ? 1 : 0
}
