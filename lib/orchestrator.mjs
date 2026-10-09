// lib/orchestrator.mjs
//
// 목표 중심 자동 실행기(WF-S5). 한 반복:
//   goal-check → goal-priority → 실행 가능성(소유·승인·잠금·도구) → [기획 필요면 ChatGPT 요청 + WAITING_CHATGPT]
//   → Claude 구현 → 범위 검사 → 증거 → Codex 독립 리뷰 → (P0/P1 in-scope) 재작업 반복 → 완료/BLOCKED → goal-check
//
// 안전 원칙
//   · 단일 writer: `orchestrator--singleton` 잠금을 쥔 프로세스 하나만 돈다(잠금 경쟁 잔여 위험 — WF-S3 — 때문에 첫 자동 실행은 이 모드만).
//   · 진행 단계는 ORCHESTRATOR.json(journal 트랜잭션)에 매 단계 기록 → 프로세스가 죽으면 다음 실행이 복구한다.
//   · 상한: 작업 수 · 경과 분 · 총 비용 USD · Claude 1회 비용 · 리뷰 반복 · 같은 원인 실패 횟수. 닿으면 멈추거나 그 작업만 BLOCKED.
//   · 사용자 중단(runtime/STOP)·인증 실패·사용량 제한은 우회하지 않고 멈춘다.
//   · 승인은 로컬 정책 + 사용자 기록으로만 판정(ChatGPT 응답 값은 근거 아님).
//   · Claude 가 범위 밖 파일을 바꾸면 되돌리지 않고(파괴적 조작 금지) 작업을 BLOCKED 로 두고 사람에게 넘긴다.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { p, root } from './paths.mjs'
import { withState, loadState } from './state.mjs'
import { acquire, release, heartbeat, pidAlive } from './lock.mjs'
import { loadCriteria } from './goals.mjs'
import * as T from './tasks.mjs'
import { computeGoalCheck, applyGoalCheck, CI_RULES } from './goalcheck.mjs'
import { rankTasks } from './priority.mjs'
import { checkFeasibility } from './feasibility.mjs'
import { createRequest } from './planning.mjs'
import { appendLog } from './fsutil.mjs'

export const DEFAULT_LIMITS = {
  max_tasks: 1,
  max_minutes: 90,
  max_cost_usd: 15,
  claude_budget_usd: 5,
  max_review_rounds: 3,
  max_same_failure: 2,
  claude_timeout_ms: 45 * 60_000,
  codex_timeout_ms: 20 * 60_000,
}
export const REVIEWER = 'independent-review'
const SINGLETON = 'orchestrator--singleton'

const nowIso = () => new Date().toISOString()

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

// ── 실행 기록 ────────────────────────────────────────────────────────────

function runEvent(runId, event) {
  withState((s) => {
    const r = s.orchestrator.runs[runId]
    r.events.push({ at: nowIso(), ...event })
    if (event.phase) r.phase = event.phase
    if (event.task_id !== undefined) r.task_id = event.task_id
    if (event.cost_usd) r.cost_usd = Math.round((r.cost_usd + event.cost_usd) * 10000) / 10000
    r.updated_at = nowIso()
  })
  appendLog(p.eventLog(), { at: nowIso(), event: 'orchestrator', run: runId, ...event })
}

function getRun(runId) {
  return loadState().state.orchestrator.runs[runId]
}

// ── goal-check ───────────────────────────────────────────────────────────

export function goalCheckStep({ deps = {}, by = 'goal-check', ciEnabled = true } = {}) {
  const doc = loadCriteria()
  const { state } = loadState()
  const ci = {}
  if (ciEnabled && deps.readWorkflowJob) {
    for (const rule of CI_RULES) {
      try {
        const r = deps.readWorkflowJob(rule.workflow, rule.job)
        const ev = path.join('verification', 'ci', `MAIN-${rule.workflow}-${rule.job}-${r.run_id ?? 'none'}.json`)
        fs.mkdirSync(path.join(root(), 'verification', 'ci'), { recursive: true })
        fs.writeFileSync(path.join(root(), ev), JSON.stringify(r, null, 2))
        ci[rule.criterion_id] = { ...r, evidence_path: ev.split(path.sep).join('/') }
      } catch (e) {
        ci[rule.criterion_id] = undefined
      }
    }
  }
  const repo = deps.productRepo || process.env.VFC_PRODUCT_REPO || 'D:/workspace/Vocaflow'
  let mainSha = null
  try {
    mainSha = deps.mainSha ? deps.mainSha() : git(repo, ['rev-parse', 'origin/main'])
  } catch {
    mainSha = null
  }
  const check = computeGoalCheck({ doc, state, ci, repo, git: deps.git, head: { main_sha: mainSha } })
  const stamp = check.checked_at.replace(/[:.]/g, '-')
  const rel = `verification/goal-check/GC-${stamp}.json`
  fs.mkdirSync(path.join(root(), 'verification', 'goal-check'), { recursive: true })
  fs.writeFileSync(path.join(root(), rel), JSON.stringify(check, null, 2))
  const changes = withState((s) => applyGoalCheck(s, check, { by, reportPath: rel }), { event: 'goal_check', by })
  const dist = {}
  for (const g of Object.values(check.goals)) dist[g.status] = (dist[g.status] || 0) + 1
  return { report: rel, changes, distribution: dist, check }
}

