#!/usr/bin/env node
// bin/goal-priority.mjs — 다음 작업 선정(WF-S5 §4·§5) · 상태를 바꾸지 않는다(읽기 전용)
//
//   node bin/goal-priority.mjs [--json]
// 우선순위(점수와 이유) + 실행 가능성(소유·worktree·잠금·승인·도구·기획 필요)을 함께 보인다.

import { loadState } from '../lib/state.mjs'
import { loadCriteria } from '../lib/goals.mjs'
import { rankTasks } from '../lib/priority.mjs'
import { checkFeasibility } from '../lib/feasibility.mjs'

const doc = loadCriteria()
const { state } = loadState()
const r = rankTasks({ doc, state })
const rows = r.ranked.map((x) => {
  const t = state.taskQueue.tasks.find((t) => t.task_id === x.task_id)
  const f = checkFeasibility(t, state, { tools: ['git', 'claude', 'codex'] })
  return { ...x, executable: f.ok, blockers: f.checks.filter((c) => !c.ok).map((c) => `${c.check}: ${c.detail}`), needs_planning: f.needs_planning }
})
const next = rows.find((x) => x.executable && !x.needs_planning.length) ?? null
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ next: next?.task_id ?? null, ranked: rows, excluded: r.excluded, uncovered: r.uncovered }, null, 2))
} else {
  console.log(`다음 실행: ${next ? `${next.task_id} (점수 ${next.score})` : '없음'}`)
  for (const x of rows) {
    console.log(`\n${x.task_id} ${x.goal_id} 점수 ${x.score} · ${x.executable ? '실행 가능' : '실행 불가'}`)
    for (const why of x.reasons) console.log(`   + ${why}`)
    for (const b of x.blockers) console.log(`   ✗ ${b}`)
    if (x.needs_planning.length) console.log(`   ? 기획 필요: ${x.needs_planning.join(', ')}`)
  }
  console.log(`\n제외 ${r.excluded.length} · 열린 작업 없는 L3 목표 ${r.uncovered.length}: ${r.uncovered.map((u) => `${u.goal_id}(${u.status})`).join(' ')}`)
}
