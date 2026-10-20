// lib/execution-status.mjs — read-only execution diagnosis; mailbox delivery is not a running process.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { root, goalsDir } from './paths.mjs'
import { loadState } from './state.mjs'
import { devConfig, automaticReview, missionCollaboration } from './devmode.mjs'
import { pidAlive } from './lock.mjs'
import { goalMode } from './dispatch.mjs'
import { checkFeasibility } from './feasibility.mjs'
import { selectionGate } from './usergoals.mjs'

export function executionStatus({ owner = null } = {}) {
  const code = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const { state } = loadState(), cfg = devConfig()
  if (owner && !state.ownership.owners[owner]) throw new Error(`Unknown owner: ${owner}`)
  let head = null
  try { head = execFileSync('git', ['-C', code, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { /* no invented version */ }
  const runs = Object.values(state.orchestrator.runs || {})
  const live = (r) => r.host === os.hostname() && pidAlive(r.pid)
  const tasks = state.taskQueue.tasks.filter((t) => (!owner || t.owner_id === owner) && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status)).map((t) => {
    const goal = state.userGoals?.goals?.[t.user_goal_id]
    const gate = selectionGate(state, t)
    const feasible = t.status === 'READY' && gate.allow ? checkFeasibility(t, state, { tools: ['git', 'claude', 'codex'] }) : null
    return { task_id: t.task_id, owner_id: t.owner_id, status: t.status, execution_mode: goalMode(goal),
      automatic_independent_review: automaticReview(t, { cfg }),
      dynamic_roles: t.local_roles === true || !!t.roles || cfg.dynamic_roles === true || missionCollaboration(t, cfg)?.dynamic_roles === true,
      owner_inbox_exists: fs.existsSync(path.join(root(), 'planning', 'inbox', `${t.owner_id}.md`)),
      dispatched: !!t.dispatch, dispatch_acknowledged: !!t.dispatch?.accepted_at,
      claim_recorded: !!t.run?.started_at,
      accepted_session: t.dispatch?.accepted_session ?? t.run?.session ?? null,
      implementation_running: t.status === 'IN_PROGRESS' && live(t.run || {}),
      verified_commit: t.verified_commit ?? null,
      eligible: t.status === 'READY' && gate.allow && feasible?.ok === true,
      blockers: [...(!gate.allow ? [gate.reason] : []), ...(feasible?.checks.filter((c) => !c.ok).map((c) => `${c.check}: ${c.detail}`) || []), ...(feasible?.needs_planning || [])] }
  })
  return { code_root: code, code_head: head, state_root: root(), goals_root: goalsDir(),
    config_file: path.join(root(), 'config', 'dev-mode.json'), config: { mode: cfg.mode, dynamic_roles: cfg.dynamic_roles === true, auto_codex_review: cfg.auto_codex_review === true, auto_integrate: cfg.auto_integrate === true },
    active_runs: runs.filter((r) => r.status === 'running' && live(r)).map((r) => ({ run_id: r.run_id, pid: r.pid, phase: r.phase, task_id: r.task_id })),
    tasks,
    workers: Object.values(state.ownership.owners).filter((o) => !owner || o.owner_id === owner).flatMap((o) => Object.values(o.workers || {}).map((w) => ({ worker_id: w.worker_id, owner_id: w.owner_id, status: w.status, process_live: live(w), default_platform_path: false }))),
    transport: 'Inbox is file delivery only; no interactive session wakeup is implied.',
    execution: 'Platform tasks use goal-orchestrator. Standalone owner-worker is legacy owner_session compatibility only.',
    resume: { executable: process.execPath, args: [path.join(code, 'bin', 'goal-orchestrator.mjs'), ...(owner ? ['--owner', owner] : []), '--max-tasks', '3', '--watch-seconds', '60', '--json'], env: { VFC_ROOT: root() } } }
}
