// packages/library-pipeline/src/analyze/learning-value.ts
// LCP v2.0 — Learning Value Score (Phase 14.6 segment-aware formula)
//
// LV = (0.45 * bookFreqNorm
//     + 0.35 * cefrWeight * cefrConfidence    ← list_tags 신호 강할수록 cefr 약화
//     + 0.15 * novelty
//     + 0.05 * density)
//    * globalFreqWeight                       ← NGSL rank-based multiplier
//    * segmentBonus                           ← user segment × matching list
//
// cefrConfidence:
//   shared_dictionary 부재 단어 → 0.3 (자동 stopword 처리)
//   list_tags 강한 multi-list signal → cefr 라벨 신뢰도 ↓
//   → CEFR 라벨 부정확 케이스 자동 흡수
//
// segmentBonus:
//   사용자 segment + 매칭 list = 1.20~1.30× (학습 개인화)
//
// DB 검증 (Alice ch1, 2026-05-12):
//   - alice/little/way/come (shared_dictionary 부재) → LV ~0.03 자동 stopword
//   - turtle/caterpillar/lobster (학습 가치) → LV ~0.43 (Top 부각)
//   - rope/mask/shout (C2 라벨 + 3+ list cover, 부정확) → LV ~0.27~0.30 (적절 약화)

import type { ChapterWord, CefrLevel } from '../types'
import type { BookLemmaIndex } from './extract-lemmas'
import type { DictionaryEntry } from './lookup-enrich'

export type UserSegment =
  | 'middle_school'
  | 'high_school'
  | 'academic'
  | 'business'
  | 'toeic'
  | 'civil_service'
  | 'general'
  | 'book_recommend'

// CEFR weight — Yerkes-Dodson 최적 자극 (B2)
const CEFR_WEIGHT: Record<CefrLevel, number> = {
  A1: 0.1,
  A2: 0.25,
  B1: 0.6,
  B2: 1.0,
  C1: 0.85,
  C2: 0.5,
}
const NULL_CEFR_WEIGHT = 0.7

// Segment → 매칭 list × LV 보너스
const SEGMENT_LIST_BONUS: Record<UserSegment, { listId: string; bonus: number }> = {
  middle_school: { listId: 'ndl_1.1', bonus: 1.3 },
  high_school: { listId: 'ngsl_gr_1.0', bonus: 1.15 },
  academic: { listId: 'nawl_1.2', bonus: 1.25 },
  business: { listId: 'bsl_1.20', bonus: 1.25 },
  toeic: { listId: 'tsl_1.2', bonus: 1.25 },
  civil_service: { listId: 'nawl_1.2', bonus: 1.2 },
  general: { listId: 'ngsl_spoken_1.2', bonus: 1.1 },
  book_recommend: { listId: 'ngsl_gr_1.0', bonus: 1.2 },
}

// list_tags 신호 강도 → cefr 라벨 신뢰도 (다중 리스트 cover 시 cefr 가중치 약화)
function computeCefrConfidence(
  isInSharedDict: boolean,
  listTags: string[],
): number {
  if (!isInSharedDict) return 0.3 // 사전 부재 → 강한 stopword
  const n = listTags.length
  const hasNgsl = listTags.includes('ngsl_1.2')
  if (n >= 4) return 0.4 // 매우 강한 multi-list signal
  if (n >= 3) return 0.5 // CEFR 라벨 부정확 자동 흡수
  if (n >= 2) return 0.7
  if (n === 1 && hasNgsl) return 0.8
  if (n === 1) return 0.6
  return 1.0 // tag 없음 → cefr 전적 신뢰
}

// NGSL rank-based multiplier (Phase 14.4.1 유지) + 사전 부재 단어 보정
function computeGlobalFreqWeight(
  rank: number | null,
  isInSharedDict: boolean,
): number {
  if (rank === null) return isInSharedDict ? 0.8 : 0.3
  if (rank < 500) return 0.05 // stopword (the, of, and …)
  if (rank < 1500) return 0.3
  if (rank < 5000) return 0.85
  if (rank < 10000) return 1.0
  if (rank < 20000) return 0.9
  return 0.75
}

function computeSegmentBonus(segment: UserSegment, listTags: string[]): number {
  const map = SEGMENT_LIST_BONUS[segment]
  return map && listTags.includes(map.listId) ? map.bonus : 1.0
}

export interface ComputeLvOptions {
  totalChapters: number
  /** 사용자 segment — 미지정 시 'general' (가장 중립). */
  segment?: UserSegment
  /**
   * VRL v3 V-Level 사용자 기준점 (0~11). 지정 시 Krashen i+1 가중치 적용.
   * 미지정 시 weight=1.0 (영향 없음 — 기존 pipeline 호환).
   */
  userVLevel?: number
}

