// lib/localroles.mjs — local planning within the existing task/orchestrator, not a new scheduler.
import crypto from 'node:crypto'
import { runAgent, parseReview } from './agents.mjs'
import { assignRoles, ROLE_CONTRACT, workReason, otherAgent, designReviewAllows } from './roles.mjs'
import { devConfig, isLocalFast } from './devmode.mjs'

export const dynamicTask = (t) => isLocalFast() && (t.local_roles === true || !!t.roles || devConfig().dynamic_roles === true)
export function roleBinding(task, samples = []) {
  return task.role_assignment || assignRoles(task, { samples })
}
export function canCombinePlan(task, binding) {
  return task.priority !== 'P0' && task.complexity !== 'complex' && !task.approval_required && !task.local_design_feedback && !workReason(task) && !(task.flags || []).length && ['analyst', 'planner', 'architect'].every((role) => binding.roles[role] === binding.roles.implementer)
}
export function planKey(task, base, binding) {
  return crypto.createHash('sha256').update(JSON.stringify([ROLE_CONTRACT, base, binding, task.description, task.acceptance, task.allowed_paths, task.forbidden_paths, task.design_version, task.depends_on, task.approval])).digest('hex')
}
export function parsePlan(text, task) {
  try {
    const block = [...String(text).matchAll(/```json vfc-plan\s*\n([\s\S]*?)\n```/g)].at(-1)
    if (!block) throw new Error('Missing vfc-plan block')
    const plan = JSON.parse(block[1])
    if (!['READY', 'CONFLICT', 'NEEDS_APPROVAL'].includes(plan.status)) throw new Error('Unknown plan status')
    if (!Array.isArray(plan.steps) || !plan.steps.length || !plan.steps.every((s) => typeof s === 'string' && s.trim())) throw new Error('Missing implementation steps')
    if (!Array.isArray(plan.acceptance_indexes) || task.acceptance.some((_, i) => !plan.acceptance_indexes.includes(i))) throw new Error('Plan must cover all task acceptance')
    if (!Array.isArray(plan.risks) || !Array.isArray(plan.reuse) || typeof plan.goal_fit !== 'string' || !plan.goal_fit.trim()) throw new Error('Missing goal/risk/reuse analysis')
    return { ok: true, plan }
  } catch (e) { return { ok: false, error: e.message } }
}

