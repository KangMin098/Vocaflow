// tests/start-policy.test.mjs — 수동 task start 도 위임 정책(범위·위험·예산)을 다시 검사한다(Codex P1)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startTask } from '../lib/tasks.mjs'

function fixture({ paths = ['src/map/a.ts'], spent = 0 } = {}) {
  const policy = { allowed_code_areas: ['src/map/**'], allowed_capabilities: ['code_change'], excluded_operations: [], risk_level: 'MEDIUM', max_cost_usd: 5 }
  const task = { task_id: 'T-1', owner_id: 'o', status: 'READY', depends_on: [], user_goal_id: 'UG-1', design_version: 1, allowed_paths: paths, db_scope: { mode: 'none', targets: [] }, orchestration: { budget_used_usd: spent }, worktree: null }
  return {
    taskQueue: { tasks: [task] },
    userGoals: { goals: { 'UG-1': { ug_id: 'UG-1', status: 'OPEN', designs: [{ version: 1, status: 'APPROVED' }], execution_policy: policy, approval: { via_policy: true } } } },
    ownership: { owners: { o: { worktrees: [] } } },
  }
}

test('수동 start: 위임 정책 밖 경로·예산 초과는 거부, 정책 안이면 다음 게이트(worktree)로 넘어간다', () => {
  assert.throws(() => startTask(fixture({ paths: ['src/other/x.ts'] }), 'T-1', { owner_id: 'o' }), { code: 'POLICY_NOT_COVERED' })
  assert.throws(() => startTask(fixture({ spent: 5 }), 'T-1', { owner_id: 'o' }), { code: 'POLICY_BUDGET' })
  assert.throws(() => startTask(fixture(), 'T-1', { owner_id: 'o' }), { code: 'WORKTREE_REQUIRED' })
})
