// scripts/knowledge/real-db-concurrency.mjs
//
// 실제 개발 DB 에서 G2 기록 RPC(learning_attempt_record)의 멱등 · 동시성을 재검증하고, **이번 실행이 만든 행만** 정리한다.
// 승인 범위(2026-10-08 사용자 조건부 승인 · docs/methodology/VNEXT_REAL_DB_E2E_PLAN.md §3):
//   계정 = 기존 E2E 테스트 계정 1개 · 쓰기 표 = learning_sessions ≤60 · learning_task_attempts ≤120 · learning_mutations ≤200
//   전부 synthetic · 다른 표 쓰기 금지 · 실행별 test_run_id + 생성 PK 기록 · 정리는 기록된 PK 만(계정 전체 삭제 금지)
//   성공·실패와 무관하게 정리 · 실패 시 남은 PK 보고(광범위 DELETE 금지)
//
// 실행(착수 조건 충족 뒤에만):
//   node --tls-max-v1.2 --env-file=<.env.local> scripts/knowledge/real-db-concurrency.mjs \
//        --integration-worktree D:/workspace/Vocaflow-g2-int --target-sha <첫 시도 키 수정이 들어간 커밋> \n//        --deployed-evidence <적용 이력 증거 JSON> --commit
//   증거 JSON = { "checkedAt": ISO, "migrations": { "<버전>_<이름>.sql": "<schema_migrations.statements 의 UTF-8 sha256>" } } —
//   DB 관리 도구(execute_sql)로 실행 직전에 뽑는다. 통합 HEAD 의 같은 파일 sha256 과 하나라도 다르면 쓰지 않는다(로컬 커밋 ≠ 설치된 SQL).
//   --commit 이 없으면 사전 점검만 하고 아무것도 쓰지 않는다.
//   --cleanup <매니페스트 경로>  : 이전 실행이 남긴 PK 만 다시 정리한다(정리 재시도).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const arg = (k, d = null) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const COMMIT = process.argv.includes('--commit')
const CLEANUP_ONLY = arg('--cleanup')
const RUN_DIR = path.resolve('scripts/knowledge/runs')

// 승인 상한 — 넘기는 계획은 시작 전에 거부한다
export const CAPS = { sessions: 60, attempts: 120, mutations: 200 }
const TABLES = ['learning_task_attempts', 'learning_sessions', 'learning_mutations']

function fail(msg) {
  console.error(`중단: ${msg}`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) fail('NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 없다(--env-file 로 .env.local 을 넘긴다)')
if (!url.includes('jajenrevcbmrpaliomxv')) fail('개발 DB(jajenrevcbmrpaliomxv)가 아니다 — 승인 대상 DB 만 쓴다')
const db = createClient(url, key, { auth: { persistSession: false } })

/** 테스트 계정 — 픽스처의 이메일로 찾는다(새 계정을 만들지 않는다) */
async function testUserId() {
  const src = fs.readFileSync(path.resolve('apps/web/tests/e2e/fixtures/test-user.ts'), 'utf8')
  const email = src.match(/email:\s*[^'"`]*['"`]([^'"`]+@[^'"`]+)['"`]/)?.[1]
  if (!email) fail('테스트 계정 이메일을 픽스처에서 찾지 못했다')
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`사용자 조회 실패: ${error.message}`)
    const hit = data.users.find((u) => u.email === email)
    if (hit) return { id: hit.id, email }
    if (data.users.length < 200) break
  }
  fail(`테스트 계정(${email})이 없다 — 새로 만들지 않는다`)
}

async function counts(userId) {
  const out = {}
  for (const t of TABLES) {
    const all = await db.from(t).select('*', { count: 'exact', head: true })
    const mine = await db.from(t).select('*', { count: 'exact', head: true }).eq('user_id', userId)
    // 쓰기 단계 안에서도 불리므로 프로세스를 끝내지 않고 던진다 — finally 의 정리가 반드시 돈다
    if (all.error || all.count === null || mine.error || mine.count === null) throw new Error(`${t} 행 수를 셀 수 없다(0 으로 삼키지 않는다)`)
    out[t] = { all: all.count, testUser: mine.count }
  }
  return out
}

