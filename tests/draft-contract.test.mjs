// tests/draft-contract.test.mjs — 작업 초안은 만들 때의 설계 계약에 묶인다(Codex P1)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addTaskDraft, takeDraftsFor } from '../lib/usergoals.mjs'

const design = (version, acceptance) => ({ version, status: 'PROPOSED', acceptance, allowed_paths: ['src/map/**'], preserved_contracts: [], db_changes: false })

test('초안 계약: 같은 계약으로 승인되면 꺼내고, 계약이 바뀐 설계 승인에는 작업을 만들지 않고 보관한다', () => {
  const g = { ug_id: 'UG-1', designs: [design(1, ['A'])], history: [] }
  const state = { userGoals: { goals: { 'UG-1': g } } }
  addTaskDraft(state, 'UG-1', { title: 'v1 초안' }, { by: 't' })
  assert.equal(g.task_drafts[0].design_version, 1)
  // 수용 기준이 바뀐 v2 승인 → v1 초안은 작업이 되지 않는다
  const v2 = design(2, ['A', 'B'])
  g.designs.push(v2)
  assert.deepEqual(takeDraftsFor(g, v2, 't'), [])
  assert.equal(g.stale_drafts.length, 1)
  assert.equal(g.task_drafts.length, 0)
  // v2 기준 초안은 문장 공백만 다른 같은 계약 v3 승인에서 꺼내진다
  addTaskDraft(state, 'UG-1', { title: 'v2 초안' }, { by: 't' })
  const v3 = design(3, ['A', '  B '])
  assert.equal(takeDraftsFor(g, v3, 't').length, 1)
})
