// apps/web/src/components/library/story/story-vault-after.ts
//
// U03 — 독서 후 「내 단어장 살펴보기」 선택(LCP_D5_INTEGRATION.md §4~5 · §12.4).
// 이 읽기 화면(컴포넌트 인스턴스)에서 관측한 유효 저장(saved · already_exists)이 있을 때만 링크 주소를 준다.
// - 결속: 저장 당시의 StoryReaderSession 객체(본인 · 판본 · 인증 경계가 바뀌면 화면이 새 세션을 만든다) — 다르면 없음.
// - 세션이 버린 응답(stale: 늦은 응답 · 거부 · 다른 주인)과 실패는 표지를 만들지 않는다. 앞서 관측한 유효 저장은 지우지 않는다.
// - 메모리에만 있다 — 저장소 · 주소 · 서버 쓰기 없음. 재마운트 · 새 탭에서는 모르므로 링크가 없다.
// - 주소는 기존 검증된 왕복(storyVaultHref — 마지막 유효 저장의 발행 키 · 단위)을 그대로 쓴다. 전체 단어장이므로 개수 · 「이 Story 낱말만」을 말하지 않는다.

import type { StoryWordSaveOutcome } from '@/lib/library/story/learner-types'

export interface StoryVaultAfterMark {
  /** 저장을 관측한 세션(본인 · 판본 · 인증 경계의 대리). */
  owner: object
  href: string
}

/** 저장 결과 하나를 반영한다 — 유효 성공일 때만 새 표지, 그 밖에는 이전 표지 그대로. */
export function markAfterSave(
  prev: StoryVaultAfterMark | null,
  owner: object,
  outcome: StoryWordSaveOutcome | { stale: true },
  href: string,
): StoryVaultAfterMark | null {
  if ('stale' in outcome) return prev
  if (!outcome.ok) return prev
  if (outcome.data.status !== 'saved' && outcome.data.status !== 'already_exists') return prev
  return { owner, href }
}

/** 지금 화면에 보일 주소 — 같은 세션 · 긍정 확인(same) · 거부 없음일 때만. */
export function visibleVaultAfterHref(
  mark: StoryVaultAfterMark | null,
  current: { owner: object; verified: boolean; denied: boolean },
): string | null {
  if (!mark || !current.verified || current.denied) return null
  return mark.owner === current.owner ? mark.href : null
}
