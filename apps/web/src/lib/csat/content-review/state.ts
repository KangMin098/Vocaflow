// apps/web/src/lib/csat/content-review/state.ts
//
// **F3 상태 계약 · F7 승인 계약 · F8 비파괴 원장.**
//
// 원장(LedgerEntry[])이 유일한 진실이다. 상태는 원장을 처음부터 다시 접어서(fold) 얻는다 —
// 그래서 「지금 상태」 칸을 따로 저장하지 않고, 되돌림도 지우기가 아니라 **되돌림 줄을 덧붙이기**다.
// 이 파일은 순수 함수만 가진다(DB·시계 없음 — 시각은 호출자가 `at` 으로 넘긴다).

import type {
  Evidence,
  LedgerEntry,
  ReviewCandidate,
  ReviewState,
  ReviewTrack,
  Reviewer,
  RevisionBinding,
} from './types'

/** 허용 전이. 여기 없는 전이는 모두 거부된다. */
export const TRANSITIONS: Readonly<Record<ReviewState, readonly ReviewState[]>> = {
  queued: ['in_review', 'withdrawn', 'stale'],
  in_review: ['changes_requested', 'content_approved', 'queued', 'withdrawn', 'stale'],
  changes_requested: ['in_review', 'withdrawn', 'stale'],
  content_approved: ['publish_pending', 'in_review', 'stale', 'withdrawn'],
  publish_pending: ['content_approved', 'stale', 'withdrawn'],
  stale: ['queued', 'withdrawn'],
  withdrawn: ['queued'],
}

export const STATE_LABEL: Readonly<Record<ReviewState, string>> = {
  queued: '검수 대기',
  in_review: '검토 중',
  changes_requested: '수정 요청',
  content_approved: '내용 승인',
  publish_pending: '발행 대기',
  stale: '판본 바뀜 · 재검수',
  withdrawn: '철회',
}

export const TRACK_LABEL: Readonly<Record<ReviewTrack, string>> = {
  official_answer: '공식 정답',
  explanation: '교육적 해설',
  lecture_cue: '강의 cue',
  evidence_gold: '결정 근거 gold',
}

export function sameBinding(a: RevisionBinding, b: RevisionBinding): boolean {
  return (
    a.itemId === b.itemId &&
    a.itemMd5 === b.itemMd5 &&
    a.analysisVersion === b.analysisVersion &&
    a.analysisMd5 === b.analysisMd5 &&
    a.lectureVersion === b.lectureVersion &&
    a.lectureHash === b.lectureHash
  )
}

/** 결속이 어긋난 칸 이름 — 화면이 「무엇이 바뀌었나」를 보여 준다 */
export function bindingDiff(a: RevisionBinding, b: RevisionBinding): string[] {
  const keys: (keyof RevisionBinding)[] = ['itemId', 'itemMd5', 'analysisVersion', 'analysisMd5', 'lectureVersion', 'lectureHash']
  return keys.filter((k) => a[k] !== b[k])
}

/**
 * 판본 결속 해시 — 증거의 `boundHash` 가 **이 값과 같아야** 그 판본의 증거로 센다.
 * (비어 있지 않은지만 보면 다른 문항·옛 판본의 증거로 승인이 통과한다 — T-0158 Codex P1)
 */
export function bindingHash(b: RevisionBinding): string {
  return `${b.itemId}|${b.itemMd5}|${b.analysisVersion}|${b.analysisMd5}|${b.lectureVersion ?? '-'}|${b.lectureHash ?? '-'}`
}

export type Rejection = { ok: false; code: string; message: string }
export type Accepted = { ok: true; entry: LedgerEntry }

export interface TransitionRequest {
  candidate: ReviewCandidate
  track: ReviewTrack
  to: ReviewState
  by: Reviewer
  /** 지금 화면이 보고 있는 판본 — 후보 binding 과 다르면 승인 불가 */
  currentBinding: RevisionBinding
  evidence: Evidence[]
  reason: string
  at: string
}

/** 트랙별 승인 필수 증거(F7). AI 합의는 어느 목록에도 없다. */
export const REQUIRED_EVIDENCE: Readonly<Record<ReviewTrack, readonly Evidence['kind'][]>> = {
  official_answer: ['official_answer_sheet'],
  explanation: ['official_pdf_text', 'analysis_revision'],
  lecture_cue: ['official_pdf_text', 'lecture_cue'],
  evidence_gold: ['official_pdf_text'],
}