// ── 선정 ────────────────────────────────────────────────────────────────

/** 우선순위 순으로 보며 실행 가능한 첫 작업을 고른다. 기획이 필요한 작업은 요청을 만들고 WAITING_CHATGPT 로 둔다(다른 작업은 계속). */
export function selectStep({ runId, tools, pid, by = 'orchestrator', allowPlanning = true }) {
  const doc = loadCriteria()
  const { state } = loadState()
  const ranking = rankTasks({ doc, state })
  const skipped = []
  for (const cand of ranking.ranked) {
    const task = state.taskQueue.tasks.find((t) => t.task_id === cand.task_id)
    const f = checkFeasibility(task, state, { tools, pid })
    if (f.needs_planning.length && allowPlanning) {
      const req = createPlanningRequest(task, f.needs_planning, by)
      withState((s) => T.waitForPlanning(s, task.task_id, { caller: task.owner_id, request_id: req.id, reason: f.needs_planning.join(',') }), { event: 'task.wait_planning', task: task.task_id, by })
      skipped.push({ task_id: task.task_id, score: cand.score, reason: `기획 필요(${f.needs_planning.join(',')}) → ${req.id} · WAITING_CHATGPT` })
      continue
    }
    if (!f.ok) {
      skipped.push({ task_id: task.task_id, score: cand.score, reason: f.checks.filter((c) => !c.ok).map((c) => `${c.check}: ${c.detail}`).join(' / ') })
      continue
    }
    return { selected: { ...cand, feasibility: f }, skipped, ranking }
  }
  return { selected: null, skipped, ranking }
}

function createPlanningRequest(task, reasons, by) {
  const { state } = loadState()
  const q = [
    `작업 ${task.task_id} 「${task.title}」 을 실행하기 전에 심층 기획이 필요하다.`,
    `기획이 필요한 이유: ${reasons.join(', ')}`,
    `목표: ${task.goal_id} · 관련 ${task.related_goal_ids.join(', ') || '없음'}`,
    `설명: ${task.description}`,
    `현재 완료 조건: ${task.acceptance.map((a, i) => `[${i}] ${a}`).join(' / ')}`,
    `변경 허용: ${task.allowed_paths.join(', ')} · 금지: ${task.forbidden_paths.join(', ')}`,
    `실패 이력: ${JSON.stringify(task.orchestration?.failures ?? {})}`,
  ].join('\n\n')
  return createRequest({ topic: `${task.task_id} 기획 — ${reasons.join(',')}`, question: q, goal_ids: [task.goal_id], attachments: [], canon_version: state.goalStatus.canon_version, created_by: by, kind: 'plan', task_id: task.task_id })
}

// ── Claude ───────────────────────────────────────────────────────────────

