// lib/perf.mjs — 오케스트레이터 실행 시간·비용 측정(WF-S9 Phase A)
//
// ORCHESTRATOR.json 의 run.events(단계 · 시각)에서 각 사건부터 다음 사건까지를 그 단계의 소요 시간으로 본다.
//   goal_check  목표 검사(정본·증거·CI 판독)          select  우선순위·실행 가능성 선정
//   implement   Claude 구현(+테스트·커밋)             review  Codex 독립 리뷰
//   기타        복구·차단·완료 처리 등 상태 저장 단계
// 측정값은 근사다: 이벤트 사이의 상태 저장·git 작업 시간이 앞 단계에 포함된다(단계 경계에 별도 사건이 없다).

const BUCKET = { goal_check: 'goal_check', select: 'select', selected: 'select', implement: 'implement', implement_done: 'state_git', review: 'review', review_done: 'state_git', review_failed: 'state_git', task_done: 'state_git', complete_refused: 'state_git', implement_failed: 'state_git', design_conflict: 'state_git', stop_hook_blocked: 'state_git' }

export function measureRuns(orchestrator, { since = null } = {}) {
  const runs = Object.values(orchestrator.runs || {}).filter((r) => !since || String(r.started_at || r.run_id) >= since)
  const totals = {}
  const perRun = []
  const perTask = {}
  let cost = 0
  for (const r of runs) {
    const ev = (r.events || []).filter((e) => e.at)
    const row = { run_id: r.run_id, status: r.status, tasks: (r.tasks_done || []).map((t) => `${t.task_id}:${t.outcome}`), cost_usd: Number(r.cost_usd || 0), wall_ms: 0, phases: {} }
    for (let i = 0; i < ev.length - 1; i++) {
      const ms = Date.parse(ev[i + 1].at) - Date.parse(ev[i].at)
      if (!(ms >= 0)) continue
      const b = BUCKET[ev[i].phase] || 'other'
      row.phases[b] = (row.phases[b] || 0) + ms
      totals[b] = (totals[b] || 0) + ms
      if (ev[i].task_id && ['implement', 'review'].includes(ev[i].phase)) {
        const t = (perTask[ev[i].task_id] ||= { implement_ms: 0, review_ms: 0, rounds: 0 })
        t[`${ev[i].phase}_ms`] += ms
        if (ev[i].phase === 'implement') t.rounds += 1
      }
    }
    if (ev.length > 1) row.wall_ms = Date.parse(ev[ev.length - 1].at) - Date.parse(ev[0].at)
    cost += row.cost_usd
    perRun.push(row)
  }
  const wall = perRun.reduce((a, r) => a + r.wall_ms, 0)
  const share = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, { ms: v, pct: wall ? Math.round((v / wall) * 1000) / 10 : 0 }]))
  const done = perRun.flatMap((r) => r.tasks).filter((t) => t.endsWith(':completed')).length
  return { runs: perRun.length, wall_ms: wall, cost_usd: Math.round(cost * 10000) / 10000, completed_tasks: done, per_completed_task_ms: done ? Math.round(wall / done) : null, by_phase: share, per_task: perTask, per_run: perRun }
}
