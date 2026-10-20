// lib/localgoal.mjs — existing user-goal design intake, using local CLI instead of Work transport.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { runAgent } from './agents.mjs'
import { otherAgent, designReviewAllows } from './roles.mjs'
import { parseReview } from './agents.mjs'
import { root } from './paths.mjs'
import { sha256File } from './fsutil.mjs'
import * as UG from './usergoals.mjs'

export function planGoalLocally(state, ug, { agent = 'codex', cwd, runDir, issue = null, limits, deps, record = () => {} }) {
  const g = UG.findGoal(state, ug), base = execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (!['codex', 'claude'].includes(agent)) throw new Error('Unknown planner')
  const policy = g.execution_policy
  let spent = 0
  const deadline = Date.now() + (limits.max_minutes ?? 90) * 60000
  const execute = (provider, role, options) => {
    const left = Math.min(limits.max_cost_usd ?? Infinity, UG.policyBudgetLeft(state, ug) ?? Infinity) - spent
    if (left <= 0 || Date.now() >= deadline) return { ok: false, code: 1, ms: 0, stdout: '' }
    const r = runAgent(provider, role, { ...options, budgetUsd: Math.min(options.budgetUsd, left), timeoutMs: Math.max(1, Math.min(options.timeoutMs, deadline - Date.now())) }, deps)
    spent += r.cost_usd || 0
    return r
  }
  const prompt = [
    `READ ONLY local product analyst/planner/architect. Goal ${ug}: ${g.title}. Canon goals: ${g.canon_goal_ids.join(',')}. HEAD ${base}.`,
    `Latest design: ${JSON.stringify(g.designs.at(-1) || null)}. User direction: ${JSON.stringify(g.next_scope || [])}. Gap: ${JSON.stringify(issue)}.`,
    `Delegated policy (not new approval): ${JSON.stringify(policy)}. Existing accepted work: ${JSON.stringify(state.taskQueue.tasks.filter((t) => t.user_goal_id === ug).map((t) => ({ id: t.task_id, status: t.status, acceptance: t.acceptance, head: t.verified_commit })))}`,
    'Inspect actual relevant code. Select the next smallest useful product increment. State reusable files/functions, ordered implementation plan/dependencies, measurable acceptance, counterexamples. Preserve goal canon, rights/Gold/security/approval. No DB writes, network, commits or file edits. This is PROPOSED only.',
    'End with ```json vfc-design\n{"summary":"purpose and product change","design":"selected design, reuse, ordered steps, dependencies, risks and verification","acceptance":["testable outcome"],"allowed_paths":["actual/file"],"preserved_contracts":["existing contract"],"db_changes":false}\n``` . For UI include ui_design with all existing UI_DESIGN_FIELDS and actual desktop browser verification; do not waive UI gates.',
  ].join('\n')
  let feedback = ''
  for (let round = 1; round <= 2; round++) {
    const r = execute(agent, 'planner', { prompt: prompt + feedback, cwd, runDir: `${runDir}/plan-${round}`, budgetUsd: limits.claude_budget_usd, timeoutMs: limits.codex_timeout_ms })
    record({ phase: 'local_goal_plan', role: 'planner', agent, ms: r.ms, ok: r.ok, cost_usd: r.cost_usd ?? null })
    if (!r.ok) return { ok: false, error: 'Local goal planner execution failed' }
    let design
    try { design = JSON.parse([...r.stdout.matchAll(/```json vfc-design\s*\n([\s\S]*?)\n```/g)].at(-1)[1]) } catch { return { ok: false, error: 'Missing/invalid local vfc-design' } }
    const peer = otherAgent(agent)
    // Goal design changes accepted contracts: independent feasibility review before policy considers it.
    const rr = execute(peer, 'architect', { prompt: `READ ONLY independent goal/design feasibility check. ${prompt}\nCandidate: ${JSON.stringify(design)}\nEnd with a json vfc-review fenced block {"verdict":"APPROVE|REQUEST_CHANGES","findings":[{"id":"D1","severity":"P1","scope":"in","claim":"..."}],"ran_tests":false}.`, cwd, runDir: `${runDir}/peer-${round}`, budgetUsd: limits.claude_budget_usd, timeoutMs: limits.codex_timeout_ms })
    record({ phase: 'local_goal_design_review', role: 'architect', agent: peer, ms: rr.ms, ok: rr.ok, cost_usd: rr.cost_usd ?? null })
    const parsed = rr.ok ? parseReview(rr.stdout) : { ok: false }
    if (!parsed.ok) return { ok: false, error: 'Goal feasibility review unknown' }
    if (!designReviewAllows(parsed.review)) { feedback = `\nResolve within unchanged approval: ${JSON.stringify(parsed.review.findings)}`; continue }
    if (execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== base) return { ok: false, error: 'HEAD moved during planning' }
    fs.mkdirSync(runDir, { recursive: true })
    const file = path.join(runDir, 'local-design.json')
    fs.writeFileSync(file, JSON.stringify({ task: ug, base, agent, reviewer: peer, review_executable: rr.executable, design, review: parsed.review }, null, 2))
    return { ok: true, design, provenance: { by: 'local-planner', agent, base_commit: base, file: path.relative(root(), file).replace(/\\/g, '/'), file_sha256: sha256File(file) } }
  }
  return { ok: false, work: 'repeated_local_design_conflict' }
}
