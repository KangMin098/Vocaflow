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
import { fileURLToPath } from 'node:url'
import { runProcess } from './agents.mjs'
import { p, root, normalizeWorktree } from './paths.mjs'
import { withState, loadState } from './state.mjs'
import { acquire, release, heartbeat, pidAlive } from './lock.mjs'
import { loadCriteria } from './goals.mjs'
import * as T from './tasks.mjs'
import { computeGoalCheck, applyGoalCheck, CI_RULES } from './goalcheck.mjs'
import { rankTasks } from './priority.mjs'
import { sameGoalPreference, goalLevel } from './alignment.mjs'
import { pathRisk, highApprovalKind } from './policy.mjs'
import { goalMode, writeInbox } from './dispatch.mjs'
import { checkFeasibility } from './feasibility.mjs'
import { reviewGate } from './review-verdicts.mjs'
import * as UG from './usergoals.mjs'
import * as CTX from './context.mjs'
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

// 리뷰 정책 버전(정본 hooks/codex-review-policy.mjs POLICY_VERSION 과 같은 값). 작업이 처음 라운드를 시작할 때 찍고 끝날 때까지 바꾸지 않는다.
// 이 판부터: require_review_pass 가 아닌 작업은 구현 세션의 Stop 훅 리뷰(low)를 건너뛰고 이 오케스트레이터의 독립 리뷰(medium/high) 하나로 본다.
// require_review_pass(CRITICAL) 작업은 그대로 둘 다 받는다 — 그 커밋의 Stop REVIEW_PASS 는 별도 게이트다(약화 금지).
export const REVIEW_POLICY_VERSION = 'RP-2026-10-10.1'
/** 구현 세션 Stop 리뷰를 독립 리뷰에 맡기는가 — 이 판에서 시작한 · CRITICAL 이 아닌 작업만(이전 판 작업은 소급하지 않는다) */
export const stopReviewDeferred = (task) => !task.require_review_pass && task.orchestration?.review_policy === REVIEW_POLICY_VERSION
const SINGLETON = 'orchestrator--singleton'

const nowIso = () => new Date().toISOString()

// 같은 diff 의 중복 리뷰 방지 — (작업 · diff 내용 · 리뷰 입력 계약) 이 같고 직전 판정이 APPROVE(차단 0)면 그 판정을 다시 쓴다.
// REQUEST_CHANGES·판독 실패는 캐시하지 않는다(재리뷰가 의미 있다). 계약이 바뀌면 키가 바뀐다.
const reviewCacheFile = () => path.join(root(), 'runtime', 'review-cache.json')
function reviewKey(task, diffText, report) {
  // 프롬프트의 실질 입력(구현자 보고서 포함)이 같을 때만 같은 키 — 보고서·증거만 바뀐 라운드도 다시 리뷰한다(Codex P2)
  const contract = JSON.stringify([report ?? null, task.acceptance, task.allowed_paths, task.forbidden_paths, task.criterion_claims, task.impact?.acceptance_ids ?? null, task.design_version ?? null])
  return `${task.task_id}:${crypto.createHash('sha256').update(diffText).digest('hex')}:${crypto.createHash('sha256').update(contract).digest('hex').slice(0, 16)}`
}
function readReviewCache() {
  try {
    return JSON.parse(fs.readFileSync(reviewCacheFile(), 'utf8'))
  } catch {
    return {}
  }
}
function writeReviewCache(key, entry) {
  const c = readReviewCache()
  c[key] = entry
  fs.mkdirSync(path.dirname(reviewCacheFile()), { recursive: true })
  fs.writeFileSync(reviewCacheFile(), JSON.stringify(c, null, 1))
}

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
export function selectStep({ runId, tools, pid, by = 'orchestrator', allowPlanning = true, last = null }) {
  const doc = loadCriteria()
  const { state } = loadState()
  const ranking = rankTasks({ doc, state })
  const skipped = []
  // 사용자 지정 목표(WF-S7): USER_GOAL 모드면 활성 목표 작업이 먼저(tier 0) — 진행 가능한 작업이 있는 한 다른 목표로 옮기지 않는다.
  // 설계 미승인·SUPERSEDED 설계·재검증 필요 작업은 모드와 무관하게 고르지 않는다. 같은 tier 안은 기존 우선순위 순서 그대로.
  const gated = []
  for (const cand of ranking.ranked) {
    const task = state.taskQueue.tasks.find((t) => t.task_id === cand.task_id)
    const gate = UG.selectionGate(state, task)
    if (!gate.allow) skipped.push({ task_id: cand.task_id, score: cand.score, reason: `user_goal: ${gate.reason}` })
    else gated.push({ cand, tier: gate.tier, pref: sameGoalPreference(task, last) })
  }
  // tier(실행 모드) → 방금 끝난 작업과 같은 상위 목표·그 작업에 의존하는 작업 → 기존 점수 순(안정 정렬)
  gated.sort((a, b) => a.tier - b.tier || a.pref - b.pref)
  for (const { cand } of gated) {
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
    `   "tests" holds ONLY runs on the final commit that passed (each with non-empty "covers"). Put red-step (before-fix failing) logs and not-run checks in "notes" with their log paths, not in "tests".`,
    `   If you cannot complete within scope, set status "blocked" and explain in notes — never widen scope.`,
  ]
  // 사용자 지정 목표(WF-S7): 승인된 설계 버전의 요약·계약을 붙이고, 설계 자체가 틀렸으면 코드로 우회하지 말고 design_issue 로 보고하게 한다
  const ug = task.user_goal_id ? loadState().state.userGoals?.goals?.[task.user_goal_id] : null
  const appr = ug && UG.approvedDesign(ug)
  if (appr) {
    lines.push(
      ``,
      `## User goal ${ug.ug_id} 「${ug.title}」 — approved design v${appr.version} (profile ${ug.profile})`,
      appr.summary,
      `Design acceptance: ${appr.acceptance.map((a, i) => `[${i}] ${a}`).join(' / ')}`,
      `Preserved contracts: ${(appr.preserved_contracts || []).join(' / ') || '(none)'}`,
      `If the approved design itself is wrong or conflicts with the code/canon (not a mere code bug), do NOT work around it: set status "blocked" and add`,
      `   "design_issue":{"problem":"...","evidence":["file:line",...],"conflicts_with":"which design point","alternatives":["..."],"question":"what ChatGPT must decide","approval_scope_change":false}`,
    )
  }
  if (findings?.length) {
    lines.push(``, `## FINDINGS_TO_ADDRESS (round ${round}) — from independent Codex review`, `For each: fix it (action "fixed") or, if it is not a real defect for THIS task's approved scope, answer action "false_positive" with code evidence. Do not apply restrictions from other tasks.`)
    for (const f of findings) lines.push(`- ${f.id} [${f.severity}] ${f.file ?? ''}:${f.line ?? ''} — ${f.claim} · scenario: ${f.scenario ?? ''} · suggested fix: ${f.fix ?? ''}`)
  }
  return lines.join('\n')
}

