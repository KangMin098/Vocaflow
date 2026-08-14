// apps/web/src/lib/vcb/compose/types.ts
//
// Recipe v3 — 단어장 하나를 만드는 선언. 4단(population → select → organize → present).
//
// 왜 이 파일이 필요한가:
//   단어장을 만드는 코드가 5곳에 있고 각자 다른 curation_query 방언을 쓴다
//   (VCB 8-step=null · publish-list-word-set · roots-publish-set · topics-publish-set · KICE).
//   그래서 "무엇으로 뽑았는가" 가 재현되지 않고, "좋은 단어장인가" 를 수치로 답할 곳이 없다.
//   v3 는 그 5 방언을 흡수하는 상위 집합이며, shared_word_sets.curation_query 에 그대로 저장한다
//   (기존 컬럼 재사용 — 마이그레이션 불필요).
//
// 근거: docs/VCB_REDESIGN.md (자산 실측 · 26 유형 분류 · 평가 지표)

import type { FacetId } from '@/lib/framework/axes'
import type { Cefr, Segment } from '../types'
import type { FreqBand, ListTag, PracticalPos, VLevel } from '../filters'

export const RECIPE_VERSION = 3 as const

// ── 모집단 — 어디서 뽑나 ────────────────────────────────────────────
//
// 합성 가능(union/intersect/except)해야 하는 이유: 시중 유형의 절반은 교집합이다.
// "수능 어휘 중 아직 안 외운 것" · "이 책에 나오는 NGSL 3000" 같은 것이 그것이다.

/** 학습자 상태 — 기지 어휘 차감·약점 추출에 쓴다. */
export type LearnerState = 'unknown' | 'known' | 'risk' | 'shaky' | 'due'

export type PopulationSpec =
  /** shared_dictionary 전체 (45,688행) */
  | { kind: 'dictionary' }
  /** list_tags 소속 — 시험·교육과정·분야 리스트 */
  | { kind: 'list'; tags: ListTag[] | string[]; mode: 'any' | 'all' }
  /** word_root_links — 어원·접사. root_ids 생략 시 전체 181 어근 */
  | { kind: 'roots'; root_ids?: number[]; affix_types?: ('root' | 'prefix' | 'suffix')[] }
  /** dictionary_word_categories — 의미장. themes 는 L1 name_ko */
  | { kind: 'topics'; themes?: string[]; rollup_level?: 1 | 2 | 3 }
  /** 코퍼스 — 도서/챕터/글. 토큰 빈도를 함께 들고 온다 (unlock/recycle 의 전제) */
  | {
      kind: 'corpus'
      scope: 'book' | 'chapter_range' | 'text' | 'article'
      ids: string[]
      chapter_from?: number
      chapter_to?: number
    }
  /** 기출 문항 — csat_dcp_items */
  | { kind: 'exam_items'; source_key: string; question_nos?: number[]; min_years?: number }
  /** 학습자 상태 (개인화 세트) */
  | { kind: 'learner'; user_id: string; state: LearnerState }
  /** 집합 연산 — 교집합/차집합이 시중 유형의 절반을 만든다 */
  | { kind: 'union'; of: PopulationSpec[] }
  | { kind: 'intersect'; of: PopulationSpec[] }
  | { kind: 'except'; of: [PopulationSpec, PopulationSpec] }

export type PopulationKind = PopulationSpec['kind']

// ── 선별 — 무엇을 남기나 ────────────────────────────────────────────

/** register 잡음 — 기존 두 스크립트가 각자 하드코딩하던 집합을 한 곳으로 모았다. */
export const NOISE_REGISTERS = [
  'archaic_literary',
  'period_cultural',
  'phrase_unit',
  'brand',
  'abbreviation',
  'proper_noun',
] as const
export type NoiseRegister = (typeof NOISE_REGISTERS)[number]

/** 카드가 요구할 수 있는 사전 필드 — 면(facet) 요구가 이 이름으로 표현된다. */
export const REQUIRABLE_FIELDS = [
  'meaning_ko',
  'example_en',
  'ipa',
  'audio_url',
  'image_url',
  'collocations',
  'synonyms',
  'antonyms',
  'homophones',
  'rhyme_key',
  'senses_multi',
  'mnemonic_ko',
  'morphology',
  'korean_learner_note',
] as const
export type RequirableField = (typeof REQUIRABLE_FIELDS)[number]