/** 트랙별 승인 역할 — 공식 정답은 별도 권한(answer_authority) */
const REQUIRED_ROLE: Readonly<Record<ReviewTrack, Reviewer['roles'][number]>> = {
  official_answer: 'answer_authority',
  explanation: 'content_reviewer',
  lecture_cue: 'content_reviewer',
  evidence_gold: 'content_reviewer',
}

/** 원장을 접어 (후보, 트랙)의 현재 상태를 얻는다. 처음은 queued. */
export function currentState(ledger: readonly LedgerEntry[], candidateId: string, track: ReviewTrack): ReviewState {
  let s: ReviewState = 'queued'
  for (const e of ledger) if (e.candidateId === candidateId && e.track === track) s = e.to
  return s
}

/**
 * 전이 하나를 검사하고 원장 줄을 만든다. 원장 자체는 바꾸지 않는다(호출자가 덧붙인다).
 * 거부 사유는 화면에 그대로 보인다 — 「왜 못 누르나」가 검수자에게 보여야 한다.
 */
export function transition(ledger: readonly LedgerEntry[], req: TransitionRequest): Accepted | Rejection {
  const { candidate, track, to, by } = req
  if (!candidate.tracks.includes(track)) {
    return { ok: false, code: 'TRACK_NOT_IN_CANDIDATE', message: `이 후보에는 「${TRACK_LABEL[track]}」 트랙이 없다` }
  }
  const from = currentState(ledger, candidate.id, track)
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'ILLEGAL_TRANSITION', message: `${STATE_LABEL[from]} → ${STATE_LABEL[to]} 전이는 없다` }
  }
  if (!req.reason.trim()) return { ok: false, code: 'REASON_REQUIRED', message: '사유를 적어야 한다' }

  const stale = !sameBinding(candidate.binding, req.currentBinding)
  if (stale && to !== 'stale' && to !== 'withdrawn') {
    return {
      ok: false,
      code: 'BINDING_MISMATCH',
      message: `후보가 묶인 판본과 지금 판본이 다르다(${bindingDiff(candidate.binding, req.currentBinding).join(' · ')}) — 재검수로 보낸다`,
    }
  }

  if (to === 'content_approved' || to === 'publish_pending') {
    if (by.kind !== 'human') {
      return { ok: false, code: 'AI_CANNOT_APPROVE', message: 'AI 판정은 증거로만 남고 승인할 수 없다' }
    }
    const role = to === 'publish_pending' ? 'publisher' : REQUIRED_ROLE[track]
    if (!by.roles.includes(role)) {
      return { ok: false, code: 'ROLE_REQUIRED', message: `이 동작에는 ${role} 역할이 필요하다` }
    }
    if (to === 'content_approved') {
      const bound = req.evidence.filter((e) => e.kind !== 'ai_consensus' && e.boundHash === bindingHash(req.currentBinding))
      const missing = REQUIRED_EVIDENCE[track].filter((k) => !bound.some((e) => e.kind === k))
      if (missing.length) {
        return { ok: false, code: 'EVIDENCE_MISSING', message: `판본에 묶인 증거가 없다: ${missing.join(', ')}` }
      }
      // 같은 사람이 같은 판본을 이미 승인했다가 되돌린 게 아니라면 — 중복 승인 방지
      const dup = ledger.some(
        (e) => e.candidateId === candidate.id && e.track === track && e.to === 'content_approved' &&
          e.by.id === by.id && sameBinding(e.binding, req.currentBinding) && currentState(ledger, candidate.id, track) === 'content_approved',
      )
      if (dup) return { ok: false, code: 'DUPLICATE_APPROVAL', message: '같은 판본을 이미 승인했다' }
    }
    if (to === 'publish_pending') {
      // 발행 대기는 이 후보의 **모든 트랙**이 내용 승인일 때만 — 정답 트랙만 승인된 채 해설이 나가지 않게
      const notApproved = candidate.tracks.filter((t) => t !== track && currentState(ledger, candidate.id, t) !== 'content_approved' && currentState(ledger, candidate.id, t) !== 'publish_pending')
      if (notApproved.length) {
        return { ok: false, code: 'TRACKS_NOT_APPROVED', message: `내용 승인 안 된 트랙: ${notApproved.map((t) => TRACK_LABEL[t]).join(', ')}` }
      }
    }
  }

  const entry: LedgerEntry = {
    seq: ledger.length ? ledger[ledger.length - 1]!.seq + 1 : 1,
    candidateId: candidate.id,
    track,
    from,
    to,
    by,
    binding: req.currentBinding,
    evidence: req.evidence,
    reason: req.reason,
    at: req.at,
  }
  return { ok: true, entry }
}