export function claudePrompt(task, { reportPath, round, findings, doc }) {
  const goal = doc.criteria.find((c) => c.id === task.goal_id)
  const lines = [
    `You are Claude Code acting as owner "${task.owner_id}" in an automated, non-interactive run of the Vocaflow AI workflow (WF-S5). Work ONLY inside the current directory (git worktree ${task.worktree}, branch ${task.branch}). Answer files and commit messages in Korean.`,
    ``,
    `## Task ${task.task_id}: ${task.title}`,
    task.description,
    ``,
    `## Goal (canon v1.1.0) — ${goal.id} 「${goal.title}」`,
    ...goal.acceptance.map((a) => `- ${a.criterion_id}: ${a.condition}`),
    `This task's claim on those criteria: ${JSON.stringify(task.criterion_claims)} — do not claim more.`,
    ``,
    `## Scope`,
    `Allowed paths (you may change ONLY these): ${task.allowed_paths.join(', ')}`,
    `Forbidden: ${task.forbidden_paths.join(', ')} · any DB change · git push · deleting files outside scope · installing packages.`,
    ``,
    `## Acceptance (numbered — your test evidence must reference these numbers in "covers")`,
    ...task.acceptance.map((a, i) => `[${i}] ${a}`),
    ``,
    `## Required`,
    `1. Read AGENTS.md rules that apply (file-first-line path comment, no TODO, tests). Keep changes minimal.`,
    `2. Implement, then run the relevant tests (pnpm --filter web exec vitest run <files>, typecheck/lint for touched files as appropriate). Save each test command's full output to a log file under .vfc-runs/ in this worktree (create it; it is not committed).`,
    `3. Commit your changes with \`git add <files> && git commit --only <files> -F -\` (conventional message, last line: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>). Do NOT push.`,
    `4. Write the report JSON to: ${reportPath}`,
    `   {"task_id":"${task.task_id}","status":"implemented|blocked|failed","commit":"<sha>","changed_files":[...],"tests":[{"command":"...","result":"pass|fail|skip|not_run","skip_count":0,"skipped_files":[],"log_path":".vfc-runs/<file>.log","covers":[0]}],"notes":"...","findings_response":[{"finding_id":"F1","action":"fixed|false_positive|deferred","rationale":"...","evidence":"file:line or test"}]}`,
    `   If you cannot complete within scope, set status "blocked" and explain in notes — never widen scope.`,
  ]
  if (findings?.length) {
    lines.push(``, `## FINDINGS_TO_ADDRESS (round ${round}) — from independent Codex review`, `For each: fix it (action "fixed") or, if it is not a real defect for THIS task's approved scope, answer action "false_positive" with code evidence. Do not apply restrictions from other tasks.`)
    for (const f of findings) lines.push(`- ${f.id} [${f.severity}] ${f.file ?? ''}:${f.line ?? ''} — ${f.claim} · scenario: ${f.scenario ?? ''} · suggested fix: ${f.fix ?? ''}`)
  }
  return lines.join('\n')
}

function changedFiles(wt, base) {
  const committed = git(wt, ['diff', '--name-only', `${base}..HEAD`]).split('\n').filter(Boolean)
  const dirty = git(wt, ['status', '--porcelain'])
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).trim())
    .filter((f) => !f.startsWith('.vfc-runs/') && f !== '.agent-goal.md')
  return { committed, dirty }
}

/**
 * worktree 루트 .agent-goal.md(저장소 규칙 — 리뷰가 목적을 대조한다). 이미 사람이 쓴 파일이면 덮지 않는다:
 * vfc 가 만든 파일(첫 줄 표식)만 갱신한다. 파일은 .gitignore 대상이라 커밋되지 않는다.
 */
export function writeAgentGoal(task, doc) {
  const f = path.join(task.worktree, '.agent-goal.md')
  const MARK = '<!-- vfc:auto -->'
  if (fs.existsSync(f) && !fs.readFileSync(f, 'utf8').startsWith(MARK)) return false
  const goal = doc.criteria.find((c) => c.id === task.goal_id)
  const body = [
    MARK,
    `# 작업 단위 — ${task.task_id} (owner: ${task.owner_id}) · 오케스트레이터 자동 작성`,
    `플랫폼 목표 정본: D:/workspace/Vocaflow-AI-Control/goals/PROJECT_GOAL.md (v1.1.0) · 주 목표 ${goal.id} 「${goal.title}」 · claims ${JSON.stringify(task.criterion_claims)}`,
    '',
    '## 목적',
    `${task.title} — ${task.description}`,
    '',
    '## 수용 기준',
    ...task.acceptance.map((a, i) => `- [${i}] ${a}`),
    '',
    '## 변경 허용 범위',
    ...task.allowed_paths.map((x) => `- ${x}`),
    '',
    '## 하지 않을 것 — 이 작업 단위에만 적용',
    ...task.forbidden_paths.map((x) => `- ${x}`),
    `- DB 접근(db_scope=${task.db_scope.mode}) · git push · 범위 밖 변경`,
    '',
  ].join('\n')
  fs.writeFileSync(f, body)
  return true
}