function lockFree(worktree) {
  const out = execFileSync('node', ['agents/scripts/lock.mjs', 'status'], { cwd: worktree, encoding: 'utf8' })
  return /잠금 없음/.test(out)
}

function save(m) {
  fs.mkdirSync(RUN_DIR, { recursive: true })
  fs.writeFileSync(path.join(RUN_DIR, `${m.testRunId}.json`), JSON.stringify(m, null, 2))
}

/**
 * 정리 — 매니페스트에 적힌 PK 만. 지우기 전에 각 행이 (테스트 계정 · synthetic · 실행 시작 이후)인지 다시 확인하고,
 * 하나라도 아니면 그 행은 건드리지 않고 보고한다. 순서: 시도 → 세션 → 원장(FK).
 */
/**
 * 응답을 잃은 RPC 의 시도 복구 — DB 가 커밋했는데 응답이 끊기면 attempt_id 가 매니페스트에 없다.
 * 기록해 둔 mutation id 로 실제 시도를 찾아 합친다. 조회가 실패하면 미해결로 남긴다(조용히 넘기지 않는다).
 */
export async function recoverAttempts(m) {
  if (!m.created.mutations.length) return { recovered: 0, unresolved: [] }
  const { data, error } = await db.from('learning_task_attempts').select('id').eq('user_id', m.userId).in('client_mutation_id', m.created.mutations)
  if (error) return { recovered: 0, unresolved: [...m.created.mutations] }
  let n = 0
  for (const r of data) {
    if (!m.created.attempts.includes(Number(r.id))) {
      m.created.attempts.push(Number(r.id))
      n++
    }
  }
  return { recovered: n, unresolved: [] }
}

