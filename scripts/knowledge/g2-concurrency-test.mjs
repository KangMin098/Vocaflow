// scripts/knowledge/g2-concurrency-test.mjs
//
// G2 통합 SQL(20261008160000_learning_sessions_integrated)의 **요청 멱등 · 두 세션 동시성**을 격리 PostgreSQL 에서 시험한다.
// 공유 개발 DB 를 쓰지 않는다. 마이그레이션은 정본 브랜치의 **커밋된 파일**을 git show 로 읽는다(개발 DB 에 적용된 것과 sha256 동일 — 2026-10-08 대조).
//
// 실행: node scripts/knowledge/g2-concurrency-test.mjs --pg-dir <isolated-pg 하네스 폴더> [--ref origin/feat/methodology-vnext]
//   하네스 = embedded-postgres + lib.mjs(startCluster · conn · openTx) + bootstrap.sql(Supabase 역할·auth 재현).
//   정본 쪽 vnext-schema-test.mjs 와 같은 하네스다. 데이터 폴더는 하네스 폴더 안에 생기므로 남의 워크트리를 가리키지 않는다.
//
// 시험(전부 service_role · RPC learning_attempt_record):
//   C1 같은 client_mutation_id 를 두 연결이 동시에 → 뒤쪽은 앞쪽 커밋까지 기다리고 duplicate · 행 1
//   C2 같은 id · 다른 내용 동시에 → 뒤쪽 conflict · 행 1 · 앞쪽 내용 보존
//   C3 앞쪽이 롤백하면 → 뒤쪽이 inserted(유령 원장 없음) · 행 1
//   C4 다른 id 두 개 동시에 → 서로 기다리지 않고 둘 다 inserted
//   C5 순차 재전송(같은 내용) → duplicate · 같은 attempt_id
//   C6 판단 시각을 빼고 재전송 → 첫 요청과 내용이 다르면 conflict(서버 now() 로 멱등이 깨지지 않음)
//   C7 첫 시도 뷰 — 같은 학습자 · 과제 · 문항 · 단계의 서로 다른 제출 둘 중 판단 시각이 이른 것 하나
//   C8 권한 — authenticated 는 RPC 실행 불가 · 자기 시도만 SELECT
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const PG_DIR = arg('--pg-dir')
if (!PG_DIR) {
  console.error('--pg-dir <isolated-pg 하네스 폴더> 가 필요하다')
  process.exit(2)
}
const REF = arg('--ref', 'origin/feat/methodology-vnext')
const { startCluster, conn, openTx, as, sleep } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default

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
]
const show = (f) => execFileSync('git', ['show', `${REF}:supabase/migrations/${f}`], { encoding: 'utf8', maxBuffer: 64 << 20 })