/** Claude 1회 실행 + 보고서 검증 + 범위 검사 + 증거 기록. 실패 원인 문자열 또는 null. */
export function implementStep({ runId, task, round, findings, limits, deps }) {
  const doc = loadCriteria()
  const runDir = path.join(p.runs(), runId, `${task.task_id}-r${round}`)
  fs.mkdirSync(runDir, { recursive: true })
  const reportPath = path.join(runDir, 'claude-report.json').split(path.sep).join('/')
  const wt = task.worktree
  const base = task.orchestration?.base_commit || git(wt, ['rev-parse', 'HEAD'])
  if (!task.orchestration?.base_commit) withState((s) => (s.taskQueue.tasks.find((t) => t.task_id === task.task_id).orchestration.base_commit = base))
  writeAgentGoal(task, doc)
  const prompt = claudePrompt(task, { reportPath, round, findings, doc })
  fs.writeFileSync(path.join(runDir, 'claude-prompt.md'), prompt)
  runEvent(runId, { phase: 'implement', task_id: task.task_id, round })
  const r = deps.runClaude({ prompt, cwd: wt, budgetUsd: limits.claude_budget_usd, timeoutMs: limits.claude_timeout_ms, runDir })
  runEvent(runId, { phase: 'implement_done', task_id: task.task_id, round, cost_usd: r.cost_usd || 0, claude_code: r.code, timed_out: r.timed_out })
  withState((s) => {
    const t = s.taskQueue.tasks.find((x) => x.task_id === task.task_id)
    t.orchestration.budget_used_usd = Math.round(((t.orchestration.budget_used_usd || 0) + (r.cost_usd || 0)) * 10000) / 10000
  })
  const text = `${r.stdout}\n${r.stderr}\n${r.result_text ?? ''}`
  if (/usage limit|rate limit|quota/i.test(text) && r.is_error) return { cause: 'usage_limit', stop: true, detail: '사용량 제한 — 우회하지 않고 멈춘다' }
  if (/auth|login|unauthorized|api key/i.test(text) && r.is_error && !fs.existsSync(reportPath)) return { cause: 'auth', stop: true, detail: '인증 실패 — 우회하지 않고 멈춘다' }
  if (r.timed_out) return { cause: 'timeout', detail: `Claude 실행 시간 초과(${limits.claude_timeout_ms}ms)` }
  const rep = deps.readClaudeReport(reportPath, task)
  if (!rep.ok) return { cause: 'bad_report', detail: rep.error }
  const report = rep.report
  fs.copyFileSync(reportPath, path.join(runDir, 'claude-report.copy.json'))
  if (report.status !== 'implemented') return { cause: `claude_${report.status}`, detail: report.notes ?? '' , report }

  // 범위 검사 — 작업 범위 밖 변경은 되돌리지 않고 멈춘다(사람이 본다)
  const ch = changedFiles(wt, base)
  const outside = [...ch.committed, ...ch.dirty].filter((f) => !T.pathInScope(f, task.allowed_paths) || T.pathInScope(f, task.forbidden_paths))
  if (outside.length) return { cause: 'scope_violation', detail: `범위 밖 변경: ${outside.join(', ')}`, block: true, report }
  if (ch.dirty.length) return { cause: 'uncommitted', detail: `커밋 안 된 변경: ${ch.dirty.join(', ')}`, report }
  const head = git(wt, ['rev-parse', 'HEAD'])
  if (!head.startsWith(report.commit) && !report.commit.startsWith(head.slice(0, report.commit.length))) return { cause: 'commit_mismatch', detail: `보고 commit ${report.commit} ≠ HEAD ${head}`, report }

  // 증거: 보고서의 테스트 로그를 공간으로 복사해 기록(로그 파일이 실제로 있어야 한다)
  const evDir = path.join(root(), 'verification', 'tests', 'orch', runId)
  fs.mkdirSync(evDir, { recursive: true })
  for (const [i, t] of report.tests.entries()) {
    const src = path.isAbsolute(t.log_path) ? t.log_path : path.join(wt, t.log_path)
    if (!fs.existsSync(src)) return { cause: 'missing_log', detail: `테스트 로그 ${t.log_path} 가 없다`, report }
    const dest = path.join(evDir, `${task.task_id}-r${round}-t${i}.log`)
    fs.copyFileSync(src, dest)
    const rel = path.relative(root(), dest).split(path.sep).join('/')
    withState((s) =>
      T.addEvidence(
        s,
        task.task_id,
        { type: /e2e/.test(t.command) ? 'e2e' : /typecheck|lint|tsc|eslint/.test(t.command) ? 'ci' : 'unit', command_or_protocol: t.command, result: t.result, skip_count: t.skip_count, ...(t.skipped_files?.length ? { skipped_files: t.skipped_files } : {}), commit: head.slice(0, 12), artifact_path_or_url: rel, observed_at: localIso(), covers: t.covers },
        { caller: task.owner_id },
      ),
    )
  }
  return { cause: null, report, head, base }
}

