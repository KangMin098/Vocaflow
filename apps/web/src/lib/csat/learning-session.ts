// apps/web/src/lib/csat/learning-session.ts
//
// **학습 세션 — 기출 한 문항을 열어 마칠 때까지.** 계약 정본: `docs/csat-learner/G0_LEARNING_CONTRACT.md`.
//
// 순수 함수만 둔다(브라우저 · DB · React 모름, 시각은 `now` 로 받는다).
//   - 세션은 시도가 0건이어도 있다(열기만 · 「모르겠어요」).
//   - stage 는 open → revealed → finished 로만 간다. 「처음부터 다시」는 새 세션이다.
//   - completion 은 저장하지 않고 stage · help 에서 파생한다.
//   - 완료 · 복습 예약은 멱등 — 이미 정해졌으면 기록을 바꾸지 않는다(같은 객체를 돌려준다).

import type { DissectionRecord, Prediction } from './dissect'

export type Activity = 'theater' | 'dissect' | 'practice'
export type Phase = 'practice' | 'review' | 'transfer' | 'pre' | 'post' | 'delayed'
export type HelpLevel = 'independent' | 'hint' | 'viewed_first'
export type Stage = 'open' | 'revealed' | 'finished'
export type Completion = 'viewed' | 'guided' | 'independent'

export interface LearningSession {
  id: string
  sv: 1
  item: string
  activity: Activity
  phase: Phase
  stage: Stage
  help: HelpLevel | null
  /** 마지막으로 본 단계(0-기반) — 재개 위치 */
  step: number
  /** 그때의 단계 수 — 강의가 바뀌면 재개 위치를 버린다 */
  steps: number
  /** 이 세션의 예측 시도 id(client_attempt_id) */
  attempt?: string
  /** 처음 공개한 시각 — 두 기기가 다르게 공개했으면 먼저 공개한 쪽의 help · attempt 가 이긴다 */
  revealedAt?: number
  startedAt: number
  updatedAt: number
  finishedAt?: number
  reviewAt?: number
  deleted?: true
}

export const SESSION_CAP = 300
export const REVIEW_DAYS = 3
const DAY = 86_400_000
const STAGE_RANK: Record<Stage, number> = { open: 0, revealed: 1, finished: 2 }

/** 「모르겠어요—바로 보기」로 생긴 극장 예측인가. 확정 버튼은 근거나 정답 중 하나가 있어야 켜지므로(PredictGate) 이 조합은 그 버튼에서만 생긴다. */
export function isSkipPrediction(p: Prediction): boolean {
  return p.source === 'theater' && (p.sentence ?? null) === null && (p.choice ?? null) === null
}

/** 적중률에 넣는 예측 — 「모르겠어요」는 분모 · 분자 모두에서 뺀다 */
export function countedPredictions(predictions: Prediction[]): Prediction[] {
  return predictions.filter((p) => !isSkipPrediction(p))
}

export function completionOf(s: Pick<LearningSession, 'stage' | 'help'>): Completion | null {
  if (s.stage === 'open') return null
  if (s.stage === 'revealed') return 'viewed'
  return s.help === 'independent' ? 'independent' : 'guided'
}

/** 읽을 때 모양이 깨진 세션은 거른다(계약 §9) */
export function isSession(v: unknown): v is LearningSession {
  if (!v || typeof v !== 'object') return false
  const s = v as Partial<LearningSession>
  return (
    s.sv === 1 &&
    typeof s.id === 'string' &&
    typeof s.item === 'string' &&
    (s.stage === 'open' || s.stage === 'revealed' || s.stage === 'finished') &&
    typeof s.step === 'number' &&
    typeof s.updatedAt === 'number' &&
    typeof s.startedAt === 'number'
  )
}

export function sessionsOf(record: DissectionRecord): LearningSession[] {
  return (record.sessions ?? []).filter(isSession)
}

/** 이 문항의 가장 최근(삭제 안 된) 세션 */
export function latestSession(record: DissectionRecord, itemId: string, activity: Activity = 'theater'): LearningSession | null {
  const mine = sessionsOf(record).filter((s) => s.item === itemId && s.activity === activity && !s.deleted)
  return mine.length ? mine.reduce((a, b) => (b.startedAt > a.startedAt ? b : a)) : null
}

function replace(record: DissectionRecord, next: LearningSession): DissectionRecord {
  const rest = (record.sessions ?? []).filter((s) => !(isSession(s) && s.id === next.id))
  return { ...record, sessions: prune([...rest, next]) }
}

/**
 * 상한을 넘으면 오래된 것부터 — **마친 세션 먼저**, 삭제 표시는 마지막까지 남긴다.
 * 삭제 표시를 먼저 버리면 다른 기기의 옛 사본과 합칠 때 지운 세션이 되살아난다(Codex 리뷰 P2).
 */
