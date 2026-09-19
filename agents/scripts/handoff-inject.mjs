#!/usr/bin/env node
// agents/scripts/handoff-inject.mjs
//
// SessionStart 훅 — Claude Code · Codex CLI 공용. stdout 이 세션 컨텍스트로 들어간다.
//   · .agent-handoff/latest.json 이 이 에이전트 앞으로 왔고 아직 읽음 표시(--ack)가 없으면 1–6항목을 주입
//   · 워크트리 잠금이 남(다른 에이전트)에게 있으면 경고
// 아무것도 없으면 아무것도 출력하지 않는다(매 세션 컨텍스트를 낭비하지 않게). 항상 exit 0 — 세션 시작을 막지 않는다.
//
//   node agents/scripts/handoff-inject.mjs --agent claude

import fs from 'node:fs'
import path from 'node:path'
import { DIR } from './handoff.mjs'
import { isMain, lf } from './lib.mjs'
import { read as readLock, state as lockState } from './lock.mjs'

const MAX_AGE_MS = 7 * 24 * 3600 * 1000

export function injection(agent) {
  const out = []
  try {
    const js = path.join(DIR, 'latest.json')
    const md = path.join(DIR, 'latest.md')
    if (fs.existsSync(js) && fs.existsSync(md)) {
      const h = JSON.parse(fs.readFileSync(js, 'utf8'))
      const fresh = Date.now() - Date.parse(h.created_at) < MAX_AGE_MS
      if (h.to === agent && !h.ack && fresh) {
        const text = lf(fs.readFileSync(md, 'utf8'))
        const cut = text.indexOf('\n## 부록 A')
        out.push(
          `[인수인계 도착] ${h.from} → ${h.to} (${h.created_at}). 첫 동작: 수용 기준 재확인 → \`node agents/scripts/handoff.mjs --verify\` → \`node agents/scripts/lock.mjs acquire ${agent}\`. 읽었으면 \`node agents/scripts/handoff.mjs --ack ${agent}\`.`,
          '',
          (cut === -1 ? text : text.slice(0, cut)).trim(),
        )
      }
    }
  } catch (e) {
    out.push(`[인수인계] latest.json 을 읽지 못했다: ${e.message}`)
  }
  const lock = readLock()
  if (lock && lock.agent !== agent && lockState(lock) === 'held')
    out.push(`[잠금] 이 워크트리는 ${lock.agent} 가 쓰는 중이다(pid ${lock.pid}, ${lock.started_at}). 쓰기 전에 사용자에게 확인하거나 \`pnpm wt new <suffix>\` 로 워크트리를 나눈다.`)
  return out.join('\n')
}

if (isMain(import.meta.url)) {
  const i = process.argv.indexOf('--agent')
  const text = injection(i === -1 ? 'unknown' : process.argv[i + 1])
  if (text) process.stdout.write(text + '\n')
  process.exit(0)
}