function localIso() {
  const d = new Date(Date.now() + 9 * 3_600_000)
  return d.toISOString().slice(0, 19) + '+09:00'
}

// ── Codex ────────────────────────────────────────────────────────────────

export function codexPrompt(task, { base, head, report, round, falsePositives }) {
  if (!/^[0-9a-f]{7,40}$/.test(String(base)) || !/^[0-9a-f]{7,40}$/.test(String(head))) throw new Error(`Codex 리뷰 diff 범위가 잘못됐다(base=${base} head=${head})`)
  const { state } = loadState()
  const approvals = state.decisionLog.entries.filter((e) => e.status === 'APPROVED' && ((e.affects_goal_ids || []).includes(task.goal_id) || e.kind === 'strategy')).map((e) => `${e.decision_id}: ${e.summary}`)
  const lines = [
    `You are Codex acting as owner "${REVIEWER}", independent of the implementer (${task.owner_id}). READ-ONLY: do not modify files. Answer in Korean.`,
    `Review task ${task.task_id} 「${task.title}」 (goal ${task.goal_id}, round ${round}).`,
    `Diff: git -C ${task.worktree} diff ${base}..${head}`,
    `Task spec (scope, acceptance, evidence): node ${path.join(root(), 'bin', 'vfc.mjs').split(path.sep).join('/')} task show ${task.task_id}`,
    `Canon: ${path.join(root(), 'goals', 'GOAL_ACCEPTANCE_CRITERIA.json').split(path.sep).join('/')}`,
    `Approval basis: ${approvals.join(' | ') || task.approval?.reference || '없음(승인 불필요 작업)'}`,
    `Implementer report: ${JSON.stringify(report).slice(0, 4000)}`,
    `Look for: real defects, goal deviation, regressions, unsupported completion claims, unapproved DB changes, unnecessary scope expansion. Apply ONLY this task's scope; restrictions from other tasks' purpose files do not apply — mark such items scope "out".`,
  ]
  if (falsePositives?.length) lines.push(`The implementer contested these earlier findings as false positives (judge the rationale against the code): ${JSON.stringify(falsePositives)}`)
  lines.push(
    'End with exactly one block:',
    '```json vfc-review',
    '{"verdict":"APPROVE|REQUEST_CHANGES","findings":[{"id":"F1","severity":"P0|P1|P2|P3","scope":"in|out","file":"path","line":0,"claim":"...","scenario":"...","fix":"..."}],"ran_tests":false,"notes":"..."}',
    '```',
    'REQUEST_CHANGES only for in-scope P0/P1. ran_tests=true only if you actually executed tests.',
  )
  return lines.join('\n')
}

// ── 한 작업 처리 ─────────────────────────────────────────────────────────

function bump(taskId, cause) {
  return withState((s) => {
    const t = s.taskQueue.tasks.find((x) => x.task_id === taskId)
    t.orchestration.failures[cause] = (t.orchestration.failures[cause] || 0) + 1
    return t.orchestration.failures[cause]
  })
}

function block(taskId, owner, reason) {
  withState((s, ctx) => T.blockTask(s, taskId, { caller: owner, reason }, ctx), { event: 'task.block', task: taskId, by: 'orchestrator' })
}

