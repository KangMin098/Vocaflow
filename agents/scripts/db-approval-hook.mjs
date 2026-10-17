#!/usr/bin/env node
// agents/scripts/db-approval-hook.mjs
//
// PreToolUse 훅 — 승인형 DB 배포의 승인 창 + 1회용 난수 담당(판정 규칙은 guard.mjs deployApprovals · 티켓은 db-approval.mjs).
//
// 정식 apply 명령이면: 티켓(난수 해시)을 쓰고, permissionDecision "ask" 와 함께 명령 끝에 `--approval-nonce <난수>` 를
// 붙인 updatedInput 을 낸다. 사용자가 허용해야 그 명령이 실행되고, 러너는 난수로 티켓을 소비한다.
// 거부하면 난수가 실린 명령은 실행되지 않으므로 티켓은 누구도 쓸 수 없다.
// 형식 오류 · 변형 호출 · 에이전트가 붙인 난수 · 티켓 디렉터리 쓰기 → deny.
//
// Claude 대화형 세션에서만 발급한다. Codex · 자동 실행(VFC_AUTOMATED_RUN=1) · AGENT_GUARD_ASK=0 · CI 는 발급하지 않는다
// (guard 가 그 환경의 deny 를 맡는다). 이 훅은 무엇도 allow 하지 않는다.
//
// 시험: echo '{"tool_name":"Bash","tool_input":{"command":"node scripts/db/x/deploy.mjs apply --stage db1 --confirm-sha <64hex>"}}' \
//         | VF_DB_APPROVAL_DIR=/tmp/t node agents/scripts/db-approval-hook.mjs --agent claude

import { issueTicket, withNonce } from './db-approval.mjs'
import { deployApprovals } from './guard.mjs'
import { isMain } from './lib.mjs'

const SHELL_TOOLS = /^(Bash|PowerShell)$/

/** @returns {{ deny: string[], ask: null | { reason: string, command: string }, tickets: object[] }} */
export function handle(payload, { agent, env = process.env, now = Date.now(), dir } = {}) {
  const none = { deny: [], ask: null, tickets: [] }
  if (!SHELL_TOOLS.test(payload?.tool_name ?? '')) return none
  const cmd = payload?.tool_input?.command
  if (typeof cmd !== 'string' || !cmd) return none
  const { asks, denies } = deployApprovals(cmd)
  if (denies.length) return { ...none, deny: denies }
  if (asks.length !== 1) return none
  if (agent !== 'claude') return none
  if (env.VFC_AUTOMATED_RUN === '1' || env.AGENT_GUARD_ASK === '0' || (env.CI && env.CI !== 'false')) return none
  const [a] = asks
  const { ticket, nonce } = issueTicket({ runner: a.runner, stage: a.stage, sha: a.sha, sessionId: payload.session_id ?? null, now, ...(dir ? { dir } : {}) })
  return {
    deny: [],
    tickets: [ticket],
    ask: {
      command: withNonce(cmd, a.sha, nonce),
      reason:
        `[db-approval] 개발 DB 배포 승인 — 러너 ${a.runner} · 단계 ${a.stage} · 전체 SHA ${a.sha}\n` +
        `허용하면 이 명령만 1회 실행된다(티켓 ${ticket.id} · ${ticket.expires_at} 까지). 거부하면 아무것도 적용되지 않는다.`,
    },
  }
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
  let out = null
  try {
    const r = handle(payload, { agent })
    if (r.deny.length)
      out = { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[db-approval] ${r.deny.join(' / ')}` }
    else if (r.ask)
      out = {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: r.ask.reason,
        updatedInput: { ...payload.tool_input, command: r.ask.command },
      }
  } catch (e) {
    process.stderr.write(`[db-approval-hook] 티켓 발급 실패 — 러너가 승인 없음으로 거절한다: ${e.message}\n`)
  }
  if (out) process.stdout.write(JSON.stringify({ hookSpecificOutput: out }) + '\n')
  process.exit(0)
}

if (isMain(import.meta.url)) main()