export async function cleanup(m) {
  const recovery = await recoverAttempts(m)
  m.recovery = [...(m.recovery ?? []), { at: new Date().toISOString(), ...recovery }]
  save(m)
  const left = { attempts: [], sessions: [], mutations: [] }
  const refused = []
  // 복구 조회가 실패한 mutation 의 원장은 지우지 않는다 — 시도가 남아 있을 수 있어 원장을 먼저 지우면 다시 못 찾는다
  const unresolved = new Set(recovery.unresolved)
  // 정리는 확인 조회가 실패해도 프로세스를 끝내지 않는다 — 실패한 단계의 PK 는 left/unresolved 로 남기고, 독립적으로 안전한 단계는 계속한다.
  const errors = []
  if (m.created.attempts.length) {
    const { data, error } = await db.from('learning_task_attempts').select('id,user_id,synthetic,answered_at').in('id', m.created.attempts)
    if (error) {
      errors.push(`시도 확인 실패: ${error.message}`)
      left.attempts.push(...m.created.attempts)
      // 시도를 확인·삭제하지 못했으면 그 원장도 지우지 않는다(다음 --cleanup 이 mutation id 로 시도를 다시 찾게)
      for (const x of m.created.mutations) unresolved.add(x)
    } else {
      const ok = data.filter((r) => r.user_id === m.userId && r.synthetic === true).map((r) => r.id)
      refused.push(...data.filter((r) => !ok.includes(r.id)).map((r) => ({ table: 'learning_task_attempts', id: r.id })))
      if (ok.length) {
        const del = await db.from('learning_task_attempts').delete().in('id', ok).eq('user_id', m.userId).select('id')
        if (del.error) {
          errors.push(`시도 삭제 실패: ${del.error.message}`)
          left.attempts.push(...ok)
          for (const x of m.created.mutations) unresolved.add(x)
        }
      }
    }
  }
  if (m.created.sessions.length) {
    const { data, error } = await db.from('learning_sessions').select('id,user_id,synthetic').in('id', m.created.sessions)
    if (error) {
      errors.push(`세션 확인 실패: ${error.message}`)
      left.sessions.push(...m.created.sessions)
    } else {
      const ok = data.filter((r) => r.user_id === m.userId && r.synthetic === true).map((r) => r.id)
      refused.push(...data.filter((r) => !ok.includes(r.id)).map((r) => ({ table: 'learning_sessions', id: r.id })))
      if (ok.length) {
        const del = await db.from('learning_sessions').delete().in('id', ok).eq('user_id', m.userId).select('id')
        if (del.error) {
          errors.push(`세션 삭제 실패: ${del.error.message}`)
          left.sessions.push(...ok)
        }
      }
    }
  }
  if (m.created.mutations.length) {
    const { data, error } = await db.from('learning_mutations').select('client_mutation_id,user_id,created_at').eq('user_id', m.userId).in('client_mutation_id', m.created.mutations)
    if (error) {
      errors.push(`원장 확인 실패: ${error.message}`)
      left.mutations.push(...m.created.mutations)
    } else {
      const ok = data.filter((r) => Date.parse(r.created_at) >= Date.parse(m.startedAt) && !unresolved.has(r.client_mutation_id)).map((r) => r.client_mutation_id)
      refused.push(...data.filter((r) => !ok.includes(r.client_mutation_id) && !unresolved.has(r.client_mutation_id)).map((r) => ({ table: 'learning_mutations', id: r.client_mutation_id })))
      if (ok.length) {
        const del = await db.from('learning_mutations').delete().eq('user_id', m.userId).in('client_mutation_id', ok).select('client_mutation_id')
        if (del.error) {
          errors.push(`원장 삭제 실패: ${del.error.message}`)
          left.mutations.push(...ok)
        }
      }
    }
  }
  // 남았는지 다시 센다(지운 것이 실제로 사라졌는가)
  const still = {
    attempts: m.created.attempts.length ? (await db.from('learning_task_attempts').select('id').in('id', m.created.attempts)).data?.map((r) => r.id) ?? ['조회 실패'] : [],
    sessions: m.created.sessions.length ? (await db.from('learning_sessions').select('id').in('id', m.created.sessions)).data?.map((r) => r.id) ?? ['조회 실패'] : [],
    mutations: m.created.mutations.length
      ? (await db.from('learning_mutations').select('client_mutation_id').eq('user_id', m.userId).in('client_mutation_id', m.created.mutations)).data?.map((r) => r.client_mutation_id) ?? ['조회 실패']
      : [],
  }
  return { left, refused, still, unresolved: [...unresolved], errors }
}

const RPC = (userId, mutation, item, response, correct, answeredAt) =>
  db.rpc('learning_attempt_record', {
    p_user: userId,
    p_mutation: mutation,
    p_session_id: null,
    p_task_key: 'claim-support',
    p_activity: 'practice',
    p_phase: 'practice',
    p_help_level: 'independent',
    p_item_ref: item,
    p_content_hash: 'vnext-real-db-concurrency',
    p_response: response,
    p_is_correct: correct,
    p_sec: 30,
    p_synthetic: true,
    p_application_id: null,
    p_trial_id: null,
    p_answered_at: answeredAt,
  })

