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
import { spawnSync } from 'node:child_process'

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

export function runProcess(cmd, args, { cwd, input, timeoutMs, env = {}, unset = [] }) {
  const [exe, pre] = splitCmd(cmd)
  const t0 = Date.now()
  const childEnv = { ...process.env, ...env }
  for (const k of unset) delete childEnv[k]
  const r = spawnSync(exe, [...pre, ...args], { cwd, input, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024, env: childEnv, windowsHide: true })
  return { code: r.status, signal: r.signal, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message ?? null, timed_out: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM', ms: Date.now() - t0 }
}

export const CLAUDE_ALLOW = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash(pnpm:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git show:*)', 'Bash(node:*)']
export const CLAUDE_DENY = ['Bash(git push:*)', 'Bash(git reset:*)', 'Bash(git checkout:*)', 'Bash(git clean:*)', 'Bash(rm:*)', 'Bash(curl:*)', 'Bash(pnpm add:*)', 'Bash(pnpm install:*)', 'WebFetch', 'WebSearch']

export function runClaude({ prompt, cwd, budgetUsd, timeoutMs, runDir }) {
  fs.mkdirSync(runDir, { recursive: true })
  const settingsPath = path.join(runDir, 'claude-settings.json')
  fs.writeFileSync(settingsPath, JSON.stringify({ permissions: { allow: CLAUDE_ALLOW, deny: CLAUDE_DENY } }, null, 2))
  const args = ['-p', '--output-format', 'json', '--permission-mode', 'acceptEdits', '--settings', settingsPath, '--strict-mcp-config', '--no-session-persistence', '--max-budget-usd', String(budgetUsd)]
  // 이 오케스트레이터가 Claude Code 세션 안에서 돌 때 상속되는 세션 표식을 지운다 — 남겨 두면 자식 CLI 가 중첩 세션으로 거부하거나 부모 세션 설정을 따른다
  const unset = Object.keys(process.env).filter((k) => /^CLAUDE(CODE|_CODE_|_PID$|_AGENT_SDK)/.test(k))
  const r = runProcess(resolveClaude(), args, { cwd, input: prompt, timeoutMs, unset })
  fs.writeFileSync(path.join(runDir, 'claude-stdout.json'), r.stdout)
  if (r.stderr) fs.writeFileSync(path.join(runDir, 'claude-stderr.txt'), r.stderr)
  let meta = null
  try {
    meta = JSON.parse(r.stdout)
  } catch {
    meta = null
  }
  return { ...r, cost_usd: Number(meta?.total_cost_usd ?? meta?.cost_usd ?? 0) || 0, is_error: meta ? !!meta.is_error : r.code !== 0, result_text: meta?.result ?? null, subtype: meta?.subtype ?? null }
}

export function runCodex({ prompt, cwd, timeoutMs, runDir }) {
  fs.mkdirSync(runDir, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'codex-prompt.md'), prompt)
  const r = runProcess(resolveCodex(), ['exec', '-s', 'read-only', '-c', 'model_reasoning_effort="high"', '--skip-git-repo-check', '-'], { cwd, input: prompt, timeoutMs })
  fs.writeFileSync(path.join(runDir, 'codex-output.txt'), r.stdout + (r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''))
  return r
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
