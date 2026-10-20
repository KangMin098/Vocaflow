// lib/remote.mjs — LOCAL_FAST 의 두 상태를 분리한다(2026-10-20 사용자 지시 「CI 대기를 개발 중단 시간으로 만들지 말라」)
//
//   로컬 개발 상태(작업 큐에서 계산 · 저장하지 않는다)
//     READY → DESIGNING(기획 대기) → IMPLEMENTING → LOCAL_REVIEW(반대 AI 리뷰) → LOCAL_ACCEPTED(COMPLETED) → LOCAL_INTEGRATED(로컬 통합 기록)
//   원격 공식 통합 상태(state/REMOTE_INTEGRATION.json · 공식 제품 PR 에만)
//     NOT_SUBMITTED → CI_PENDING → CI_FAILED | REMOTE_REVIEW → MERGE_READY → MERGED
//
// 원격 상태는 **로컬 진행을 막지 않는다** — 다음 작업 선정 · 로컬 통합은 원격 상태를 읽지 않는다.
// 원격 상태는 공식 병합 판정(safe-merge · 필수 CI)만 대신 보여 줄 뿐, 통과로 바꾸지 않는다: MERGE_READY 는 기록일 뿐 병합 권한이 아니다.
import fs from 'node:fs'
import path from 'node:path'

import { atomicWriteJson, readJsonSafe } from './fsutil.mjs'
import { root } from './paths.mjs'

export const REMOTE_STATES = ['NOT_SUBMITTED', 'CI_PENDING', 'CI_FAILED', 'REMOTE_REVIEW', 'MERGE_READY', 'MERGED']
export const LOCAL_STATES = ['READY', 'DESIGNING', 'IMPLEMENTING', 'LOCAL_REVIEW', 'LOCAL_ACCEPTED', 'LOCAL_INTEGRATED', 'BLOCKED', 'FAILED']

const file = () => path.join(root(), 'state', 'REMOTE_INTEGRATION.json')
const SHA = /^[0-9a-f]{7,40}$/

export function loadRemote(f = file()) {
  return readJsonSafe(f, { schema: 'vfc-remote/1', entries: {} }).value
}

/** 원격 상태 기록 — 작업 · PR · HEAD 에 결속. HEAD 가 바뀌면 이전 CI 결과를 승계하지 않는다(새 HEAD 는 CI_PENDING 부터) */
export function setRemote(task_id, { pr, head, status, note = null, by }, { f = file(), now = () => new Date().toISOString() } = {}) {
  if (!REMOTE_STATES.includes(status)) throw new Error(`원격 상태는 ${REMOTE_STATES.join('|')}`)
  if (status !== 'NOT_SUBMITTED' && !(Number.isInteger(pr) && pr > 0)) throw new Error('제출된 원격 상태에는 PR 번호가 필요하다')
  if (status !== 'NOT_SUBMITTED' && !SHA.test(String(head ?? ''))) throw new Error('제출된 원격 상태에는 HEAD sha 가 필요하다')
  if (!by) throw new Error('기록 주체(--by)가 필요하다')
  const r = loadRemote(f)
  const prev = r.entries[task_id] ?? null
  // 같은 HEAD 가 아닌데 CI 결과 이후 상태로 바로 가면 거부 — 다른 커밋의 초록을 승계하지 않는다
  if (prev && head && prev.head && !String(head).startsWith(String(prev.head).slice(0, 7)) && !['NOT_SUBMITTED', 'CI_PENDING'].includes(status)) {
    throw new Error(`HEAD ${String(head).slice(0, 9)} 는 기록된 ${String(prev.head).slice(0, 9)} 와 다르다 — 새 HEAD 는 CI_PENDING 부터`)
  }
  const entry = { task_id, pr: pr ?? null, head: head ?? null, status, note, updated_at: now(), by, history: [...(prev?.history ?? []), { at: now(), from: prev?.status ?? null, to: status, head: head ?? null, by, note }] }
  r.entries[task_id] = entry
  fs.mkdirSync(path.dirname(f), { recursive: true })
  atomicWriteJson(f, r)
  return entry
}

/** 로컬 통합 기록(verification/local/integrate--<task>--<sha>.json) 중 성공한 것 */
export function localIntegrated(task_id, dir = path.join(root(), 'verification', 'local')) {
  let files = []
  try { files = fs.readdirSync(dir).filter((x) => x.startsWith(`integrate--${task_id}--`)) } catch { return null }
  for (const x of files) {
    try { const j = JSON.parse(fs.readFileSync(path.join(dir, x), 'utf8')); if (j.ok && j.integrated) return { head: j.head, integrated: j.integrated, at: j.at } } catch { /* 판독 불가 기록은 통합 근거가 아니다 */ }
  }
  return null
}

/** 로컬 개발 상태 — 작업 큐 상태 + 로컬 통합 기록에서 계산(원격 상태는 입력이 아니다) */
export function localStatus(t, integrated = localIntegrated(t.task_id)) {
  switch (t.status) {
    case 'READY': return 'READY'
    case 'WAITING_CHATGPT': return 'DESIGNING'
    case 'IN_PROGRESS': return 'IMPLEMENTING'
    case 'REVIEW': return 'LOCAL_REVIEW'
    case 'COMPLETED': return integrated && t.verified_commit && String(integrated.head).startsWith(String(t.verified_commit).slice(0, 7)) ? 'LOCAL_INTEGRATED' : 'LOCAL_ACCEPTED'
    case 'BLOCKED': return 'BLOCKED'
    default: return t.status === 'FAILED' ? 'FAILED' : 'READY'
  }
}

/** 두 상태 나란히 — 작업마다 { local, remote } */
export function statusBoard(tasks, remote = loadRemote(), integratedOf = localIntegrated) {
  return tasks.map((t) => ({ task_id: t.task_id, owner: t.owner_id, local: localStatus(t, integratedOf(t.task_id)), remote: remote.entries[t.task_id]?.status ?? 'NOT_SUBMITTED', pr: remote.entries[t.task_id]?.pr ?? null, head: remote.entries[t.task_id]?.head ?? null }))
}
