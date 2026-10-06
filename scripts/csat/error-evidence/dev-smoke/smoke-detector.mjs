// scripts/csat/error-evidence/dev-smoke/smoke-detector.mjs
//
// G4 경계 감지기(20261006120000) **개발 Supabase DB** smoke — 앱과 같은 supabase-js 경로(학습자 로그인 · service_role)로 커밋되는 흐름을 본다.
// 수용 기준(2026-10-06 사용자 지정):
//   interpretation → detector signal → pending probe → probe response → completion · unknown/범주 없음 → probe 없음 ·
//   정정 → 미응답 probe 취소 · 응답한 probe → 기록 보존 + obsolete · 정답/오답 attempt 동일 · AI/판정 출처 신호는 학습자 대기에 안 나옴 ·
//   completed · closed_incomplete 뒤 새 신호 거부 · 감지기 실패 시 증거 저장도 함께 롤백(부분 상태 없음).
// 경계 키 · probe 키 · 범주는 DB(봉인 v0.1)에서 읽는다(하드코딩 없음). 테스트 계정 ec-detector-<run>-*@example.com 은 끝나면 지운다.
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/error-evidence/dev-smoke/smoke-detector.mjs

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const DEV_REF = 'jajenrevcbmrpaliomxv'
const TAX = 'v0.1'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY, DB_URL = process.env.SUPABASE_DB_URL
if (!URL_ || !ANON || !SERVICE || !DB_URL) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
if (!URL_.includes(DEV_REF) || !DB_URL.includes(DEV_REF)) { console.error(`개발 프로젝트(${DEV_REF})가 아니다 — 중단`); process.exit(2) }

const results = []
const record = (area, name, ok, detail) => { results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}` : ''}`) }
const opt = { auth: { persistSession: false, autoRefreshToken: false } }
const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const svc = createClient(URL_, SERVICE, opt)
const run = randomUUID().slice(0, 8)
const users = {}

async function makeUser(role) {
  const email = `ec-detector-${run}-${role.toLowerCase()}@example.com`, password = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'csat_ec detector dev smoke' } })
  if (error) throw new Error(`계정 생성 실패(${role}): ${error.message}`)
  const client = createClient(URL_, ANON, opt)
  const { error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw new Error(`로그인 실패(${role}): ${se.message}`)
  users[role] = { id: data.user.id, client }
}

