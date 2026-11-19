// apps/web/src/lib/dictation/retry-missed.ts
//
// 결과 화면 「틀린 문항만 다시」 — 틀리거나 건너뛴 **원래 문항을 그대로** 새 받아쓰기로 넘긴다.
// 제품 결정(T0221_RETRY_UNIT_DECISION_20261029): 단위는 기록이 가진 문항이다. 정답 문자열에서 영어 문장 경계를 되살리지 않는다 —
//   바깥 공백만 지우고 나누지도 · 일부를 버리지도 · 고쳐 쓰지도 않는다. 묶음 문항이면 묶음 전체가 그대로 다시 나온다.
// 원 세션 기록·통계는 읽기만 한다. 새로 받아쓴 것은 기존 방식대로 별도 세션(source_kind='custom')으로 남는다.
//
// ⚠️ 넘기는 문항은 그 결과 주인의 비공개 원문일 수 있다 — 붙여넣기 전역 키(vocaflow:dictation:custom)에 싣지 않는다.
//   이 재시도 전용 봉투(MISSED_RETRY_KEY)에 **만든 사람의 확정 계정**을 함께 담고, 설정 화면은 지금 확정된 계정과
//   같을 때만 꺼낸다(readMissedRetry). 확인 전·로그아웃·다른 계정·깨진 값이면 아무것도 돌려주지 않는다.
//   남의 봉투는 지우지 않는다 — 꺼내지 않을 뿐이다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { customSourceFromSentences, type DictationSource } from './source'

/** 결과 화면이 이미 가진 문항 결과에서 판정에 쓰는 것만 */
export interface MissedAttemptInput {
  itemIdx: number
  expected: string
  accuracy: number
  skipped: boolean
}

/** 다시 받아쓸 문항 — 건너뜀이거나 정확도 100 미만(틀린 낱말이 하나라도 있음) */
export function isMissedAttempt(a: MissedAttemptInput): boolean {
  return a.skipped || a.accuracy < 100
}

/** 틀림·건너뜀 문항의 정답 — 문항 순서대로, 원 문자열 그대로(바깥 공백만 제거), 같은 정답은 한 번만. */
export function missedItems(attempts: readonly MissedAttemptInput[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of [...attempts].sort((x, y) => x.itemIdx - y.itemIdx)) {
    if (!isMissedAttempt(a)) continue
    const t = a.expected.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export interface MissedRetryPayload {
  title: string
  /** 원 문항 정답 그대로 — 한 항목 = 새 받아쓰기의 한 문항 */
  items: string[]
}

/** 넘길 자료 — 다시 받아쓸 문항이 없으면 null(단추를 그리지 않는다) */
export function missedRetryPayload(title: string, attempts: readonly MissedAttemptInput[]): MissedRetryPayload | null {
  const items = missedItems(attempts)
  if (items.length === 0) return null
  return { title: `${title.trim() || '받아쓰기'} · 틀린 문항 다시`, items }
}

export const MISSED_RETRY_KEY = 'vocaflow:dictation:retry-missed'
export const MISSED_RETRY_HREF = '/dictate/setup?retry=missed'

interface MissedRetryEnvelope extends MissedRetryPayload {
  v: 2
  ownerId: string
}

/** 확정 계정(결과 주인 = 지금 브라우저 신원으로 확인된 사람)에 묶어 이 탭에 둔다. 주인이 없으면 두지 않는다. */
export function stashMissedRetry(ownerId: string | null, payload: MissedRetryPayload): boolean {
  if (typeof window === 'undefined' || !ownerId) return false
  const env: MissedRetryEnvelope = { v: 2, ownerId, title: payload.title, items: [...payload.items] }
  try {
    window.sessionStorage.setItem(MISSED_RETRY_KEY, JSON.stringify(env))
    return true
  } catch {
    return false
  }
}

/** 지금 확정된 계정의 봉투만 — 확인 전(null)·다른 계정·깨진 값(빈 문자열·비문자열 포함)은 null. */
export function readMissedRetry(currentUserId: string | null): MissedRetryPayload | null {
  if (typeof window === 'undefined' || !currentUserId) return null
  try {
    const raw = window.sessionStorage.getItem(MISSED_RETRY_KEY)
    if (!raw) return null
    const env = JSON.parse(raw) as Partial<MissedRetryEnvelope> | null
    if (!env || env.v !== 2 || typeof env.ownerId !== 'string' || env.ownerId !== currentUserId) return null
    if (typeof env.title !== 'string' || !Array.isArray(env.items) || env.items.length === 0) return null
    if (!env.items.every((s): s is string => typeof s === 'string' && s.trim().length > 0)) return null
    return { title: env.title, items: env.items }
  } catch {
    return null
  }
}

/**
 * 설정 화면 진입 — 지금 확정 계정(userId)의 봉투를 자료로. 계정이 없거나 다르면 null(「사라졌어요」).
 * 이 재시도 입력은 이미 받아쓴 원 문항이다 — 새 원문을 학습 후보로 고르는 문장 필터(isUsableSentence)를 다시 적용하지 않는다(keepAll).
 */
export async function resolveMissedRetrySource(
  client: SupabaseClient,
  userId: string | null,
): Promise<DictationSource | null> {
  const payload = readMissedRetry(userId)
  if (!payload) return null
  return customSourceFromSentences(client, payload.title, payload.items, userId, { keepAll: true })
}
