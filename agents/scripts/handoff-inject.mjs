#!/usr/bin/env node
// agents/scripts/handoff-inject.mjs
//
// SessionStart 훅 — Claude Code · Codex CLI 공용. stdout 이 세션 컨텍스트로 들어간다.
//   · .agent-handoff/latest.json 이 이 에이전트 앞으로 왔고 아직 읽음 표시(--ack)가 없으면 1–6항목을 주입
//   · 워크트리 잠금이 남(다른 에이전트)에게 있으면 경고
//   · 이 워크트리의 안전장치(SAFETY_PATHS)가 origin/main 보다 뒤처졌으면 경고
// 아무것도 없으면 아무것도 출력하지 않는다(매 세션 컨텍스트를 낭비하지 않게). 항상 exit 0 — 세션 시작을 막지 않는다.
//
//   node agents/scripts/handoff-inject.mjs --agent claude

import fs from 'node:fs'
import path from 'node:path'
import { DIR } from './handoff.mjs'
import { git, isMain, lf } from './lib.mjs'
import { read as readLock, state as lockState } from './lock.mjs'

const MAX_AGE_MS = 7 * 24 * 3600 * 1000

/** 두 에이전트의 안전장치가 사는 경로 — 여기가 main 보다 낡으면 파괴 명령 차단이 옛 규칙으로 돈다. */
export const SAFETY_PATHS = ['agents/scripts', '.codex', '.claude/settings.json']

/**
 * 이 워크트리에 아직 없는 main 의 안전장치 커밋 수. 네트워크를 쓰지 않는다(로컬 origin/main 기준) —
 * 세션 시작을 느리게 만들지 않으려고. origin/main 이 없거나 git 이 실패하면 null(경고하지 않는다).
 *
 * ⚠️ 실측 2026-09-26: main 에 Codex 가드 수정(JSON deny)이 들어간 뒤에도 워크트리 15개 중 13개가 옛 가드였다.
 *    옛 가드는 Codex 에서 exit 2 만 내고 명령은 그대로 실행된다 — 조용히 무력한 종류라 세션 시작에서 알린다.
 */
export function staleSafetyCommits(run = git) {
  try {
    run(['rev-parse', '--verify', '--quiet', 'origin/main'])
    const n = Number(run(['rev-list', '--count', 'HEAD..origin/main', '--', ...SAFETY_PATHS]).trim())
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function injection(agent, run = git) {
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
  const stale = staleSafetyCommits(run)
  if (stale)
    out.push(`[안전장치 낡음] 이 워크트리의 ${SAFETY_PATHS.join(' · ')} 가 origin/main 보다 커밋 ${stale}개 뒤다 — 파괴 명령 차단이 옛 규칙으로 돈다. 작업 전에 사용자에게 알리고 \`git merge origin/main\` 으로 받는다(agents/router.md §5).`)
  return out.join('\n')
}

if (isMain(import.meta.url)) {
  const i = process.argv.indexOf('--agent')
  const text = injection(i === -1 ? 'unknown' : process.argv[i + 1])
  if (text) process.stdout.write(text + '\n')
  process.exit(0)
}
