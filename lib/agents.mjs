// lib/agents.mjs
//
// Claude Code CLI · Codex CLI 실행기. 셸을 거치지 않고 실행 파일을 인자 배열로 부른다(인용 문제·주입 없음).
// 프롬프트는 stdin 으로 넘긴다.
//
// Claude 실행 안전장치
//   --strict-mcp-config(MCP 0개)  → DB·외부 서비스 접근 경로가 없다 = 무승인 DB 쓰기 불가능
//   --settings <json>              → 허용 도구 화이트리스트(Read/Edit/Write/Glob/Grep + pnpm·git(읽기·add·commit)·node)
//                                    deny: git push · rm · 원격 · 패키지 설치
//   --max-budget-usd               → 실행 1회 비용 상한(CLI 가 강제)
//   cwd = 작업 worktree             → 다른 owner 의 worktree 를 건드리지 않는다(쓰기 범위는 오케스트레이터가 diff 로 재검사)
// Codex: exec -s read-only — 파일을 고칠 수 없다. 테스트를 직접 못 돌리면 그렇게 말하도록 프롬프트가 요구한다.
//
// 테스트는 VFC_CLAUDE_CMD · VFC_CODEX_CMD 로 가짜 에이전트(node 스크립트)를 넣는다.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DEFAULT_CLAUDE = 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'

export function resolveCodex() {
  if (process.env.VFC_CODEX_CMD) return process.env.VFC_CODEX_CMD
  const ext = path.join(process.env.USERPROFILE || 'C:/Users/Administrator', '.vscode', 'extensions')
  try {
    const dirs = fs.readdirSync(ext).filter((d) => d.startsWith('openai.chatgpt-')).sort()
    for (const d of dirs.reverse()) {
      const p = path.join(ext, d, 'bin', 'windows-x86_64', 'codex.exe')
      if (fs.existsSync(p)) return p
    }
  } catch {
    /* 확장 없음 */
  }
  return 'codex'
}

export function resolveClaude() {
  return process.env.VFC_CLAUDE_CMD || DEFAULT_CLAUDE
}

/** 명령 문자열 "node path/to/fake.mjs" 같은 테스트용 형태도 받는다(첫 토큰 = 실행 파일). */
function splitCmd(cmd) {
  const m = cmd.match(/^"([^"]+)"\s*(.*)$/) || cmd.match(/^(\S+)\s*(.*)$/)
  const rest = m[2] ? m[2].split(/\s+/).filter(Boolean) : []
  return [m[1], rest]
}

/** 감독자가 남긴 자식이 아직 살아 있으면 그 트리를 끝낸다(감독자가 강제 종료된 경우의 뒷정리) */
function killRecordedChild(pidFile) {
  let m
  try {
    m = JSON.parse(fs.readFileSync(pidFile, 'utf8'))
  } catch {
    return
  }
  if (!m.child) return
  try {
    process.kill(m.child, 0)
  } catch {
    return
  }
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(m.child), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    else process.kill(-m.child, 'SIGKILL')
  } catch {
    try {
      process.kill(m.child, 'SIGKILL')
    } catch {
      /* 이미 끝났다 */
    }
  }
  try {
    fs.writeFileSync(pidFile, JSON.stringify({ ...m, exited: true, killed_because: 'caller cleanup after supervisor ended', at: new Date().toISOString() }))
  } catch {
    /* 기록 실패 무시 */
  }
}

const SUPERVISOR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'supervise.mjs')