export interface SelectFilters {
  v_level_min: VLevel | null
  v_level_max: VLevel | null
  cefr_levels: Cefr[]
  freq_bands: FreqBand[]
  primary_pos: PracticalPos[]
  verified_only: boolean
  /** 제외할 register. 기본 NOISE_REGISTERS */
  exclude_registers: string[]
  /** 이 필드가 있어야 후보로 남는다 (면 요구와 별개로 명시 가능) */
  require_fields: RequirableField[]
  /** 최소 등장 빈도 — 코퍼스 모집단에서만 의미 있다 */
  min_corpus_freq?: number
}

/**
 * 몇 개를 뽑나 — 개수가 아니라 **목표**로 쓴다.
 *
 * `coverage` 가 이 설계의 핵심이다: "1,000개" 가 아니라 "이 책의 95% 를 읽을 수 있을 만큼" 이
 * 학습자가 실제로 원하는 것이고, 그 답은 콘텐츠마다 다르다.
 */
export type Objective =
  | { kind: 'count'; n: number }
  | { kind: 'coverage'; target: number; max_words?: number }
  | { kind: 'all' }

export interface SelectSpec {
  filters: SelectFilters
  objective: Objective
  /** 이 사용자가 이미 아는 단어를 뺀다 (word_familiarity known + FSRS stable) */
  subtract_known_for?: string | null
  /** 파생어를 기본형으로 접는다 — word family 세트에서 중복 방지 */
  family_collapse: 'none' | 'base_only'
  /** 반드시 포함/제외할 단어 (어드민 수동 개입) */
  must_include: string[]
  must_exclude: string[]
}

// ── 조직 — 목차를 어떻게 짜나 ───────────────────────────────────────
//
// 여기가 기존 위저드에 통째로 없던 단이다. 목차가 필터로 표현되지 않는 유형
// (어원 챕터 · 의미장 · 짝 대조 · N일 완성)은 지금 어드민에서 만들 수 없다.

export const GROUP_BYS = [
  'none',
  'root',
  'topic',
  'family',
  'pos',
  'v_level',
  'cefr',
  'freq_band',
  'confusable',
  'collocation_hub',
  'synonym_cluster',
  'sense',
  'rhyme',
  'source_chapter',
  'day',
] as const
export type GroupBy = (typeof GROUP_BYS)[number]

export const ORDER_WITHINS = [
  'frequency',
  'v_level',
  'alpha',
  'unlock_yield',
  'recycle_soon',
  'sense_count',
  'as_selected',
] as const
export type OrderWithin = (typeof ORDER_WITHINS)[number]

export interface OrganizeSpec {
  group_by: GroupBy
  /** 그룹 자체의 순서 */
  group_order: 'size_desc' | 'alpha' | 'v_level' | 'source_order'
  /** 그룹 하나당 최대 — 어원 세트의 per_root_cap 이 여기로 흡수된다 */
  group_cap: number | null
  order_within: OrderWithin
  /** N일 완성 — group_by='day' 와 함께 쓴다 */
  pacing?: { days: number; per_day: number } | null
  /** 짝 유형(혼동어·반의어)은 짝이 같은 그룹에 있어야 한다 */
  keep_pairs_together?: boolean
  /**
   * 이 크기 미만 그룹은 **버린다**.
   *
   * 짝 유형의 정의가 여기 있다: 혼동어 단어장에 짝 없는 단어가 섞이면 그것은 혼동어 단어장이
   * 아니다. Round 2 실측에서 confusable 300개 중 126개가 짝 없이 남아 유형 적합이 0 이 됐다 —
   * 개수를 채우려고 유형을 깨는 것보다, 개수가 줄고 유형이 성립하는 쪽이 옳다.
   */
  min_group_size?: number | null
}

// ── 표현 — 무엇을 보장하나 ──────────────────────────────────────────

