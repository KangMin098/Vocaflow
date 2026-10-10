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

/** 겹치는 구간을 합친 길이(ms) — 병렬로 돈 검증·대기를 두 번 세지 않는다 */
export function unionMs(intervals) {
  const xs = intervals.map(([a, b]) => [Date.parse(a), Date.parse(b)]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b >= a).sort((p, q) => p[0] - q[0])
  let total = 0
  let cur = null
  for (const [a, b] of xs) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0]
      cur = [a, b]
    } else cur[1] = Math.max(cur[1], b)
  }
  if (cur) total += cur[1] - cur[0]
  return total
}

const TEST_TYPES = new Set(['unit', 'integration', 'e2e', 'ci', 'smoke', 'db_query'])

/**
 * 목표 단위 속도 지표(2026-10-10 요구 A) — 사용자 목표 접수부터 검증된 완료까지. 상태 기록에서만 계산한다(추정·상수 없음).
 * 기록이 없는 값은 null 로 두고 not_measured 에 사유를 적는다 — 0 으로 메우지 않는다. 겹치는 구간은 합쳐서 잰다(unionMs).
 *   notified   배정 알림 기록(runtime/logs/dispatch-notified.jsonl 의 줄들) — 배정→전달 · 전달→인수 분리
 *   prRecords  { [pr]: verification/ci/PR<n>-*.json 최신 } — PR 생성 · CI 시작·종료 · 병합 시각
 * now 는 주입(열린 목표의 경과 시간 계산용).
 */
export function goalMetrics(state, ug, { now, notified = [], prRecords = {} }) {
  const g = state.userGoals?.goals?.[ug]
  if (!g) return null
  const ms = (a, b) => (a && b ? Date.parse(b) - Date.parse(a) : null)
  const min = (xs) => xs.filter(Boolean).sort()[0] ?? null
  const designs = g.designs || []
  const firstApproved = min(designs.map((d) => d.approved_at))
  const requests = (g.rounds || []).filter((r) => r.recipient === 'chatgpt')
  const answered = requests.filter((r) => ['APPLIED', 'OBSOLETE'].includes(r.response_status) || r.completed_at)
  const tasks = state.taskQueue.tasks.filter((t) => t.user_goal_id === ug)
  const untimed = { evidence: 0, notify: 0, pr: 0 }
  const perTask = tasks.map((t) => {
    const h = t.history || []
    const firstStart = h.find((x) => x.to === 'IN_PROGRESS')?.at ?? null
    const done = h.find((x) => x.to === 'COMPLETED')?.at ?? null
    const reviewSpans = []
    for (let i = 0; i < h.length; i++) if (h[i].to === 'REVIEW') reviewSpans.push([h[i].at, h[i + 1]?.at ?? (t.status === 'REVIEW' ? now : null)])
    const apprAt = designs.find((d) => d.version === t.design_version)?.approved_at ?? null
    const ev = t.evidence || []
    const timed = ev.filter((e) => e.started_at && e.observed_at)
    untimed.evidence += ev.length - timed.length
    const notifiedAt = min(notified.filter((n) => n.task_id === t.task_id && (!t.dispatch?.at || n.dispatched_at === t.dispatch.at)).map((n) => n.notified_at))
    if (t.dispatch && !notifiedAt) untimed.notify += 1
    const pr = t.pr != null ? prRecords[t.pr] ?? null : null
    if (t.pr != null && !pr) untimed.pr += 1
    return {
      task_id: t.task_id,
      status: t.status,
      ui_gate: !!t.ui_gate,
      dispatch_wait_ms: ms(t.dispatch?.at, t.dispatch?.accepted_at),
      dispatch_to_notify_ms: ms(t.dispatch?.at, notifiedAt),
      notify_to_claim_ms: ms(notifiedAt, t.dispatch?.accepted_at),
      design_to_done_ms: ms(apprAt, done),
      start_to_done_ms: ms(firstStart, done),
      review_wait_ms: unionMs(reviewSpans),
      rework: h.filter((x) => x.from === 'REVIEW' && x.to !== 'COMPLETED').length,
      test_ms: timed.some((e) => TEST_TYPES.has(e.type)) ? unionMs(timed.filter((e) => TEST_TYPES.has(e.type)).map((e) => [e.started_at, e.observed_at])) : null,
      ui_verify_ms: timed.some((e) => e.type === 'ui') ? unionMs(timed.filter((e) => e.type === 'ui').map((e) => [e.started_at, e.observed_at])) : null,
      ui_evidence: ev.filter((e) => e.type === 'ui').length,
      pr: t.pr ?? null,
      pr_to_merge_ms: pr ? ms(pr.pr_created_at, pr.merged_at) : null,
      ci_ms: pr ? ms(pr.ci_started_at, pr.ci_completed_at) : null,
    }
  })
  const accepted = g.accepted_at ?? null
  const userDecisions = state.decisionLog.entries.filter((e) => e.recorded_via === 'tty' && JSON.stringify(e).includes(ug))
  const not_measured = {}
  if (untimed.evidence) not_measured.test_and_ui_duration = `증거 ${untimed.evidence}건에 started_at 이 없다(소요 시간 미계측 — 증거에 started_at 을 적으면 잰다)`
  if (untimed.notify) not_measured.dispatch_notify = `배정 ${untimed.notify}건의 전달 기록이 없다(배정 알림 훅 미설치 또는 알림 전 인수)`
  if (!tasks.some((t) => t.pr != null)) not_measured.pr_ci_merge = '이 목표의 작업에 PR 번호가 연결되지 않았다(task.pr)'
  else if (untimed.pr) not_measured.pr_ci_merge = `PR ${untimed.pr}건의 CI 기록 파일이 없다(verification/ci/PR<n>-*.json)`
  return {
    ug_id: ug,
    status: g.status,
    received_at: g.created_at,
    received_to_first_design_approval_ms: ms(g.created_at, firstApproved),
    work_round_trips: { requested: requests.length, answered: answered.length },
    work_wait_ms: unionMs(requests.map((r) => [r.created_at, r.completed_at ?? (r.response_status === 'PENDING' ? now : null)])),
    design_versions: designs.length,
    approval_wait_ms: unionMs(designs.map((d) => [d.created_at, d.approved_at])),
    tasks: perTask,
    rework_total: perTask.reduce((a, t) => a + t.rework, 0),
    goal_elapsed_ms: ms(g.created_at, accepted ?? now),
    goal_closed: !!accepted,
    user_interventions: userDecisions.length,
    not_measured,
  }
}