/** 이 작업 밖 worktree(다른 owner · 같은 owner 의 다른 worktree)의 git 상태 스냅샷 — 자동 실행이 범위 밖을 썼는지 대조 */
export function snapshotOtherWorktrees(task) {
  const { state } = loadState()
  const snap = {}
  for (const o of Object.values(state.ownership.owners)) {
    for (const w of o.worktrees) {
      if (w.path === task.worktree || !fs.existsSync(w.path)) continue
      // 테스트 전용: 시드 owner 의 실제 worktree(다른 세션이 쓰는 중일 수 있다)를 감시 대상에서 빼 테스트 간섭을 없앤다. 운영에서는 설정하지 않는다
      // 8.3 짧은 이름(ADMINI~1)과 긴 이름이 섞이므로 둘 다 실경로로 펴서 비교한다
      if (process.env.VFC_SNAPSHOT_ONLY_UNDER && !normalizeWorktree(w.path).startsWith(normalizeWorktree(process.env.VFC_SNAPSHOT_ONLY_UNDER) + '/')) continue
      try {
        snap[w.path] = git(w.path, ['status', '--porcelain']) + '\n' + git(w.path, ['rev-parse', 'HEAD'])
      } catch {
        snap[w.path] = null
      }
    }
  }
  return snap
}

