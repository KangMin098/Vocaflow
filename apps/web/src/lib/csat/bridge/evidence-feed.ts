// apps/web/src/lib/csat/bridge/evidence-feed.ts
//
// H5 — 학습지도 판단 엔진에 넘길 「유효한 독립 수행 증거」만 고르는 계약(순수 · 판정 엔진 아님).
//   지도 엔진(skillDiagnosis · evidenceView)을 대신하지 않는다 — 공급 후보와 거절 사유만 낸다. 숙달 · 해소 · 목표 달성을 선언하지 않는다.
//   공급 조건(모두): 수행 · 정오 있음 · P6 independent_candidate · 노출 X0/X1 · 시도 판본 해시 = 현재 판본 해시 · 같은 시도 중복 아님.
//   하나라도 모르면 held(UNKNOWN 보존) — 실패로 바꾸지도, 독립으로 올리지도 않는다.

import { meaningOfAttempt, type ActivityMeaning } from './activity-meaning'
import { exposureLevelOf, type AttemptForExposure, type ExposureLevel, type ExposureRow, type IndependenceStatus } from './exposure-consumer'
import type { ThinkingSkillId } from './skill-map'

export interface FeedAttempt extends AttemptForExposure {
  attemptId: string
  taskKey: string
  isCorrect: boolean | null
  contentHash: string | null
  passageKey: string | null
  skill: ThinkingSkillId | null
  /** learning_attempt_independence 결과 — null = 조회 실패 · 함수 없음 */
  independence: IndependenceStatus | null
}

export type FeedRejection = 'duplicate' | 'not_performed' | 'helped_or_exposed' | 'not_check_phase' | 'stale_analysis' | 'independence_unknown' | 'exposure_unknown' | 'ledger_unavailable'

export interface FeedObservation {
  attemptId: string
  itemRef: string
  taskKey: string
  skill: ThinkingSkillId | null
  passageKey: string | null
  correct: boolean
  level: ExposureLevel
  /** 서버 관측 범위 안의 독립 — 외부 노출은 모른다 */
  scope: 'observed_independent'
}

export interface EvidenceFeed {
  accepted: FeedObservation[]
  rejected: { attemptId: string; reason: FeedRejection; meaning: ActivityMeaning | null }[]
  /** 판정 보류 — UNKNOWN 을 그대로 남긴다 */
  held: { attemptId: string; reason: FeedRejection }[]
  learningEffect: 'NOT_EVALUATED'
}

const HELD: ReadonlySet<FeedRejection> = new Set(['independence_unknown', 'exposure_unknown', 'ledger_unavailable', 'stale_analysis'])

/**
 * rows = P6 원장 행(null = 못 읽음 · 설치 전). currentHash = 문항 → 지금 분석 판본 해시(undefined/null = 모름).
 */
export function buildEvidenceFeed(attempts: readonly FeedAttempt[], rows: readonly ExposureRow[] | null, currentHash: (itemRef: string, taskKey: string) => string | null | undefined): EvidenceFeed {
  const out: EvidenceFeed = { accepted: [], rejected: [], held: [], learningEffect: 'NOT_EVALUATED' }
  const seen = new Set<string>()
  const reject = (a: FeedAttempt, reason: FeedRejection, meaning: ActivityMeaning | null) => {
    if (HELD.has(reason)) out.held.push({ attemptId: a.attemptId, reason })
    else out.rejected.push({ attemptId: a.attemptId, reason, meaning })
  }
  for (const a of attempts) {
    if (seen.has(a.attemptId)) { out.rejected.push({ attemptId: a.attemptId, reason: 'duplicate', meaning: null }); continue }
    seen.add(a.attemptId)
    if (!a.itemRef || a.isCorrect === null) { reject(a, 'not_performed', null); continue }
    if (rows === null) { reject(a, 'ledger_unavailable', null); continue }
    const level = exposureLevelOf(a, rows).level
    const meaning = meaningOfAttempt(a.independence, level)
    if (meaning.kind === 'post_explanation_check' || meaning.kind === 'helped_attempt') { reject(a, 'helped_or_exposed', meaning); continue }
    if (meaning.kind === 'not_evidence') { reject(a, 'not_check_phase', meaning); continue }
    if (a.independence !== 'independent_candidate') { reject(a, 'independence_unknown', meaning); continue }
    if (level !== 'X0' && level !== 'X1') { reject(a, 'exposure_unknown', meaning); continue }
    const now = currentHash(a.itemRef, a.taskKey)
    if (!now || !a.contentHash || now !== a.contentHash) { reject(a, 'stale_analysis', meaning); continue }
    out.accepted.push({ attemptId: a.attemptId, itemRef: a.itemRef, taskKey: a.taskKey, skill: a.skill, passageKey: a.passageKey, correct: a.isCorrect, level, scope: 'observed_independent' })
  }
  return out
}

export type SkillClaim =
  /** 서로 다른 지문 2개 이상에서 독립 정답 — 「관측 범위 안에서 거듭 혼자 판단함」. 숙달 확정 아님 */
  | 'repeated_independent_success'
  | 'single_independent_success'
  | 'independent_but_incorrect'
  | 'no_valid_evidence'

/** 한 사고 기능에 대해 공급된 증거로 말할 수 있는 가장 강한 주장 — 같은 지문 · 같은 문항 반복은 하나로 센다 */
export function skillClaimOf(feed: EvidenceFeed, skill: ThinkingSkillId): { claim: SkillClaim; passages: number; mastery: 'NOT_ESTABLISHED' } {
  const mine = feed.accepted.filter((o) => o.skill === skill)
  const ok = new Set(mine.filter((o) => o.correct).map((o) => o.passageKey ?? `item:${o.itemRef}`))
  const claim: SkillClaim = ok.size >= 2 ? 'repeated_independent_success' : ok.size === 1 ? 'single_independent_success' : mine.length ? 'independent_but_incorrect' : 'no_valid_evidence'
  return { claim, passages: ok.size, mastery: 'NOT_ESTABLISHED' }
}

/**
 * 숙달 · 해소 승격 요청 검문 — 요청이 든 근거 시도가 모두 이 공급에서 accepted 이고 서로 다른 지문 2개 이상일 때만 「엔진에 넘길 수 있음」.
 * 넘길 수 있어도 해소는 엔진이 정한다(여기서 resolved 를 쓰지 않는다).
 */
export function promotionGate(feed: EvidenceFeed, evidenceAttemptIds: readonly string[]): { ok: true } | { ok: false; reason: 'no_evidence' | 'invalid_evidence' | 'single_passage' } {
  if (evidenceAttemptIds.length === 0) return { ok: false, reason: 'no_evidence' }
  const byId = new Map(feed.accepted.map((o) => [o.attemptId, o]))
  const obs = evidenceAttemptIds.map((id) => byId.get(id))
  if (obs.some((o) => !o || !o.correct)) return { ok: false, reason: 'invalid_evidence' }
  const passages = new Set(obs.map((o) => o!.passageKey ?? `item:${o!.itemRef}`))
  return passages.size >= 2 ? { ok: true } : { ok: false, reason: 'single_passage' }
}
