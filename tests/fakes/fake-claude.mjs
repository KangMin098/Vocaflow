// tests/fakes/fake-claude.mjs — 테스트용 가짜 Claude Code CLI
//
// stdin 으로 프롬프트를 받는다. 시나리오는 FAKE_CLAUDE_MAP(JSON: task_id → 시나리오) 또는 FAKE_CLAUDE(기본).
//   ok         src/ 아래 파일을 고치고 커밋 · 테스트 로그 · 모든 완료 조건을 덮는 보고서
//   fail       status failed 보고서
//   scope      허용 범위 밖(secret.txt)을 고치고 커밋
//   hang       오래 잠든다(비정상 종료 복구 테스트)
//   costly     ok + 비용 1.0
//   hook_blocked ok + Codex Stop 훅이 그 커밋에 REVIEW_BLOCKED 를 남긴 상황(VFC_REVIEW_VERDICTS 에 기록)
// 재작업 라운드(FINDINGS_TO_ADDRESS)에는 FAKE_CLAUDE_FINDINGS(fixed|false_positive) 로 답한다.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const prompt = fs.readFileSync(0, 'utf8')
const taskId = (prompt.match(/## Task (T-\d+)/) || [])[1]
const map = JSON.parse(process.env.FAKE_CLAUDE_MAP || '{}')
const scenario = map[taskId] || process.env.FAKE_CLAUDE || 'ok'
const reportPath = (prompt.match(/Write the report JSON to: (.+)/) || [])[1].trim()
const nAcc = (prompt.match(/^\[\d+\] /gm) || []).length
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim()

if (scenario === 'hang') {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120000)
  process.exit(0)
}
if (scenario === 'fail') {
  fs.writeFileSync(reportPath, JSON.stringify({ task_id: taskId, status: 'failed', commit: null, changed_files: [], tests: [], notes: 'fake failure' }))
  console.log(JSON.stringify({ total_cost_usd: 0.01, result: 'failed', is_error: false }))
  process.exit(0)
}
const target = scenario === 'scope' ? 'secret.txt' : path.join('src', `${taskId}.ts`)
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.appendFileSync(target, `// ${taskId} ${Date.now()}\n`)
git('add', target)
git('commit', '-q', '-m', `fake ${taskId}`)
if (scenario === 'hook_blocked') {
  const head = git('rev-parse', 'HEAD')
  fs.appendFileSync(process.env.VFC_REVIEW_VERDICTS, JSON.stringify({ at: new Date().toISOString(), head, kind: 'final', verdict: 'REVIEW_BLOCKED', fix_rounds: 3, p0_p1: [{ finding_id: 'F-fake', severity: 'P1' }], raw_paths: [] }) + '\n')
}
fs.mkdirSync('.vfc-runs', { recursive: true })
fs.writeFileSync('.vfc-runs/test.log', 'fake tests passed\n')
const findings = [...prompt.matchAll(/^- (F\d+|ACC) \[/gm)].map((m) => m[1])
const action = process.env.FAKE_CLAUDE_FINDINGS || 'fixed'
fs.writeFileSync(
  reportPath,
  JSON.stringify({
    task_id: taskId,
    status: 'implemented',
    commit: git('rev-parse', 'HEAD'),
    changed_files: [target],
    tests: [{ command: 'node fake-test', result: 'pass', skip_count: 0, log_path: '.vfc-runs/test.log', covers: Array.from({ length: nAcc }, (_, i) => i) }],
    notes: 'fake',
    findings_response: findings.map((id) => ({ finding_id: id, action, rationale: action === 'false_positive' ? 'contested: 이 작업 범위 밖의 지적이다(코드 근거 src/)' : '고쳤다', evidence: target })),
  }),
)
console.log(JSON.stringify({ total_cost_usd: scenario === 'costly' ? 1.0 : 0.01, result: 'done', is_error: false }))