async function main() {
  const user = await testUserId()

  if (CLEANUP_ONLY) {
    const m = JSON.parse(fs.readFileSync(CLEANUP_ONLY, 'utf8'))
    if (m.userId !== user.id) fail('매니페스트 계정이 테스트 계정과 다르다')
    const r = await cleanup(m)
    m.cleanupRetries = [...(m.cleanupRetries ?? []), { at: new Date().toISOString(), ...r }]
    save(m)
    console.log(JSON.stringify(r, null, 2))
    if ([...r.still.attempts, ...r.still.sessions, ...r.still.mutations].length + r.unresolved.length + r.errors.length > 0) process.exitCode = 1
    return
  }

  const integ = arg('--integration-worktree')
  const sha = arg('--target-sha')
  if (!integ || !sha) fail('--integration-worktree 와 --target-sha(첫 시도 키 수정 커밋)가 필요하다')
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: integ, encoding: 'utf8' }).trim()
  // 통합 워크트리의 **현재 HEAD** 가 그 커밋을 조상으로 갖는가(다른 브랜치가 갖고 있는 것은 소용없다)
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: integ, stdio: 'ignore' })
  } catch {
    fail(`통합 워크트리 HEAD(${head})가 ${sha} 를 조상으로 갖지 않는다`)
  }
  // 설치된 SQL — 증거 JSON 의 sha256 이 통합 HEAD 의 같은 마이그레이션 파일과 같아야 한다
  const evPath = arg('--deployed-evidence')
  if (!evPath) fail('--deployed-evidence(적용 이력 sha256 증거)가 필요하다 — 로컬 커밋만으로 DB 상태를 가정하지 않는다')
  const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'))
  if (!ev.checkedAt || Date.now() - Date.parse(ev.checkedAt) > 60 * 60 * 1000) fail('증거가 1시간보다 오래됐다 — 실행 직전에 다시 뽑는다')
  const needed = Object.keys(ev.migrations ?? {})
  if (!needed.some((f) => f.startsWith('20261008160000'))) fail('증거에 통합 SQL(20261008160000)이 없다')
  for (const f of needed) {
    const body = execFileSync('git', ['show', `HEAD:supabase/migrations/${f}`], { cwd: integ, maxBuffer: 64 << 20 })
    const h = crypto.createHash('sha256').update(body).digest('hex')
    if (h !== ev.migrations[f]) fail(`설치된 ${f}(${String(ev.migrations[f]).slice(0, 12)}…)와 통합 HEAD 파일(${h.slice(0, 12)}…)이 다르다`)
  }
  // 실제 DB 에 RPC · 첫 시도 뷰가 있는가(쓰지 않는 조회)
  const probe = await db.from('learning_first_attempts').select('attempt_id', { head: true, count: 'exact' }).limit(1)
  if (probe.error) fail(`첫 시도 뷰를 읽을 수 없다: ${probe.error.message}`)
  if (!lockFree(integ)) fail('통합 세션의 DB 쓰기 잠금이 잡혀 있다 — 착수 조건 ② 미충족')

  // 계획 — 상한 안인지 먼저 본다(세션 0 · 시도 최대 4 · 원장 최대 4)
  const plan = { sessions: 0, attempts: 4, mutations: 4 }
  for (const k of Object.keys(CAPS)) if (plan[k] > CAPS[k]) fail(`계획(${k} ${plan[k]})이 승인 상한(${CAPS[k]})을 넘는다`)

  const before = await counts(user.id)
  console.log('사전 행 수', JSON.stringify(before))
  if (!COMMIT) {
    console.log('사전 점검 통과 — --commit 이 없어 쓰지 않는다')
    return
  }

  const m = {
    testRunId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    userId: user.id,
    integrationHead: head,
    approval: 'docs/methodology/VNEXT_REAL_DB_E2E_PLAN.md §3 (2026-10-08 조건부 승인)',
    before,
    created: { sessions: [], attempts: [], mutations: [] },
    results: [],
  }
  save(m) // 쓰기 전에 매니페스트부터 남긴다(중간에 죽어도 정리 대상이 남는다)
  const track = (mutation, res) => {
    if (!m.created.mutations.includes(mutation)) m.created.mutations.push(mutation)
    for (const row of res.data ?? []) if (row.attempt_id && !m.created.attempts.includes(Number(row.attempt_id))) m.created.attempts.push(Number(row.attempt_id))
    save(m)
  }
  const rec = (name, pass, detail) => {
    m.results.push({ name, pass, detail })
    save(m)
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} — ${JSON.stringify(detail).slice(0, 220)}`)
  }

  try {
    // R1 같은 id 동시 두 번
    const m1 = crypto.randomUUID()
    m.created.mutations.push(m1)
    save(m)
    const [a, b] = await Promise.all([
      RPC(user.id, m1, '2022#20', { claim: 3, testRunId: m.testRunId }, true, '2026-10-08T10:00:00Z'),
      RPC(user.id, m1, '2022#20', { claim: 3, testRunId: m.testRunId }, true, '2026-10-08T10:00:00Z'),
    ])
    track(m1, a)
    track(m1, b)
    const outs = [a.data?.[0]?.outcome, b.data?.[0]?.outcome].sort()
    rec('R1 같은 id 동시 — inserted 1 · duplicate 1 · 같은 attempt_id', !a.error && !b.error && outs[0] === 'duplicate' && outs[1] === 'inserted' && a.data[0].attempt_id === b.data[0].attempt_id, { a: a.data ?? a.error, b: b.data ?? b.error })

    // R2 같은 id · 다른 내용
    const r2 = await RPC(user.id, m1, '2022#20', { claim: 5, testRunId: m.testRunId }, false, '2026-10-08T10:00:00Z')
    track(m1, r2)
    rec('R2 같은 id · 다른 내용 — conflict', !r2.error && r2.data?.[0]?.outcome === 'conflict', r2.data ?? r2.error)

    // R3 다른 id 둘 동시
    const m2 = crypto.randomUUID()
    const m3 = crypto.randomUUID()
    m.created.mutations.push(m2, m3)
    save(m)
    const [c, d] = await Promise.all([
      RPC(user.id, m2, '2022#20', { claim: 3, testRunId: m.testRunId }, true, '2026-10-08T10:01:00Z'),
      RPC(user.id, m3, '2022#20', { claim: 4, testRunId: m.testRunId }, false, '2026-10-08T10:00:30Z'),
    ])
    track(m2, c)
    track(m3, d)
    rec('R3 다른 id 동시 — 둘 다 inserted', c.data?.[0]?.outcome === 'inserted' && d.data?.[0]?.outcome === 'inserted', { c: c.data ?? c.error, d: d.data ?? d.error })

    // R4 첫 시도 뷰 — 이 계정 · 문항 · 단계에서 판단 시각이 가장 이른 것(10:00:00 의 m1)
    const fa = await db.from('learning_first_attempts').select('attempt_id,answered_at,synthetic').eq('user_id', user.id).eq('item_ref', '2022#20').eq('phase', 'practice').eq('task_key', 'claim-support')
    const firstOk = !fa.error && fa.data.length === 1 && Date.parse(fa.data[0].answered_at) === Date.parse('2026-10-08T10:00:00Z') && fa.data[0].synthetic === true
    rec('R4 첫 시도 뷰 — 1행 · 가장 이른 판단 · synthetic', firstOk, fa.data ?? fa.error)

    // R5 상한 · 다른 표 무변경
    const mid = await counts(user.id)
    const delta = Object.fromEntries(TABLES.map((t) => [t, mid[t].all - before[t].all]))
    rec('R5 증가분이 계획 안(시도 ≤4 · 원장 ≤4 · 세션 0)', delta.learning_task_attempts <= 4 && delta.learning_mutations <= 4 && delta.learning_sessions === 0, delta)
  } finally {
    const r = await cleanup(m)
    m.cleanup = r
    save(m) // 사후 집계가 실패해도 정리 결과·잔여 PK 는 먼저 남는다
    try {
      m.after = await counts(user.id)
    } catch (e) {
      m.after = { error: e.message }
    }
    m.finishedAt = new Date().toISOString()
    save(m)
    const back = !m.after.error && TABLES.every((t) => m.after[t].all === m.before[t].all)
    console.log(`정리: 남음 ${JSON.stringify(r.still)} · 거부 ${r.refused.length} · 기준선 복귀 ${back}`)
    console.log(`매니페스트 ${path.join(RUN_DIR, `${m.testRunId}.json`)}`)
    const residual = [...r.still.attempts, ...r.still.sessions, ...r.still.mutations].length + r.unresolved.length + r.errors.length
    // 검사 실패 · 정리 잔여가 있으면 종료 코드 1(매니페스트 저장 뒤) — 호출자가 성공으로 오판하지 않게
    if (m.results.some((x) => !x.pass) || residual > 0 || m.after.error) process.exitCode = 1
    if (!back) console.log('⚠️ 기준선과 다르다 — 이번 실행이 만든 PK 는 위 「남음」만 확인하고, 다른 행(다른 세션 · 실사용)은 건드리지 않는다')
  }
}

await main()
