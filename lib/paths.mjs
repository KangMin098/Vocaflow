// lib/paths.mjs
//
// 공유 제어 공간의 경로. VFC_ROOT 로 바꿀 수 있다(테스트는 임시 폴더를 쓴다 — 실제 상태를 오염시키지 않는다).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export function root() {
  return path.resolve(process.env.VFC_ROOT || path.join(HERE, '..'))
}

export function goalsDir() {
  // 정본은 항상 이 저장소의 goals/ 에서 읽는다(테스트 루트에서도 같은 정본을 쓴다)
  return path.resolve(process.env.VFC_GOALS_DIR || path.join(HERE, '..', 'goals'))
}

export const p = {
  state: () => path.join(root(), 'state'),
  goalStatus: () => path.join(root(), 'state', 'GOAL_STATUS.json'),
  taskQueue: () => path.join(root(), 'state', 'TASK_QUEUE.json'),
  activeTasks: () => path.join(root(), 'state', 'ACTIVE_TASKS.json'),
  decisionLog: () => path.join(root(), 'state', 'DECISION_LOG.json'),
  ownership: () => path.join(root(), 'state', 'OWNERSHIP_REGISTRY.json'),
  locks: () => path.join(root(), 'runtime', 'locks'),
  recoveredLocks: () => path.join(root(), 'runtime', 'locks', 'recovered'),
  logs: () => path.join(root(), 'runtime', 'logs'),
  eventLog: () => path.join(root(), 'runtime', 'logs', 'events.jsonl'),
  checkpoints: () => path.join(root(), 'runtime', 'checkpoints'),
  requests: () => path.join(root(), 'planning', 'requests'),
  responses: () => path.join(root(), 'planning', 'responses'),
  archive: () => path.join(root(), 'planning', 'archive'),
}

/**
 * worktree 경로를 하나의 자원 식별자로: Git Bash 형식 변환 → 절대경로 → (있으면) 실경로(junction·심볼릭·8.3 이름 해소)
 * → 구분자 / → 끝 / 제거 → Windows 는 전체 소문자(NTFS 는 대소문자 무시 — D:/WORKSPACE/X 와 d:/workspace/x 는 같은 폴더).
 */
export function normalizeWorktree(wt) {
  if (!wt) return null
  let s = String(wt).trim()
  const m = s.match(/^\/([a-zA-Z])\/(.*)$/)
  if (m) s = `${m[1]}:/${m[2]}`
  s = path.resolve(s)
  try {
    s = fs.realpathSync.native(s)
  } catch {
    /* 아직 없는 경로는 해석한 그대로 */
  }
  s = s.replace(/\\/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? s.toLowerCase() : s
}
