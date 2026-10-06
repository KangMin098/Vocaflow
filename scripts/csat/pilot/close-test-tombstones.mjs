// scripts/csat/pilot/close-test-tombstones.mjs
//
// 테스트가 남긴 열린 묘비를 **설계된 관리자 종료 경로**(csat_ec_close_tombstone)로 닫는다 — 행은 지우지 않는다(append-only · 사유 기록).
// 2026-10-06 사용자 승인: id 1 · 2(smoke-detector — 2014A) · 4–8(E2E 1차 실행 — 2019 · 2020 · 2021 · 2018 · 2023).
// 임시 관리자 계정(@example.com)을 만들어 부르고 끝나면 지운다. 승인된 id 밖은 건드리지 않는다.
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/pilot/close-test-tombstones.mjs
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'
const req = createRequire(path.resolve('scripts/csat/error-evidence/dev-smoke/package.json'))
const { createClient } = req('@supabase/supabase-js')
const pg = req('pg')

const APPROVED = { 1: '2014A', 2: '2014A', 4: '2019', 5: '2020', 6: '2021', 7: '2018', 8: '2023' }
const REASON = 'TEST 정리 — 테스트 계정이 수집 중 삭제되며 생긴 묘비(smoke-detector · Pilot E2E 1차, 2026-10-06 사용자 승인)'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!URL_?.includes('jajenrevcbmrpaliomxv')) { console.error('개발 프로젝트가 아니다'); process.exit(2) }
const opt = { auth: { persistSession: false, autoRefreshToken: false } }
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, opt)
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
let adminId = null
let fail = 0
try {
  const rows = (await db.query(`select id, exam_id, closed_at from public.csat_ec_capture_tombstone where id = any($1::bigint[]) order by id`, [Object.keys(APPROVED).map(Number)])).rows
  for (const r of rows) if (APPROVED[r.id] !== r.exam_id) throw new Error(`묘비 ${r.id} 의 시험이 승인 목록과 다르다(${r.exam_id}) — 중단`)
  const email = `ec-tomb-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
  const cu = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'close test tombstones' } })
  if (cu.error) throw cu.error
  adminId = cu.data.user.id
  await db.query(`insert into public.user_profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin'`, [adminId])
  const adm = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opt)
  const si = await adm.auth.signInWithPassword({ email, password })
  if (si.error) throw si.error
  for (const r of rows) {
    if (r.closed_at) { console.log(`묘비 ${r.id} (${r.exam_id}) 이미 닫힘`); continue }
    const c = await adm.rpc('csat_ec_close_tombstone', { p_id: r.id, p_reason: REASON })
    if (c.error) { fail++; console.log(`FAIL 묘비 ${r.id} (${r.exam_id}) — ${c.error.message}`) } else console.log(`닫음 묘비 ${r.id} (${r.exam_id})`)
  }
  const exams = [...new Set(Object.values(APPROVED))]
  const { data: emb, error: ee } = await svc.rpc('csat_ec_embargoed_exams', { p_exams: exams })
  console.log(ee ? `보류 확인 실패 ${ee.message}` : `지금 보류인 시험: ${JSON.stringify(emb)}`)
  if (ee || (emb ?? []).length) fail++
} catch (e) { fail++; console.log('중단:', e.message) } finally {
  if (adminId) { const d = await svc.auth.admin.deleteUser(adminId); console.log(d.error ? `임시 관리자 삭제 실패 ${d.error.message}` : '임시 관리자 삭제') }
  await db.end()
  process.exitCode = fail ? 1 : 0
}