export interface PresentSpec {
  /** 이 세트가 훈련 가능하다고 **선언**하는 면. 평가기가 요구 필드 결측을 센다. */
  facets: FacetId[]
  /** 카드에 실을 필드 */
  card_fields: RequirableField[]
  /** 대조 표시 — 짝 유형에서 카드가 무엇과 함께 보여야 하나 */
  contrast: 'none' | 'antonym' | 'confusable' | 'sense' | 'synonym'
  /** 챕터/그룹 제목을 무엇으로 쓸까 */
  group_label: 'auto' | 'root_gloss' | 'topic_ko' | 'day_number' | 'chapter_title'
}

// ── 레시피 ──────────────────────────────────────────────────────────

/**
 * 대상 학습자 층.
 *
 * VCB run 의 `Segment` 를 그대로 쓰지 않고 `'elementary'` 를 더한 이유: 파닉스·그림 단어장의
 * 대상은 초등이고, 그것을 `middle_school` 로 적으면 데이터가 거짓이 된다. run 쪽 `Segment` 는
 * 보강(enrichment) 난이도 지시이자 precheck 검증 대상이므로 확장하면 DB 검증까지 번진다 —
 * 그래서 컴포저의 대상 층은 컴포저가 자기 타입으로 들고 있는다.
 */
export type ComposeSegment = Segment | 'elementary'

export interface RecipeMeta {
  slug: string
  title: string
  description: string
  cover_emoji: string
  /** shared_word_sets.category — 기존 값 집합 유지 */
  category: string
  subcategory: string | null
  target_segment: ComposeSegment | null
  target_cefr_range: Cefr[]
}

export interface Recipe {
  version: typeof RECIPE_VERSION
  blueprint: string
  meta: RecipeMeta
  population: PopulationSpec
  select: SelectSpec
  organize: OrganizeSpec
  present: PresentSpec
}

// ── 컴포저 입출력 ───────────────────────────────────────────────────

/** 컴포저가 다루는 단어 하나 — 모집단 종류가 달라도 이 형태로 정규화된다. */
export interface CandidateWord {
  word: string
  lemma: string | null
  meaning_ko: string | null
  pos: string | null
  primary_pos: string | null
  cefr_level: string | null
  v_level: number | null
  frequency_rank: number | null
  frequency_band: string | null
  word_register: string | null
  ipa: string | null
  audio_url: string | null
  image_url: string | null
  example_en: string | null
  collocations: string[]
  synonyms: string[]
  antonyms: string[]
  homophones: string[]
  rhyme_key: string | null
  sense_count: number
  mnemonic_ko: string | null
  korean_learner_note: string | null
  base_word: string | null
  derivation_suffix: string | null
  derived_forms: string[]
  verified: boolean
  /** 코퍼스 모집단에서만 채워진다 — unlock/recycle 의 입력 */
  corpus_freq?: number
  /** 코퍼스 문장 — 실제 원서 문장이 예문이 된다 */
  corpus_sentence?: string | null
  corpus_chapter?: number | null
  /** 앞으로 몇 챕터에서 다시 나오나 (recycle) */
  future_encounters?: number
  /** 그룹 키 후보 — roots/topics 모집단이 채운다 */
  group_keys?: { key: string; label: string; rank?: number }[]
}

export interface ComposedEntry {
  word: string
  sort_order: number
  group_key: string
  group_label: string
  candidate: CandidateWord
}

export interface ComposedGroup {
  key: string
  label: string
  entries: ComposedEntry[]
}

export interface ComposedSet {
  recipe: Recipe
  groups: ComposedGroup[]
  entries: ComposedEntry[]
  /** 모집단 → 최종까지 몇 개가 어디서 떨어졌나 (드라이런 진단) */
  funnel: {
    population: number
    after_filters: number
    after_subtract: number
    after_objective: number
    final: number
    dropped: Record<string, number>
  }
  /** 코퍼스 목표가 있을 때만 — 달성 커버리지 */
  coverage?: { achieved: number; target: number; tokens_total: number; tokens_covered: number }
  /**
   * 고유 유형의 우위 증거 — 대조군(일반 빈도순)과 같은 단어 수로 비교한 결과.
   *
   * 여기에 남기지 않으면 "획기적" 이 주장으로만 남는다. 평가기의 `blueprint_fit` 이 이 값을 읽는다.
   */
  evidence?: {
    sentence_unlock?: { ours: number; baseline: number; total: number; budget: number }
    future_encounters?: { ours_mean: number; baseline_mean: number; population_mean: number }
  }
}