export function runProcess(cmd, args, { cwd, input, timeoutMs, env = {}, unset = [], pidFile = null }) {
  let [exe, pre] = splitCmd(cmd)
  // pidFile 이 있으면 감독자(supervise.mjs)를 거친다 — 자식 pid 를 남기고, 부모가 죽으면 자식 트리를 끝낸다
  if (pidFile) {
    pre = [SUPERVISOR, String(process.pid), pidFile, exe, ...pre]
    exe = process.execPath
  }
  const t0 = Date.now()
  const childEnv = { ...process.env, VFC_AGENT: '1', ...env }
  for (const k of unset) delete childEnv[k]
  if (pidFile && timeoutMs) childEnv.VFC_SUPERVISE_TIMEOUT_MS = String(timeoutMs)
  const r = spawnSync(exe, [...pre, ...args], { cwd, input, encoding: 'utf8', timeout: pidFile && timeoutMs ? timeoutMs + 15000 : timeoutMs, maxBuffer: 256 * 1024 * 1024, env: childEnv, windowsHide: true })
  if (pidFile) killRecordedChild(pidFile)
  return { code: r.status, signal: r.signal, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message ?? null, timed_out: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM' || (!!pidFile && r.status === 124), ms: Date.now() - t0 }
}

// Bash 는 검증 명령으로만 좁힌다(Codex 최종 리뷰 P1: node:* · pnpm:* 는 임의 코드 실행 — 다른 worktree 쓰기 · DB 요청 가능).
// 남는 한계: 테스트 파일 자체는 코드다 — vitest 가 Claude 가 쓴 테스트를 실행한다. 그래서 아래 DB_SENTINEL_ENV 로
// DB 자격증명을 무력화하고(앱 코드가 .env.local 대신 이 값을 쓴다 — dotenv 는 이미 있는 변수를 덮지 않는다),
// 오케스트레이터가 실행 전후 다른 owner worktree 의 변경을 대조한다. 완전한 격리(컨테이너)는 아니다 — docs/ORCHESTRATOR.md 「한계」.
export const CLAUDE_ALLOW = [
  'Read', 'Edit', 'Write', 'Glob', 'Grep',
  'Bash(node --test:*)', 'Bash(node --check:*)',
  'Bash(pnpm --filter web exec vitest run:*)', 'Bash(pnpm --filter web typecheck)', 'Bash(pnpm --filter web lint)', 'Bash(pnpm --filter web exec eslint:*)', 'Bash(pnpm --filter web exec tsc:*)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git show:*)', 'Bash(git rev-parse:*)', 'Bash(mkdir -p .vfc-runs)',
]
export const CLAUDE_DENY = ['Bash(git push:*)', 'Bash(git reset:*)', 'Bash(git checkout:*)', 'Bash(git clean:*)', 'Bash(rm:*)', 'Bash(curl:*)', 'Bash(node -e:*)', 'Bash(node --eval:*)', 'Bash(npx:*)', 'Bash(pnpm add:*)', 'Bash(pnpm install:*)', 'Bash(pnpm dlx:*)', 'WebFetch', 'WebSearch']

/** 자동 실행 자식의 DB 자격증명 무력화 — 접속 불가 주소 · 빈 키(값을 생성·추정하지 않는다). 통합 테스트는 건너뛰거나 실패한다. */
export const DB_SENTINEL_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_URL: 'http://127.0.0.1:9',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'vfc-automated-run-no-db',
  SUPABASE_SERVICE_ROLE_KEY: '',
  SUPABASE_ACCESS_TOKEN: '',
  DATABASE_URL: '',
  DIRECT_URL: '',
  PGPASSWORD: '',
  VFC_AUTOMATED_RUN: '1',
}