try {
  // ── 봉인 v0.1 에서 경계 · probe · 범주를 읽는다 ──
  const bnd = (await db.query(`select b.boundary_key, b.probe_key, ca.student_group ga, cb.student_group gb from public.csat_ec_boundary b
      join public.csat_ec_code ca on ca.version = b.version and ca.code = b.code_a join public.csat_ec_code cb on cb.version = b.version and cb.code = b.code_b
      where b.version = $1 and b.status = 'provisional' and b.probe_key is not null order by b.boundary_key limit 1`, [TAX])).rows[0]
  if (!bnd) throw new Error('v0.1 provisional 경계가 없다')
  const outside = (await db.query(`select g from unnest(array['word','sentence','flow','evidence','choice','time']) g where g not in ($1, $2) limit 1`, [bnd.ga, bnd.gb])).rows[0].g
  const exam = (await db.query(`select i.exam_id from public.csat_items i where i.answer is not null and i.passage is not null group by 1 having count(*) >= 20 order by 1 limit 1`)).rows[0].exam_id
  const items = (await db.query(`select no, id, answer from public.csat_items where exam_id = $1 order by no`, [exam])).rows
  const targets = items.filter((i) => i.answer && i.no >= 18).slice(0, 5).map((i) => i.no)
  const [t1, t2, t3, t4, t5] = targets
  const HASH = 'c'.repeat(64)
  for (const r of ['P', 'W', 'C', 'ADM']) await makeUser(r)
  await db.query(`insert into public.user_profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin'`, [users.ADM.id])

  // 정답 attempt(P) · 오답 attempt(W) · 종료용(C) — 같은 시험 · 같은 봉인 대상 · 같은 probe 설정
  async function makeSession(role, correct) {
    const responses = items.map((i) => { const ch = correct ? Number(i.answer) : (Number(i.answer) % 5) + 1; return { item_no: i.no, item_id: i.id, chosen_option: i.answer ? ch : null, is_correct: i.answer ? correct : null, confidence: 'sure' } })
    const { data, error } = await svc.rpc('csat_ec_record_session_held', {
      p_session: { user_id: users[role].id, exam_id: exam, mode: 'live', taken_at: '2026-10-06', client_key: randomUUID(), raw_score: 0 },
      p_responses: responses, p_participant: true, p_taxonomy: TAX,
      p_config: { probe_cap: null, probes: [{ key: bnd.probe_key, version: '1.0.0', prompt_hash: HASH }] }, p_targets: targets, p_evidence_eligible: true,
    })
    if (error) throw new Error(`세션 저장 실패(${role}): ${error.message}`)
    const sid = data.session_id
    const o = await users[role].client.rpc('csat_ec_capture_open', { p_session: sid })
    if (o.error) throw new Error(`수집 열기 실패(${role}): ${o.error.message}`)
    return sid
  }
  const S = { P: await makeSession('P', true), W: await makeSession('W', false), C: await makeSession('C', false) }
  const pe = (role, no, kind, value, sup = null) => users[role].client.rpc('csat_ec_add_process_evidence', { p_session: S[role], p_item_no: no, p_kind: kind, p_value: value, p_supersedes: sup })
  const pend = async (role) => { const r = await users[role].client.rpc('csat_ec_my_pending_probes', { p_session: S[role] }); return r.error ? r.error.message : r.data.map((p) => ({ item_no: p.item_no, probe_key: p.probe_key })) }
  const sigs = async (role) => (await db.query(`select s.item_no, s.boundary_key, s.probe_required, s.source, r.reason from public.csat_ec_boundary_signal s
      left join public.csat_ec_boundary_signal_retraction r on r.signal_id = s.id where s.session_id = $1 order by s.item_no, s.id`, [S[role]])).rows
  const runs = async (role) => (await db.query(`select item_no, result from public.csat_ec_detector_run where session_id = $1 order by item_no, id`, [S[role]])).rows
  const lastResult = (rs, no) => rs.filter((r) => r.item_no === no).at(-1)?.result
  const curCat = async (role, no) => (await db.query(`select id from public.csat_ec_process_evidence p where session_id = $1 and item_no = $2 and kind = 'category'
      and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id) order by id desc limit 1`, [S[role], no])).rows[0]?.id

  // ── 같은 시나리오를 P · W 에 — 학생 화면이 부르는 RPC 순서 그대로 ──
  async function scenario(role) {
    const errs = []
    const go = async (...a) => { const r = await pe(role, ...a); errs.push(r.error ? r.error.message : 'ok'); return r }
    // t1: 경계 범주 + 해석 → 신호 · 대기 probe → 응답 → 정정으로 경계 소멸 → obsolete(응답 보존)
    await go(t1, 'category', { group: bnd.ga }); await go(t1, 'interpretation', { state: 'answered', text: '그 낱말을 이런 뜻으로 읽었어요' })
    const pendAfterT1 = await pend(role)
    const pr = await users[role].client.rpc('csat_ec_add_probe_response', { p_session: S[role], p_item_no: t1, p_value: { probe_key: bnd.probe_key, probe_version: '1.0.0', taxonomy_version: TAX, boundary_key: bnd.boundary_key, prompt_hash: HASH, option: 'B', skipped: false }, p_session_cap: null })
    errs.push(pr.error ? pr.error.message : 'ok')
    const pendAfterAnswer = await pend(role)
    await go(t1, 'category', { group: outside }, await curCat(role, t1))
    // t2: 범주 없음 → probe 없음 · t3: unsure → probe 없음
    await go(t2, 'interpretation', { state: 'answered', text: '이렇게 읽었어요' })
    await go(t3, 'category', { group: 'unsure' }); await go(t3, 'interpretation', { state: 'answered', text: '이렇게 읽었어요' })
    // t4: 경계 → 대기 → 응답 전에 정정 → 취소(대기에서 사라짐)
    await go(t4, 'category', { group: bnd.gb }); await go(t4, 'interpretation', { state: 'answered', text: '이 표현을 이렇게 받아들였어요' })
    const pendT4 = await pend(role)
    await go(t4, 'category', { group: outside }, await curCat(role, t4))
    const pendAfterCancel = await pend(role)
    // t5: 「모름」 해석 → probe 없음
    await go(t5, 'category', { group: bnd.ga }); await go(t5, 'interpretation', { state: 'unknown' })
    return { errs, pendAfterT1, pendAfterAnswer, pendT4, pendAfterCancel, sigs: await sigs(role), runs: (await runs(role)).map((r) => [r.item_no, r.result]),
      probeKept: (await db.query(`select count(*)::int n from public.csat_ec_process_evidence where session_id = $1 and item_no = $2 and kind = 'targeted_probe'`, [S[role], t1])).rows[0].n }
  }
  const P = await scenario('P'), W = await scenario('W')

  record('흐름', `interpretation → 신호 → 대기 probe(${bnd.boundary_key})`, P.pendAfterT1.length === 1 && P.pendAfterT1[0].item_no === t1 && P.pendAfterT1[0].probe_key === bnd.probe_key, P.pendAfterT1)
  record('흐름', 'probe 응답 저장 → 대기에서 빠짐', P.errs.every((e) => e === 'ok') && !P.pendAfterAnswer.some((p) => p.item_no === t1), { errs: P.errs, pend: P.pendAfterAnswer })
  const t1sig = P.sigs.filter((s) => s.item_no === t1)
  record('정정', '응답한 probe → 정정 뒤 신호 obsolete · 응답 기록 보존', t1sig.length >= 1 && t1sig.at(-1).reason === 'obsolete' && P.probeKept === 1, { t1sig, kept: P.probeKept })
  record('증거 부족', '범주 없음 → insufficient_evidence · 신호 0', lastResult(P.runs.map(([item_no, result]) => ({ item_no, result })), t2) === 'insufficient_evidence' && !P.sigs.some((s) => s.item_no === t2), P.runs)
  record('증거 부족', 'unsure → insufficient_evidence · 신호 0', lastResult(P.runs.map(([item_no, result]) => ({ item_no, result })), t3) === 'insufficient_evidence' && !P.sigs.some((s) => s.item_no === t3), P.runs)
  record('증거 부족', '해석 「모름」 → 신호 0 · 대기 0', !P.sigs.some((s) => s.item_no === t5) && !P.pendAfterCancel.some((p) => p.item_no === t5), P.sigs)
  record('정정', '미응답 probe → 정정 뒤 cancelled · 대기에서 사라짐', P.pendT4.some((p) => p.item_no === t4) && P.sigs.filter((s) => s.item_no === t4).at(-1)?.reason === 'cancelled' && !P.pendAfterCancel.some((p) => p.item_no === t4), { pendT4: P.pendT4, sig: P.sigs.filter((s) => s.item_no === t4) })
  record('출처', '모든 신호가 detector 출처', P.sigs.every((s) => s.source === 'detector'), P.sigs)
  const norm = (x) => JSON.stringify({ ...x })
  record('오라클', '정답 attempt(P) · 오답 attempt(W) — 응답 · 대기 · 신호 · 실행 결과 · 오류 동일', norm(P) === norm(W), { P: P.runs, W: W.runs })

  // ── AI · 판정 출처 신호는 학습자 대기에 나오지 않는다 — 대기 함수 정의가 detector 출처만 고른다(격리 PG 에서 행 단위로도 검증) ──
  const def = (await db.query(`select pg_get_functiondef('public.csat_ec_my_pending_probes(uuid)'::regprocedure) d`)).rows[0].d
  record('출처', '대기 probe 함수가 source = detector 만 고른다(정의)', /source\s*=\s*'detector'/.test(def))

  // ── 완료 → 새 신호 · 증거 거부 ──
  const cf = await users.P.client.rpc('csat_ec_confirm_session', { p_session: S.P, p_took_exam: true, p_judged_each: true })
  const fin = await users.P.client.rpc('csat_ec_capture_finish', { p_session: S.P })
  record('완료', '확인 + 대상 해석 모두 → completed', !cf.error && !fin.error && fin.data?.status === 'completed', cf.error?.message ?? fin.error?.message ?? fin.data)
  const afterFinEv = await pe('P', t2, 'category', { group: bnd.ga })
  record('완료', 'completed 뒤 학생 증거 거부(감지기도 돌지 않음)', !!afterFinEv.error, afterFinEv.error?.message)
  const sigBefore = (await sigs('P')).length
  const svcSig = await svc.rpc('csat_ec_add_detector_signal', { p_session: S.P, p_item_no: t2, p_taxonomy: TAX, p_boundary_key: bnd.boundary_key, p_detector_version: 'smoke', p_probe_required: true, p_evidence_ids: [] })
  record('완료', 'completed 뒤 service 의 새 detector 신호 거부', !!svcSig.error && (await sigs('P')).length === sigBefore, svcSig.error?.message ?? 'inserted')

  // ── closed_incomplete → 새 신호 · 증거 거부 ──
  await pe('C', t1, 'category', { group: bnd.ga })
  const cl = await users.ADM.client.rpc('csat_ec_capture_close', { p_user: users.C.id, p_exam: exam, p_reason: 'TEST detector smoke — 미완료 종료' })
  record('종료', '관리자 종료 → closed_incomplete', !cl.error && cl.data >= 1, cl.error?.message ?? cl.data)
  const afterCloseEv = await pe('C', t1, 'interpretation', { state: 'answered', text: '종료 뒤에 남기려는 해석' })
  const svcSig2 = await svc.rpc('csat_ec_add_detector_signal', { p_session: S.C, p_item_no: t1, p_taxonomy: TAX, p_boundary_key: bnd.boundary_key, p_detector_version: 'smoke', p_probe_required: true, p_evidence_ids: [] })
  record('종료', 'closed_incomplete 뒤 학생 증거 · service 신호 모두 거부', !!afterCloseEv.error && !!svcSig2.error, [afterCloseEv.error?.message, svcSig2.error?.message])

  // ── 원자성: 감지기가 실패하면 증거 저장도 함께 롤백 — 한 트랜잭션에서 감지기를 실패하게 바꾸고(무조건 ROLLBACK) 학습자 저장을 시도 ──
  const before = (await db.query(`select count(*)::int n from public.csat_ec_process_evidence where session_id = $1`, [S.W])).rows[0].n
  let atomic = null
  // 반환형 · 보안 속성은 정의에서 읽는다(CREATE OR REPLACE 는 반환형을 바꿀 수 없다)
  const fdef = (await db.query(`select pg_get_function_result(p.oid) rt, p.prosecdef sd from pg_proc p where p.oid = 'public.csat_ec_detect_boundaries(uuid,smallint,uuid)'::regprocedure`)).rows[0]
  try {
    await db.query('begin')
    await db.query(`set local lock_timeout = '5s'`)
    await db.query(`create or replace function public.csat_ec_detect_boundaries(p_session uuid, p_item_no smallint, p_trigger uuid) returns ${fdef.rt}
      language plpgsql ${fdef.sd ? 'security definer' : ''} set search_path = '' as $$ begin raise exception 'smoke: 감지기 강제 실패'; end $$`)
    await db.query(`set local role authenticated`)
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'authenticated', sub: users.W.id })])
    let failed = false
    await db.query('savepoint s')
    try { await db.query(`select public.csat_ec_add_process_evidence($1, $2::smallint, 'interpretation', $3::jsonb, null)`, [S.W, t2, JSON.stringify({ state: 'answered', text: '원자성 확인용 해석' })]) } catch { failed = true; await db.query('rollback to savepoint s') }
    await db.query('reset role')
    const mid = (await db.query(`select count(*)::int n from public.csat_ec_process_evidence where session_id = $1`, [S.W])).rows[0].n
    atomic = { failed, mid }
  } catch (e) { atomic = { error: e.message } } finally { await db.query('rollback').catch(() => {}) }
  const after = (await db.query(`select count(*)::int n from public.csat_ec_process_evidence where session_id = $1`, [S.W])).rows[0].n
  const defBack = (await db.query(`select pg_get_functiondef('public.csat_ec_detect_boundaries(uuid,smallint,uuid)'::regprocedure) ~ '강제 실패' x`)).rows[0].x
  record('원자성', '감지기 실패 → 학생 증거 저장도 실패 · 부분 상태 0(증거 행 수 그대로)', atomic?.failed === true && atomic.mid === before && after === before && defBack === false, { atomic, before, after, defRestored: !defBack })
} catch (e) {
  record('실행', '스모크', false, e.message)
} finally {
  // 활성 수집(held · collecting)이 남은 계정을 지우면 묘비가 남아 그 시험이 **모든 사용자에게** 보류된다(2026-10-06 실측 — 이 스크립트가 2014A 묘비 2개를 남겼다).
  // 지우기 전에 관리자 종료(closed_incomplete)로 닫는다. 닫지 못한 계정은 지우지 않고 실패로 남긴다.
  const tombBefore = (await db.query(`select coalesce(max(id), 0)::int m from public.csat_ec_capture_tombstone`)).rows[0].m
  const keep = new Set()
  for (const [role, u] of Object.entries(users)) {
    if (role === 'ADM') continue
    const act = (await db.query(`select c.exam_id from public.csat_ec_capture_session c join public.csat_dx_session s on s.id = c.session_id
        where s.user_id = $1 and c.status in ('held', 'collecting') group by 1`, [u.id])).rows
    for (const { exam_id } of act) {
      const r = users.ADM ? await users.ADM.client.rpc('csat_ec_capture_close', { p_user: u.id, p_exam: exam_id, p_reason: 'TEST detector smoke 정리 — 계정 삭제 전 종료' }) : { error: { message: '관리자 계정 없음' } }
      if (r.error) { keep.add(role); record('정리', `활성 수집 종료 ${role}`, false, r.error.message) }
    }
  }
  for (const [role, u] of Object.entries(users)) {
    if (keep.has(role)) continue
    const d = await svc.auth.admin.deleteUser(u.id); if (d.error) record('정리', `계정 삭제 ${u.id.slice(0, 8)}`, false, d.error.message)
  }
  const newOpen = (await db.query(`select count(*)::int n from public.csat_ec_capture_tombstone where id > $1 and closed_at is null`, [tombBefore])).rows[0].n
  record('정리', '새 열린 묘비 0(시험 전체 보류를 남기지 않음)', newOpen === 0, newOpen)
  const left = (await db.query(`select count(*)::int n from auth.users where email like $1`, [`ec-detector-${run}-%`])).rows[0].n
  record('정리', '테스트 계정 0', left === 0, left)
  await db.end()
  const fail = results.filter((r) => !r.ok).length
  fs.writeFileSync(path.join(DIR, 'results-detector.json'), JSON.stringify({ ranAt: new Date().toISOString(), run, pass: results.length - fail, fail, results }, null, 1))
  console.log(`\n합계 PASS ${results.length - fail} · FAIL ${fail}`)
  process.exitCode = fail ? 1 : 0
}