export function prune(sessions: LearningSession[], cap = SESSION_CAP): LearningSession[] {
  if (sessions.length <= cap) return sessions
  const rank = (s: LearningSession) => (s.deleted ? 2 : s.stage === 'finished' ? 0 : 1)
  const drop = [...sessions].sort((a, b) => rank(a) - rank(b) || a.updatedAt - b.updatedAt).slice(0, sessions.length - cap)
  const gone = new Set(drop.map((s) => s.id))
  return sessions.filter((s) => !gone.has(s.id))
}

export interface OpenOptions {
  itemId: string
  steps: number
  now: number
  newId: () => string
  /** 세션이 없던 시절 극장에서 남긴 확정 — 있으면 공개된 세션으로 이어 받는다 */
  legacy?: Prediction | null
}

/**
 * 문항을 연다 — 마치지 않은 세션이 있으면 **재개**, 마친 세션뿐이면 그것을 돌려준다(완료 화면),
 * 없으면 새 세션. 재개할 때 단계 수가 바뀌었으면(강의 재구성) 처음 단계로 돌린다.
 */
export function openSession(record: DissectionRecord, o: OpenOptions): { record: DissectionRecord; session: LearningSession; resumed: boolean } {
  const last = latestSession(record, o.itemId)
  if (last) {
    if (last.stage !== 'finished' && last.steps !== o.steps) {
      const fixed: LearningSession = { ...last, step: 0, steps: o.steps, updatedAt: o.now }
      return { record: replace(record, fixed), session: fixed, resumed: true }
    }
    // 다시 볼 때가 된 마친 문항은 새 세션으로 연다 — 복습은 지난 기록을 보는 것이 아니라 다시 판단하는 것
    const dueAgain = last.stage === 'finished' && last.reviewAt != null && last.reviewAt <= o.now
    if (!dueAgain) return { record, session: last, resumed: last.stage !== 'finished' }
    const r = restartSession(record, o.itemId, o.steps, o.now, o.newId, 'review')
    return { record: r.record, session: r.session, resumed: false }
  }
  const legacy = o.legacy ?? null
  const session: LearningSession = {
    id: o.newId(),
    sv: 1,
    item: o.itemId,
    activity: 'theater',
    phase: 'practice',
    stage: legacy ? 'revealed' : 'open',
    help: legacy ? (isSkipPrediction(legacy) ? 'viewed_first' : 'independent') : null,
    step: 0,
    steps: o.steps,
    ...(legacy?.attempt ? { attempt: legacy.attempt } : {}),
    startedAt: o.now,
    updatedAt: o.now,
  }
  return { record: replace(record, session), session, resumed: false }
}

/** 「처음부터 다시」 — 언제나 새 세션 */
export function restartSession(record: DissectionRecord, itemId: string, steps: number, now: number, newId: () => string, phase: Phase = 'practice'): { record: DissectionRecord; session: LearningSession } {
  const session: LearningSession = { id: newId(), sv: 1, item: itemId, activity: 'theater', phase, stage: 'open', help: null, step: 0, steps, startedAt: now, updatedAt: now }
  return { record: replace(record, session), session }
}

function find(record: DissectionRecord, id: string): LearningSession | null {
  return sessionsOf(record).find((s) => s.id === id && !s.deleted) ?? null
}

/** 공개 — 확정(independent) 또는 「모르겠어요」(viewed_first). 한 번 정한 help 는 바꾸지 않는다 */
export function revealSession(record: DissectionRecord, id: string, help: HelpLevel, attempt: string | null, now: number): DissectionRecord {
  const s = find(record, id)
  if (!s || s.stage !== 'open') return record
  return replace(record, { ...s, stage: 'revealed', help, revealedAt: now, ...(attempt ? { attempt } : {}), updatedAt: now })
}

/** 단계 이동 — 마친 세션은 위치를 바꾸지 않는다(완료 화면을 다시 열어도 그대로) */
export function stepSession(record: DissectionRecord, id: string, step: number, now: number): DissectionRecord {
  const s = find(record, id)
  if (!s || s.stage === 'finished' || s.step === step) return record
  return replace(record, { ...s, step, updatedAt: now })
}

/** 마치기 — 공개된 세션만. 이미 마쳤으면 기록을 바꾸지 않는다(완료 최대 1건) */
export function finishSession(record: DissectionRecord, id: string, now: number): DissectionRecord {
  const s = find(record, id)
  if (!s || s.stage !== 'revealed') return record
  return replace(record, { ...s, stage: 'finished', finishedAt: now, updatedAt: now })
}

/** 다시 보기 예약 — 마친 세션만, 한 번만 */
export function scheduleReview(record: DissectionRecord, id: string, now: number, days = REVIEW_DAYS): DissectionRecord {
  const s = find(record, id)
  if (!s || s.stage !== 'finished' || s.reviewAt != null) return record
  return replace(record, { ...s, reviewAt: now + days * DAY, updatedAt: now })
}