export function runClaude({ prompt, cwd, budgetUsd, timeoutMs, runDir, readOnly = false, verify = false, strictPermissions = false }) {
  fs.mkdirSync(runDir, { recursive: true })
  const settingsPath = path.join(runDir, 'claude-settings.json')
  const allow = readOnly ? CLAUDE_ALLOW.filter((x) => !['Edit', 'Write'].includes(x) && !/^Bash\((git (add|commit)|mkdir)/.test(x) && (verify || !/^Bash\((node|pnpm)/.test(x))) : CLAUDE_ALLOW
  const deny = readOnly ? [...CLAUDE_DENY, 'Edit', 'Write', 'NotebookEdit', 'Bash(git add:*)', 'Bash(git commit:*)'] : CLAUDE_DENY
  fs.writeFileSync(settingsPath, JSON.stringify({ permissions: { allow, deny } }, null, 2))
  const args = ['-p', '--output-format', 'json', '--permission-mode', readOnly || strictPermissions ? 'dontAsk' : 'acceptEdits', '--settings', settingsPath, '--strict-mcp-config', '--no-session-persistence', '--max-budget-usd', String(budgetUsd)]
  // Preserve session markers and provider protections. A nested-session refusal must
  // remain a refusal; removing markers is not an authorized execution path.
  const r = runProcess(resolveClaude(), args, { cwd, input: prompt, timeoutMs, env: DB_SENTINEL_ENV, pidFile: path.join(runDir, 'claude.pid.json') })
  fs.writeFileSync(path.join(runDir, 'claude-stdout.json'), r.stdout)
  if (r.stderr) fs.writeFileSync(path.join(runDir, 'claude-stderr.txt'), r.stderr)
  let meta = null
  try {
    meta = JSON.parse(r.stdout)
  } catch {
    meta = null
  }
  return { ...r, session_id: meta?.session_id ?? null, cost_usd: Number(meta?.total_cost_usd ?? meta?.cost_usd ?? 0) || 0, is_error: meta ? !!meta.is_error : r.code !== 0, result_text: meta?.result ?? null, subtype: meta?.subtype ?? null }
}

/** Narrow MCP access without discarding user rules, hooks, or authentication. No secret config is persisted. */
export function codexMcpIsolation(cmd, cwd) {
  const rows = JSON.parse(execFileSync(cmd, ['mcp', 'list', '--json'], { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] }))
  if (!Array.isArray(rows)) throw new Error('Cannot enumerate Codex MCP configuration')
  return rows.flatMap((r) => {
    if (!/^[-a-zA-Z0-9_]+$/.test(r.name) || !['stdio', 'streamable_http'].includes(r.transport?.type)) throw new Error('Unknown MCP transport; execution refused')
    // CLI merges tables: keep the transport kind while disabling, otherwise loading fails.
    return ['-c', `mcp_servers.${r.name}={${r.transport.type === 'stdio' ? 'command="vfc-disabled-mcp"' : 'url="http://127.0.0.1:9"'},enabled=false}`]
  })
}

export function runCodex({ prompt, cwd, timeoutMs, runDir, effort, writable = false, isolated = false }) {
  if (effort !== undefined && !['low', 'medium', 'high', 'xhigh'].includes(effort)) throw new Error('Unsupported Codex effort')
  fs.mkdirSync(runDir, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'codex-prompt.md'), prompt)
  let isolation = []
  if (isolated && !process.env.VFC_CODEX_CMD) isolation = codexMcpIsolation(resolveCodex(), cwd)
  const reasoning = effort === undefined ? [] : ['-c', `model_reasoning_effort="${effort}"`]
  const r = runProcess(resolveCodex(), ['exec', '-s', writable ? 'workspace-write' : 'read-only', '-c', 'approval_policy="never"', ...isolation, ...reasoning, '--skip-git-repo-check', '-'], { cwd, input: prompt, timeoutMs, env: isolated ? DB_SENTINEL_ENV : {}, pidFile: path.join(runDir, 'codex.pid.json') })
  fs.writeFileSync(path.join(runDir, 'codex-output.txt'), r.stdout + (r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''))
  return { ...r, session_id: r.stderr.match(/^session id:\s+([0-9a-f-]{36})\s*$/mi)?.[1] ?? null }
}

