// apps/web/src/lib/dictation/retry-missed.ts
//
// 결과 화면 「틀린 문장만 다시」 — 틀리거나 건너뛴 문항의 정답 문장만 모아 새 받아쓰기로 넘긴다.
// 원 세션 기록·통계는 읽기만 한다. 새로 받아쓴 것은 기존 방식대로 별도 세션(source_kind='custom')으로 남는다.
//
// ⚠️ 넘기는 문장은 그 결과 주인의 비공개 원문일 수 있다 — 붙여넣기 전역 키(vocaflow:dictation:custom)에 싣지 않는다.
//   이 재시도 전용 봉투(MISSED_RETRY_KEY)에 **만든 사람의 확정 계정**을 함께 담고, 설정 화면은 지금 확정된 계정과
//   같을 때만 꺼낸다(readMissedRetry). 확인 전·로그아웃·다른 계정·깨진 값이면 아무것도 돌려주지 않는다.
//   남의 봉투를 지우지는 않는다 — 꺼내지 않을 뿐이다.
// 문장은 배열 그대로 넘긴다 — 이어 붙였다 다시 쪼개면 닫는 따옴표로 끝나는 문장의 경계를 잃는다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { customSourceFromSentences, isUsableSentence, type DictationSource } from './source'
import { splitSentences } from './text-splitter'

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

/**
 * 틀림·건너뜀 문항의 정답 문장 — 문항 순서대로, 같은 문장은 한 번만.
 * 묶음 문항은 문장으로 펼친다. 기존 받아쓰기 자료 규칙(isUsableSentence)을 통과하는 것만 남긴다 — 단추의 수가 실제로 시작될 수와 같아야 한다.
 */
export function missedSentences(attempts: readonly MissedAttemptInput[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of [...attempts].sort((x, y) => x.itemIdx - y.itemIdx)) {
    if (!isMissedAttempt(a)) continue
    const whole = a.expected.trim()
    const pieces = splitSentences(whole).map((s) => s.trim()).filter(isUsableSentence)
    // 쪼개지지 않는 문항(따옴표 경계 등)은 통째로 — 그것도 규칙 밖이면 뺀다
    for (const t of pieces.length > 0 ? pieces : isUsableSentence(whole) ? [whole] : []) {
      if (seen.has(t)) continue
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

export interface MissedRetryPayload {
  title: string
  sentences: string[]
}

/** 넘길 자료 — 다시 받아쓸 문장이 없으면 null(단추를 그리지 않는다) */
export function missedRetryPayload(title: string, attempts: readonly MissedAttemptInput[]): MissedRetryPayload | null {
  const sentences = missedSentences(attempts)
  if (sentences.length === 0) return null
  return { title: `${title.trim() || '받아쓰기'} · 틀린 문장 다시`, sentences }
}

export const MISSED_RETRY_KEY = 'vocaflow:dictation:retry-missed'
export const MISSED_RETRY_HREF = '/dictate/setup?retry=missed'

interface MissedRetryEnvelope extends MissedRetryPayload {
  v: 1
  ownerId: string
}

/** 확정 계정(결과 주인 = 지금 브라우저 신원으로 확인된 사람)에 묶어 이 탭에 둔다. 주인이 없으면 두지 않는다. */
export function stashMissedRetry(ownerId: string | null, payload: MissedRetryPayload): boolean {
  if (typeof window === 'undefined' || !ownerId) return false
  const env: MissedRetryEnvelope = { v: 1, ownerId, title: payload.title, sentences: [...payload.sentences] }
  try {
    window.sessionStorage.setItem(MISSED_RETRY_KEY, JSON.stringify(env))
    return true
  } catch {
    return false
  }
}

/** 지금 확정된 계정의 봉투만 — 확인 전(null)·다른 계정·깨진 값은 null. */
export function readMissedRetry(currentUserId: string | null): MissedRetryPayload | null {
  if (typeof window === 'undefined' || !currentUserId) return null
  try {
    const raw = window.sessionStorage.getItem(MISSED_RETRY_KEY)
    if (!raw) return null
    const env = JSON.parse(raw) as Partial<MissedRetryEnvelope> | null
    if (!env || env.v !== 1 || typeof env.ownerId !== 'string' || env.ownerId !== currentUserId) return null
    if (typeof env.title !== 'string' || !Array.isArray(env.sentences)) return null
    const sentences = env.sentences.filter((s): s is string => typeof s === 'string')
    if (sentences.length === 0 || sentences.length !== env.sentences.length) return null
    return { title: env.title, sentences }
  } catch {
    return null
  }
}

/** 설정 화면 진입 — 지금 확정 계정(userId)의 봉투를 자료로. 계정이 없거나 다르면 null(「사라졌어요」). */
export async function resolveMissedRetrySource(
  client: SupabaseClient,
  userId: string | null,
): Promise<DictationSource | null> {
  const payload = readMissedRetry(userId)
  if (!payload) return null
  return customSourceFromSentences(client, payload.title, payload.sentences, userId)
}
