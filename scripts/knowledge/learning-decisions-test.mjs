// scripts/knowledge/learning-decisions-test.mjs
//
// 학습 결정 기록 표(_pending_20261010120000_learning_decisions.sql) 격리 PostgreSQL 시험 — 공유 DB 에 쓰지 않는다.
//   node scripts/knowledge/learning-decisions-test.mjs --pg-dir <isolated-pg 하네스 폴더>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const PG_DIR = arg('--pg-dir')
if (!PG_DIR) {
  console.error('--pg-dir <isolated-pg 하네스 폴더> 가 필요하다')
  process.exit(2)
}
const { startCluster, conn, as } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default

const MIG = path.resolve('supabase/migrations')
const MIGRATIONS = [
  '20260919120000_methodology_intelligence.sql',
  '20260928120000_knowledge_registry.sql',
  '20260928130000_knowledge_evidence_invariants.sql',
  '20260928140000_knowledge_evidence_concurrency.sql',
  '20260928150000_knowledge_regrade_locks_items.sql',
  '20261001120000_knowledge_evidence_version.sql',
  '20261001130000_knowledge_evidence_observed.sql',
  '20261008120000_knowledge_vnext.sql',
  '20261010034932_learning_decisions.sql',
]
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'

let fail = 0
const rec = (name, ok, detail = '') => {
  if (!ok) fail++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`)
}

const cluster = await startCluster()
try {
  const admin = new pg.Client({ host: '127.0.0.1', port: Number(process.env.IPG_PORT ?? 54339), database: 'ec', user: 'supabase_admin', password: 'admin' })
  await admin.connect()
  await admin.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await admin.query('alter role postgres set search_path = public, extensions')
  await admin.query(`insert into auth.users (id, email) values ('${U1}', 'u1@test.invalid'), ('${U2}', 'u2@test.invalid') on conflict do nothing`)
  await admin.end()

  const pool = conn('postgres', 'postgres')
  for (const f of MIGRATIONS) await pool.query(fs.readFileSync(path.join(MIG, f), 'utf8'))
  rec(`마이그레이션 ${MIGRATIONS.length}개 적용`, true)

  const row = (uid, fp, extra = {}) => ({
    user_id: uid, step_key: 'structure', find_task_id: 'B6-3', policy_version: 'find-policy.v3', action: 'practice_method', focus: 'support',
    observation: JSON.stringify({ state: 'confirmed_need', items: ['2022#20', '2025#20'] }), reason: '확인된 요구', fingerprint: fp, synthetic: false, ...extra,
  })
  const ins = (r) => `insert into public.learning_decisions (${Object.keys(r).join(',')}) values (${Object.keys(r).map((_, i) => `$${i + 1}`).join(',')})`
  const SR = { role: 'service_role' }

  const r1 = row(U1, 'fp-0000000000000001')
  rec('서버(service_role) 기록', (await as(pool, SR, ins(r1), Object.values(r1))).ok)
  const dup = await as(pool, SR, ins(r1), Object.values(r1))
  rec('같은 학습자 · 같은 근거 결정은 한 번만(fingerprint)', !dup.ok && dup.code === '23505', dup.err)
  const r2 = row(U2, 'fp-0000000000000002')
  await as(pool, SR, ins(r2), Object.values(r2))

  const bad = row(U1, 'fp-0000000000000003', { action: 'teleport' })
  rec('알 수 없는 행동 거부', !(await as(pool, SR, ins(bad), Object.values(bad))).ok)
  const badFocus = row(U1, 'fp-0000000000000004', { focus: 'vocab' })
  rec('알 수 없는 초점 거부', !(await as(pool, SR, ins(badFocus), Object.values(badFocus))).ok)

  const mine = await as(pool, { role: 'authenticated', uid: U1 }, 'select user_id from public.learning_decisions')
  rec('학습자는 자기 행만 읽는다', mine.ok && mine.rows.length === 1 && mine.rows[0].user_id === U1, JSON.stringify(mine.rows ?? mine.err))
  const r3 = row(U1, 'fp-0000000000000005')
  const clientWrite = await as(pool, { role: 'authenticated', uid: U1 }, ins(r3), Object.values(r3))
  rec('학습자(클라이언트)는 결정을 써 넣지 못한다', !clientWrite.ok, clientWrite.err)
  const anon = await as(pool, { role: 'anon' }, 'select count(*) from public.learning_decisions')
  rec('익명은 읽지 못한다', !anon.ok, anon.err)

  await pool.end()
} catch (e) {
  rec('예외', false, e.message)
} finally {
  await cluster.stop?.()
}
console.log(fail ? `실패 ${fail}` : '전부 통과')
process.exit(fail ? 1 : 0)