/** Provider-neutral execution; actor identity comes from the controller, never model output. */
export function runAgent(agent, role, options, deps = { runClaude, runCodex }) {
  if (!['codex', 'claude'].includes(agent)) throw new Error('Unknown local AI')
  let r
  try {
    r = agent === 'claude'
      ? deps.runClaude({ ...options, strictPermissions: true, readOnly: role !== 'implementer', verify: ['reviewer', 'verifier'].includes(role) })
      : deps.runCodex({ ...options, isolated: true, writable: role === 'implementer' })
  } catch {
    // Configuration may contain secret values; do not copy exceptions/command output into public evidence.
    r = { code: 1, stdout: '', stderr: 'Local AI configuration/execution failed; execution refused', ms: 0, timed_out: false, is_error: true }
  }
  let processId = null
  try { processId = JSON.parse(fs.readFileSync(path.join(options.runDir, `${agent}.pid.json`), 'utf8')).child ?? null } catch { /* receipt absent for injected unit-test runners */ }
  return { ...r, process_id: processId, stdout: agent === 'claude' ? r.result_text ?? '' : r.stdout, agent, role, executable: agent === 'claude' ? resolveClaude() : resolveCodex(), ok: r.code === 0 && !r.timed_out && !r.is_error }
}

/** Codex 출력에서 마지막 ```json vfc-review``` 블록을 꺼낸다. */
export function parseReview(text) {
  const blocks = [...String(text).matchAll(/```json vfc-review\s*\n([\s\S]*?)\n```/g)]
  if (!blocks.length) return { ok: false, error: 'vfc-review 블록 없음' }
  try {
    const j = JSON.parse(blocks[blocks.length - 1][1])
    const errs = []
    if (!['APPROVE', 'REQUEST_CHANGES'].includes(j.verdict)) errs.push('verdict 는 APPROVE|REQUEST_CHANGES')
    if (!Array.isArray(j.findings)) errs.push('findings 배열')
    for (const [i, f] of (j.findings || []).entries()) {
      if (!['P0', 'P1', 'P2', 'P3'].includes(f.severity)) errs.push(`findings[${i}].severity`)
      if (!f.id || !f.claim) errs.push(`findings[${i}] id/claim`)
      if (!['in', 'out'].includes(f.scope)) errs.push(`findings[${i}].scope 는 in|out`)
    }
    if (typeof j.ran_tests !== 'boolean') errs.push('ran_tests(boolean)')
    if (errs.length) return { ok: false, error: errs.join('; '), review: j }
    return { ok: true, review: j }
  } catch (e) {
    return { ok: false, error: `JSON 파싱 실패: ${e.message}` }
  }
}

/** Claude 구조 보고서 검증 */
export function readClaudeReport(file, task) {
  if (!fs.existsSync(file)) return { ok: false, error: `보고서 ${file} 가 없다` }
  let r
  try {
    r = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    return { ok: false, error: `보고서 JSON 오류: ${e.message}` }
  }
  const errs = []
  if (r.task_id !== task.task_id) errs.push('task_id 불일치')
  if (!['implemented', 'blocked', 'failed'].includes(r.status)) errs.push('status 는 implemented|blocked|failed')
  if (!Array.isArray(r.tests)) errs.push('tests 배열')
  for (const [i, t] of (r.tests || []).entries()) {
    if (!t.command || !['pass', 'fail', 'skip', 'not_run'].includes(t.result) || !Number.isInteger(t.skip_count) || !t.log_path) errs.push(`tests[${i}] command/result/skip_count/log_path`)
    if (!Array.isArray(t.covers)) errs.push(`tests[${i}].covers`)
  }
  if (r.status === 'implemented' && !/^[0-9a-f]{7,40}$/.test(r.commit || '')) errs.push('implemented 면 commit sha 필요')
  if (r.findings_response !== undefined && !Array.isArray(r.findings_response)) errs.push('findings_response 배열')
  for (const [i, fr] of (r.findings_response || []).entries()) {
    if (!fr.finding_id || !['fixed', 'false_positive', 'deferred'].includes(fr.action) || !fr.rationale) errs.push(`findings_response[${i}]`)
  }
  return errs.length ? { ok: false, error: errs.join('; '), report: r } : { ok: true, report: r }
}