/**
 * F8 — 잘못된 승격 되돌리기. 지우지 않고 「되돌림 줄」을 덧붙인다.
 * 대상 줄의 from 상태로 돌아가며, 그 사이 이력은 원장에 그대로 남는다.
 */
export function revert(
  ledger: readonly LedgerEntry[],
  seq: number,
  by: Reviewer,
  reason: string,
  at: string,
): Accepted | Rejection {
  const target = ledger.find((e) => e.seq === seq)
  if (!target) return { ok: false, code: 'NO_SUCH_ENTRY', message: `${seq}번 줄이 없다` }
  if (by.kind !== 'human') return { ok: false, code: 'AI_CANNOT_REVERT', message: '되돌림은 사람만 한다' }
  if (!reason.trim()) return { ok: false, code: 'REASON_REQUIRED', message: '사유를 적어야 한다' }
  const now = currentState(ledger, target.candidateId, target.track)
  if (now !== target.to) {
    return { ok: false, code: 'NOT_LATEST', message: '그 뒤에 상태가 또 바뀌었다 — 최신 줄부터 되돌린다' }
  }
  if (ledger.some((e) => e.revertsSeq === seq)) return { ok: false, code: 'ALREADY_REVERTED', message: '이미 되돌렸다' }
  // 승인 상태로 **돌아가는** 되돌림은 그 자체가 승인이다 — 같은 역할을 요구하고, 원래 승인 줄의
  // 판본·증거를 그대로 잇는다(빈 증거로 승인 상태를 만들지 않는다 — T-0158 Codex P1).
  let binding = target.binding
  let evidence: Evidence[] = []
  if (isApprovalState(target.from)) {
    const role = requiredRole(target.from, target.track)
    if (!by.roles.includes(role)) {
      return { ok: false, code: 'ROLE_REQUIRED', message: `승인 상태로 되돌리려면 ${role} 역할이 필요하다` }
    }
    const before = ledger.filter((e) => e.seq < seq && e.candidateId === target.candidateId && e.track === target.track && e.to === target.from)
    const origin = before[before.length - 1]
    if (!origin) return { ok: false, code: 'NO_PRIOR_APPROVAL', message: '되돌아갈 승인 줄이 원장에 없다' }
    // 판본 무효화(stale)를 되돌려 옛 판본의 승인을 살리지 않는다 — 복원은 지금 판본과 같은 승인만(T-0158 Codex 2차 P1)
    if (!sameBinding(origin.binding, target.binding)) {
      return { ok: false, code: 'BINDING_MISMATCH', message: `복원할 승인은 옛 판본의 것이다(${bindingDiff(origin.binding, target.binding).join(' · ')}) — 재검수한다` }
    }
    binding = origin.binding
    evidence = origin.evidence
  }
  const entry: LedgerEntry = {
    seq: ledger[ledger.length - 1]!.seq + 1,
    candidateId: target.candidateId,
    track: target.track,
    from: target.to,
    to: target.from,
    by,
    binding,
    evidence,
    reason,
    at,
    revertsSeq: seq,
  }
  return { ok: true, entry }
}

function isApprovalState(s: ReviewState): boolean {
  return s === 'content_approved' || s === 'publish_pending'
}

function requiredRole(to: ReviewState, track: ReviewTrack): Reviewer['roles'][number] {
  return to === 'publish_pending' ? 'publisher' : REQUIRED_ROLE[track]
}

/** 승인 줄 하나가 계약(사람 · 역할 · 판본에 묶인 필수 증거)을 지키는지 */
function approvalProblem(e: LedgerEntry): string | null {
  if (e.by.kind !== 'human') return '사람 아닌 승인'
  const role = requiredRole(e.to, e.track)
  if (!e.by.roles.includes(role)) return `${role} 역할 없는 승인`
  if (e.to === 'content_approved') {
    const h = bindingHash(e.binding)
    const missing = REQUIRED_EVIDENCE[e.track].filter((k) => !e.evidence.some((x) => x.kind === k && x.boundHash === h))
    if (missing.length) return `판본에 묶인 증거 없음: ${missing.join(', ')}`
  }
  return null
}

