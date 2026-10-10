#!/usr/bin/env node
// hooks/dispatch-notify.mjs — 배정 알림 훅(UserPromptSubmit · PostToolUse). 담당 owner 세션의 대화에 「새 배정」을 넣는다.
//
// 왜: T-0019 는 배정(03:54) 뒤 99분 동안 담당 세션에 전달되지 않았다 — 배정은 받은 편지함 파일에만 있었고 세션은 다른 일을 하느라
//     파일을 보지 않았다(2026-10-10 실측). 이 훅은 Claude Code 가 지원하는 additionalContext 로 실행 중인 세션에 직접 알린다.
//
// 동작(읽기 전용 · 실패해도 세션을 막지 않는다 — 항상 exit 0):
//   1. 이 세션이 어느 owner 인가: OWNERSHIP_REGISTRY 의 session_aliases(세션 id) 또는 owner worktree 안의 cwd
//   2. 그 owner 에게 배정됐고 아직 인수 안 된 READY 작업 중 이 세션에 아직 알리지 않은 것
//   3. additionalContext 로 알리고, 알린 사실을 <root>/runtime/logs/dispatch-notified.jsonl 에 남긴다(배정→전달 시간 계측)
// 빈도: PostToolUse 는 세션당 60초에 한 번만 본다(UserPromptSubmit 은 매번). 설정: 같은 폴더 dispatch-notify.config.json {"root": AI-Control 경로}

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const THROTTLE_MS = 60_000
const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/([a-z])\//i, '$1:/').replace(/\/+$/, '').toLowerCase()

/** 순수 판정 — 테스트 대상. 반환: { owners, tasks } */
export function pendingFor({ ownership, taskQueue, sessionId, cwd, notified = [] }) {
  const owners = Object.entries(ownership.owners || {})
    .filter(([, o]) => (o.session_aliases || []).some((a) => (typeof a === 'string' ? a : a?.label) === sessionId) || (o.worktrees || []).some((w) => w.path && (norm(cwd) === norm(w.path) || norm(cwd).startsWith(`${norm(w.path)}/`))))
    .map(([id]) => id)
  const tasks = (taskQueue.tasks || []).filter((t) => owners.includes(t.dispatch?.to) && t.status === 'READY' && !t.dispatch?.accepted_at && !notified.includes(`${t.task_id}@${t.dispatch?.at}`))
  return { owners, tasks }
}

export function message(tasks) {
  return [
    `[AI-Control 배정] 이 세션의 owner 에게 인수 대기 작업 ${tasks.length}건 — 지금 하는 일을 안전한 지점에서 마치고 인수하세요(다른 owner 영역은 건드리지 않음).`,
    ...tasks.map((t) => `- ${t.task_id} 「${t.title}」 · owner ${t.dispatch.to} · 배정 ${t.dispatch.at}${t.ui_gate ? ' · UI Quality Gate(type ui 증거 필요)' : ''} · 허용 경로 ${(t.allowed_paths || []).join(', ')}`),
    `인수: node bin/vfc.mjs task start <id> --owner <owner> --agent claude --session <세션 id> (AI-Control 저장소에서) · 상세는 planning/inbox/<owner>.md`,
  ].join('\n')
}

function main() {
  let input = {}
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
  } catch {
    return
  }
  const here = path.dirname(fileURLToPath(import.meta.url))
  let root = process.env.VFC_ROOT
  try {
    root ||= JSON.parse(fs.readFileSync(path.join(here, 'dispatch-notify.config.json'), 'utf8')).root
  } catch {
    return
  }
  const sid = input.session_id
  if (!root || !sid) return
  const event = input.hook_event_name || 'PostToolUse'
  const memo = path.join(os.tmpdir(), `vfc-dispatch-notify-${String(sid).replace(/[^\w-]/g, '')}.json`)
  let seen = { checked_at: 0, notified: [] }
  try {
    seen = JSON.parse(fs.readFileSync(memo, 'utf8'))
  } catch {
    /* 처음 */
  }
  const nowMs = Date.now()
  if (event === 'PostToolUse' && nowMs - (seen.checked_at || 0) < THROTTLE_MS) return
  seen.checked_at = nowMs
  let ownership, taskQueue
  try {
    ownership = JSON.parse(fs.readFileSync(path.join(root, 'state', 'OWNERSHIP_REGISTRY.json'), 'utf8'))
    taskQueue = JSON.parse(fs.readFileSync(path.join(root, 'state', 'TASK_QUEUE.json'), 'utf8'))
  } catch {
    fs.writeFileSync(memo, JSON.stringify(seen))
    return
  }
  const { tasks } = pendingFor({ ownership, taskQueue, sessionId: sid, cwd: input.cwd || process.cwd(), notified: seen.notified || [] })
  if (tasks.length) {
    seen.notified = [...(seen.notified || []), ...tasks.map((t) => `${t.task_id}@${t.dispatch.at}`)].slice(-200)
    const at = new Date(nowMs).toISOString()
    try {
      fs.mkdirSync(path.join(root, 'runtime', 'logs'), { recursive: true })
      fs.appendFileSync(path.join(root, 'runtime', 'logs', 'dispatch-notified.jsonl'), tasks.map((t) => JSON.stringify({ task_id: t.task_id, owner: t.dispatch.to, dispatched_at: t.dispatch.at, notified_at: at, session: sid, event })).join('\n') + '\n')
    } catch {
      /* 기록 실패는 알림을 막지 않는다 */
    }
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: message(tasks) } }))
  }
  fs.writeFileSync(memo, JSON.stringify(seen))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main()
  } catch {
    /* 훅 실패로 세션을 막지 않는다 */
  }
  process.exit(0)
}
