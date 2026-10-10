// tests/critical-evidence.test.mjs — CRITICAL 대체 검증 계약 CRIT-EV-1(자동 Codex 제거 뒤 require_review_pass 작업)
// 하나라도 빠지면 완료 거부(자동 승격 없음) · 모두 갖추면 Stop PASS 없이도 충족
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criticalEvidenceMissing } from '../lib/tasks.mjs'

const C = 'c0ffee1234567890c0ffee1234567890c0ffee12'
const ev = (type, over = {}) => ({ type, result: 'pass', commit: C, recorded_by: 'learning-map', ...over })
const task = (over = {}) => ({ owner_id: 'learning-map', db_scope: { mode: 'none' }, approval: null, ...over })
const FULL = [ev('unit'), ev('ci'), ev('e2e'), ev('review', { recorded_by: 'independent-review' })]

test('CE1 전부 갖추면 충족(빈 목록)', () => {
  assert.deepEqual(criticalEvidenceMissing(task(), FULL), [])
})

test('CE2 단위 테스트만 · 증거 없음은 충족 아님', () => {
  assert.ok(criticalEvidenceMissing(task(), [ev('unit')]).length >= 3)
  assert.ok(criticalEvidenceMissing(task(), []).includes('모든 증거에 검증 커밋(commit)'))
})

test('CE3 항목별로 빠지면 그 항목을 짚는다', () => {
  const without = (type) => FULL.filter((e) => e.type !== type)
  assert.deepEqual(criticalEvidenceMissing(task(), without('ci')), ['그 커밋의 CI 통과 증거(type ci)'])
  assert.ok(criticalEvidenceMissing(task(), without('e2e')).includes('통합·e2e·DB 검증 증거(type integration|e2e|db_query)'))
  assert.deepEqual(criticalEvidenceMissing(task(), without('review')), ['작업 owner 가 아닌 owner 의 독립 검증 증거'])
})

test('CE4 독립 검증은 작업 owner 가 붙인 것이면 인정하지 않는다', () => {
  const selfOnly = [ev('ci'), ev('e2e'), ev('review')]
  assert.deepEqual(criticalEvidenceMissing(task(), selfOnly), ['작업 owner 가 아닌 owner 의 독립 검증 증거'])
})

test('CE5 통과가 아닌 증거는 세지 않는다 · 커밋 없는 증거가 섞이면 거부', () => {
  const failingCi = FULL.map((e) => (e.type === 'ci' ? { ...e, result: 'fail' } : e))
  assert.ok(criticalEvidenceMissing(task(), failingCi).includes('그 커밋의 CI 통과 증거(type ci)'))
  const noCommit = [...FULL, ev('log', { commit: undefined })]
  assert.ok(criticalEvidenceMissing(task(), noCommit).includes('모든 증거에 검증 커밋(commit)'))
})

test('CE6 DB 쓰기 작업은 승인 기록이 있어야 한다', () => {
  assert.deepEqual(criticalEvidenceMissing(task({ db_scope: { mode: 'write' } }), FULL), ['DB 쓰기 승인 기록(task.approval)'])
  assert.deepEqual(criticalEvidenceMissing(task({ db_scope: { mode: 'write' }, approval: { decision_id: 'DL-1' } }), FULL), [])
})
