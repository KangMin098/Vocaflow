// lib/workers.mjs
//
// owner worker — 영구 owner_id 와 실제 실행 주체(worker 인스턴스)를 나눈다. 세션 이름이 바뀌어도 owner_id 는 그대로다.
//
//   등록(1회 · 사용자 대화형 터미널): owners[owner].workers[worker_id] = { worker_id, owner_id, worktree, branch, task_kinds,
//        registered_at, registered_via:'tty', status, pid, heartbeat_at, active_task, generation }
//        worktree 는 그 owner 에 묶인다(다른 owner 의 worktree 면 거부 — 다른 작업 영역을 차지하지 않는다)
//   인수(claim): 배정(dispatch)된 작업은 그 owner 의 등록 worker(또는 owner session_aliases 의 세션)만 시작할 수 있다 — 다른 세션의 claim 거부
//        상태 뮤텍스 안에서 READY → IN_PROGRESS 한 번(중복 claim 은 ALREADY_RUNNING/BAD_TRANSITION) · run.generation 증가(fencing)
//   생존: worker 가 heartbeat_at·pid 를 남긴다. pid 가 죽으면 기존 reap/handoffDeadSessions 가 작업을 되돌린다(임대 만료만으로 쓰기 권한을 넘기지 않음)
//   제출 전 fencing: 작업의 run.worker_id·generation 이 자기 것이 아니면 제출하지 않는다

import crypto from 'node:crypto'
import os from 'node:os'
import { RuleError, bindWorktree, approvalChannel } from './tasks.mjs'
import { normalizeWorktree } from './paths.mjs'

const now = () => new Date().toISOString()
export const HEARTBEAT_STALE_MS = 5 * 60_000

export function workersOf(state, owner) {
  return state.ownership.owners[owner]?.workers || {}
}

/** 1회 등록 — 사람의 대화형 터미널에서만(worker 는 owner 의 신원으로 작업을 인수한다) */
export function registerWorker(state, { owner, worktree, branch, task_kinds = ['implement'], via = approvalChannel() }) {
  if (via !== 'tty') throw new RuleError('TRUST_REQUIRED', `worker 등록은 사람의 대화형 터미널에서만(현재 ${via}) — owner 의 신원으로 작업을 인수하는 권한이다`)
  const o = state.ownership.owners[owner]
  if (!o) throw new RuleError('NO_OWNER', `owner ${owner} 가 없다`)
  const key = normalizeWorktree(worktree)
  for (const [id, other] of Object.entries(state.ownership.owners)) {
    if (id !== owner && (other.worktrees || []).some((w) => w.path === key)) throw new RuleError('WORKTREE_OWNED', `${key} 는 owner ${id} 의 worktree 다 — 다른 작업 영역을 차지하지 않는다`)
  }
  if (!(o.worktrees || []).some((w) => w.path === key)) bindWorktree(state, owner, worktree, branch)
  const worker_id = `w-${owner}-${crypto.randomBytes(3).toString('hex')}`
  o.workers = { ...(o.workers || {}), [worker_id]: { worker_id, owner_id: owner, worktree: key, branch, task_kinds, registered_at: now(), registered_via: 'tty', host: os.hostname(), status: 'registered', pid: null, heartbeat_at: null, active_task: null, generation: 0 } }
  return o.workers[worker_id]
}

export function findWorker(state, worker_id) {
  for (const o of Object.values(state.ownership.owners)) if (o.workers?.[worker_id]) return o.workers[worker_id]
  return null
}

export function heartbeat(state, worker_id, { pid, status, active_task = undefined }) {
  const w = findWorker(state, worker_id)
  if (!w) throw new RuleError('NO_WORKER', `worker ${worker_id} 가 없다`)
  if (w.status === 'revoked') throw new RuleError('WORKER_REVOKED', `worker ${worker_id} 는 해지됐다`)
  Object.assign(w, { pid, heartbeat_at: now(), status, ...(active_task !== undefined ? { active_task } : {}) })
  return w
}

/** 이 owner 의 실행 가능한 worker 가 있나(heartbeat 신선 · 해지 아님) — 중앙이 OWNER_UNAVAILABLE 을 판단할 때 */
export function liveWorkers(state, owner, nowMs = Date.now()) {
  return Object.values(workersOf(state, owner)).filter((w) => w.status !== 'revoked' && w.heartbeat_at && nowMs - Date.parse(w.heartbeat_at) < HEARTBEAT_STALE_MS)
}

/** 배정 작업의 claim 자격 — startTask 가 부른다 */
export function assertClaimer(state, task, { owner_id, session, worker_id }) {
  if (!task.dispatch) return
  const o = state.ownership.owners[task.owner_id]
  if (worker_id) {
    const w = o?.workers?.[worker_id]
    if (!w || w.status === 'revoked') throw new RuleError('WRONG_WORKER', `worker ${worker_id} 는 owner ${task.owner_id} 의 등록 worker 가 아니다`)
    if (task.worktree && normalizeWorktree(task.worktree) !== w.worktree) throw new RuleError('WRONG_WORKTREE', `작업 worktree ${task.worktree} ≠ worker worktree ${w.worktree}`)
    return
  }
  const aliases = o?.session_aliases || []
  if (session?.label && aliases.includes(session.label)) return
  throw new RuleError('WRONG_WORKER', `배정 작업 ${task.task_id} 는 owner ${task.owner_id} 의 등록 worker(--worker) 또는 등록된 세션만 인수한다(받은: ${session?.label ?? '-'})`)
}