export function diffSnapshots(a, b) {
  return Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k])
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
  // 자식 pid 파일 위치를 먼저 기록 — 이 프로세스가 죽어도 복구가 자식 생존을 확인할 수 있게
  withState((s) => {
    const t = s.taskQueue.tasks.find((x) => x.task_id === task.task_id)
    if (t.run) t.run.child_pid_files = [path.join(runDir, 'claude.pid.json'), path.join(runDir, 'codex.pid.json')].map((x) => x.split(path.sep).join('/'))
  })
  const before = snapshotOtherWorktrees(task)
  const deferStop = stopReviewDeferred(task)
  runEvent(runId, { phase: 'review_policy', task_id: task.task_id, round, review_policy: task.orchestration?.review_policy ?? 'RP-v1', stop_review: deferStop ? 'deferred_to_independent' : 'stop_hook' })
  const r = deps.runClaude({ prompt, cwd: wt, budgetUsd: limits.claude_budget_usd, timeoutMs: limits.claude_timeout_ms, runDir, extraEnv: deferStop ? { VFC_REVIEW_DEFER: 'orchestrator', VFC_TASK_ID: task.task_id } : {} })
  const touchedOthers = diffSnapshots(before, snapshotOtherWorktrees(task))
  if (touchedOthers.length) return { cause: 'foreign_worktree_write', detail: `다른 owner 의 worktree 가 실행 중 바뀌었다: ${touchedOthers.join(', ')}`, block: true, stop: true }
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
  // 위험 HIGH 파일(DB·정본·인증·비밀·배포·의존성)은 범위 glob 안이라도 자동 작업에서 바꾸지 않는다 — 별도 승인(Codex P1)
  // 파일마다 그 종류의 승인이 실제로 기록됐을 때만(다른 종류의 승인으로 풀리지 않는다 · Codex P1)
  const approvedKinds = new Set(task.approval?.kinds || [])
  const high = [...ch.committed, ...ch.dirty].filter((f) => pathRisk(f) === 'HIGH' && !(highApprovalKind(f) && approvedKinds.has(highApprovalKind(f))))
  if (high.length) return { cause: 'high_risk_change', detail: `위험 HIGH 파일 변경: ${high.join(', ')} — 별도 사용자 승인 필요`, block: true, report }
  if (ch.dirty.length) return { cause: 'uncommitted', detail: `커밋 안 된 변경: ${ch.dirty.join(', ')}`, report }
  const head = git(wt, ['rev-parse', 'HEAD'])
  if (!head.startsWith(report.commit) && !report.commit.startsWith(head.slice(0, report.commit.length))) return { cause: 'commit_mismatch', detail: `보고 commit ${report.commit} ≠ HEAD ${head}`, report }

  // 증거: 보고서의 테스트 로그를 공간으로 복사해 기록(로그 파일이 실제로 있어야 한다)
  const evDir = path.join(root(), 'verification', 'tests', 'orch', runId)
  fs.mkdirSync(evDir, { recursive: true })
  // 실행하지 않았고 아무 조건도 덮지 않는 항목은 증거가 아니라 메모다 — 증거로 넣으려다 실행 전체가 멈췄다(T-0012 실측)
  const evidenceTests = report.tests.filter((t) => !(t.result === 'not_run' && !(t.covers || []).length))
  // 증거 규칙 위반(빈 covers · 범위 밖 번호 · 수정 전 실패 로그 등)은 실행 오류가 아니라 재작업 사유다 — 먼저 전부 검사한다
  for (const t of evidenceTests) {
    if (!Array.isArray(t.covers) || !t.covers.length || t.covers.some((c) => !Number.isInteger(c) || c < 0 || c >= task.acceptance.length)) return { cause: 'bad_evidence', detail: `증거 「${t.command}」 의 covers 는 0~${task.acceptance.length - 1} 의 비지 않은 배열이어야 한다`, report }
    if (t.result !== 'pass') return { cause: 'bad_evidence', detail: `증거 「${t.command}」 결과 ${t.result} — 보고서 tests 에는 최종 커밋에서 통과한 실행만 넣는다(수정 전 실패 확인은 notes 에 로그 경로와 함께 적는다)`, report }
  }
  for (const [i, t] of evidenceTests.entries()) {
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

/** 목표 정렬 질문 Q1 — 겨냥 기준은 지금 작업 필드에서 만든다(설계 재결속 뒤 옛 impact 를 쓰지 않는다 · Codex P2) */
export function codexPromptAlignmentForTest(task) {
  return alignmentQuestion(task)
}
function alignmentQuestion(task) {
  const head = 'Goal alignment (answer both in notes; report a "no" to Q1 or a "yes" to Q2 as an in-scope P1 finding):'
  if (task.impact?.kind === 'independent') return `${head} Q1 (independent user-requested task — not tied to canon goals) Does this change satisfy the task's own acceptance conditions ${JSON.stringify(task.acceptance)} for user request ${task.impact.user_request_ref}?`
  const ids = task.user_goal_id ? (task.design_acceptance || []).map((i) => `${task.user_goal_id}@v${task.design_version}#${i}`) : (task.impact?.acceptance_ids ?? (task.criterion_claims || []).map((c) => c.criterion_id))
  const gap = task.user_goal_id ? `설계 v${task.design_version} 수용 기준 [${(task.design_acceptance || []).join(',')}]` : task.impact?.current_gap ?? 'n/a'
  return `${head} Q1 Does this change contribute to the targeted unmet acceptance criteria ${JSON.stringify(ids)} (gap: ${gap}; dependency ${task.impact?.dependency_type ?? 'direct'})?`
}

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
    alignmentQuestion(task),
    `Q2 Does the change, its report, or its docs claim a goal/criterion is complete that this change does not actually satisfy (e.g. a prerequisite or one sub-path presented as the whole goal)?`,
  ]
  if (falsePositives?.length) lines.push(`The implementer contested these earlier findings as false positives (judge the rationale against the code): ${JSON.stringify(falsePositives)}`)
  lines.push(
    'End with exactly one block:',
    '```json vfc-review',
    '{"verdict":"APPROVE|REQUEST_CHANGES","findings":[{"id":"F1","severity":"P0|P1|P2|P3","scope":"in|out","kind":"code|design","file":"path","line":0,"claim":"...","scenario":"...","fix":"..."}],"ran_tests":false,"notes":"..."}',
    '```',
    'REQUEST_CHANGES only for in-scope P0/P1. ran_tests=true only if you actually executed tests.',
    'kind "design" only when the approved design itself is wrong (not a code bug) — it routes to a ChatGPT design re-query instead of a Claude fix.',
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

/**
 * 설계 쟁점 → 구조화 재질의(WF-S7). 작업은 DESIGN_CONFLICT 사유로 BLOCKED(설계 v 승인 시 approveDesign 이 자동 재개).
 * 같은 쟁점 재질의 예산을 넘으면 DESIGN_BUDGET 으로 BLOCKED(사람 판단) — 어느 쪽이든 오케스트레이터는 다른 독립 작업으로 간다.
 */
function designConflict({ runId, task, issue, head, round }) {
  const { state } = loadState()
  try {
    let context = null
    try {
      context = CTX.buildContext(state, task.user_goal_id)
    } catch {
      context = null // 패킷 실패는 요청을 막지 않는다 — 요청서에 「패킷 없음」 이 적힌다
    }
    const req = UG.requestDesign(withState, task.user_goal_id, { context, purpose: 'design_conflict', issue: { ...issue, attachments: (issue.attachments || []).filter((f) => fs.existsSync(f)) }, base_commit: head, canon_version: state.goalStatus.canon_version, by: 'orchestrator' })
    block(task.task_id, task.owner_id, `DESIGN_CONFLICT: ${req.id} — ${String(issue.problem).slice(0, 160)}`)
    runEvent(runId, { phase: 'design_conflict', task_id: task.task_id, round, request_id: req.id })
    return { outcome: 'waiting_design' }
  } catch (e) {
    if (!(e instanceof T.RuleError) || !['REQUERY_BUDGET', 'ROUND_PENDING'].includes(e.code)) throw e
    block(task.task_id, task.owner_id, `${e.code === 'REQUERY_BUDGET' ? 'DESIGN_BUDGET' : 'DESIGN_CONFLICT'}: ${e.message}`)
    runEvent(runId, { phase: 'design_conflict_held', task_id: task.task_id, round, detail: e.message })
    return { outcome: e.code === 'REQUERY_BUDGET' ? 'blocked_design_budget' : 'waiting_design' }
  }
}

/** 작업 하나: 시작 → (구현 → 리뷰) 반복 → 완료 또는 BLOCKED. 반환: { outcome, stop? } */
export function processTask({ runId, taskId, limits, deps, pid }) {
  const session = { label: `orch-${runId}`, agent: 'orchestrator', pid }
  let task = loadState().state.taskQueue.tasks.find((t) => t.task_id === taskId)
  // 사용자 목표 프로필은 예산만 줄인다(승인·무결성 게이트는 그대로)
  limits = UG.limitsFor(loadState().state, task, limits)
  let findings = null
  let falsePositives = []
  for (let round = (task.orchestration.rounds || 0) + 1; ; round++) {
    if (budgetExceeded(runId, limits)) return { outcome: 'budget_stop', stop: true }
    if (fs.existsSync(p.stopFile())) return { outcome: 'user_stop', stop: true }
    if (task.user_goal_id) {
      const left = UG.policyBudgetLeft(loadState().state, task.user_goal_id)
      if (left !== null && left <= 0) {
        block(taskId, task.owner_id, `목표 정책 비용 상한 도달 — 남은 예산 0$`)
        return { outcome: 'blocked_goal_budget' }
      }
      if (left !== null) limits = { ...limits, claude_budget_usd: Math.min(limits.claude_budget_usd, left) }
    }
    if (round > limits.max_review_rounds) {
      block(taskId, task.owner_id, `리뷰·수정 반복 상한(${limits.max_review_rounds}) 도달 — 남은 P0/P1: ${JSON.stringify(findings?.map((f) => f.id) ?? [])}`)
      return { outcome: 'blocked_review_limit' }
    }
    withState((s, ctx) => {
      const t = s.taskQueue.tasks.find((x) => x.task_id === taskId)
      t.orchestration.rounds = round
      // 첫 라운드에서만 지금 판을 찍는다 — 이전 판에서 라운드를 시작한 작업(재개 포함)은 끝날 때까지 v1
      if (!t.orchestration.review_policy) t.orchestration.review_policy = round === 1 ? REVIEW_POLICY_VERSION : 'RP-v1'
      return T.startTask(s, taskId, { owner_id: t.owner_id, session, pid }, ctx)
    }, { event: 'task.start', task: taskId, by: 'orchestrator' })
    task = loadState().state.taskQueue.tasks.find((t) => t.task_id === taskId)

    const impl = implementStep({ runId, task, round, findings, limits, deps })
    // 설계 쟁점(WF-S7): Claude 가 구현 중 설계 문제를 구조화해 보고하면 코드 루프가 아니라 ChatGPT 재질의로 보낸다(사용자 목표 작업만)
    if (impl.report?.design_issue && task.user_goal_id) {
      const dc = designConflict({ runId, task, issue: impl.report.design_issue, head: impl.head, round })
      if (dc) return dc
    }
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

    // Stop 훅이 이 커밋을 이미 막았으면 리뷰·재구현 라운드로 가지 않는다 — 즉시 BLOCKED, 다른 독립 작업으로(Codex 리뷰 P1)
    const hookGate = reviewGate(impl.head)
    if (hookGate.state === 'blocked') {
      runEvent(runId, { phase: 'stop_hook_blocked', task_id: taskId, round, head: impl.head })
      block(taskId, task.owner_id, `REVIEW_BLOCKED: Stop 훅 판정(${hookGate.record.kind}) 커밋 ${String(impl.head).slice(0, 9)} — 완료·병합·배포 금지`)
      return { outcome: 'blocked_review_verdict' }
    }
    withState((s, ctx) => T.submitForReview(s, taskId, { caller: task.owner_id }, ctx), { event: 'task.submit', task: taskId, by: 'orchestrator' })
    runEvent(runId, { phase: 'review', task_id: taskId, round })
    const runDir = path.join(p.runs(), runId, `${taskId}-r${round}`)
    let diffText = null
    try {
      diffText = git(task.worktree, ['diff', `${impl.base}..${impl.head}`])
    } catch {
      diffText = null
    }
    const rKey = diffText !== null ? reviewKey(task, diffText, impl.report) : null
    const cached = rKey && !falsePositives.length ? readReviewCache()[rKey] : null
    let cr
    let parsed
    if (cached) {
      cr = { stdout: cached.stdout, cost_usd: 0, ms: 0 }
      parsed = { ok: true, review: cached.review }
      runEvent(runId, { phase: 'review_cache_hit', task_id: taskId, round, from: cached.review_rel })
    } else {
      cr = deps.runCodex({ prompt: codexPrompt(task, { base: impl.base, head: impl.head, report: impl.report, round, falsePositives }), cwd: task.worktree, timeoutMs: limits.codex_timeout_ms, runDir, effort: limits.codex_effort || 'high' })
      parsed = deps.parseReview(cr.stdout)
    }
    const reviewRel = `verification/reviews/${taskId}-orch-${runId}-r${round}.md`
    fs.mkdirSync(path.join(root(), 'verification', 'reviews'), { recursive: true })
    fs.writeFileSync(path.join(root(), reviewRel), `# ${taskId} — Codex 리뷰 (orchestrator ${runId} · round ${round})\n\n- 리뷰 정책: ${task.orchestration?.review_policy ?? 'RP-v1'} · effort ${limits.codex_effort || 'high'} · Stop 훅 리뷰 ${stopReviewDeferred(task) ? '독립 리뷰에 위임(구현 세션에서 생략)' : '함께 받음'}${cached ? ' · 캐시 재사용' : ''}\n- 파싱: ${parsed.ok ? 'ok' : parsed.error}\n- ran_tests: ${parsed.review?.ran_tests ?? '?'}(false 면 Codex 는 테스트를 직접 실행하지 않았다)\n\n\`\`\`json\n${JSON.stringify(parsed.review ?? null, null, 2)}\n\`\`\`\n`)
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
    if (rKey && !cached && parsed.review.verdict === 'APPROVE' && !blocking.length) writeReviewCache(rKey, { review: parsed.review, stdout: String(cr.stdout).slice(-20000), review_rel: reviewRel, at: nowIso() })
    runEvent(runId, { phase: 'review_done', task_id: taskId, round, verdict: parsed.review.verdict, blocking: blocking.map((f) => f.id) })
    // Codex 가 설계 자체의 문제(kind:"design")를 짚으면 Claude 수정 루프가 아니라 설계 재질의(사용자 목표 작업만)
    const designFinding = task.user_goal_id && blocking.find((f) => f.kind === 'design')
    if (designFinding) {
      withState((s) => T.rejectReview(s, taskId, { caller: REVIEWER, reason: `설계 쟁점 ${designFinding.id}`, review_path: reviewRel }))
      const dc = designConflict({ runId, task, head: impl.head, round, issue: { problem: designFinding.claim, evidence: [`${designFinding.file || ''}:${designFinding.line || ''}`, reviewRel], conflicts_with: designFinding.conflicts_with || '현재 승인 설계', alternatives: designFinding.alternatives || [designFinding.fix].filter(Boolean), question: designFinding.question || `이 설계 쟁점을 어떻게 해소할지 판단해 주세요: ${designFinding.claim}`, approval_scope_change: !!designFinding.approval_scope_change } })
      if (dc) return dc
    }
    if (blocking.length || parsed.review.verdict === 'REQUEST_CHANGES') {
      withState((s) => T.rejectReview(s, taskId, { caller: REVIEWER, reason: `P0/P1 ${blocking.map((f) => f.id).join(',')}`, review_path: reviewRel }))
      findings = blocking.length ? blocking : parsed.review.findings
      continue
    }
    try {
      withState((s) => T.completeTask(s, taskId, { caller: REVIEWER, review_path: reviewRel }), { event: 'task.complete', task: taskId, by: 'orchestrator' })
    } catch (e) {
      // Stop 훅 판정이 이 커밋을 막았다 — 재시도로 풀 일이 아니다. 즉시 BLOCKED, 다음 반복은 다른 독립 작업을 고른다
      if (['REVIEW_BLOCKED', 'REVIEW_COMMIT_MISMATCH', 'REVIEW_PASS_REQUIRED', 'DESIGN_SUPERSEDED'].includes(e.code)) {
        withState((s) => T.rejectReview(s, taskId, { caller: REVIEWER, reason: `완료 판정 거부: ${e.message}`, review_path: reviewRel }))
        runEvent(runId, { phase: 'complete_refused', task_id: taskId, round, detail: e.message, code: e.code })
        block(taskId, task.owner_id, `${e.code}: ${e.message}`)
        return { outcome: 'blocked_review_verdict' }
      }
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

/**
 * 세션 인계(오케스트레이터가 아닌 담당 세션 — Claude/Codex 대화 세션 — 이 죽은 작업).
 * owner 와 세션을 구분한다: owner 는 그대로 두고, 죽은 세션(pid 사망 · 잠금 ttl 경과)의 작업만 회수한다(살아 있는 세션은 건드리지 않는다).
 * worktree 에 커밋 안 된 변경이 없으면(잃을 것이 없다) READY 로 되돌려 같은 owner 로 다시 실행 · 있으면 BLOCKED 로 두고 사유에 남긴다(사람 확인).
 */
export function handoffDeadSessions({ by = 'orchestrator' } = {}) {
  const reaped = withState((s, ctx) => T.reapAbandoned(s, { by }, ctx), { event: 'task.reap', by })
  const { state } = loadState()
  const cands = state.taskQueue.tasks.filter((t) => t.status === 'BLOCKED' && /죽었다/.test(t.blocker?.reason || '') && !String(t.run?.session || '').startsWith('orch-'))
  const dirty = {}
  for (const t of cands) {
    try {
      dirty[t.task_id] = t.worktree ? git(t.worktree, ['status', '--porcelain']).split('\n').filter((l) => l.trim() && !/\.vfc-runs\/|\.agent-lock/.test(l)) : []
      // 죽은 세션이 커밋을 남겼거나 시작 기준을 모르면 자동 재개하지 않는다 — 그 커밋이 범위 검사·리뷰에서 빠진다(Codex P1)
      const head = t.worktree ? git(t.worktree, ['rev-parse', 'HEAD']) : null
      if (!t.run?.start_head) dirty[t.task_id].push('세션 시작 기준(start_head) 없음 — 리뷰 기준을 알 수 없다')
      else if (head !== t.run.start_head) dirty[t.task_id].push(`세션이 커밋을 남겼다(${t.run.start_head.slice(0, 9)}→${String(head).slice(0, 9)}) — 리뷰 기준 확인 필요`)
    } catch (e) {
      dirty[t.task_id] = [`git 상태 확인 실패: ${e.message}`]
    }
  }
  const out = withState((s) => {
    const res = { revived: [], kept: [] }
    for (const c of cands) {
      const t = s.taskQueue.tasks.find((x) => x.task_id === c.task_id)
      if (t.status !== 'BLOCKED' || !/죽었다/.test(t.blocker?.reason || '')) continue
      const sess = t.run?.session ?? null
      if (dirty[t.task_id].length) {
        if (!/사람 확인 후 unblock/.test(t.blocker.reason)) t.blocker.reason = `${t.blocker.reason} · 자동 인계 불가(미커밋 변경·커밋·기준 없음 ${dirty[t.task_id].length}건: ${dirty[t.task_id][0]}) — 사람 확인 후 unblock`
        res.kept.push({ task_id: t.task_id, dirty: dirty[t.task_id].slice(0, 5) })
        continue
      }
      t.blocker = null
      t.status = 'READY'
      t.history.push({ at: nowIso(), from: 'BLOCKED', to: 'READY', by, note: `세션 인계 — 세션 ${sess} 종료 · worktree 깨끗 · owner ${t.owner_id} 유지` })
      res.revived.push(t.task_id)
    }
    return res
  }, { event: 'task.session_handoff', by })
  if (out.revived.length || out.kept.length) appendLog(p.eventLog(), { at: nowIso(), event: 'orchestrator.session_handoff', ...out })
  return { reaped: (reaped || []).map((x) => x.task_id), ...out }
}

/**
 * 담당 세션이 제출한 작업의 독립 리뷰(owner_session 모드). 기준 = 세션 시작 HEAD(start_head) 또는 작업 기준 커밋 · 대상 = worktree HEAD.
 * APPROVE·차단 0 → independent-review 가 완료 · 아니면 반려(받은 편지함에 지적 사항). Codex 실패·판독 실패는 완료가 아니다(그대로 REVIEW).
 */
function reviewSubmitted({ runId, task, deps, limits }) {
  const base = task.run?.start_head || task.orchestration?.base_commit
  if (!task.worktree || !base) return { result: 'skip', why: 'worktree·기준 커밋 없음 — 담당 세션이 assign-worktree 후 task start 로 인수해야 한다' }
  let head
  try {
    head = git(task.worktree, ['rev-parse', 'HEAD'])
  } catch (e) {
    return { result: 'skip', why: `HEAD 확인 실패: ${e.message}` }
  }
  const runDir = path.join(p.runs(), runId, `${task.task_id}-owner-review`)
  const cr = deps.runCodex({ prompt: codexPrompt(task, { base, head, report: { submitted_by: task.owner_id, evidence: task.evidence?.slice(-3) ?? [] }, round: 1, falsePositives: [] }), cwd: task.worktree, timeoutMs: limits.codex_timeout_ms, runDir, effort: limits.codex_effort || 'high' })
  const parsed = deps.parseReview(cr.stdout)
  const reviewRel = `verification/reviews/${task.task_id}-owner-${runId}.md`
  fs.mkdirSync(path.join(root(), 'verification', 'reviews'), { recursive: true })
  fs.writeFileSync(path.join(root(), reviewRel), `# ${task.task_id} — 담당 세션 제출 독립 리뷰(${runId})\n\n- 범위: ${base}..${head}\n- 파싱: ${parsed.ok ? 'ok' : parsed.error}\n\n\`\`\`json\n${JSON.stringify(parsed.review ?? null, null, 2)}\n\`\`\`\n`)
  if (!parsed.ok) return { result: 'unknown', why: `리뷰 판독 실패: ${parsed.error}` }
  const blocking = parsed.review.findings.filter((f) => ['P0', 'P1'].includes(f.severity) && f.scope === 'in')
  const goal = UG.ugState(loadState().state).goals[task.user_goal_id]
  if (parsed.review.verdict === 'APPROVE' && !blocking.length) {
    try {
      withState((s) => {
        const t = s.taskQueue.tasks.find((x) => x.task_id === task.task_id)
        t.verified_commit = head
        return T.completeTask(s, task.task_id, { caller: REVIEWER, review_path: reviewRel })
      }, { event: 'task.complete', task: task.task_id, by: REVIEWER })
      return { result: 'completed', head }
    } catch (e) {
      // 리뷰는 통과했지만 완료 계약(증거가 모든 완료 조건을 덮음 등)을 못 채웠다 — 실행 전체를 멈추지 않고 담당 세션에 돌려준다
      withState((s) => T.rejectReview(s, task.task_id, { caller: REVIEWER, reason: `완료 계약 미충족: ${String(e.message).slice(0, 400)}`, review_path: reviewRel }), { event: 'task.reject', task: task.task_id, by: REVIEWER })
      if (goal) writeInbox(task.owner_id, { kind: 'completion_refused', task, goal, note: `리뷰 APPROVE · 완료 거부: ${String(e.message).slice(0, 400)}` })
      return { result: 'rejected', why: String(e.message).slice(0, 200) }
    }
  }
  withState((s) => T.rejectReview(s, task.task_id, { caller: REVIEWER, reason: `독립 리뷰 차단: ${blocking.map((f) => `${f.id} ${f.claim}`).join(' | ').slice(0, 600)}`, review_path: reviewRel }), { event: 'task.reject', task: task.task_id, by: REVIEWER })
  if (goal) writeInbox(task.owner_id, { kind: 'review_rejected', task, goal, note: `P0/P1: ${blocking.map((f) => `${f.id} ${f.claim}`).join(' | ').slice(0, 800)} · 리뷰 ${reviewRel}` })
  return { result: 'rejected', blocking: blocking.map((f) => f.id) }
}

/** 이전 run 이 비정상 종료됐으면 복구: run 을 aborted 로 닫고, 그 run 이 쥔 작업을 reap → 자기 작업이면 READY 로 되살린다. */
export function recoverPrevious({ by = 'orchestrator' } = {}) {
  const { state } = loadState()
  // 'stopped'(오류로 끝난 실행)도 작업을 쥔 채 끝났으면 복구한다 — 아니면 그 작업이 IN_PROGRESS·잠금째 영영 남는다(T-0012 실측).
  // current_run 은 다음 실행이 덮으므로 모든 run 중에서 찾는다
  const holds = (run) => state.taskQueue.tasks.some((t) => ['IN_PROGRESS', 'REVIEW'].includes(t.status) && String(t.run?.session || '').startsWith(`orch-${run.run_id}`))
  const curRun = state.orchestrator.current_run && state.orchestrator.runs[state.orchestrator.current_run]
  const cur = curRun?.status === 'running' ? curRun : Object.values(state.orchestrator.runs).find((r) => ['stopped', 'aborted'].includes(r.status) && !r.recovered_at && holds(r))
  if (!cur) return null
  if (cur.host === os.hostname() && pidAlive(cur.pid)) return { alive: true, run_id: cur.run_id }
  const reaped = withState((s, ctx) => T.reapAbandoned(s, { by }, ctx), { event: 'task.reap', by })
  // 원인(Codex Stop 리뷰 P1 반복): reapAbandoned 는 **모든** run 의 버려진 작업을 BLOCKED 로 만드는데, 되살리기·복구 표시는
  // 고른 run 하나만 했다 — 다른 run 의 작업은 BLOCKED 로 남고 holds 에서도 빠져 영영 복구되지 않았다.
  // 그래서 되살리기는 **이번 reap 이 풀어 준 작업 전부**(오케스트레이터 세션 것만 — 사람 세션 작업은 사람이 본다)로, 복구 표시는 영향받은 run 전부에 한다.
  const reapedIds = new Set((reaped || []).filter((x) => !x.skipped).map((x) => x.task_id))
  const revived = withState((s) => {
    const out = []
    const runIds = new Set([cur.run_id])
    for (const t of s.taskQueue.tasks) {
      const sess = String(t.run?.session || '')
      if (t.status !== 'BLOCKED' || !sess.startsWith('orch-')) continue
      const rid = sess.slice('orch-'.length)
      const owner = s.orchestrator.runs[rid]
      // 이번 reap 이 푼 것 + 이전에(예: `vfc task reap` 수동 실행) 「죽었다」 사유로 막힌 것 — 그 run 이 지금 살아 있지 않을 때만
      const ownerAlive = owner?.status === 'running' && owner.host === os.hostname() && pidAlive(owner.pid)
      if (reapedIds.has(t.task_id) || (/죽었다/.test(t.blocker?.reason || '') && !ownerAlive)) {
        runIds.add(rid)
        t.blocker = null
        t.history.push({ at: nowIso(), from: 'BLOCKED', to: 'READY', by, note: `orchestrator 복구 — run ${rid} 비정상 종료` })
        t.status = 'READY'
        out.push(t.task_id)
      }
    }
    const stillHeld = []
    for (const rid of runIds) {
      const r = s.orchestrator.runs[rid]
      if (!r) continue
      if (r.status === 'running') {
        r.status = 'aborted'
        r.stop_reason = `프로세스 pid ${r.pid} 비정상 종료 — 다음 실행이 복구(phase ${r.phase})`
      }
      // 아직 쥐고 있는 작업(살아 있는 자식 · REVIEW 등 reap 대상이 아닌 것)이 남으면 복구 완료로 표시하지 않는다 — 다음 실행이 다시 본다
      const held = s.taskQueue.tasks.filter((t) => ['IN_PROGRESS', 'REVIEW'].includes(t.status) && String(t.run?.session || '').startsWith(`orch-${rid}`)).map((t) => t.task_id)
      stillHeld.push(...held)
      if (!held.length && !r.recovered_at) {
        if (r.status !== 'aborted') r.stop_reason = `${r.stop_reason} · 쥐고 있던 작업을 다음 실행이 복구`
        r.recovered_at = nowIso()
      }
    }
    return { out, stillHeld }
  })
  appendLog(p.eventLog(), { at: nowIso(), event: 'orchestrator.recovered', run: cur.run_id, phase: cur.phase, reaped, revived: revived.out, still_held: revived.stillHeld })
  return { recovered: cur.run_id, phase: cur.phase, reaped, revived: revived.out, still_held: revived.stillHeld }
}

// ── Work 브리지(이벤트형 — 상시 데몬 없음) ─────────────────────────────────
// config/bridge.json { repo, app, wait_work_min, interval_s } 이 있으면 반복마다 poc/work-bridge.mjs tick 을 한 번 부른다.
// tick: 대기 요청이 있으면 한 번 수집·인수, 없으면 아직 안 올린 PENDING 요청 하나 게시(단일 in-flight). 설계는 PROPOSED 로만 들어온다.
export function bridgeConfig() {
  if (process.env.VFC_BRIDGE_OFF === '1') return null
  const f = process.env.VFC_BRIDGE_CONFIG || path.join(root(), 'config', 'bridge.json')
  if (!fs.existsSync(f)) return null
  const c = JSON.parse(fs.readFileSync(f, 'utf8'))
  return c.repo ? { app: null, wait_work_min: 0, interval_s: 30, ...c } : null
}

function bridgeTick(cfg) {
  // 스크립트는 코드 위치에서(root() 는 상태 폴더 — VFC_ROOT 가 다르면 틀린다)
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'poc', 'work-bridge.mjs')
  const args = [script, 'tick', '--repo', cfg.repo, ...(cfg.app ? ['--app', cfg.app] : []), ...(cfg.retry_after_min ? ['--retry-after-min', String(cfg.retry_after_min)] : [])]
  try {
    // 감독자 경유 — 시간 초과 시 자식 트리(gh 등 손자)까지 끝낸다. execFileSync 의 timeout 은 자식만 죽여 손자가 파이프를 쥐면 33분 멈췄다(실측 run9)
    const r = runProcess(`"${process.execPath}"`, args, { timeoutMs: 180_000, env: { VFC_ROOT: root() }, pidFile: path.join(p.runs(), 'bridge-tick.pid.json') })
    if (r.timed_out) return { error: '브리지 tick 시간 초과(180초) — 다음 반복에서 다시', waiting: [] }
    return JSON.parse(r.stdout)
  } catch (e) {
    return { error: String(e.stderr || e.message).slice(0, 300), waiting: [] }
  }
}

const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

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
  const handoff = handoffDeadSessions()
  const runId = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${crypto.randomBytes(3).toString('hex')}`
  withState((s) => {
    s.orchestrator.current_run = runId
    s.orchestrator.runs[runId] = { run_id: runId, pid, host: os.hostname(), started_at: nowIso(), limits, status: 'running', phase: 'start', task_id: null, cost_usd: 0, tasks_done: [], events: [], recovery }
  }, { event: 'orchestrator.start', run: runId })
  const summary = { run_id: runId, recovery, handoff, iterations: [] }
  let stopReason = null
  try {
    let lastDone = null
    const bridge = bridgeConfig()
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
      const bt = bridge && !dryRun ? bridgeTick(bridge) : null
      // 사용자 대화형 설계 승인 → 적용 · 초안/보류 작업 재개(사용자는 vfc approve 하나만)
      const applied = dryRun ? [] : withState((s) => UG.applyTrustedDesignApprovals(s), { event: 'usergoal.auto_approve', by: 'orchestrator' })
      if (applied.length) runEvent(runId, { phase: 'approval_applied', applied })
      if (bt) runEvent(runId, { phase: 'bridge', published: bt.published?.published ?? null, collected: bt.collected ?? [], intake: (bt.intake ?? []).map((x) => x.status), waiting: bt.waiting ?? [], error: bt.error ?? bt.errors?.[0] ?? null })
      // 담당 세션이 제출(REVIEW)한 owner_session 작업 — 오케스트레이터는 Codex 독립 리뷰만 하고 완료/반려(제품 코드는 바꾸지 않는다)
      if (!dryRun && deps?.runCodex) {
        const stR = loadState().state
        for (const t of stR.taskQueue.tasks.filter((x) => x.status === 'REVIEW' && x.user_goal_id && goalMode(UG.ugState(stR).goals[x.user_goal_id]) === 'owner_session')) {
          const out = reviewSubmitted({ runId, task: t, deps, limits })
          runEvent(runId, { phase: 'owner_review', task_id: t.task_id, ...out })
        }
      }
      let sel = selectStep({ runId, tools, pid, last: lastDone })
      // 작업 큐가 비었고 정책 목표가 미완료면 다음 설계를 자동 요청한다(같은 버전·미충족 조합은 한 번만) — 게시는 바로 tick
      if (!sel.selected && bridge && !dryRun && !(bt?.waiting?.length)) {
        let st0 = loadState().state
        for (const ug of Object.keys(UG.ugState(st0).goals)) {
          if (!UG.nextDesignIssue(st0, ug, { checkKey: false })) continue // 조건만 먼저(키는 패킷 기준 커밋을 안 뒤에)
          // 직전 응답이 needs_info 면 먼저 코드에서 답을 찾는다(Codex read-only 샌드박스 · 사람 대기 없음)
          const rq = UG.pendingResearch(st0, ug)
          if (rq && deps?.runCodex) {
            const g0 = UG.ugState(st0).goals[ug]
            const wt = (g0.delegations || []).at(-1)?.worktree
            const prompt = [
              'You are Codex doing READ-ONLY code research for a design reviewer. Do not modify files. Answer in Korean.',
              `Repository worktree: ${wt}. Goal: ${g0.title}.`,
              'The reviewer could not finalize the next design and asked these questions. Answer each from the actual code (exact file paths, function/field names, call sites). If you can run read-only commands to count tests (e.g. vitest list) do so; otherwise say what is unknown — do not guess.',
              ...rq.questions.map((q, i) => `Q${i + 1}. ${q}`),
              `Reviewer findings: ${rq.findings.join(' | ').slice(0, 1500)}`,
              'End with exactly one block:',
              '```json vfc-research',
              '{"answers":[{"q":"...","a":"...","paths":["apps/web/src/..."]}]}',
              '```',
            ].join('\n')
            const runDir = path.join(p.runs(), runId, `research-${rq.request_id}`)
            let notes = { at: nowIso(), answers: [], error: null }
            try {
              const cr = deps.runCodex({ prompt, cwd: wt, timeoutMs: limits.codex_timeout_ms, runDir, effort: 'medium' })
              const blocks = [...String(cr.stdout).matchAll(/```json vfc-research\s*\n([\s\S]*?)\n```/g)]
              notes.answers = blocks.length ? JSON.parse(blocks.at(-1)[1]).answers || [] : []
              if (!blocks.length) notes.error = '조사 블록 없음'
            } catch (e) {
              notes.error = String(e.message).slice(0, 200)
            }
            // 답에 나온 실제 파일만(apps/web/src 아래 · 존재) 다음 패킷 발췌에 더한다 — 최대 12
            const extra = [...new Set(notes.answers.flatMap((a) => a.paths || []))].filter((x) => /^apps\/web\/src\//.test(x) && fs.existsSync(path.join(wt, x))).slice(0, 12)
            withState((s) => {
              const g = UG.ugState(s).goals[ug]
              g.research_notes = { ...(g.research_notes || {}), [rq.request_id]: { ...notes, added_paths: extra } }
              g.context_extra_paths = [...new Set([...(g.context_extra_paths || []), ...extra])]
            }, { event: 'usergoal.research', ug, request: rq.request_id, by: 'orchestrator' })
            runEvent(runId, { phase: 'research', ug, request: rq.request_id, answers: notes.answers.length, added_paths: extra, error: notes.error })
            st0 = loadState().state // 조사 답·추가 경로가 이번 요청의 패킷·근거에 들어가게
          }
          let context = null
          try {
            context = CTX.buildContext(st0, ug, { fetch: true, ref: CTX.contextRefFor(st0, ug) })
          } catch {
            context = null
          }
          // 같은 (버전·미충족·패킷 기준 커밋) 조합은 한 번만 — 기준이 바뀌면(작업 브랜치 갱신) 다시 묻는다
          const nx = UG.nextDesignIssue(st0, ug, { base: context?.manifest?.base_commit ?? context?.base_commit ?? null })
          if (!nx) continue
          try {
            const req = UG.requestDesign(withState, ug, { context, purpose: 'design', issue: nx.issue, canon_version: st0.goalStatus.canon_version, by: 'orchestrator' })
            withState((s) => {
              const g = UG.ugState(s).goals[ug]
              g.auto_design_requests = { ...(g.auto_design_requests || {}), [nx.key]: { request_id: req.request_id ?? req.id ?? null, at: nowIso() } }
              g.open_issue = null // 다음 증분 요청은 설계 충돌이 아니다 — 라우터가 DESIGN_CONFLICT 로 보이지 않게
            }, { event: 'usergoal.auto_design_request', ug, by: 'orchestrator' })
            runEvent(runId, { phase: 'auto_design_request', ug, key: nx.key, request: req.request_id ?? req.id ?? null })
            const t2 = bridgeTick(bridge)
            runEvent(runId, { phase: 'bridge', published: t2.published?.published ?? null, waiting: t2.waiting ?? [] })
            if (bt) bt.waiting = t2.waiting ?? []
          } catch (e) {
            runEvent(runId, { phase: 'auto_design_request_failed', ug, error: String(e.message).slice(0, 200) })
          }
          break // 단일 in-flight
        }
      }
      // 고를 작업이 없고 Work 응답을 기다리는 중이면 — 정해진 시간까지 tick 으로 기다렸다가 인수되면 다시 고른다(대기 중 다른 작업은 위에서 이미 실행)
      if (!sel.selected && bridge && !dryRun && bridge.wait_work_min > 0 && (bt?.waiting?.length ?? 0) > 0) {
        const until = Date.now() + bridge.wait_work_min * 60_000
        let applied = false
        // 실행 예산(max_minutes·비용)이 대기보다 먼저 — 넘으면 기다리지 않고 멈춘다(Codex P2)
        while (!applied && Date.now() < until && !fs.existsSync(p.stopFile()) && !budgetExceeded(runId, limits)) {
          sleepMs(Number(process.env.VFC_BRIDGE_INTERVAL_MS || bridge.interval_s * 1000))
          const w = bridgeTick(bridge)
          runEvent(runId, { phase: 'bridge_wait', collected: w.collected ?? [], intake: (w.intake ?? []).map((x) => x.status), waiting: w.waiting ?? [] })
          applied = (w.intake ?? []).length > 0 || (w.waiting ?? []).length === 0
        }
        if (applied && !budgetExceeded(runId, limits)) {
          // 받은 설계를 정책으로 바로 적용·작업화한 뒤 다시 고른다(다음 반복을 기다리지 않는다)
          const ap = withState((s) => UG.applyTrustedDesignApprovals(s), { event: 'usergoal.auto_approve', by: 'orchestrator' })
          if (ap.length) runEvent(runId, { phase: 'approval_applied', applied: ap })
          sel = selectStep({ runId, tools, pid, last: lastDone })
        }
      }
      const it = { bridge: bt ? { published: bt.published?.published ?? null, collected: bt.collected ?? [], waiting: bt.waiting ?? [], error: bt.error ?? null } : null, goal_check: gc.report, changes: gc.changes, distribution: gc.distribution, selected: sel.selected ? { task_id: sel.selected.task_id, score: sel.selected.score, reasons: sel.selected.reasons } : null, skipped: sel.skipped, uncovered: sel.ranking.uncovered.slice(0, 10) }
      summary.iterations.push(it)
      runEvent(runId, { phase: 'selected', task_id: it.selected?.task_id ?? null, skipped: sel.skipped })
      if (!sel.selected) {
        stopReason = bt?.waiting?.length ? `실행 가능한 작업 없음 · Work 응답 대기(${bt.waiting.join(',')})` : '실행 가능한 작업 없음'
        break
      }
      if (dryRun) {
        stopReason = 'dry-run — 선정까지만'
        break
      }
      const res = processTask({ runId, taskId: sel.selected.task_id, limits, deps, pid })
      it.outcome = res.outcome
      {
        // 작업 완료(TASK_COMPLETED)와 목표 단계를 분리해 남긴다 · 다음 선정은 같은 목표의 의존 작업 우선
        const st = loadState().state
        const done = st.taskQueue.tasks.find((t) => t.task_id === sel.selected.task_id)
        it.goal_level = done.user_goal_id ? UG.goalLevelOf(st, done.user_goal_id) : goalLevel(st, done.impact?.parent_goal_id ?? done.goal_id)
        if (res.outcome === 'completed') lastDone = { task_id: done.task_id, parent_goal_id: done.user_goal_id ?? done.impact?.parent_goal_id ?? done.goal_id }
        // 정책이 branch_push 를 위임한 목표: 완료 작업의 브랜치를 바로 push — 다음 설계 패킷(원격 브랜치 기준)이 이 커밋을 보게(Work needs_info 실측)
        const pol = done.user_goal_id ? UG.ugState(st).goals[done.user_goal_id]?.execution_policy : null
        if (res.outcome === 'completed' && pol?.allowed_capabilities?.includes('branch_push') && done.worktree && done.branch && done.branch !== 'main') {
          try {
            git(done.worktree, ['push', '-q', 'origin', `HEAD:refs/heads/${done.branch}`])
            runEvent(runId, { phase: 'branch_pushed', task_id: done.task_id, branch: done.branch, head: git(done.worktree, ['rev-parse', 'HEAD']) })
          } catch (e) {
            runEvent(runId, { phase: 'branch_push_failed', task_id: done.task_id, error: String(e.message).slice(0, 200) })
          }
        }
      }
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
