#!/usr/bin/env node
// bin/goal-check.mjs — 최상위 목표 검사기(WF-S5 §3)
//
//   node bin/goal-check.mjs [--no-ci] [--json]
// 정본 v1.1.0 의 모든 목표·수용 기준을 실제 증거(작업 증거 · 리뷰 · Git · CI 로그)로 판정하고
// verification/goal-check/GC-<시각>.json 에 남긴 뒤 GOAL_STATUS 를 갱신한다(바뀐 것만, 이전 상태·이유 기록).

import { goalCheckStep } from '../lib/orchestrator.mjs'
import { ghAvailable, readLatestWorkflowJob } from '../lib/ci.mjs'
import { validateCanon } from '../lib/goals.mjs'

const args = process.argv.slice(2)
const v = validateCanon()
if (!v.ok) {
  console.error(`정본 검증 실패 — 검사하지 않는다:\n  ${v.errors.join('\n  ')}`)
  process.exit(1)
}
const ciEnabled = !args.includes('--no-ci') && ghAvailable()
const r = goalCheckStep({ deps: { readWorkflowJob: (wf, job) => readLatestWorkflowJob(wf, job) }, ciEnabled, by: 'goal-check-cli' })
if (args.includes('--json')) {
  console.log(JSON.stringify({ report: r.report, distribution: r.distribution, changes: r.changes, ci: ciEnabled }, null, 2))
} else {
  console.log(`목표 검사 — 보고서 ${r.report} · CI 판독 ${ciEnabled ? 'on' : 'off'}`)
  console.log(`분포: ${JSON.stringify(r.distribution)}`)
  for (const c of r.changes) console.log(`  변경 ${c.goal_id}: ${c.from} → ${c.to} (${c.kind})`)
  const notPass = r.check.results.filter((x) => x.status !== 'PASS' && x.level === 3)
  for (const x of notPass) console.log(`  ${x.criterion_id.padEnd(20)} ${x.status.padEnd(24)} ${x.reason.slice(0, 140)}`)
}
