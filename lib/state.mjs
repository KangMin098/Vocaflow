// lib/state.mjs
//
// 공유 상태 파일 5종의 읽기·쓰기. 모든 변경은 withState() 안에서 한다.
//
//   상태 뮤텍스 → (남은 journal 이 있으면 먼저 재적용) → 5개 파일 읽기 → fn 이 변경
//   → 바뀐 파일 전체를 state/.journal.json 에 한 번에 원자적으로 기록(= 커밋 지점)
//   → 각 파일을 원자적으로 교체 → journal 삭제 → 커밋 후 동작(잠금 반납 등) → 뮤텍스 반납
//
// 어느 단계에서 죽어도:
//   journal 기록 전  → 아무것도 바뀌지 않았다(본 파일 옛 판).
//   journal 기록 후  → 다음 withState 가 journal 을 재적용해 5개 파일을 한꺼번에 새 판으로 맞춘다(부분 커밋 없음).
//   커밋 후 동작 전 → 잠금이 남지만 그 작업은 더 이상 IN_PROGRESS 가 아니므로 고아 정리(reconcileLocks)가 치운다.
//
// 파일                       내용
//   GOAL_STATUS.json         정본 목표·출시 게이트별 PASS/FAIL/UNKNOWN/BLOCKED/EXTERNAL_INPUT_REQUIRED + 근거
//   TASK_QUEUE.json          모든 작업의 정본
//   ACTIVE_TASKS.json        IN_PROGRESS 작업(TASK_QUEUE 에서 파생)
//   DECISION_LOG.json        결정·제안·열린 질문(append-only)
//   OWNERSHIP_REGISTRY.json  고정 owner_id ↔ worktree·branch·DB 범위·현재 세션
//   ORCHESTRATOR.json        자동 실행기의 run 기록(단계·예산·사건) — 재시작 시 여기서 복구한다

import fs from 'node:fs'
import path from 'node:path'
import { p } from './paths.mjs'
import { atomicWriteJson, readJsonSafe, appendLog, readJson } from './fsutil.mjs'
import { withMutex } from './lock.mjs'

export const STATE_MUTEX = 'state--mutex'
export const SCHEMA = 'vfc-state/1'

export const FILES = {
  goalStatus: p.goalStatus,
  taskQueue: p.taskQueue,
  activeTasks: p.activeTasks,
  decisionLog: p.decisionLog,
  ownership: p.ownership,
  orchestrator: p.orchestrator,
}

const EMPTY = {
  goalStatus: () => ({ schema: SCHEMA, canon_version: null, goals: {}, release_gates: {} }),
  taskQueue: () => ({ schema: SCHEMA, next_seq: 1, tasks: [] }),
  activeTasks: () => ({ schema: SCHEMA, tasks: [] }),
  decisionLog: () => ({ schema: SCHEMA, next_seq: 1, entries: [], imported_responses: {} }),
  ownership: () => ({ schema: SCHEMA, owners: {} }),
  orchestrator: () => ({ schema: SCHEMA, current_run: null, runs: {} }),
}

const journalFile = () => path.join(p.state(), '.journal.json')

/** 뮤텍스 밖에서 읽을 때: journal 이 남아 있으면 그 판을 우선(커밋은 됐고 반영만 안 된 상태). */
export function loadState() {
  const s = {}
  const recovered = []
  let journal = null
  if (fs.existsSync(journalFile())) {
    try {
      journal = readJson(journalFile())
    } catch {
      journal = null // journal 자체가 깨졌으면 커밋 전에 죽은 것 — 무시
    }
  }
  for (const [k, fp] of Object.entries(FILES)) {
    if (journal?.files?.[k]) {
      s[k] = journal.files[k]
      continue
    }
    const r = readJsonSafe(fp(), EMPTY[k]())
    if (r.recovered) recovered.push({ file: fp(), error: r.error })
    s[k] = r.value
  }
  if (!s.decisionLog.imported_responses) s.decisionLog.imported_responses = {}
  return { state: s, recovered, pending_journal: !!journal }
}

