// apps/web/src/components/library/vocab/mock-data.ts
//
// ⚠️ DEPRECATED — 실 데이터로 전환 (v06.24+).
// 본 파일은 type re-export 와 하위 호환 stub 만 남김.
// 신규 코드는 `@/lib/library/vocab/queries.ts` 의 `PublishedVocabSet` 사용.

export type { PublishedVocabSet as VocabSet } from '@/lib/library/vocab/queries'

/** @deprecated 빌드 호환용 빈 배열 — Supabase fetch 사용. */
export const MOCK_VOCAB_SETS: never[] = []
