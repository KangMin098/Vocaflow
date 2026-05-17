// packages/vcb-core/src/pos-map.ts
// winkNLP (Universal Dependencies) POS → VCB Pos 매핑
// 보수적 정책: 학습 어휘로 부적합한 태그는 drop
// CLAUDE.md §19.4 Step 3 정합

import type { Pos } from './types'

/**
 * winkNLP UD POS 태그 → VCB Pos 매핑.
 * null = drop (학습 어휘로 부적합).
 *
 * Drop 사유:
 * - PROPN: 고유명사 ("john", "london") — 어휘 학습 가치 낮음
 * - AUX:   조동사 ("be", "have", "do", "will") — 문법 요소
 * - PART:  소사 ("to", "'s", "n't") — 학습 단어 아님
 * - NUM:   숫자 — 어휘 아님
 * - SYM:   기호 — 어휘 아님
 * - X:     미분류 — 잡음
 * - PUNCT: 구두점 — 안전망 (excludePunctuation 옵션이 차단하지만 명시)
 */
export const WLP_TO_VCB_POS: Readonly<Record<string, Pos | null>> = Object.freeze({
  NOUN: 'NOUN',
  VERB: 'VERB',
  ADJ: 'ADJ',
  ADV: 'ADV',
  PRON: 'PRON',
  DET: 'DET',
  INTJ: 'INTJ',
  ADP: 'PREP', // ADP (Adposition) → PREP 이름 변환
  CCONJ: 'CONJ', // Coordinating conjunction → CONJ
  SCONJ: 'CONJ', // Subordinating conjunction → CONJ (합병)
  PROPN: null,
  AUX: null,
  PART: null,
  NUM: null,
  SYM: null,
  X: null,
  PUNCT: null,
})

/**
 * winkNLP POS 를 VCB Pos 로 매핑.
 * 매핑 결과가 null 이면 drop 대상.
 * 미지의 태그는 null (drop) 반환 + 호출자가 통계 로그에 기록.
 */
export function mapWlpPos(wlpPos: string): Pos | null {
  return WLP_TO_VCB_POS[wlpPos] ?? null
}

/**
 * drop 통계 누적용 헬퍼.
 */
export interface PosDropStats {
  dropped_total: number
  by_tag: Record<string, number>
  unknown_tags: string[]
}

export function createDropStats(): PosDropStats {
  return {
    dropped_total: 0,
    by_tag: {},
    unknown_tags: [],
  }
}

export function recordDrop(stats: PosDropStats, wlpPos: string): void {
  stats.dropped_total += 1
  stats.by_tag[wlpPos] = (stats.by_tag[wlpPos] ?? 0) + 1
  if (!(wlpPos in WLP_TO_VCB_POS) && !stats.unknown_tags.includes(wlpPos)) {
    stats.unknown_tags.push(wlpPos)
  }
}

/**
 * VCB Pos → shared_dictionary.pos 매핑.
 * 실제 컬럼값 검증 결과 (2026-05-13): 소문자 풀네임 사용.
 * Outlier (idiom / phrasal verb / abbreviation / exclamation / auxiliary verb)
 * 는 WLP 토큰화 단위(단일 단어)와 어긋나 자연스럽게 lookup miss 발생.
 */
export const VCB_TO_SHARED_DICT_POS: Readonly<Record<Pos, string>> = Object.freeze({
  NOUN: 'noun',
  VERB: 'verb',
  ADJ: 'adjective',
  ADV: 'adverb',
  PRON: 'pronoun',
  DET: 'determiner',
  INTJ: 'interjection',
  PREP: 'preposition',
  CONJ: 'conjunction',
})

export function mapVcbToSharedDictPos(pos: Pos): string {
  return VCB_TO_SHARED_DICT_POS[pos]
}