/**
 * VRL v3 Krashen i+1 가중치 — word v_level 와 user v_level 간 거리 기반.
 * adaptive-extract 의 secondary re-ranking 에서도 재사용.
 *
 * 정합: §17.2 [2] 상태 축 — comfort/growth/frustration zone
 *   - distance +1 = sweet spot (Krashen i+1)
 *   - distance  0 = i+0 (review/refresh)
 *   - distance +2 = growth zone
 *   - distance -1 = known
 *   - distance >=+3 = too hard
 *   - distance <=-2 = too easy
 *   - null (unclassified word 또는 user) = neutral (CEFR fallback 흐름 유지)
 */
export function vLevelWeightFor(
  wordVLevel: number | null | undefined,
  userVLevel: number | null | undefined,
): number {
  if (wordVLevel == null || userVLevel == null) return 0.7
  const d = wordVLevel - userVLevel
  if (d === 1) return 1.3
  if (d === 0) return 1.0
  if (d === 2) return 0.85
  if (d === -1) return 0.55
  if (d >= 3) return 0.4
  return 0.2
}

/**
 * 책 전체 lemma index + dictionary entries → ChapterWord[] (LV Score 포함).
 *
 * UNIQUE (library_book_id, word) 제약으로 word당 1 row만 INSERT.
 * 첫 등장 chapter의 ChapterWord만 반환 (occurrences는 chapter_idx 오름차순).
 * 결과는 base_learning_value 내림차순 정렬되어 반환됨.
 */
export function computeLearningValue(
  index: BookLemmaIndex,
  entries: Map<string, DictionaryEntry>,
  opts: ComputeLvOptions,
): ChapterWord[] {
  let totalWordsInBook = 0
  for (const count of index.bookFrequency.values()) totalWordsInBook += count
  const logDenom = Math.log(Math.max(totalWordsInBook, 100) + 1)
  const segment: UserSegment = opts.segment ?? 'general'

  const result: ChapterWord[] = []

  for (const [lemma, occurrences] of index.occurrences) {
    if (occurrences.length === 0) continue

    const first = occurrences[0]! // chapter_idx 오름차순
    const bookFreq = index.bookFrequency.get(lemma) ?? 1
    const entry = entries.get(lemma)
    const isInSharedDict = entry !== undefined
    const listTags = entry?.list_tags ?? []

    // 1. bookFreqNorm — 책 내부 빈도 정규화 (0~1)
    const bookFreqNorm =
      logDenom > 0 ? Math.log(first.frequency_in_chapter + 1) / logDenom : 0

    // 2. cefrWeight
    const cefr = entry?.cefr_level as CefrLevel | null | undefined
    const cefrWeight =
      cefr && cefr in CEFR_WEIGHT ? CEFR_WEIGHT[cefr] : NULL_CEFR_WEIGHT

    // 3. cefrConfidence — list_tags 신호 강할수록 cefr 약화
    const cefrConfidence = computeCefrConfidence(isInSharedDict, listTags)

    // 4. novelty — first_sentence 존재 시 첫 출현으로 간주
    const novelty = first.first_sentence_in_chapter ? 1.0 : 0.0

    // 5. density — chapter 내 반복 횟수 (5회 이상 saturate)
    const density = Math.min(first.frequency_in_chapter, 5) / 5

    const baseLv =
      0.45 * bookFreqNorm +
      0.35 * cefrWeight * cefrConfidence +
      0.15 * novelty +
      0.05 * density

    // 6. NGSL multiplier + 사전 부재 stopword 보정
    const globalFreqWeight = computeGlobalFreqWeight(
      entry?.frequency_rank ?? null,
      isInSharedDict,
    )

    // 7. segmentBonus — user segment × matching list
    const segmentBonus = computeSegmentBonus(segment, listTags)

    // 8. VRL v3 Krashen i+1 weight — userVLevel 지정 시에만 적용 (미지정 = 1.0)
    const vWeight =
      opts.userVLevel == null
        ? 1.0
        : vLevelWeightFor(entry?.v_level ?? null, opts.userVLevel)

    const lv = baseLv * globalFreqWeight * segmentBonus * vWeight

    result.push({
      word: lemma,
      chapter_idx: first.chapter_idx,
      frequency_in_chapter: first.frequency_in_chapter,
      frequency_in_book: bookFreq,
      first_sentence: first.first_sentence_in_chapter,
      base_learning_value: Number(Math.max(0, Math.min(1, lv)).toFixed(4)),
      context_pos: first.context_pos,
    })
  }

  result.sort((a, b) => b.base_learning_value - a.base_learning_value)
  return result
}

/** LV 분류 helper — 학습 가치 단계 표시 (Phase 14.6 임계값) */
export function classifyLV(
  lv: number,
): 'stopword' | 'low' | 'medium' | 'high' | 'optimal' {
  if (lv < 0.1) return 'stopword'
  if (lv < 0.25) return 'low'
  if (lv < 0.4) return 'medium'
  if (lv < 0.55) return 'high'
  return 'optimal'
}
