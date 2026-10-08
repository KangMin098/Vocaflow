#!/usr/bin/env node
// bin/goal-orchestrator.mjs — 목표 중심 지속 실행기(WF-S5 §11)
//
//   node bin/goal-orchestrator.mjs [--max-tasks 1] [--max-minutes 90] [--max-cost-usd 15] [--claude-budget-usd 5]
//                                  [--max-review-rounds 3] [--max-same-failure 2] [--no-ci] [--dry-run] [--json]
//
// 단일 writer(싱글턴 잠금) · journal 상태 · 비정상 종료 복구 · 상한 · 사용자 중단(runtime/STOP 파일).
// OpenAI API 를 쓰지 않는다. ChatGPT 는 기획이 필요할 때 요청 파일만 만들고(WAITING_CHATGPT) 사람이 전달한다.

import { runOrchestrator, DEFAULT_LIMITS } from '../lib/orchestrator.mjs'
import { runClaude, runCodex, parseReview, readClaudeReport } from '../lib/agents.mjs'
import { ghAvailable, readLatestWorkflowJob } from '../lib/ci.mjs'
import { validateCanon } from '../lib/goals.mjs'

const argv = process.argv.slice(2)
const opt = {}
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue
  const k = argv[i].slice(2)
  const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
  opt[k] = v
}
const num = (k, d) => (opt[k] !== undefined ? Number(opt[k]) : d)
const limits = {
  max_tasks: num('max-tasks', DEFAULT_LIMITS.max_tasks),
  max_minutes: num('max-minutes', DEFAULT_LIMITS.max_minutes),
  max_cost_usd: num('max-cost-usd', DEFAULT_LIMITS.max_cost_usd),
  claude_budget_usd: num('claude-budget-usd', DEFAULT_LIMITS.claude_budget_usd),
  max_review_rounds: num('max-review-rounds', DEFAULT_LIMITS.max_review_rounds),
  max_same_failure: num('max-same-failure', DEFAULT_LIMITS.max_same_failure),
  claude_timeout_ms: num('claude-timeout-min', DEFAULT_LIMITS.claude_timeout_ms / 60_000) * 60_000,
  codex_timeout_ms: num('codex-timeout-min', DEFAULT_LIMITS.codex_timeout_ms / 60_000) * 60_000,
}
const v = validateCanon()
if (!v.ok) {
  console.error(`정본 검증 실패 — 실행하지 않는다:\n  ${v.errors.join('\n  ')}`)
  process.exit(1)
}
const ciEnabled = !opt['no-ci'] && ghAvailable()
const result = runOrchestrator({
  limits,
  ciEnabled,
  dryRun: !!opt['dry-run'],
  deps: { runClaude, runCodex, parseReview, readClaudeReport, readWorkflowJob: (wf, job) => readLatestWorkflowJob(wf, job) },
})
if (opt.json) console.log(JSON.stringify(result, null, 2))
else {
  console.log(`run ${result.run_id ?? '-'} · ${result.status ?? 'done'} · 멈춘 이유: ${result.stop_reason ?? result.reason ?? '-'}`)
  if (result.recovery) console.log(`복구: ${JSON.stringify(result.recovery)}`)
  for (const it of result.iterations ?? []) {
    console.log(`- 검사 ${it.goal_check} ${JSON.stringify(it.distribution)} · 선정 ${it.selected?.task_id ?? '없음'} → ${it.outcome ?? '-'}`)
    for (const s of it.skipped ?? []) console.log(`    건너뜀 ${s.task_id}: ${s.reason.slice(0, 160)}`)
  }
  if (result.final_goal_check) console.log(`최종 검사 ${result.final_goal_check.report} ${JSON.stringify(result.final_goal_check.distribution)} 변경 ${JSON.stringify(result.final_goal_check.changes)}`)
  if (result.run) console.log(`비용 $${result.run.cost_usd} · 작업 ${JSON.stringify(result.run.tasks_done)}`)
}
process.exit(result.status === 'refused' || result.error ? 2 : 0)
