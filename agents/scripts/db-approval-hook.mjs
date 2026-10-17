#!/usr/bin/env node
// agents/scripts/db-approval-hook.mjs
//
// PreToolUse 훅 — 승인형 DB 배포의 티켓 발급 담당(판정 규칙은 guard.mjs · 티켓은 db-approval.mjs).
// guard.mjs 가 같은 명령에 "ask"(사용자 승인 창)를 내는 동안, 이 훅은 승인 창이 뜨기 직전에 1회용 티켓을 쓴다.
// 사용자가 창에서 허용하면 러너가 티켓을 소비해 접속하고, 거부하면 명령이 실행되지 않아 티켓은 TTL 뒤 무효가 된다.
//
// Claude 대화형 세션에서만 발급한다. Codex · 자동 실행(VFC_AUTOMATED_RUN=1) · AGENT_GUARD_ASK=0 · CI 에서는
// 발급하지 않는다(승인할 사람이 없다). 판정 거부(형식 오류 · 래퍼 · 티켓 디렉터리 접근)면 발급하지 않는다.
// 이 훅은 아무것도 허용하지 않는다 — 출력이 없으면 Claude Code 는 다른 훅(guard)의 판정을 따른다.
//
// 시험: echo '{"tool_name":"Bash","tool_input":{"command":"node scripts/db/x/deploy.mjs apply --stage db1 --confirm-sha <64hex>"}}' \
//         | VF_DB_APPROVAL_DIR=/tmp/t node agents/scripts/db-approval-hook.mjs --agent claude

import { issueTicket } from './db-approval.mjs'
import { deployApprovals } from './guard.mjs'
import { isMain } from './lib.mjs'

const SHELL_TOOLS = /^(Bash|PowerShell)$/

/** 정식 형태가 아닌 apply(셸 래퍼 · 변수 · 치환)는 승인 창의 명령과 실행 명령이 어긋날 수 있어 거부한다. */
export function denyReasons(cmd) {
  const { asks, denies } = deployApprovals(cmd)
  if (denies.length) return denies
  if (!asks.length && !/^\s*git\s/.test(cmd) && /deploy\.mjs/i.test(cmd) && /\bapply\b/.test(cmd) && /scripts[\\/]db[\\/]/i.test(cmd))
    return ['DB 배포 apply 가 정식 형태가 아니다 — 래퍼·변수·치환 없이 `node scripts/db/<id>/deploy.mjs apply --stage <s> --confirm-sha <sha>` 로만 승인한다']
  return []
}

/** @returns {{ deny: string[], tickets: object[] }} */
export function handle(payload, { agent, env = process.env, now = Date.now(), dir } = {}) {
  const none = { deny: [], tickets: [] }
  if (!SHELL_TOOLS.test(payload?.tool_name ?? '')) return none
  const cmd = payload?.tool_input?.command
  if (typeof cmd !== 'string' || !cmd) return none
  const deny = denyReasons(cmd)
  if (deny.length) return { deny, tickets: [] }
  if (agent !== 'claude') return none
  if (env.VFC_AUTOMATED_RUN === '1' || env.AGENT_GUARD_ASK === '0' || (env.CI && env.CI !== 'false')) return none
  const { asks } = deployApprovals(cmd)
  if (asks.length !== 1) return none
  const [a] = asks
  const t = issueTicket({ runner: a.runner, stage: a.stage, sha: a.sha, sessionId: payload.session_id ?? null, now, ...(dir ? { dir } : {}) })
  return { deny: [], tickets: [t] }
}

async function main() {
  const argv = process.argv.slice(2)
  const agent = argv[argv.indexOf('--agent') + 1] ?? 'unknown'
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  let payload
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    process.exit(0)
  }
  try {
    const { deny } = handle(payload, { agent })
    if (deny.length) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[db-approval] ${deny.join(' / ')}` },
        }) + '\n',
      )
    }
  } catch (e) {
    process.stderr.write(`[db-approval-hook] 티켓 발급 실패 — 러너가 승인 없음으로 거절한다: ${e.message}\n`)
  }
  process.exit(0)
}

if (isMain(import.meta.url)) main()
