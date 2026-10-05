// scripts/csat/error-evidence/dev-smoke/smoke-seed.mjs
//
// v0.1 conditional seed 적용 뒤 — 개발 DB 의 실제 PostgREST · Auth 경로로 seed 가 보이는 방식만 본다(쓰기 없음 · 테스트 계정 1개 만들고 지움).
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/error-evidence/dev-smoke/smoke-seed.mjs

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const DEV_REF = 'jajenrevcbmrpaliomxv'
const V = 'v0.1', HASH = '303e5140a2d54b2d58a8df99bc7be6c1c55cceaa63294111bf17f02aeb934ced'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !ANON || !SERVICE) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
if (!URL_.includes(DEV_REF)) { console.error(`개발 프로젝트(${DEV_REF})가 아니다 — 중단`); process.exit(2) }

const results = []
const record = (area, name, ok, detail) => { results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }
const perm = (r) => r.error?.code === '42501'
const opt = { auth: { persistSession: false, autoRefreshToken: false } }
const svc = createClient(URL_, SERVICE, opt), anon = createClient(URL_, ANON, opt)
let uid
try {
  const email = `ec-seed-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'csat_ec seed smoke' } })
  if (error) throw new Error(error.message)
  uid = data.user.id
  const L = createClient(URL_, ANON, opt)
  const { error: se } = await L.auth.signInWithPassword({ email, password }); if (se) throw new Error(se.message)

  const tv = await L.from('csat_ec_taxonomy_version').select('version,status,definitions_hash,note').eq('version', V)
  record('learner', 'v0.1 버전 읽기 — sealed · 해시 · conditional 표기', !tv.error && tv.data[0]?.status === 'sealed' && tv.data[0]?.definitions_hash === HASH && /conditional/.test(tv.data[0]?.note) && !/TEST/.test(tv.data[0]?.note), tv.error?.message ?? tv.data)
  const codes = await L.from('csat_ec_code').select('code,status,student_group').eq('version', V)
  record('learner', '코드 19 · 모두 active', !codes.error && codes.data.length === 19 && codes.data.every((c) => c.status === 'active'), codes.error?.message ?? codes.data?.length)
  const g = Object.fromEntries((codes.data ?? []).filter((c) => c.code.startsWith('E.')).map((c) => [c.code, c.student_group]))
  record('learner', 'E 학생 범주 = 결정', g['E.evidence_location'] === 'evidence' && g['E.task_misread'] === 'choice' && g['E.option_mismatch'] === 'choice', g)
  const b = await L.from('csat_ec_boundary').select('boundary_key,code_a,code_b,status,probe_key').eq('version', V)
  record('learner', '경계 1 — r.inference__v.wrong_sense · provisional · r6_derivation_probe', !b.error && b.data.length === 1 && b.data[0].boundary_key === 'r.inference__v.wrong_sense'
    && b.data[0].status === 'provisional' && b.data[0].probe_key === 'r6_derivation_probe', b.error?.message ?? b.data)
  record('learner', '경계 수정 거부(PostgREST)', perm(await L.from('csat_ec_boundary').update({ status: 'accepted' }).eq('version', V)))
  record('learner', '코드 수정 거부(PostgREST)', perm(await L.from('csat_ec_code').update({ status: 'deprecated' }).eq('version', V)))
  record('anon', '코드 읽기 거부', perm(await anon.from('csat_ec_code').select('code').eq('version', V)))
  record('anon', '경계 읽기 거부', perm(await anon.from('csat_ec_boundary').select('boundary_key').eq('version', V)))
  const tx = await svc.rpc('csat_ec_ai_taxonomy', { p_version: V })
  record('AI', 'ai_taxonomy(service_role) — V/S/R/E 14 · 경계 1 · 해시', !tx.error && tx.data.codes.length === 14 && tx.data.boundaries.length === 1 && tx.data.definitions_hash === HASH, tx.error?.message)
  record('AI', 'service_role — 코드 표 직접 거부(RPC 로만)', perm(await svc.from('csat_ec_code').select('code').limit(1)))
  record('learner', 'ai_taxonomy — 학습자 거부', !!(await L.rpc('csat_ec_ai_taxonomy', { p_version: V })).error)
} catch (e) {
  record('실행', '예외', false, e.message)
} finally {
  if (uid) { const { error } = await svc.auth.admin.deleteUser(uid); record('정리', '테스트 계정 삭제', !error, error?.message) }
  const fail = results.filter((r) => !r.ok)
  fs.writeFileSync(path.join(DIR, 'results-seed.json'), JSON.stringify({ ranAt: '2026-10-05', pass: results.length - fail.length, fail: fail.length, results }, null, 2) + '\n')
  console.log(`\n합계 PASS ${results.length - fail.length} · FAIL ${fail.length}`)
  process.exitCode = fail.length ? 1 : 0
}
