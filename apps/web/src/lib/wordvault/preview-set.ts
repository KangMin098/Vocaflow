// apps/web/src/lib/wordvault/preview-set.ts
//
// WordVault 「학습 자산」 행(경량 메타) → 챕터 학습 모달이 받는 PublishedVocabSet 최소 형태.
//
// ⚠️ 행의 `wordCount` 는 **내가 그 세트에서 담은 단어 수**다(행 오른쪽 「N개」). 모달 머리 「총 N개 단어 · M챕터」와
//    학습 계획 계산은 **세트의 전체 단어 수**를 뜻한다(서가 카탈로그는 `shared_word_sets.word_count` 를 넘긴다).
//    예전에는 행 값을 그대로 넘겨, 아직 한 단어도 담지 않은 세트가 「총 0개 단어」로 열렸다(2026-10-05).
//    전체 수(`totalWords`)를 모르면 행 값으로 물러나되, 그 경우는 hub-query 가 세트 메타를 못 읽은 때뿐이다.

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
import type { ResourceSetEntry } from '@/lib/wordvault/hub-query'

export function toPreviewSet(s: ResourceSetEntry & { setId: string }): PublishedVocabSet {
  return {
    id: s.setId,
    title: s.title,
    description: null,
    category: (s.category ?? 'themed') as PublishedVocabSet['category'],
    categoryNode: null,
    additionalCategoryIds: [],
    cefrLevel: s.cefrLevel ?? null,
    coverEmoji: s.coverEmoji ?? null,
    sortOrder: 0,
    wordCount: s.totalWords ?? s.wordCount,
    subscriberCount: 0,
    createdAt: new Date(0).toISOString(),
    // 모달은 id/title/wordCount/coverEmoji 만 쓴다 — 유형 줄은 카탈로그 카드에서만 보인다.
    kind: null,
    coverImageUrl: null,
    coverImageMeta: null,
    // 이 자리는 내 구독 목록이라 출판 정보를 싣지 않는다(판권면은 카탈로그에서 본다).
    brandFingerprint: null,
    ladderStep: null,
    // 표지 계열·규격·슬러그도 같은 이유로 안 싣는다 — 이 승격은 모달의 최소 형태다.
    brandFamily: null,
    brandLockup: null,
    slug: null,
    // 판권면 3종 — 각인값을 갖고 오지 않는다(판권면은 그 줄들을 통째로 뺀다 · 없는 것을 지어내지 않는다).
    imprintCode: null,
    qa: null,
    level: null,
  }
}
