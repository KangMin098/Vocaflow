// apps/web/src/lib/dictation/retry-missed.ts
//
// 결과 화면 「틀린 문장만 다시」 — 틀리거나 건너뛴 문항의 정답 문장만 모아 새 받아쓰기로 넘긴다.
// 새 저장 경로를 만들지 않는다: 붙여넣은 글과 같은 기존 진입(stashCustomScript → /dictate/setup?custom=1)을 그대로 쓴다.
// 원 세션 기록·통계는 읽기만 한다. 새로 받아쓴 것은 기존 방식대로 별도 세션(source_kind='custom')으로 남는다.

import { isUsableSentence, type CustomScript } from './source'
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
 * 다시 쪼갰을 때 기존 받아쓰기 자료 규칙(isUsableSentence)을 통과하는 것만 남긴다 — 통과 못 하면 새 세션에서 사라지기 때문이다.
 */
export function missedSentences(attempts: readonly MissedAttemptInput[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of [...attempts].sort((x, y) => x.itemIdx - y.itemIdx)) {
    if (!isMissedAttempt(a)) continue
    for (const s of splitSentences(a.expected.trim())) {
      const t = s.trim()
      if (!t || seen.has(t) || !isUsableSentence(t)) continue
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

/** 넘길 자료 — 다시 받아쓸 문장이 없으면 null(버튼을 그리지 않는다) */
export function missedRetryScript(
  title: string,
  attempts: readonly MissedAttemptInput[],
): { payload: CustomScript; count: number } | null {
  const sentences = missedSentences(attempts)
  if (sentences.length === 0) return null
  // 새 세션은 이 글을 splitSentences 로 다시 쪼갠다 — 끝 문장부호가 없는 문장은 다음 문장과 붙어 버리므로 마침표를 채운다.
  const script = sentences.map((s) => (/[.!?]["')\]]*$/.test(s) ? s : `${s}.`)).join(' ')
  return { payload: { title: `${title.trim() || '받아쓰기'} · 틀린 문장 다시`, script }, count: sentences.length }
}

export const MISSED_RETRY_HREF = '/dictate/setup?custom=1'
