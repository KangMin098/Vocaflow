// scripts/knowledge/__tests__/real-db-concurrency.test.mjs
//
// 실제 DB 검증 도구(real-db-concurrency.mjs)의 **장애 주입 시험** — 공유 DB 없이 메모리 가짜 클라이언트로.
// 확인하는 것(2026-10-08 사용자 요청): ① 기록 뒤 행 수 조회 실패에도 정리가 돌아 합성 행이 지워지는가
// ② 정리 자체가 실패하면 남은 PK · 원인이 매니페스트에 남는가(재시도로 지워지는가) ③ 사후 집계 실패면 종료 코드 1 · 성공 판정 없음
// ④ RPC 응답이 끊겨도(커밋은 됨) 정리가 시도를 찾아 지우는가 ⑤ 정상 실행은 기준선으로 돌아오고 종료 코드 0
// 실행: node --test scripts/knowledge/__tests__/real-db-concurrency.test.mjs
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { useDb, useRunDir, executeRun, counts, cleanup } from '../real-db-concurrency.mjs'

const USER = '11111111-1111-4111-8111-111111111111'

/** 메모리 가짜 Supabase — 쓰는 메서드만. fault 로 장애를 넣는다. */
function fakeDb(fault = {}) {
  const t = { learning_task_attempts: [], learning_sessions: [], learning_mutations: [] }
  let seq = 0
  let countCalls = 0
  const firstAttempts = () => {
    const best = new Map()
    for (const a of t.learning_task_attempts) {
      const k = [a.user_id, a.task_key, a.item_ref ?? '', a.phase].join('|')
      const cur = best.get(k)
      if (!cur || Date.parse(a.answered_at) < Date.parse(cur.answered_at) || (a.answered_at === cur.answered_at && a.id < cur.id)) best.set(k, a)
    }
    return [...best.values()].map((a) => ({ attempt_id: a.id, user_id: a.user_id, task_key: a.task_key, item_ref: a.item_ref, phase: a.phase, answered_at: a.answered_at, synthetic: a.synthetic }))
  }
  function builder(table) {
    const st = { filters: [], del: false, head: false, count: false }
    const rows = () => (table === 'learning_first_attempts' ? firstAttempts() : t[table])
    const match = (r) => st.filters.every(([op, c, v]) => (op === 'eq' ? r[c] === v : v.includes(r[c])))
    const run = () => {
      if (st.count) {
        countCalls++
        if (fault.countFails?.(countCalls)) return { data: null, count: null, error: { message: '주입: 행 수 조회 실패' } }
        return { data: null, count: rows().filter(match).length, error: null }
      }
      if (st.del) {
        if (fault.deleteFails?.has(table)) return { data: null, error: { message: `주입: ${table} 삭제 실패` } }
        const gone = t[table].filter(match)
        t[table] = t[table].filter((r) => !match(r))
        return { data: gone, error: null }
      }
      if (fault.selectFails?.has(table)) return { data: null, error: { message: `주입: ${table} 조회 실패` } }
      return { data: rows().filter(match), error: null }
    }
    const b = {
      select(_cols, opts = {}) {
        if (opts.count) st.count = true
        if (opts.head) st.head = true
        return b
      },
      delete() {
        st.del = true
        return b
      },
      eq(c, v) {
        st.filters.push(['eq', c, v])
        return b
      },
      in(c, v) {
        st.filters.push(['in', c, v])
        return b
      },
      limit() {
        return b
      },
      then(res, rej) {
        return Promise.resolve(run()).then(res, rej)
      },
    }
    return b
  }
  return {
    tables: t,
    from: builder,
    async rpc(_name, p) {
      const payload = JSON.stringify([p.p_task_key, p.p_item_ref, p.p_response, p.p_is_correct, p.p_answered_at])
      const led = t.learning_mutations.find((r) => r.user_id === p.p_user && r.client_mutation_id === p.p_mutation)
      if (led) {
        const a = t.learning_task_attempts.find((r) => r.user_id === p.p_user && r.client_mutation_id === p.p_mutation)
        return { data: [{ attempt_id: a ? String(a.id) : null, outcome: led.payload.key === payload ? 'duplicate' : 'conflict' }], error: null }
      }
      const id = ++seq
      // 실제 원장 payload 처럼 response · synthetic 을 담는다(정리가 실행 표식으로 소유를 확인한다)
      t.learning_mutations.push({ user_id: p.p_user, client_mutation_id: p.p_mutation, payload: { key: payload, response: p.p_response, synthetic: p.p_synthetic }, applied_at: new Date(Date.now() + 1000).toISOString() })
      t.learning_task_attempts.push({
        id, user_id: p.p_user, client_mutation_id: p.p_mutation, synthetic: p.p_synthetic, answered_at: p.p_answered_at, response: p.p_response,
        item_ref: p.p_item_ref, phase: p.p_phase, task_key: p.p_task_key,
      })
      // 커밋은 됐는데 응답이 끊긴 경우
      if (fault.loseResponse?.(id)) return { data: null, error: { message: '주입: 응답 유실' } }
      return { data: [{ attempt_id: String(id), outcome: 'inserted' }], error: null }
    },
  }
}

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdc-'))
  useRunDir(dir)
  process.exitCode = 0
})