/** 삭제 표시 — 병합으로 되살아나지 않는다 */
export function deleteSession(record: DissectionRecord, id: string, now: number): DissectionRecord {
  const s = sessionsOf(record).find((x) => x.id === id)
  if (!s || s.deleted) return record
  return replace(record, { ...s, deleted: true, updatedAt: now })
}

/**
 * 하다 만 극장 세션(공개 뒤 마치지 않은 것 · 연 뒤 단계를 넘긴 것 · **열기만 한 복습**) — 최근 순.
 * 복습은 열면 「다시 볼 문항」에서 빠지므로, 마치기 전 이탈하면 여기서라도 보여야 한다(Codex 리뷰 P2).
 */
export function unfinishedSessions(record: DissectionRecord): LearningSession[] {
  return sessionsOf(record)
    .filter((s) => s.activity === 'theater' && !s.deleted && s.stage !== 'finished' && (s.stage === 'revealed' || s.step > 0 || s.phase === 'review'))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 다시 볼 때가 된 문항 — 예약 뒤에 그 문항을 새로 시작했으면 끝난 복습이다 */
export function reviewsDue(record: DissectionRecord, now: number): LearningSession[] {
  const all = sessionsOf(record).filter((s) => !s.deleted)
  return all
    .filter((s) => s.reviewAt != null && s.reviewAt <= now && !all.some((o) => o.item === s.item && o.id !== s.id && o.startedAt >= (s.reviewAt ?? 0)))
    .sort((a, b) => (a.reviewAt ?? 0) - (b.reviewAt ?? 0))
}

// ── 병합(기기 ↔ 서버) ─────────────────────────────────────────────────────

function earliest(a?: number, b?: number): number | undefined {
  return a == null ? b : b == null ? a : Math.min(a, b)
}

/** 같은 세션 두 사본 — updatedAt 이 큰 쪽을 바탕으로, 단조 필드는 되돌리지 않는다(계약 §4) */
export function mergeSession(a: LearningSession, b: LearningSession): LearningSession {
  const newer = b.updatedAt > a.updatedAt ? b : a
  const older = newer === a ? b : a
  const stage = STAGE_RANK[a.stage] >= STAGE_RANK[b.stage] ? a.stage : b.stage
  const finishedAt = earliest(a.finishedAt, b.finishedAt)
  const reviewAt = earliest(a.reviewAt, b.reviewAt)
  // 도움 수준 · 시도 id 는 **먼저 공개한 사본**에서 함께 가져온다 — 마지막 수정 시각으로 고르면
  // 「모르겠어요」를 고른 기기가 단계만 넘겨도 다른 기기의 independent 로 바뀐다(Codex 리뷰 P2)
  const revealed = [a, b].filter((s) => s.help != null)
  const first = revealed.length ? revealed.reduce((x, y) => ((y.revealedAt ?? y.updatedAt) < (x.revealedAt ?? x.updatedAt) ? y : x)) : null
  const help = first?.help ?? null
  const attempt = first ? first.attempt : (older.attempt ?? newer.attempt)
  const revealedAt = earliest(a.revealedAt, b.revealedAt)
  return {
    ...newer,
    stage,
    help,
    ...(attempt ? { attempt } : { attempt: undefined }),
    ...(revealedAt != null ? { revealedAt } : {}),
    ...(finishedAt != null ? { finishedAt } : {}),
    ...(reviewAt != null ? { reviewAt } : {}),
    ...(a.deleted || b.deleted ? { deleted: true as const } : {}),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  }
}

export function mergeSessions(a: unknown[] | undefined, b: unknown[] | undefined): LearningSession[] {
  const out = new Map<string, LearningSession>()
  for (const s of [...(a ?? []), ...(b ?? [])]) {
    if (!isSession(s)) continue
    const prev = out.get(s.id)
    out.set(s.id, prev ? mergeSession(prev, s) : s)
  }
  return prune([...out.values()].sort((x, y) => x.startedAt - y.startedAt))
}

/**
 * 저장할 만큼 달라졌나. updatedAt 만 보면 안 된다 — 병합은 updatedAt 을 큰 쪽으로 두므로, 내 기기가 더 늦게
 * 고친 세션에 다른 기기의 「마침」이 합쳐져도 updatedAt 은 그대로다(E2E 6 에서 실측: 완료가 기기에 안 써졌다).
 * 그래서 단조 필드(stage · finishedAt · reviewAt · deleted)와 위치(step)까지 키에 넣는다.
 */
export function sameSessions(a: unknown[] | undefined, b: unknown[] | undefined): boolean {
  const key = (v: unknown[] | undefined) =>
    (v ?? [])
      .filter(isSession)
      .map((s) => `${s.id}:${s.updatedAt}:${s.stage}:${s.step}:${s.finishedAt ?? ''}:${s.reviewAt ?? ''}:${s.deleted ? 1 : 0}:${s.help ?? ''}`)
      .sort()
      .join(',')
  return key(a) === key(b)
}