let fail = 0
const rec = (name, ok, detail = '') => {
  if (!ok) fail++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 260) : ''}`)
}

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** RPC 호출 — 인자 순서는 마이그레이션 시그니처 그대로 */
const RECORD = `select * from public.learning_attempt_record($1::uuid, $2::uuid, null::uuid, $3::text, 'practice', 'practice', 'independent',
  $4::text, 'h1', $5::jsonb, $6::boolean, 30, false, null::uuid, null::uuid, $7::timestamptz)`
const args = (user, mutation, item, response, correct, at) => [user, mutation, 'claim-support', item, JSON.stringify(response), correct, at]

/** 쿼리가 ms 안에 끝나는지 — 끝나지 않으면 「기다리는 중」 */
async function settlesWithin(promise, ms) {
  let done = false
  promise.then(() => (done = true), () => (done = true))
  await sleep(ms)
  return done
}

const cluster = await startCluster()
try {
  const admin = new pg.Client({ host: '127.0.0.1', port: Number(process.env.IPG_PORT ?? 54339), database: 'ec', user: 'supabase_admin', password: 'admin' })
  await admin.connect()
  await admin.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  // 공유 DB 에는 있고 하네스에는 없는 표 — 160000 이 CHECK 를 다시 정의한다(빈 표, 기존 제약 이름 그대로)
  //   하네스 bootstrap 이 이미 만들었으면 그대로 쓴다
  await admin.query(`create table if not exists public.funnel_events (id bigserial primary key, event text not null,
    constraint funnel_events_event_check check (event = any (array['screen_viewed']::text[])))`)
  await admin.query('alter role postgres set search_path = public, extensions')
  await admin.query(`insert into auth.users (id, email) values ('${U1}', 'u1@test.invalid'), ('${U2}', 'u2@test.invalid')`)
  await admin.end()

  const pool = conn('postgres', 'postgres')
  for (const f of MIGRATIONS) {
    const c = await pool.connect()
    try {
      await c.query(show(f))
    } catch (e) {
      rec(`마이그레이션 ${f}`, false, e.message)
      throw e
    } finally {
      c.release()
    }
  }
  rec(`마이그레이션 ${MIGRATIONS.length}개 적용(${REF})`, true)

  const SR = { role: 'service_role' }
  const rows = async (user, mutation) =>
    (await pool.query('select count(*)::int n from learning_task_attempts where user_id = $1 and client_mutation_id = $2', [user, mutation])).rows[0].n

  // C1 같은 id 동시 — 뒤쪽은 기다렸다가 duplicate
  {
    const m = uuid(1)
    const A = await openTx(pool, SR)
    const B = await openTx(pool, SR)
    const a = await A.q(RECORD, args(U1, m, '2022#20', { claim: 3 }, true, '2026-10-08T10:00:00Z'))
    const bP = B.try(RECORD, args(U1, m, '2022#20', { claim: 3 }, true, '2026-10-08T10:00:00Z'))
    const waited = !(await settlesWithin(bP, 800))
    await A.commit()
    const b = await bP
    await B.commit()
    rec('C1 같은 id 동시 — 뒤쪽이 앞쪽 커밋을 기다림', waited)
    rec('C1 앞 inserted · 뒤 duplicate · 같은 attempt_id · 행 1',
      a.rows[0].outcome === 'inserted' && b.ok && b.rows[0].outcome === 'duplicate' && String(b.rows[0].attempt_id) === String(a.rows[0].attempt_id) && (await rows(U1, m)) === 1,
      { a: a.rows[0], b: b.rows?.[0] ?? b.err })
  }

  // C2 같은 id · 다른 내용 동시 — 뒤쪽 conflict, 앞쪽 내용 보존
  {
    const m = uuid(2)
    const A = await openTx(pool, SR)
    const B = await openTx(pool, SR)
    await A.q(RECORD, args(U1, m, '2022#20', { claim: 3 }, true, '2026-10-08T10:01:00Z'))
    const bP = B.try(RECORD, args(U1, m, '2022#20', { claim: 5 }, false, '2026-10-08T10:01:00Z'))
    await sleep(300)
    await A.commit()
    const b = await bP
    await B.commit()
    const kept = (await pool.query('select response->>\'claim\' c, is_correct from learning_task_attempts where user_id=$1 and client_mutation_id=$2', [U1, m])).rows
    rec('C2 같은 id · 다른 내용 → conflict · 앞쪽 내용 보존 · 행 1', b.ok && b.rows[0].outcome === 'conflict' && kept.length === 1 && kept[0].c === '3' && kept[0].is_correct === true, { b: b.rows?.[0] ?? b.err, kept })
  }

  // C3 앞쪽 롤백 — 뒤쪽이 새로 넣는다(원장에 유령 행이 남지 않는다)
  {
    const m = uuid(3)
    const A = await openTx(pool, SR)
    const B = await openTx(pool, SR)
    await A.q(RECORD, args(U1, m, '2022#21', { claim: 1 }, true, '2026-10-08T10:02:00Z'))
    const bP = B.try(RECORD, args(U1, m, '2022#21', { claim: 1 }, true, '2026-10-08T10:02:00Z'))
    await sleep(300)
    await A.rollback()
    const b = await bP
    await B.commit()
    const ledger = (await pool.query('select count(*)::int n from learning_mutations where user_id=$1 and client_mutation_id=$2', [U1, m])).rows[0].n
    rec('C3 앞쪽 롤백 → 뒤쪽 inserted · 시도 1 · 원장 1', b.ok && b.rows[0].outcome === 'inserted' && (await rows(U1, m)) === 1 && ledger === 1, { b: b.rows?.[0] ?? b.err, ledger })
  }

  // C4 다른 id 동시 — 서로 막지 않는다
  {
    const A = await openTx(pool, SR)
    const B = await openTx(pool, SR)
    await A.q(RECORD, args(U1, uuid(4), '2022#22', { claim: 2 }, true, '2026-10-08T10:03:00Z'))
    const bP = B.try(RECORD, args(U1, uuid(5), '2022#22', { claim: 2 }, true, '2026-10-08T10:03:01Z'))
    const free = await settlesWithin(bP, 800)
    await A.commit()
    const b = await bP
    await B.commit()
    rec('C4 다른 id 동시 — 기다리지 않고 둘 다 inserted', free && b.ok && b.rows[0].outcome === 'inserted' && (await rows(U1, uuid(4))) === 1 && (await rows(U1, uuid(5))) === 1, b.rows?.[0] ?? b.err)
  }

  // C5 순차 재전송
  {
    const m = uuid(6)
    const a = await as(pool, SR, RECORD, args(U1, m, '2022#23', { claim: 4 }, false, '2026-10-08T10:04:00Z'))
    const b = await as(pool, SR, RECORD, args(U1, m, '2022#23', { claim: 4 }, false, '2026-10-08T10:04:00Z'))
    rec('C5 순차 재전송 → duplicate · 같은 attempt_id', a.ok && b.ok && b.rows[0].outcome === 'duplicate' && String(a.rows[0].attempt_id) === String(b.rows[0].attempt_id), { a: a.rows?.[0] ?? a.err, b: b.rows?.[0] ?? b.err })
  }

  // C6 판단 시각을 빼고 재전송 — 서버 시각으로 채우지 않고 원문 비교라 conflict(멱등을 조용히 깨지 않는다)
  {
    const m = uuid(7)
    await as(pool, SR, RECORD, args(U1, m, '2022#24', { claim: 4 }, true, '2026-10-08T10:05:00Z'))
    const b = await as(pool, SR, RECORD, args(U1, m, '2022#24', { claim: 4 }, true, null))
    rec('C6 판단 시각 누락 재전송 → conflict(행 1)', b.ok && b.rows[0].outcome === 'conflict' && (await rows(U1, m)) === 1, b.rows?.[0] ?? b.err)
  }

  // C7 첫 시도 뷰 — 늦게 도착한 이른 판단이 첫 시도
  {
    await as(pool, SR, RECORD, args(U2, uuid(8), '2022#30', { claim: 1 }, false, '2026-10-08T11:00:00Z'))
    await as(pool, SR, RECORD, args(U2, uuid(9), '2022#30', { claim: 3 }, true, '2026-10-08T10:59:00Z')) // 나중에 도착 · 더 이른 판단
    const v = (await pool.query(`select is_correct, answered_at from learning_first_attempts where user_id=$1 and item_ref='2022#30' and phase='practice'`, [U2])).rows
    rec('C7 첫 시도 뷰 — 문항·단계당 1행 · 판단 시각이 이른 제출', v.length === 1 && v[0].is_correct === true, v)
  }

  // C8 권한
  {
    const exec = await as(pool, { role: 'authenticated', uid: U1 }, RECORD, args(U1, uuid(10), '2022#31', {}, true, '2026-10-08T12:00:00Z'))
    rec('C8 authenticated 는 RPC 실행 불가', !exec.ok, exec.err)
    const own = await as(pool, { role: 'authenticated', uid: U1 }, 'select distinct user_id from learning_task_attempts')
    rec('C8 authenticated 는 자기 시도만 SELECT', own.ok && own.rows.length === 1 && own.rows[0].user_id === U1, own.rows ?? own.err)
    const ledger = await as(pool, { role: 'authenticated', uid: U1 }, 'select count(*) from learning_mutations')
    rec('C8 authenticated 는 멱등 원장을 못 읽음', !ledger.ok, ledger.err)
  }

  await pool.end()
} finally {
  await cluster.stop()
}
console.log(fail ? `\n${fail} 실패` : '\n전부 통과')
process.exit(fail ? 1 : 0)