/** 판본이 바뀐 후보를 stale 로 보내는 줄들(자동). 승인·발행 대기에 있던 것도 내려간다. */
export function staleSweep(
  ledger: readonly LedgerEntry[],
  candidates: readonly ReviewCandidate[],
  current: ReadonlyMap<string, RevisionBinding>,
  system: Reviewer,
  at: string,
): LedgerEntry[] {
  const out: LedgerEntry[] = []
  let seq = ledger.length ? ledger[ledger.length - 1]!.seq : 0
  for (const c of candidates) {
    const now = current.get(c.itemId)
    if (!now || sameBinding(c.binding, now)) continue
    for (const t of c.tracks) {
      const s = currentState([...ledger, ...out], c.id, t)
      if (s === 'stale' || s === 'withdrawn') continue
      out.push({
        seq: ++seq, candidateId: c.id, track: t, from: s, to: 'stale', by: system,
        binding: now, evidence: [], reason: `판본 바뀜: ${bindingDiff(c.binding, now).join(' · ')}`, at,
      })
    }
  }
  return out
}

/**
 * 원장이 손으로 고쳐졌는지 — seq 연속 · from 이 직전 상태와 같은지 · 허용 전이(또는 실제 줄의 되돌림)인지 ·
 * 승인 줄마다 사람 · 역할 · 판본에 묶인 필수 증거가 있는지. 전이 함수를 거치지 않고 만든 원장도 여기서 걸린다.
 */
export function verifyLedger(ledger: readonly LedgerEntry[]): { ok: boolean; problems: string[] } {
  const problems: string[] = []
  const state = new Map<string, ReviewState>()
  // 후보별로 원장이 마지막으로 본 판본 — stale 줄이 새 판본을 기록하면 그보다 옛 판본의 승인은 무효다
  const latest = new Map<string, RevisionBinding>()
  // 한 후보의 줄은 모두 한 문항이어야 한다 — 다른 문항 승인 줄의 후보 ID 만 바꾼 이식을 잡는다(24차 P1)
  const itemOf = new Map<string, string>()
  ledger.forEach((e, i) => {
    if (e.seq !== i + 1) problems.push(`seq ${e.seq} 가 ${i + 1} 자리에 있다`)
    const item = itemOf.get(e.candidateId)
    if (item == null) itemOf.set(e.candidateId, e.binding.itemId)
    else if (item !== e.binding.itemId) problems.push(`seq ${e.seq}: 후보 ${e.candidateId} 의 문항이 ${item} 에서 ${e.binding.itemId} 로 바뀐다`)
    const k = `${e.candidateId}|${e.track}`
    const prev = state.get(k) ?? 'queued'
    if (e.from !== prev) problems.push(`seq ${e.seq}: from=${e.from} 인데 직전 상태는 ${prev}`)
    if (e.revertsSeq != null) {
      const ref = ledger.find((x) => x.seq === e.revertsSeq)
      if (!ref || ref.seq >= e.seq || ref.candidateId !== e.candidateId || ref.track !== e.track || ref.to !== e.from || ref.from !== e.to) {
        problems.push(`seq ${e.seq}: ${e.revertsSeq}번 줄의 되돌림이 아니다`)
      }
      if (e.by.kind !== 'human') problems.push(`seq ${e.seq}: 사람 아닌 되돌림`)
    } else if (!TRANSITIONS[e.from].includes(e.to)) {
      problems.push(`seq ${e.seq}: ${e.from} → ${e.to} 는 허용 전이가 아니다`)
    }
    const known = latest.get(e.candidateId)
    if (isApprovalState(e.to)) {
      const p = approvalProblem(e)
      if (p) problems.push(`seq ${e.seq}: ${p}`)
      if (known && !sameBinding(known, e.binding)) problems.push(`seq ${e.seq}: 무효화된 옛 판본의 승인`)
    }
    if (e.to === 'stale' || !known) latest.set(e.candidateId, e.binding)
    state.set(k, e.to)
  })
  return { ok: problems.length === 0, problems }
}

/** 실제 사람 내용 승인 수(트랙 단위). 화면 상단 「승인 0건」의 근거 */
export function countHumanApprovals(ledger: readonly LedgerEntry[]): number {
  const seen = new Set<string>()
  for (const e of ledger) {
    const s = currentState(ledger, e.candidateId, e.track)
    if ((s === 'content_approved' || s === 'publish_pending') && e.by.kind === 'human') seen.add(`${e.candidateId}|${e.track}`)
  }
  return seen.size
}
