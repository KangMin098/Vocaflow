// tests/fakes/two-abandoned-runs.mjs — 버려진 run 두 개(stopped · aborted)가 각각 작업을 쥔 상태를 만든다(VFC_ROOT 안에서)
//   node two-abandoned-runs.mjs <taskA> <taskB> <deadPid>
import { withState } from '../../lib/state.mjs'
import * as T from '../../lib/tasks.mjs'

const [a, b, dead, mode] = process.argv.slice(2)
const pid = Number(dead)
for (const [taskId, runId, status] of [
  [a, 'RUNA-0001', mode === 'running' ? 'running' : 'stopped'],
  [b, 'RUNB-0002', 'aborted'],
]) {
  withState((s, ctx) => {
    const t = s.taskQueue.tasks.find((x) => x.task_id === taskId)
    T.startTask(s, taskId, { owner_id: t.owner_id, session: { label: `orch-${runId}`, agent: "orchestrator", pid }, pid }, ctx)
    s.orchestrator.runs[runId] = { run_id: runId, pid, host: null, status, phase: 'implement', tasks_done: [], events: [], stop_reason: 'test' }
    if (status === 'running') s.orchestrator.current_run = runId
  })
}
console.log('ok')