async function run(fault) {
  const db = fakeDb(fault)
  useDb(db)
  const before = await counts(USER) // 기준선(3표 × 전체·계정 = 6회 조회)
  const m = await executeRun({ userId: USER, before, head: 'test' })
  const saved = JSON.parse(fs.readFileSync(path.join(dir, `${m.testRunId}.json`), 'utf8'))
  const code = process.exitCode
  process.exitCode = 0
  return { db, m, saved, code }
}

const empty = (db) => Object.values(db.tables).every((rows) => rows.length === 0)

test('⑤ 정상 실행 — 검사 통과 · 기준선 복귀 · 종료 코드 0', async () => {
  const { db, saved, code } = await run({})
  assert.ok(saved.results.length >= 5 && saved.results.every((r) => r.pass), JSON.stringify(saved.results))
  assert.ok(empty(db))
  assert.equal(code, 0)
})

test('① 기록 뒤 행 수 조회(R5) 실패 — 예외를 기록하고 정리가 돌아 합성 행이 사라진다 · 종료 코드 1', async () => {
  // 기준선 6회 다음, 실행 중 첫 조회(R5)부터 실패 · 사후 집계는 성공
  const { db, saved, code } = await run({ countFails: (n) => n === 7 })
  assert.match(saved.error ?? '', /행 수를 셀 수 없다/)
  assert.ok(saved.cleanup, '정리 결과가 매니페스트에 있다')
  assert.ok(empty(db), JSON.stringify(db.tables))
  assert.equal(code, 1)
})

test('② 정리 자체 실패 — 남은 PK · 원인 보고, 원장 보존, 재시도로 지워진다', async () => {
  const fault = { deleteFails: new Set(['learning_task_attempts']) }
  const { db, m, saved, code } = await run(fault)
  assert.ok(saved.cleanup.still.attempts.length > 0, '남은 시도 PK')
  assert.ok(saved.cleanup.errors.some((e) => /시도 삭제 실패/.test(e)))
  assert.ok(saved.cleanup.unresolved.length > 0, '시도를 못 지운 mutation 은 미해결')
  assert.ok(db.tables.learning_mutations.length > 0, '원장 보존 — 다음 정리가 시도를 다시 찾게')
  assert.equal(code, 1)
  fault.deleteFails.clear()
  const r = await cleanup(m)
  assert.deepEqual(r.still, { attempts: [], sessions: [], mutations: [] })
  assert.ok(empty(db))
})

test('③ 사후 집계 실패 — after.error · 종료 코드 1 · 성공 판정 없음', async () => {
  // 기준선 6 · R5 6 · 사후 첫 조회(13번째)부터 실패
  const { db, saved, code } = await run({ countFails: (n) => n >= 13 })
  assert.ok(saved.after?.error, '사후 집계 실패 기록')
  assert.ok(empty(db), '정리는 이미 끝남')
  assert.equal(code, 1)
})