/** 작업 하나: 시작 → (구현 → 리뷰) 반복 → 완료 또는 BLOCKED. 반환: { outcome, stop? } */
export function processTask({ runId, taskId, limits, deps, pid }) {
  const session = { label: `orch-${runId}`, agent: 'orchestrator', pid }
  let task = loadState().state.taskQueue.tasks.find((t) => t.task_id === taskId)
  let findings = null
  let falsePositives = []
  for (let round = (task.orchestration.rounds || 0) + 1; ; round++) {
    if (budgetExceeded(runId, limits)) return { outcome: 'budget_stop', stop: true }
    if (fs.existsSync(p.stopFile())) return { outcome: 'user_stop', stop: true }
    if (round > limits.max_review_rounds) {
      block(taskId, task.owner_id, `리뷰·수정 반복 상한(${limits.max_review_rounds}) 도달 — 남은 P0/P1: ${JSON.stringify(findings?.map((f) => f.id) ?? [])}`)
      return { outcome: 'blocked_review_limit' }
    }
    withState((s, ctx) => {
      const t = s.taskQueue.tasks.find((x) => x.task_id === taskId)
      t.orchestration.rounds = round
      return T.startTask(s, taskId, { owner_id: t.owner_id, session, pid }, ctx)
    }, { event: 'task.start', task: taskId, by: 'orchestrator' })
    task = loadState().state.taskQueue.tasks.find((t) => t.task_id === taskId)

    const impl = implementStep({ runId, task, round, findings, limits, deps })
    if (impl.cause) {
      const n = bump(taskId, impl.cause)
      runEvent(runId, { phase: 'implement_failed', task_id: taskId, round, cause: impl.cause, detail: impl.detail, count: n })
      if (impl.stop) {
        block(taskId, task.owner_id, `${impl.cause}: ${impl.detail}`)
        return { outcome: impl.cause, stop: true }
      }
      if (impl.block || n >= limits.max_same_failure) {
        block(taskId, task.owner_id, `${impl.cause} ×${n}: ${impl.detail}`)
        return { outcome: `blocked_${impl.cause}` }
      }
      withState((s, ctx) => T.failTask(s, taskId, { caller: task.owner_id, reason: `${impl.cause}: ${impl.detail}` }, ctx))
      withState((s) => {
        const t = s.taskQueue.tasks.find((x) => x.task_id === taskId)
        t.history.push({ at: nowIso(), from: 'FAILED', to: 'READY', by: 'orchestrator', note: `재시도(${impl.cause} ${n}/${limits.max_same_failure})` })
        t.status = 'READY'
      })
      continue
    }
    falsePositives = (impl.report.findings_response || []).filter((f) => f.action === 'false_positive')
    if (falsePositives.length) recordFalsePositives(taskId, round, falsePositives)

    withState((s, ctx) => T.submitForReview(s, taskId, { caller: task.owner_id }, ctx), { event: 'task.submit', task: taskId, by: 'orchestrator' })
    runEvent(runId, { phase: 'review', task_id: taskId, round })
    const runDir = path.join(p.runs(), runId, `${taskId}-r${round}`)
    const cr = deps.runCodex({ prompt: codexPrompt(task, { base: impl.base, head: impl.head, report: impl.report, round, falsePositives }), cwd: task.worktree, timeoutMs: limits.codex_timeout_ms, runDir })
    const parsed = deps.parseReview(cr.stdout)
    const reviewRel = `verification/reviews/${taskId}-orch-${runId}-r${round}.md`
    fs.mkdirSync(path.join(root(), 'verification', 'reviews'), { recursive: true })
    fs.writeFileSync(path.join(root(), reviewRel), `# ${taskId} — Codex 리뷰 (orchestrator ${runId} · round ${round})\n\n- 파싱: ${parsed.ok ? 'ok' : parsed.error}\n- ran_tests: ${parsed.review?.ran_tests ?? '?'}(false 면 Codex 는 테스트를 직접 실행하지 않았다)\n\n\`\`\`json\n${JSON.stringify(parsed.review ?? null, null, 2)}\n\`\`\`\n`)
    if (!parsed.ok) {
      const n = bump(taskId, 'bad_review')
      runEvent(runId, { phase: 'review_failed', task_id: taskId, round, detail: parsed.error, count: n })
      withState((s) => T.rejectReview(s, taskId, { caller: REVIEWER, reason: `리뷰 출력 판독 실패: ${parsed.error}`, review_path: reviewRel }))
      if (n >= limits.max_same_failure) {
        block(taskId, task.owner_id, `Codex 리뷰 판독 실패 ×${n}`)
        return { outcome: 'blocked_bad_review' }
      }
      findings = null
      continue
    }
    const blocking = parsed.review.findings.filter((f) => ['P0', 'P1'].includes(f.severity) && f.scope === 'in')
    runEvent(runId, { phase: 'review_done', task_id: taskId, round, verdict: parsed.review.verdict, blocking: blocking.map((f) => f.id) })
    if (blocking.length || parsed.review.verdict === 'REQUEST_CHANGES') {
      withState((s) => T.rejectReview(s, taskId, { caller: REVIEWER, reason: `P0/P1 ${blocking.map((f) => f.id).join(',')}`, review_path: reviewRel }))
      findings = blocking.length ? blocking : parsed.review.findings
      continue
    }
    try {
      withState((s) => T.completeTask(s, taskId, { caller: REVIEWER, review_path: reviewRel }), { event: 'task.complete', task: taskId, by: 'orchestrator' })
    } catch (e) {
      // 리뷰는 통과했지만 증거가 완료 조건을 덮지 못했다 — 같은 원인 반복이면 BLOCKED
      const n = bump(taskId, 'acceptance_uncovered')
      withState((s) => T.rejectReview(s, taskId, { caller: REVIEWER, reason: `완료 판정 거부: ${e.message}`, review_path: reviewRel }))
      runEvent(runId, { phase: 'complete_refused', task_id: taskId, round, detail: e.message, count: n })
      if (n >= limits.max_same_failure) {
        block(taskId, task.owner_id, `완료 조건 미충족 ×${n}: ${e.message}`)
        return { outcome: 'blocked_acceptance' }
      }
      findings = [{ id: 'ACC', severity: 'P1', scope: 'in', claim: `완료 판정 거부: ${e.message}`, fix: '모든 완료 조건 번호를 covers 로 덮는 통과 증거(로그)를 남겨라' }]
      continue
    }
    return { outcome: 'completed' }
  }
}

