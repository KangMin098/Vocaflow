// scripts/knowledge/release-approval-test.mjs
//
// B7 출시 승인 가드(_pending_20261008200000_knowledge_release_approval.sql) 격리 PostgreSQL 시험 — 공유 DB 에 쓰지 않는다.
//   하네스 = embedded-postgres + lib.mjs(startCluster · conn) + bootstrap.sql (g2-concurrency-test.mjs 와 같은 하네스).
//   node scripts/knowledge/release-approval-test.mjs --pg-dir <하네스 폴더>   (작업 트리의 마이그레이션 파일을 그대로 쓴다)
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const PG_DIR = arg('--pg-dir')
if (!PG_DIR) {
  console.error('--pg-dir <isolated-pg 하네스 폴더> 가 필요하다')
  process.exit(2)
}
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
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
  '20261008140000_knowledge_review_cascade_guard.sql',
  '20261008150000_knowledge_statement_review_fix.sql',
  '20261008160000_learning_sessions_integrated.sql',
  '20261008170000_knowledge_trial_evidence_guard.sql',
  '_pending_20261008200000_knowledge_release_approval.sql',
]

let fail = 0
const rec = (name, ok, detail = '') => {
  if (!ok) fail++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`)
}
/** 오류가 나야 하는 문장 — 메시지에 needle 이 있으면 통과 */
async function rejects(pool, name, sql, params, needle) {
  try {
    await pool.query(sql, params)
    rec(name, false, '거부되지 않았다')
  } catch (e) {
    rec(name, String(e.message).includes(needle), e.message)
  }
}

const cluster = await startCluster()
try {
  const admin = new pg.Client({ host: '127.0.0.1', port: Number(process.env.IPG_PORT ?? 54339), database: 'ec', user: 'supabase_admin', password: 'admin' })
  await admin.connect()
  await admin.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await admin.query(`create table if not exists public.funnel_events (id bigserial primary key, event text not null,
    constraint funnel_events_event_check check (event = any (array['screen_viewed']::text[])))`)
  await admin.query('alter role postgres set search_path = public, extensions')
  await admin.end()

  const pool = conn('postgres', 'postgres')
  for (const f of MIGRATIONS) await pool.query(fs.readFileSync(path.join(MIG, f), 'utf8'))
  rec(`마이그레이션 ${MIGRATIONS.length}개 적용`, true)

  // 채택 항목은 증거 사슬 가드를 거쳐야 만들어진다 — 이 시험의 대상은 적용 가드라, 항목만 트리거를 끄고 넣는다
  const su = new pg.Client({ host: '127.0.0.1', port: Number(process.env.IPG_PORT ?? 54339), database: 'ec', user: 'supabase_admin', password: 'admin' })
  await su.connect()
  await su.query('set session_replication_role = replica')
  const item = (await su.query(`insert into public.knowledge_items (layer, slug, title, statement, status, created_by, updated_by)
    values ('practice', 'b7-test', 'B7 시험', 'B7 시험 항목', 'adopted', 'test', 'test') returning id`)).rows[0].id
  await su.query('set session_replication_role = origin')
  await su.end()

  const app = (await pool.query(`insert into public.knowledge_applications (item_id, surface, surface_ref, created_by, updated_by)
    values ($1, 'csat_item_task', 'claim-support:2025-20', 'test', 'test') returning id`, [item])).rows[0].id
  await pool.query(`insert into public.knowledge_trials (application_id, design, created_by) values ($1, '{"min_n":30}', 'test')`, [app])

  const ON = `update public.knowledge_applications set status = 'active', released_at = now(), updated_by = 'test' where id = $1`
  await rejects(pool, 'B7-1 채택 + 검증 계획만으로는 켜지지 않는다', ON, [app], '출시 승인')

  await pool.query(`update public.knowledge_applications set release_approved_by = 'system:auto', release_approved_at = now(), release_note = '자동' where id = $1`, [app])
  await rejects(pool, 'B7-2 system:* 승인자는 받지 않는다', ON, [app], '출시 승인')

  await pool.query(`update public.knowledge_applications set release_approved_by = 'admin:kangmin', release_approved_at = now(), release_note = '  ' where id = $1`, [app])
  await rejects(pool, 'B7-3 빈 사유는 받지 않는다', ON, [app], '출시 승인')

  await pool.query(`update public.knowledge_applications set release_note = '주석 이중 맹검 · 노출 범위 검토 완료' where id = $1`, [app])
  await pool.query(ON, [app])
  rec('B7-4 사람 승인 + 사유가 있으면 켜진다', (await pool.query('select status from public.knowledge_applications where id = $1', [app])).rows[0].status === 'active')

  await rejects(pool, 'B7-5 켜져 있는 동안 승인 기록은 못 바꾼다',
    `update public.knowledge_applications set release_note = '바꿈' where id = $1`, [app], '바꿀 수 없다')

  await pool.query(`update public.knowledge_applications set status = 'paused', status_reason = '시험 중단', updated_by = 'test' where id = $1`, [app])
  const after = (await pool.query('select release_approved_by, release_approved_at, release_note from public.knowledge_applications where id = $1', [app])).rows[0]
  rec('B7-6 중단하면 승인이 지워진다', after.release_approved_by === null && after.release_approved_at === null && after.release_note === null, JSON.stringify(after))
  await rejects(pool, 'B7-7 중단 뒤 다시 켜려면 새 승인이 필요하다', ON, [app], '출시 승인')

  // 승인 → 켜기 → 적용 중 대상 바꾸기 시도
  const APPROVE = `update public.knowledge_applications set release_approved_by = 'admin:kangmin', release_approved_at = now(), release_note = '재승인' where id = $1`
  await pool.query(APPROVE, [app])
  await pool.query(ON, [app])
  await rejects(pool, 'B7-8 적용 중에는 과제 키(surface_ref)를 바꿀 수 없다',
    `update public.knowledge_applications set surface_ref = 'claim-support:2026-20' where id = $1`, [app], '대상')
  await rejects(pool, 'B7-9 적용 중에는 대상 조건(audience)을 바꿀 수 없다',
    `update public.knowledge_applications set audience = '{"item":"2026#20"}' where id = $1`, [app], '대상')

  // 꺼진 상태에서 승인 뒤 대상을 바꾸면 승인이 지워진다
  await pool.query(`update public.knowledge_applications set status = 'paused', status_reason = '대상 변경', updated_by = 'test' where id = $1`, [app])
  await pool.query(APPROVE, [app])
  await pool.query(`update public.knowledge_applications set surface_ref = 'claim-support:2026-20' where id = $1`, [app])
  const moved = (await pool.query('select release_approved_at from public.knowledge_applications where id = $1', [app])).rows[0]
  rec('B7-10 꺼진 상태에서 대상을 바꾸면 이전 승인이 지워진다', moved.release_approved_at === null)
  await rejects(pool, 'B7-11 대상 변경 뒤에는 새 승인 없이 못 켠다', ON, [app], '출시 승인')

  await pool.end()
} catch (e) {
  rec('예외', false, e.message)
} finally {
  await cluster.stop?.()
}
console.log(fail ? `실패 ${fail}` : '전부 통과')
process.exit(fail ? 1 : 0)