test('④ RPC 응답 유실(커밋은 됨) — 정리가 mutation id 로 시도를 찾아 지운다', async () => {
  // R3 의 첫 시도(id 2)는 같은 id 재호출이 없어 응답을 잃으면 매니페스트에 PK 가 없다
  const { db, saved } = await run({ loseResponse: (id) => id === 2 })
  assert.ok(saved.recovery?.some((x) => x.recovered >= 1), JSON.stringify(saved.recovery))
  assert.ok(empty(db), JSON.stringify(db.tables))
})

test('정리는 다른 사용자 행을 건드리지 않는다', async () => {
  const db = fakeDb({})
  useDb(db)
  db.tables.learning_task_attempts.push({ id: 999, user_id: 'other', client_mutation_id: 'x', synthetic: false, answered_at: '2026-10-01T00:00:00Z', item_ref: '2022#20', phase: 'practice', task_key: 'claim-support' })
  db.tables.learning_mutations.push({ user_id: 'other', client_mutation_id: 'x', payload: '', applied_at: '2026-10-01T00:00:00Z' })
  const before = await counts(USER)
  await executeRun({ userId: USER, before, head: 'test' })
  process.exitCode = 0
  assert.equal(db.tables.learning_task_attempts.length, 1)
  assert.equal(db.tables.learning_task_attempts[0].user_id, 'other')
  assert.equal(db.tables.learning_mutations.length, 1)
})

test('정리는 같은 테스트 계정의 다른 실행 행을 지우지 않는다(실행 표식 확인)', async () => {
  const db = fakeDb({})
  useDb(db)
  // 다른 실행이 같은 계정으로 남긴 합성 행 — 매니페스트에 그 PK 가 섞여 들어와도 지우면 안 된다
  db.tables.learning_task_attempts.push({ id: 500, user_id: USER, client_mutation_id: 'other-run', synthetic: true, response: { testRunId: 'other' }, answered_at: '2026-10-08T00:00:00Z', item_ref: '2022#20', phase: 'practice', task_key: 'claim-support' })
  db.tables.learning_mutations.push({ user_id: USER, client_mutation_id: 'other-run', payload: { synthetic: true, response: { testRunId: 'other' } }, applied_at: '2099-01-01T00:00:00Z' })
  const m = { testRunId: 'mine', userId: USER, startedAt: '2026-10-08T00:00:00Z', created: { attempts: [500], sessions: [], mutations: ['other-run'] } }
  const r = await cleanup(m)
  assert.equal(db.tables.learning_task_attempts.length, 1)
  assert.equal(db.tables.learning_mutations.length, 1)
  assert.ok(r.refused.some((x) => x.id === 500), JSON.stringify(r))
})

test('--commit 없는 정리(dryRun)는 아무것도 지우지 않는다', async () => {
  const db = fakeDb({})
  useDb(db)
  db.tables.learning_task_attempts.push({ id: 501, user_id: USER, client_mutation_id: 'mm', synthetic: true, response: { testRunId: 'mine' }, answered_at: '2026-10-08T00:00:00Z', item_ref: '2022#20', phase: 'practice', task_key: 'claim-support' })
  db.tables.learning_mutations.push({ user_id: USER, client_mutation_id: 'mm', payload: { synthetic: true, response: { testRunId: 'mine' } }, applied_at: '2099-01-01T00:00:00Z' })
  const m = { testRunId: 'mine', userId: USER, startedAt: '2026-10-08T00:00:00Z', created: { attempts: [501], sessions: [], mutations: ['mm'] } }
  const r = await cleanup(m, { dryRun: true })
  assert.equal(db.tables.learning_task_attempts.length, 1)
  assert.equal(db.tables.learning_mutations.length, 1)
  assert.deepEqual(r.left.attempts, [501])
  assert.deepEqual(r.left.mutations, ['mm'])
})
