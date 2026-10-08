// lib/feasibility.mjs
//
// 실행 가능성 판정(WF-S5 §5). 우선순위가 높아도 하나라도 걸리면 실행하지 않는다. 잠금을 **잡지 않고** 살펴만 본다.
//
// ChatGPT 응답의 requires_user_approval 값은 권한 근거가 아니다 — 승인 필요 여부는 로컬 정책(approval_kinds)과
// 사용자 승인 기록(task.approval · APPROVED 결정)으로만 판정한다. 응답과 정책이 어긋난 기록(approval_conflict)이
// 이 작업에 걸려 있으면 실행을 막는다.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { normalizeWorktree } from './paths.mjs'
import { judge, readLock, lockName, pidAlive } from './lock.mjs'
import { PLANNING_FLAGS } from './tasks.mjs'
import { resolveClaude, resolveCodex } from './agents.mjs'

function defaultProbe() {
  return {
    exists: (p) => fs.existsSync(p),
    branch: (wt) => {
      try {
        return execFileSync('git', ['-C', wt, 'branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      } catch {
        return null
      }
    },
    productLock: (wt) => {
      const f = path.join(wt, '.agent-lock')
      if (!fs.existsSync(f)) return null
      try {
        return JSON.parse(fs.readFileSync(f, 'utf8'))
      } catch {
        return { unreadable: true }
      }
    },
    tool: (name) => {
      // 실행기와 같은 경로 해석을 쓴다(Codex 는 VS Code 확장 안에 있어 PATH 에 없다)
      const cmd = name === 'claude' ? resolveClaude() : name === 'codex' ? resolveCodex() : name
      if (fs.existsSync(cmd)) return true
      const exe = cmd.split(/\s+/)[0] // 테스트용 "node fake.mjs" 형태 — 첫 토큰이 실행 파일
      return fs.existsSync(exe) || toolOnPath(exe)
    },
  }
}

function toolOnPath(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * @returns {{ ok:boolean, checks:Array<{check:string, ok:boolean, detail:string}>, needs_planning:string[] }}
 * opts.tools: 필요한 도구 이름 목록(예: ['claude','codex','git']) · opts.pid: 실행할 프로세스 pid(제품 잠금 판정용)
 */
export function checkFeasibility(task, state, { probe = defaultProbe(), tools = ['git'], pid = process.pid, automated = tools.includes('claude') } = {}) {
  const checks = []
  const add = (check, ok, detail) => checks.push({ check, ok, detail })
  const owner = state.ownership.owners[task.owner_id]
  add('owner', !!owner, owner ? `owner ${task.owner_id}` : `owner ${task.owner_id} 가 등록되지 않았다`)

  const wt = task.worktree ? normalizeWorktree(task.worktree) : null
  add('worktree_set', !!wt, wt ? wt : 'worktree 없음 — assign-worktree 필요')
  if (wt) {
    add('worktree_bound', !!owner?.worktrees.some((w) => w.path === wt), `owner 바인딩 ${owner?.worktrees.some((w) => w.path === wt) ? '있음' : '없음'}`)
    const exists = probe.exists(wt)
    add('worktree_exists', exists, exists ? '존재' : '경로 없음')
    if (exists && task.branch) {
      const br = probe.branch(wt)
      add('branch_matches', br === task.branch, `현재 ${br} · 작업 ${task.branch}`)
    }
    if (exists) {
      const pl = probe.productLock(wt)
      const foreign = pl && (pl.unreadable || (pl.pid !== pid && pidAlive(pl.pid)))
      add('product_lock_free', !foreign, pl ? (pl.unreadable ? '.agent-lock 읽을 수 없음' : `.agent-lock pid ${pl.pid}${foreign ? ' (남의 살아 있는 잠금)' : ''}`) : '.agent-lock 없음')
    }
    for (const name of [lockName('task', task.task_id), lockName('worktree', wt)]) {
      const l = readLock(name)
      const j = judge(l)
      add(`lock_${name.split('--')[0]}`, j.state === 'absent' || j.state === 'stale', `${name}: ${j.state}`)
    }
  }
  add('scope_defined', task.allowed_paths?.length > 0 && Array.isArray(task.forbidden_paths), `허용 ${task.allowed_paths?.length ?? 0} · 금지 ${task.forbidden_paths?.length ?? 0}`)
  add('acceptance_defined', task.acceptance?.length > 0, `완료 조건 ${task.acceptance?.length ?? 0}개`)

  const approvalOk = !task.approval_required || (task.approval?.by === 'user' && !!task.approval.reference)
  add('approval', approvalOk, task.approval_required ? (approvalOk ? `사용자 승인 ${task.approval.reference}` : `승인 필요(${task.approval_kinds.join(',')}) · 기록 없음`) : '승인 불필요(로컬 정책)')
  // 자동 실행의 Claude 는 MCP 0개(--strict-mcp-config)로 돈다 — DB 를 읽을 수도 쓸 수도 없다.
  // DB 범위가 있는 작업은 사람이 붙은 세션의 몫이다(오케스트레이터가 고르지 않는다).
  if (automated) add('automated_no_db', task.db_scope?.mode === 'none', `db_scope=${task.db_scope?.mode} — 자동 실행은 DB 접근 경로가 없다(대화형 세션에서 수행)`)
  if (task.db_scope?.mode === 'write') {
    const own = task.db_scope.targets.every((t) => (owner?.db_scopes || []).includes(t))
    add('db_write_owner', own, own ? 'DB 쓰기 소유' : 'owner 가 DB 쓰기 소유자가 아니다')
    add('db_write_sql_hash', /^[a-f0-9]{64}$/.test(task.approval?.sql_sha256 || ''), '사용자가 본 SQL sha256')
  }
  const conflicts = state.decisionLog.entries.filter((e) => e.kind === 'approval_conflict' && e.status === 'OPEN_QUESTION' && ((e.affects_task_ids || []).includes(task.task_id) || (e.affects_goal_ids || []).includes(task.goal_id)))
  add('no_approval_conflict', conflicts.length === 0, conflicts.length ? `ChatGPT 응답과 로컬 승인 정책 충돌 ${conflicts.map((c) => c.decision_id).join(',')} — 사람이 풀어야 한다` : '충돌 없음')
  for (const d of task.depends_on || []) {
    const dep = state.taskQueue.tasks.find((x) => x.task_id === d)
    add(`dependency_${d}`, dep?.status === 'COMPLETED', `선행 ${d}: ${dep?.status ?? '없음'}`)
  }
  for (const tl of tools) add(`tool_${tl}`, probe.tool(tl), `${tl} ${probe.tool(tl) ? '사용 가능' : '없음'}`)

  // 기획 필요(WF-S5 §9): 플래그가 있거나 설계 실패가 2회 이상이고, 아직 반영된 기획(재개 결정)이 없으면 실행 대신 기획 요청
  const designFailures = task.orchestration?.failures?.design ?? 0
  const needs = [...(task.flags || []).filter((f) => PLANNING_FLAGS.includes(f)), ...(designFailures >= 2 ? ['design_failed_twice'] : [])]
  const planned = !!task.planning?.resumed_by_decision
  const needsPlanning = needs.length && !planned ? needs : []
  return { task_id: task.task_id, ok: checks.every((c) => c.ok) && needsPlanning.length === 0, checks, needs_planning: needsPlanning }
}
