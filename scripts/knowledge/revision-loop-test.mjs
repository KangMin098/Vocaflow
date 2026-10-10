// scripts/knowledge/revision-loop-test.mjs
//
// 결과 → 원리 개선 환류 기능 검증(2026-10-10 · 완료 조건 5) — 격리 PostgreSQL 에서 **실제 마이그레이션 · 트리거**로 한 바퀴를 돈다.
//   공유 개발 DB 에는 쓰지 않는다(그쪽 한 바퀴는 사용자 승인 범위 밖).
//   신호(v1 결과) → 관리자 검토(항목 in_review → 적용 자동 중단) → 방법 · 과제 문장 개정(항목 버전 증가) → 재채택 →
//   새 적용 버전(v2 · 검증 계획 · 출시 승인) → 재평가(v2 수행) → 버전별 비교 · 결정 기록에 새 버전이 남는가.
//   효과 판정이 아니다 — 기능(상태 전이 · 버전 · 근거 보존 · 비교 가능)을 본다.
//   node scripts/knowledge/revision-loop-test.mjs --pg-dir <isolated-pg 하네스 폴더>
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
  '20261008144206_knowledge_release_approval.sql',
  '20261008150000_knowledge_statement_review_fix.sql',
  '20261008160000_learning_sessions_integrated.sql',
  '20261008170000_knowledge_trial_evidence_guard.sql',
  '20261008180000_learning_help_timing.sql',
  '20261010034932_learning_decisions.sql',
]
const USERS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']