function replayJournal() {
  if (!fs.existsSync(journalFile())) return false
  let journal
  try {
    journal = readJson(journalFile())
  } catch {
    fs.rmSync(journalFile(), { force: true })
    return false
  }
  for (const [k, v] of Object.entries(journal.files || {})) atomicWriteJson(FILES[k](), v)
  fs.rmSync(journalFile(), { force: true })
  appendLog(p.eventLog(), { at: new Date().toISOString(), event: 'state.journal_replayed', files: Object.keys(journal.files || {}) })
  return true
}

/**
 * fn(state, ctx) 가 state 를 직접 바꾸고 결과를 돌려준다. throw 하면 아무것도 쓰지 않는다.
 * ctx.afterCommit(cb): 상태가 디스크에 커밋된 뒤(뮤텍스 안) 실행 — 잠금 반납처럼 「기록 후에만」 해야 하는 일.
 * ctx.onAbort(cb): fn 이 throw 했을 때 실행 — 이미 잡은 잠금을 되돌리는 일.
 */
export function withState(fn, meta = {}) {
  return withMutex(STATE_MUTEX, () => {
    replayJournal()
    const { state, recovered } = loadState()
    const before = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, JSON.stringify(v)]))
    const after = []
    const abort = []
    const ctx = { afterCommit: (cb) => after.push(cb), onAbort: (cb) => abort.push(cb) }
    let result
    try {
      result = fn(state, ctx)
    } catch (e) {
      for (const cb of abort.reverse()) {
        try {
          cb()
        } catch {
          /* 되돌리기 실패는 고아 정리가 처리 */
        }
      }
      throw e
    }
    state.activeTasks = deriveActive(state.taskQueue)
    deriveTemplates(state.goalStatus, state.taskQueue)
    const now = new Date().toISOString()
    const changed = {}
    for (const [k, fp] of Object.entries(FILES)) {
      if (JSON.stringify(state[k]) !== before[k] || !fs.existsSync(fp())) {
        state[k].updated_at = now
        changed[k] = state[k]
      }
    }
    if (Object.keys(changed).length) {
      atomicWriteJson(journalFile(), { at: now, files: changed }) // 커밋 지점
      if (process.env.VFC_CRASH_AT === 'after_journal') process.exit(87)
      for (const [k, v] of Object.entries(changed)) atomicWriteJson(FILES[k](), v)
      fs.rmSync(journalFile(), { force: true })
    }
    if (process.env.VFC_CRASH_AT === 'before_after_commit') process.exit(88)
    for (const cb of after) cb()
    if (recovered.length) appendLog(p.eventLog(), { at: now, event: 'state.recovered_from_bak', recovered })
    if (meta.event) appendLog(p.eventLog(), { at: now, ...meta })
    return result
  })
}

/** 템플릿 상태는 작업에서 파생한다: 그 템플릿을 쓰는 작업이 하나라도 있으면 instantiated. PASS/FAIL 로 바꾸지 않는다. */
export function deriveTemplates(goalStatus, taskQueue) {
  for (const tpl of Object.values(goalStatus.templates || {})) {
    tpl.instances = taskQueue.tasks.filter((t) => t.template === tpl.id).map((t) => ({ task_id: t.task_id, goal_id: t.goal_id, status: t.status }))
    tpl.status = tpl.instances.length ? 'instantiated' : 'not_instantiated'
  }
}

export function deriveActive(taskQueue) {
  return {
    schema: SCHEMA,
    note: 'TASK_QUEUE.json 에서 파생 — 직접 고치지 않는다',
    tasks: taskQueue.tasks
      .filter((t) => t.status === 'IN_PROGRESS')
      .map((t) => ({ task_id: t.task_id, goal_id: t.goal_id, owner_id: t.owner_id, session: t.run?.session ?? null, worktree: t.worktree, branch: t.branch, run_seq: t.run_seq, locks: (t.run?.locks || []).map((l) => l.name), started_at: t.run?.started_at ?? null })),
  }
}
