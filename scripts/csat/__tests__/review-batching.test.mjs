// scripts/csat/__tests__/review-batching.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { validPersonasBatched } from '../lib-review-batching.mjs'

const ids = Array.from({ length: 41 }, (_, i) => `a${i}`)
const ok = (p) => Promise.resolve({ data: p.map((id) => ({ analysis_id: id, personas: [] })), error: null })
const timeout = { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } }

test('전량 · 묶음 ≤20', async () => {
  const sizes = []
  const r = await validPersonasBatched(ids, (p) => { sizes.push(p.length); return ok(p) })
  assert.equal(r.error, null); assert.equal(r.rows.length, 41); assert.ok(Math.max(...sizes) <= 20)
})
test('시간 초과 분할 재시도', async () => {
  const r = await validPersonasBatched(ids, (p) => Promise.resolve(p.length > 3 ? timeout : null).then((t) => t ?? ok(p)))
  assert.equal(r.error, null); assert.equal(r.rows.length, 41)
})
test('복구 불가 시간 초과 · 다른 오류는 오류', async () => {
  assert.match((await validPersonasBatched(ids, () => Promise.resolve(timeout))).error, /시간 초과/)
  assert.equal((await validPersonasBatched(ids, () => Promise.resolve({ data: null, error: { message: 'x', code: '42501' } }))).error, 'x')
})
