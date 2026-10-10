// tests/auto-task-superseded.test.mjs — 대체된(옛 설계 버전·재검증) 열린 작업은 자동 작업 생성을 막지 않는다(Codex P1)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoTaskFromDesign } from '../lib/usergoals.mjs'

function fixture(task) {
  const v2 = { version: 2, status: 'APPROVED', acceptance: ['A'], allowed_paths: ['src/map/**'], contract_hash: 'h2' }
  const g = { ug_id: 'UG-1', status: 'OPEN', execution_mode: 'owner_session', dispatch_owner: 'o', designs: [{ version: 1, status: 'SUPERSEDED', contract_hash: 'h1' }, v2], canon_goal_ids: [], history: [], live_verifications: [] }
  return { state: { userGoals: { goals: { 'UG-1': g } }, taskQueue: { tasks: [{ task_id: 'T-1', user_goal_id: 'UG-1', status: 'READY', ...task }] } }, g, v2 }
}

test('자동 작업: 옛 설계 버전·재검증 대기 열린 작업은 차단 사유가 아니고, 현재 버전 열린 작업은 차단한다', () => {
  for (const task of [{ design_version: 1 }, { design_version: 2, revalidate_required: { reason: 'x' } }]) {
    const { state, g, v2 } = fixture(task)
    assert.notEqual(autoTaskFromDesign(state, g, v2).reason, '열린 작업·초안이 이미 있다', JSON.stringify(task))
  }
  const { state, g, v2 } = fixture({ design_version: 2 })
  assert.equal(autoTaskFromDesign(state, g, v2).reason, '열린 작업·초안이 이미 있다')
})