/** Output is an implementation proposal within immutable task scope, never HUMAN_APPROVED. */
export function localPlan(task, { binding, base, runDir, limits, deps, record = () => {} }) {
  const reason = workReason(task)
  if (reason) return { ok: false, work: reason }
  let feedback = task.local_design_feedback ? `Implementation feasibility feedback: ${JSON.stringify(task.local_design_feedback)}` : ''
  let spent = 0
  const deadline = Date.now() + (limits.max_minutes ?? 90) * 60000
  const execute = (agent, role, opts) => {
    const left = (limits.max_cost_usd ?? Infinity) - spent
    if (left <= 0 || Date.now() >= deadline) return { ok: false, code: 1, ms: 0, stdout: '', timed_out: true }
    const r = runAgent(agent, role, { ...opts, budgetUsd: Math.min(opts.budgetUsd, left), timeoutMs: Math.max(1, Math.min(opts.timeoutMs, deadline - Date.now())) }, deps)
    spent += r.cost_usd || 0
    return r
  }
  if (binding.roles.analyst !== binding.roles.planner) {
    const agent = binding.roles.analyst
    const r = execute(agent, 'analyst', { prompt: `READ ONLY actual-code gap analysis for ${task.task_id}. Goal ${task.goal_id}, requirements ${task.description}, immutable acceptance ${JSON.stringify(task.acceptance)}, scope ${JSON.stringify(task.allowed_paths)}. Identify reusable functions, risks and missing behavior. No network, edits or new approvals.`, cwd: task.worktree, runDir: `${runDir}/analysis`, budgetUsd: limits.claude_budget_usd, timeoutMs: limits.codex_timeout_ms })
    record({ phase: 'local_analysis', role: 'analyst', agent, ms: r.ms, ok: r.ok, cost_usd: r.cost_usd ?? null })
    if (!r.ok) return { ok: false, error: 'Local analyst failed' }
    feedback += `\nIndependent analysis: ${r.stdout}`
  }
  const high = task.priority === 'P0' || task.complexity === 'complex' || task.approval_required || (task.flags || []).length > 0
  for (let round = 1; round <= 2; round++) {
    const prompt = [
      `You are the local analyst/planner/architect for ${task.task_id}. READ ONLY. Do not write, commit, call network, or change any approval.`,
      `Goal: ${task.goal_id}. ${task.title}\n${task.description}`,
      `HEAD: ${base}. Owner/worktree remain ${task.owner_id}/${task.worktree}.`,
      `Immutable acceptance: ${JSON.stringify(task.acceptance)}. Dependencies: ${JSON.stringify(task.depends_on || [])}.`,
      `Allowed: ${JSON.stringify(task.allowed_paths)}. Forbidden: ${JSON.stringify(task.forbidden_paths)}. DB changes forbidden.`,
      'Inspect relevant code. Choose the smallest reusable design, ordered implementation steps and dependencies. Do not create a roadmap or demand extra documents.',
      'If scope, security, goal canon, human approval or an approved design must change, return NEEDS_APPROVAL. Unresolved code/design disagreement: CONFLICT.',
      feedback,
      'End with ```json vfc-plan\n{"status":"READY|CONFLICT|NEEDS_APPROVAL","goal_fit":"evidence","reuse":["file:function"],"steps":["concrete change and validation"],"acceptance_indexes":[0],"risks":["risk and counterexample"]}\n```',
    ].join('\n')
    const agent = binding.roles.planner
    const r = execute(agent, 'planner', { prompt, cwd: task.worktree, runDir: `${runDir}/plan-${round}`, budgetUsd: limits.claude_budget_usd, timeoutMs: Math.min(limits.codex_timeout_ms, limits.claude_timeout_ms) })
    record({ phase: 'local_plan', role: 'planner', agent, plan_round: round, validated: false, ms: r.ms, ok: r.ok, cost_usd: r.cost_usd ?? null, combined_roles: ['analyst', 'planner', 'architect'].filter((role) => binding.roles[role] === agent) })
    if (!r.ok) return { ok: false, error: 'Local planner execution failed', execution: { code: r.code, timed_out: r.timed_out } }
    const p = parsePlan(r.stdout, task)
    if (!p.ok) return p
    if (p.plan.status === 'NEEDS_APPROVAL') return { ok: false, approval: true, plan: p.plan }
    if (p.plan.status === 'CONFLICT') { feedback = `Resolve this disagreement within the unchanged contract: ${JSON.stringify(p.plan)}`; continue }
    // Low-risk: implementation feasibility is confirmed by the implementer. High-risk: opposite AI checks the plan first.
    if (!high && binding.roles.architect === agent) { record({ phase: 'local_plan_validated', plan_round: round }); return { ...p, key: planKey(task, base, binding), status: 'LOCAL_PROPOSED' } }
    const peer = binding.roles.architect !== agent ? binding.roles.architect : otherAgent(agent)
    const rr = execute(peer, 'architect', { prompt: `READ ONLY independent feasibility/counterexample review for ${task.task_id} at ${base}. Acceptance: ${JSON.stringify(task.acceptance)}; allowed ${JSON.stringify(task.allowed_paths)}; forbidden ${JSON.stringify(task.forbidden_paths)}. Proposed plan: ${JSON.stringify(p.plan)}. Keep existing approval/security/goal contracts. End with a json vfc-review fenced block {"verdict":"APPROVE|REQUEST_CHANGES","findings":[{"id":"...","severity":"P1","scope":"in","claim":"..."}],"ran_tests":false}.`, cwd: task.worktree, runDir: `${runDir}/peer-${round}`, budgetUsd: limits.claude_budget_usd, timeoutMs: Math.min(limits.codex_timeout_ms, limits.claude_timeout_ms) })
    record({ phase: 'local_design_review', role: 'architect', agent: peer, ms: rr.ms, ok: rr.ok, cost_usd: rr.cost_usd ?? null })
    const review = rr.ok ? parseReview(rr.stdout) : { ok: false, error: 'Design reviewer execution failed' }
    if (!review.ok) return review
    if (designReviewAllows(review.review)) { record({ phase: 'local_plan_validated', plan_round: round }); return { ...p, key: planKey(task, base, binding), status: 'LOCAL_PROPOSED', peer, review: review.review } }
    feedback = `Independent counterexamples (resolve without widening scope): ${JSON.stringify(review.review.findings)}`
  }
  return { ok: false, work: 'repeated_local_design_conflict' }
}

export function reviewProvenance(task, head, execution, binding) {
  if (!execution.ok || !execution.executable) throw new Error('Review execution not successful')
  return { contract: ROLE_CONTRACT, task_id: task.task_id, head, implementer: binding.roles.implementer, reviewer: execution.agent, executable: execution.executable, process_id: execution.process_id ?? null, session_id: execution.session_id ?? null }
}

export function checkProvenance(task, head, review) {
  const p = review?.provenance, expected = task.role_assignment
  if (!expected) return [] // legacy contracts retain their existing gate
  return p?.contract === ROLE_CONTRACT && p.task_id === task.task_id && p.head === head && p.implementer === expected.roles.implementer && p.reviewer === expected.roles.reviewer && p.implementer !== p.reviewer && typeof p.executable === 'string' && p.executable.length > 0 ? [] : ['review: missing/mismatched independent actor, task, HEAD or execution provenance']
}
