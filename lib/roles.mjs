// lib/roles.mjs — task-local roles; ownership and approval authority never change.
export const ROLE_CONTRACT = 'local-roles/1'
export const ROLE_NAMES = ['analyst', 'planner', 'architect', 'implementer', 'reviewer', 'verifier']
export const AGENTS = ['codex', 'claude']
export const otherAgent = (a) => a === 'codex' ? 'claude' : 'codex'
export function designReviewAllows(review) {
  if (!review || !['APPROVE', 'REQUEST_CHANGES'].includes(review.verdict) || !Array.isArray(review.findings)) return false
  if (typeof review.ran_tests !== 'boolean' || review.findings.some((f) => !f.id || !f.claim || !['in', 'out'].includes(f.scope) || !['P0', 'P1', 'P2', 'P3'].includes(f.severity))) return false
  if (review.findings.some((f) => f.scope === 'in' && ['P0', 'P1'].includes(f.severity))) return false
  // Preserve the reviewer's verdict. Nonblocking follow-ups do not become a new product gate.
  return review.verdict === 'APPROVE' || review.findings.length > 0
}

export function validateRoles(roles = {}) {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) throw new Error('roles must be an object')
  for (const [role, agent] of Object.entries(roles)) {
    if (!ROLE_NAMES.includes(role) || !AGENTS.includes(agent)) throw new Error(`Invalid role assignment: ${role}=${agent}`)
  }
  if (roles.implementer && roles.reviewer === roles.implementer) throw new Error('Implementer and reviewer must be different AIs')
  if (roles.implementer && roles.verifier === roles.implementer) throw new Error('Independent verifier must differ from implementer')
  return { ...roles }
}

/** Explicit context wins; measurements break ties only when both agents were measured. */
export function assignRoles(task, { available = AGENTS, samples = [] } = {}) {
  const requested = validateRoles(task.roles || {})
  if (!AGENTS.every((a) => available.includes(a))) throw new Error('Independent execution requires both local AIs')
  const mean = (a, role) => {
    const xs = samples.filter((s) => s.agent === a && s.role === role && (s.phase === undefined || (s.task_id && ['role_execution', 'local_plan'].includes(s.phase))) && s.validated !== false && (s.complexity || 'simple') === (task.complexity || 'simple') && s.ok && Number.isFinite(s.ms))
    return xs.length ? xs.reduce((n, s) => n + s.ms, 0) / xs.length : null
  }
  const times = AGENTS.map((a) => mean(a, 'implementer'))
  const measured = times.every((v) => v !== null)
  const implementer = requested.implementer || (requested.reviewer ? otherAgent(requested.reviewer) : requested.verifier ? otherAgent(requested.verifier) : measured ? AGENTS[times[0] <= times[1] ? 0 : 1] : 'claude')
  const planningTimes = AGENTS.map((a) => mean(a, 'planner'))
  const planner = requested.planner || requested.architect || requested.analyst || (planningTimes.every((v) => v !== null) ? AGENTS[planningTimes[0] <= planningTimes[1] ? 0 : 1] : otherAgent(implementer))
  const roles = { analyst: planner, planner, architect: planner, implementer, reviewer: otherAgent(implementer), verifier: otherAgent(implementer), ...requested }
  validateRoles(roles)
  return { contract: ROLE_CONTRACT, roles, reason: Object.keys(requested).length ? 'task context' : measured ? 'observed successful role durations' : 'unmeasured: existing implementer with independent local planner', observed_ms: Object.fromEntries(AGENTS.map((a, i) => [a, { implementer: times[i], planner: planningTimes[i] }])) }
}

export function workReason(task, { conflicts = 0 } = {}) {
  if (task.work_requested) return 'user_explicit_work'
  if ((task.flags || []).includes('product_direction')) return 'platform_strategy'
  if ((task.flags || []).includes('independent_deep_review')) return 'independent_deep_review'
  return conflicts >= 2 ? 'repeated_local_design_conflict' : null
}

export function roleMetrics(events) {
  const phases = {}, tasks = new Set(), reworked = new Set()
  const acceptance = {}
  let p01 = 0, reviews = 0, interventions = 0, github = 0
  for (const e of events) {
    if (e.task_id) tasks.add(e.task_id)
    if (e.task_id && e.at && Number.isFinite(Date.parse(e.at))) {
      const row = acceptance[e.task_id] ||= { selected_at: null, accepted_at: null, elapsed_ms: null }
      if (e.phase === 'selected' && !row.selected_at) row.selected_at = e.at
      if (e.phase === 'task_done' && e.outcome === 'completed') { row.accepted_at = e.at; row.elapsed_ms = row.selected_at ? Date.parse(e.at) - Date.parse(row.selected_at) : null }
    }
    if (e.role && Number.isFinite(e.ms)) {
      const key = `${e.agent}:${e.role}`
      const v = phases[key] ||= { calls: 0, ms: 0, failures: 0 }
      v.calls++; v.ms += e.ms; if (!e.ok) v.failures++
    }
    if (e.phase === 'review_done') { reviews++; p01 += e.blocking?.length || 0; if (e.blocking?.length) reworked.add(e.task_id) }
    if (e.phase === 'user_intervention') interventions++
    if (e.phase === 'github_call') github++
  }
  const cost = (e) => e.cost_usd ?? e.measured_cost_usd
  const costs = events.filter((e) => e.role && Number.isFinite(cost(e)))
  return { phases, acceptance, tasks: tasks.size, reworked_tasks: reworked.size, rework_rate: tasks.size ? reworked.size / tasks.size : null, detected_p0p1: p01, p0p1_per_review: reviews ? p01 / reviews : null, user_interventions: interventions, github_calls: github, detection_recall: null, cost_complete: !events.some((e) => e.role && !Number.isFinite(cost(e))), measured_role_cost_usd: costs.reduce((s, e) => s + cost(e), 0), note: 'Acceptance time spans first selection through passing local integration. Recall needs a labelled defect corpus. GitHub count covers controller events, not all machine processes. Combined phase time is counted once; unused roles are unmeasured.' }
}

export function compareTrials(baseline, dynamic) {
  if (!baseline || !dynamic || !baseline.workload_hash || baseline.workload_hash !== dynamic.workload_hash || !baseline.environment_hash || baseline.environment_hash !== dynamic.environment_hash || !baseline.all_pass || !dynamic.all_pass || !(baseline.wall_ms > 0 && dynamic.wall_ms > 0)) return { comparable: false, speedup: null, reason: 'Need matched workload/environment and passing local integration in both actual trials' }
  return { comparable: true, baseline_ms: baseline.wall_ms, dynamic_ms: dynamic.wall_ms, speedup: baseline.wall_ms / dynamic.wall_ms, faster_in_this_sample: dynamic.wall_ms < baseline.wall_ms, general_speed_improvement_verified: false, reason: 'Single matched trial; stochastic CLI execution is not a platform-wide speed guarantee' }
}