function recordFalsePositives(taskId, round, fps) {
  const rel = `verification/reviews/${taskId}-false-positive-r${round}.md`
  const { state } = loadState()
  const t = state.taskQueue.tasks.find((x) => x.task_id === taskId)
  const body = [`# ${taskId} — 오탐 판정 기록 (round ${round})`, ``, `작업 승인 범위: goal ${t.goal_id} · allowed ${t.allowed_paths.join(', ')} · 승인 ${t.approval?.reference ?? '불필요'}`, ``, ...fps.map((f) => `- ${f.finding_id}: ${f.rationale} · 근거 ${f.evidence ?? ''}`)].join('\n')
  fs.writeFileSync(path.join(root(), rel), body)
}

function budgetExceeded(runId, limits) {
  const r = getRun(runId)
  const minutes = (Date.now() - Date.parse(r.started_at)) / 60_000
  if (minutes > limits.max_minutes) return `시간 상한 ${limits.max_minutes}분`
  if (r.cost_usd >= limits.max_cost_usd) return `비용 상한 $${limits.max_cost_usd}`
  return null
}

// ── 지속 실행기 ──────────────────────────────────────────────────────────

/** 이전 run 이 비정상 종료됐으면 복구: run 을 aborted 로 닫고, 그 run 이 쥔 작업을 reap → 자기 작업이면 READY 로 되살린다. */
export function recoverPrevious({ by = 'orchestrator' } = {}) {
  const { state } = loadState()
  const cur = state.orchestrator.current_run && state.orchestrator.runs[state.orchestrator.current_run]
  if (!cur || cur.status !== 'running') return null
  if (cur.host === os.hostname() && pidAlive(cur.pid)) return { alive: true, run_id: cur.run_id }
  const reaped = withState((s, ctx) => T.reapAbandoned(s, { by }, ctx), { event: 'task.reap', by })
  const revived = withState((s) => {
    const out = []
    for (const t of s.taskQueue.tasks) {
      if (t.status === 'BLOCKED' && /죽었다/.test(t.blocker?.reason || '') && String(t.run?.session || '').startsWith(`orch-${cur.run_id}`)) {
        t.blocker = null
        t.history.push({ at: nowIso(), from: 'BLOCKED', to: 'READY', by, note: `orchestrator 복구 — run ${cur.run_id} 비정상 종료(phase ${cur.phase})` })
        t.status = 'READY'
        out.push(t.task_id)
      }
    }
    const r = s.orchestrator.runs[cur.run_id]
    r.status = 'aborted'
    r.stop_reason = `프로세스 pid ${cur.pid} 비정상 종료 — 다음 실행이 복구(phase ${cur.phase})`
    r.recovered_at = nowIso()
    return out
  })
  appendLog(p.eventLog(), { at: nowIso(), event: 'orchestrator.recovered', run: cur.run_id, phase: cur.phase, reaped, revived })
  return { recovered: cur.run_id, phase: cur.phase, reaped, revived }
}

