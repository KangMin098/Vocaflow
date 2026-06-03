// apps/web/src/lib/vcb/filters.ts
// VCB run config 의 새 filter / limits 스키마.
// vocab_runs.config JSONB 에 nested 로 저장 — 기존 RunConfig 와 공존.

import type { Cefr } from './types'

export type VLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export const ALL_V_LEVELS: VLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
export const ALL_CEFR: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// list_tags 실측 12 종 (정찰 결과)
export const ALL_LIST_TAGS = [
  'ngsl_1.2',
  'ngsl_gr_1.0',
  'ngsl_spoken_1.2',
  'csat-prep-core-2k',
  'csat-prep-ext-1.8k',
  'bsl_1.20',
  'ndl_1.1',
  'tsl_1.2',
  'bel_1.0',
  'nawl_1.2',
  'moel_1.0',
  'fel_1.2',
] as const
export type ListTag = (typeof ALL_LIST_TAGS)[number]

// 한국어 라벨 — UI 표시용
export const LIST_TAG_LABELS: Record<ListTag, { label: string; hint: string }> = {
  'ngsl_1.2': { label: 'NGSL 일반', hint: '국제 영어 빈도 12,181어' },
  'ngsl_gr_1.0': { label: 'NGSL 단계별', hint: '3,643어 단계' },
  'ngsl_spoken_1.2': { label: 'NGSL 회화', hint: '구어 빈출 675어' },
  'csat-prep-core-2k': { label: '수능 코어', hint: '수능 빈출 2,000어' },
  'csat-prep-ext-1.8k': { label: '수능 확장', hint: '수능 확장 1,800어' },
  'bsl_1.20': { label: '비즈니스 (BSL)', hint: 'TOEIC/비즈니스 1,093어' },
  'ndl_1.1': { label: '뉴스 (NDL)', hint: '시사·뉴스 889어' },
  'tsl_1.2': { label: '여행 (TSL)', hint: '여행 영어 887어' },
  'bel_1.0': { label: '문학 (BEL)', hint: '문학·소설 656어' },
  'nawl_1.2': { label: '학술 (NAWL)', hint: '학술 영어 633어' },
  'moel_1.0': { label: '의학 (MOEL)', hint: '의학 영어 466어' },
  'fel_1.2': { label: '금융 (FEL)', hint: '금융 영어 416어' },
}

// frequency_band 실측 11 종
export const ALL_FREQ_BANDS = [
  'top1k',
  'top2k',
  'top3k',
  'top5k',
  'top10k',
  'top15k',
  'top20k',
  'top25k',
  'rare',
  'phrase',
  'compound',
] as const
export type FreqBand = (typeof ALL_FREQ_BANDS)[number]

export const FREQ_BAND_LABELS: Record<FreqBand, string> = {
  top1k: '최빈출 1,000',
  top2k: '2,000',
  top3k: '3,000',
  top5k: '5,000',
  top10k: '10,000',
  top15k: '15,000',
  top20k: '20,000',
  top25k: '25,000',
  rare: '희귀',
  phrase: '구문',
  compound: '복합어',
}

// primary_pos 유효 7 (실용)
export const PRACTICAL_POS = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'idiom',
  'phrasal_verb',
  'preposition',
] as const
export type PracticalPos = (typeof PRACTICAL_POS)[number]

export const POS_LABELS: Record<PracticalPos, string> = {
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  idiom: '관용어',
  phrasal_verb: '구동사',
  preposition: '전치사',
}

// 정렬 옵션
export type SortBy = 'frequency_rank' | 'v_level' | 'alpha' | 'random'
export const SORT_LABELS: Record<SortBy, string> = {
  frequency_rank: '빈도순 (빈출→희귀)',
  v_level: 'V-Level순 (쉬움→어려움)',
  alpha: '알파벳순',
  random: '랜덤',
}

// list_tags 매칭 모드
export type TagMatchMode = 'any' | 'all'

// ── 핵심 Filter 스키마 ─────────────────────────────
export interface VocabFilters {
  v_level_min: VLevel | null // null = 무제한
  v_level_max: VLevel | null
  cefr_levels: Cefr[] // 빈 배열 = 전체
  list_tags: ListTag[]
  list_tags_mode: TagMatchMode // any (||) / all (&&)
  freq_bands: FreqBand[]
  primary_pos: PracticalPos[]
  verified_only: boolean
}

export interface VocabLimits {
  max_words: number | null // null = 무제한
  sort_by: SortBy
}

export const DEFAULT_FILTERS: VocabFilters = {
  v_level_min: null,
  v_level_max: null,
  cefr_levels: [],
  list_tags: [],
  list_tags_mode: 'any',
  freq_bands: [],
  primary_pos: [],
  verified_only: false,
}

export const DEFAULT_LIMITS: VocabLimits = {
  max_words: 200,
  sort_by: 'frequency_rank',
}

// ── config JSONB 의 새 형태 ────────────────────────
// 기존 RunConfig 키 (target_segment 등) 와 nested 공존
export interface VcbConfigV2Extension {
  preset_id?: string // null 시 custom
  filters?: VocabFilters
  limits?: VocabLimits
}