let fail = 0
const rec = (name, ok, detail = '') => {
  if (!ok) fail++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`)
}

const cluster = await startCluster()
try {
  const admin = new pg.Client({ host: '127.0.0.1', port: Number(process.env.IPG_PORT ?? 54339), database: 'ec', user: 'supabase_admin', password: 'admin' })
  await admin.connect()
  await admin.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await admin.query(`create table if not exists public.funnel_events (id bigserial primary key, event text not null,
    constraint funnel_events_event_check check (event = any (array['screen_viewed']::text[])))`)
  await admin.query('alter role postgres set search_path = public, extensions')
  for (const u of USERS) await admin.query(`insert into auth.users (id, email) values ($1, $2) on conflict do nothing`, [u, `${u.slice(0, 4)}@test.invalid`])
  await admin.end()

  const pool = conn('postgres', 'postgres')
  for (const f of MIGRATIONS) await pool.query(fs.readFileSync(path.join(MIG, f), 'utf8'))
  rec(`마이그레이션 ${MIGRATIONS.length}개 적용`, true)

  // 채택된 사슬(원리 → 방법 → 과제) — 채택에 필요한 증거 사슬은 이 시험 대상이 아니라 트리거를 끄고 넣는다
  const su = new pg.Client({ host: '127.0.0.1', port: Number(process.env.IPG_PORT ?? 54339), database: 'ec', user: 'supabase_admin', password: 'admin' })
  await su.connect()
  await su.query('set session_replication_role = replica')
  const mk = async (layer, slug, statement) => (await su.query(
    `insert into public.knowledge_items (layer, slug, title, statement, status, created_by, updated_by) values ($1, $2, $2, $3, 'adopted', 'test', 'test') returning id`, [layer, slug, statement])).rows[0].id
  const P = await mk('principle', 'loop-principle', '주장과 근거 연결 원리')
  const M = await mk('method', 'loop-method', '주장 · 뒷받침 문장 표시하며 읽기 v1')
  const T = await mk('practice', 'loop-task', '주장 · 근거 고르기 과제 v1')
  await su.query(`insert into public.knowledge_links (from_id, to_id, kind, reason, created_by) values ($1, $2, 'implements', 't', 'test'), ($2, $3, 'implements', 't', 'test')`, [T, M, P])
  // 재채택에는 근거가 있어야 한다(DB 가드) — 실제 항목처럼 근거 한 건을 단다
  await su.query(`insert into public.knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by, evidence_level)
    values ($1, 'B', 'stated', 'external', 'https://nflrc.hawaii.edu/rfl/item/254', 'Jiang 2012 RFL 24(1)', 'test', 'quasi_experimental')`, [T])
  await su.query('set session_replication_role = origin')
  await su.end()

  const REF = 'claim-support:2022-20'
  const newApp = async (version) => {
    const id = (await pool.query(`insert into public.knowledge_applications (item_id, surface, surface_ref, version, audience, created_by, updated_by) values ($1, 'csat_item_task', $2, $3, '{"item":"2022#20"}', 'test', 'test') returning id`, [T, REF, version])).rows[0].id
    await pool.query(`insert into public.knowledge_trials (application_id, design, created_by) values ($1, '{"min_n":2}', 'test')`, [id])
    await pool.query(`update public.knowledge_applications set status = 'active', released_at = now(), release_approved_by = 'admin:test', release_approved_at = now(), release_note = $2, updated_by = 'admin:test' where id = $1`, [id, `v${version} 출시 승인`])
    return id
  }
  const attempt = async (app, user, correct, at) => pool.query(
    `insert into public.learning_task_attempts (user_id, task_key, application_id, item_ref, content_hash, phase, response, is_correct, answered_at, synthetic, help_level, activity)
     values ($1, 'claim-support', $2, '2022#20', 'h', 'practice', '{}', $3, $4, false, 'independent', 'theater')`, [user, app, correct, at])

  // v1 — 출시 · 수행 결과
  const A1 = await newApp(1)
  rec('v1 적용 출시(검증 계획 + 출시 승인)', (await pool.query('select status from public.knowledge_applications where id = $1', [A1])).rows[0].status === 'active')
  for (const [i, u] of USERS.entries()) await attempt(A1, u, i === 0, `2026-10-10T01:0${i}:00Z`)

  // 신호 → 관리자 검토: 과제를 「검토 중」으로 → 적용 자동 중단(학습자에게서 내려간다)
  await pool.query(`update public.knowledge_items set status = 'in_review', status_reason = '성과 검토 신호: 연습 첫 시도 정답률 25%', updated_by = 'admin:test' where id = $1`, [T])
  const a1 = (await pool.query('select status, status_reason, release_approved_at from public.knowledge_applications where id = $1', [A1])).rows[0]
  rec('검토 시작 → v1 적용 자동 중단 · 출시 승인 삭제', a1.status === 'paused' && /자동 중단/.test(a1.status_reason) && a1.release_approved_at === null, JSON.stringify(a1))

  // 방법 · 과제 개정 → 버전 증가
  const before = (await pool.query('select version from public.knowledge_items where id = $1', [T])).rows[0].version
  await pool.query(`update public.knowledge_items set statement = '주장 · 근거 고르기 과제 v2 — 근거는 문장마다 예 · 아니오로 모두 판단', updated_by = 'admin:test' where id = $1`, [T])
  const after = (await pool.query('select version from public.knowledge_items where id = $1', [T])).rows[0].version
  rec('과제 문장 개정 → 항목 버전 증가', after === before + 1, `${before} → ${after}`)
  const hist = (await pool.query(`select to_status, reason from public.knowledge_reviews where item_id = $1 order by at`, [T])).rows
  rec('검토 이력에 신호 사유가 남는다', hist.some((h) => h.to_status === 'in_review' && /성과 검토 신호/.test(h.reason ?? '')), JSON.stringify(hist.map((h) => h.to_status)))

  // 재채택 → 새 적용 버전 출시(옛 버전은 다시 켜지 않는다)
  await pool.query(`update public.knowledge_items set status = 'adopted', status_reason = '개정 후 재채택', updated_by = 'admin:test' where id = $1`, [T])
  const A2 = await newApp(2)
  const apps = (await pool.query(`select version, status from public.knowledge_applications where surface_ref = $1 order by version`, [REF])).rows
  rec('v2 출시 · v1 은 중단으로 보존(비교 기준)', apps.length === 2 && apps[0].status === 'paused' && apps[1].status === 'active', JSON.stringify(apps))
  const reOn = await pool.query(`update public.knowledge_applications set status = 'active', released_at = now(), updated_by = 'x' where id = $1`, [A1]).then(() => true, () => false)
  rec('옛 버전을 새 출시 승인 없이 다시 켤 수 없다', !reOn)

  // 재평가 — v2 수행
  for (const [i, u] of USERS.entries()) await attempt(A2, u, i < 3, `2026-10-10T02:0${i}:00Z`)
  const cmp = (await pool.query(`
    select a.version, count(*) filter (where f.is_correct) right_n, count(*) n
      from public.learning_task_attempts t
      join public.knowledge_applications a on a.id = t.application_id
      left join public.learning_first_attempts f on f.attempt_id = t.id
     where a.surface_ref = $1
     group by a.version order by a.version`, [REF])).rows
  rec('버전별 결과 분리 집계(같은 과제 · 다른 적용 버전)', cmp.length === 2 && Number(cmp[0].n) === 4 && Number(cmp[1].n) === 4, JSON.stringify(cmp))

  // 결정 기록이 개정된 버전을 근거로 남기는가
  await pool.query(`insert into public.learning_decisions (user_id, step_key, find_task_id, policy_version, action, focus, observation, reason, principle_id, principle_version, method_id, method_version, task_id, task_version, application_id, application_version, fingerprint)
    values ($1, 'structure', 'B6-3', 'find-policy.v3', 'practice_method', 'support', '{}', '개정 후 처방', $2, 1, $3, 1, $4, $5, $6, 2, 'fp-loop-000000000001')`, [USERS[0], P, M, T, after, A2])
  const dec = (await pool.query(`select task_version, application_version from public.learning_decisions where fingerprint = 'fp-loop-000000000001'`)).rows[0]
  rec('결정 기록에 개정 버전(과제 · 적용) 이 남는다', dec.task_version === after && dec.application_version === 2, JSON.stringify(dec))

  await pool.end()
} catch (e) {
  rec('예외', false, e.message)
} finally {
  await cluster.stop?.()
}
console.log(fail ? `실패 ${fail}` : '전부 통과')
process.exit(fail ? 1 : 0)