export function runOrchestrator({ limits: lim = {}, deps, tools = ['git', 'claude', 'codex'], ciEnabled = true, dryRun = false } = {}) {
  const limits = { ...DEFAULT_LIMITS, ...lim }
  const pid = process.pid
  // 싱글턴의 주인은 이 프로세스 자신 — pid 가 살아 있으면 ttl 이 지나도 회수되지 않는다(judge: suspect).
  // 그래서 ttl 을 짧게 둬도 안전하고, 죽었을 때 다음 실행이 빨리 복구한다. (spawnSync 중에는 heartbeat 가 멈추지만 pid 가 살아 있다)
  const single = acquire(SINGLETON, { owner_id: 'orchestrator', purpose: 'single writer', pid, ttl_ms: Number(process.env.VFC_ORCH_TTL_MS || 5 * 60_000) })
  if (!single.ok) return { status: 'refused', reason: `다른 오케스트레이터가 실행 중이다(${single.judgement.reason}) — 단일 writer 모드` }
  const hb = setInterval(() => heartbeat(SINGLETON, single.token), 60_000)
  hb.unref?.()
  const recovery = recoverPrevious()
  const runId = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${crypto.randomBytes(3).toString('hex')}`
  withState((s) => {
    s.orchestrator.current_run = runId
    s.orchestrator.runs[runId] = { run_id: runId, pid, host: os.hostname(), started_at: nowIso(), limits, status: 'running', phase: 'start', task_id: null, cost_usd: 0, tasks_done: [], events: [], recovery }
  }, { event: 'orchestrator.start', run: runId })
  const summary = { run_id: runId, recovery, iterations: [] }
  let stopReason = null
  try {
    for (let n = 0; ; n++) {
      if (fs.existsSync(p.stopFile())) {
        stopReason = '사용자 중단(runtime/STOP)'
        break
      }
      const over = budgetExceeded(runId, limits)
      if (over) {
        stopReason = over
        break
      }
      runEvent(runId, { phase: 'goal_check' })
      const gc = goalCheckStep({ deps, ciEnabled })
      runEvent(runId, { phase: 'select', goal_check: gc.report, changes: gc.changes })
      if (getRun(runId).tasks_done.length >= limits.max_tasks) {
        stopReason = `작업 수 상한 ${limits.max_tasks}`
        summary.iterations.push({ goal_check: gc.report, changes: gc.changes, distribution: gc.distribution })
        break
      }
      const sel = selectStep({ runId, tools, pid })
      const it = { goal_check: gc.report, changes: gc.changes, distribution: gc.distribution, selected: sel.selected ? { task_id: sel.selected.task_id, score: sel.selected.score, reasons: sel.selected.reasons } : null, skipped: sel.skipped, uncovered: sel.ranking.uncovered.slice(0, 10) }
      summary.iterations.push(it)
      runEvent(runId, { phase: 'selected', task_id: it.selected?.task_id ?? null, skipped: sel.skipped })
      if (!sel.selected) {
        stopReason = '실행 가능한 작업 없음'
        break
      }
      if (dryRun) {
        stopReason = 'dry-run — 선정까지만'
        break
      }
      const res = processTask({ runId, taskId: sel.selected.task_id, limits, deps, pid })
      it.outcome = res.outcome
      withState((s) => s.orchestrator.runs[runId].tasks_done.push({ task_id: sel.selected.task_id, outcome: res.outcome, at: nowIso() }))
      runEvent(runId, { phase: 'task_done', task_id: sel.selected.task_id, outcome: res.outcome })
      if (res.stop) {
        stopReason = res.outcome
        break
      }
    }
    // 마지막 목표 재검사 — 작업 결과가 반영된 상태
    const final = goalCheckStep({ deps, ciEnabled })
    summary.final_goal_check = { report: final.report, changes: final.changes, distribution: final.distribution }
    withState((s) => Object.assign(s.orchestrator.runs[runId], { status: 'done', stop_reason: stopReason, phase: 'done', ended_at: nowIso() }), { event: 'orchestrator.done', run: runId })
  } catch (e) {
    withState((s) => Object.assign(s.orchestrator.runs[runId], { status: 'stopped', stop_reason: `오류: ${e.message}`, ended_at: nowIso() }))
    summary.error = e.message
  } finally {
    clearInterval(hb)
    release(SINGLETON, single.token)
  }
  summary.stop_reason = stopReason
  summary.run = getRun(runId)
  return summary
}
