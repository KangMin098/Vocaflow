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

/**
 * 학습자 상태 — 기지 어휘 차감·약점 추출에 쓴다.
 *
 * `wrong` 만 성격이 다르다: 나머지는 **일정**(FSRS 다음 복습일)에서 나오지만 `wrong` 은
 * **실제 채점 결과**(`learning_records.is_correct = false`)에서 나온다. 한때 혼동 세트가
 * `risk` 를 읽고 있었는데, 그건 "곧 잊을 때가 된 단어" 지 "틀린 단어" 가 아니다 —
 * 유형이 약속한 것과 데이터가 갈라져 있었다.
 */
export type LearnerState = 'unknown' | 'known' | 'risk' | 'shaky' | 'due' | 'wrong'

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
  /**
   * 기출 어휘 — `lexicon_frequencies` (lemma 키) + `frequency_data_sources.source_key`.
   *
   * `question_nos` 는 `metadata.question_history`({연도: [문항번호]})를 본다. 이 데이터는 원래
   * `lexicon_source_tags`(lexicon_id 키)에만 있었고 그 키를 잇던 `word_lexicon` 이 CASCADE 삭제돼
   * **고아**였다 — 2026-08-15 에 살아 있던 다리(`shared_words.lexicon_id`)로 673 lemma 를 구조해
   * lemma 키 테이블로 옮겼다. 그 673 개가 기존 KICE 4 세트의 합집합이므로 그 세트들은 정확히
   * 재현되지만, **그 밖의 문항유형 데이터는 복구 불가**다 (5,421 중 87%).
   */
  | {
      kind: 'exam_items'
      source_key: string
      question_nos?: number[]
      min_years?: number
      frequency_tier_min?: number
      raw_count_min?: number
    }
  /** 학습자 상태 (개인화 세트) */
  | { kind: 'learner'; user_id: string; state: LearnerState }
  /**
   * 이미 발행된 세트에 들어 있는 단어.
   *
   * 단독으로 쓰는 일은 드물고 `except` 의 오른쪽에 온다 — "아직 어느 세트에도 없는 어휘".
   * 평가기의 novelty 가 매번 "겹침 73~99%" 를 경고했는데, 경고를 **능력으로** 바꾼 것이다.
   */
  | { kind: 'published'; categories?: string[] }
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
  /** 뜻이 **읽을 수 있는 상태**인가 — 영문 잔재·깨진 글자·과장한 길이 배제 (market.ts 와 같은 판정) */
  'meaning_clean',
  'example_en',
  /** 예문이 **그 표제어를 실제로 담고 있는가** (굴절·구 포함). 담지 않은 예문은 예문이 아니다 */
  'example_matches',
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
  /**
   * 표제어 최소 길이. 기본 3.
   *
   * 빈도 상위에는 `s` · `m` · `d` · `re` 같은 토큰이 섞여 있다(실측). 시중 단어장은 이런 것을
   * 표제어로 싣지 않으며, 실리면 그 책의 신뢰가 떨어진다.
   */
  min_word_length?: number
  /**
   * 내용어만 남긴다 (명사·동사·형용사·부사·관용어·구동사).
   *
   * 대명사·전치사·접속사·관사·조동사는 빈도 최상위를 차지하지만 **외울 대상이 아니다**.
   * 시중 빈출 보카가 `is/am/are/it/he` 를 표제어로 싣지 않는 것과 같은 이유다.
   * 레시피가 `primary_pos` 를 직접 지정하면(전치사 단어장 등) 이 필터는 비활성된다.
   */
  content_pos_only?: boolean
  /**
   * 같은 풀 안에 기본형이 있는 **굴절형을 버린다** (`go` 가 있으면 `goes·going·went·gone` 제거).
   *
   * 지면 단어장은 표제어를 한 번만 싣고 굴절은 그 아래 적는다. 우리 세트는 굴절형이 각각
   * 한 자리를 차지해 600개 중 수십 개가 같은 단어의 변형이었다 — 분량을 낭비하고 아마추어처럼 보인다.
   */
  drop_pool_inflections?: boolean
  /**
   * 사전식 **변형 표제어**를 버린다. 기본 true.
   *
   * `(be) on the ball` · `(as) sick as a parrot` · `honor-bound/honour-bound` 처럼 괄호·슬래시로
   * 변형을 묶은 항목은 사전 표제어이지 **학습 카드가 아니다**. 시중 책은 이런 형태를 싣지 않는다
   * (실측: 관용어 풀 상위가 이런 항목으로 뒤덮여 "빈출 구동사" 세트가 알파벳 순 찌꺼기였다).
   */
  exclude_variant_headwords?: boolean
  /**
   * **굴절형을 표제어에서 뺀다** — 풀에 기본형이 있든 없든.
   *
   * `drop_pool_inflections` 와 다르다: 그쪽은 "같은 풀 안에 기본형이 있으면" 지우므로,
   * 기본형이 이미 다른 세트에 실려 빠져나간 경우엔 굴절형만 남아 통과한다. 실측
   * 2026-08-15 `미수록 600` 의 첫 항목이 `further · listing · wearing · worn · trading ·
   * voting · drinking · drunk` 였다 — "아무 단어장에도 없는 말" 이 아니라 **기본형이 이미
   * 실려서 굴절형만 남은 것**이었다. 제목이 거짓이 된다.
   *
   * 판정: `base_word` 가 있고 `derivation_suffix` 가 없으면 굴절(`worn→wear`·`further→far`).
   * 파생(`happiness`·`quickly`)은 별도 표제어가 맞으므로 남긴다.
   */
  exclude_inflections?: boolean
  /**
   * 품사가 **두 컬럼에서 일치**할 때만 남긴다 (`pos` 와 `primary_pos`).
   *
   * 영어 낱말은 품사가 여럿인 경우가 흔해서 두 컬럼이 서로 다른 뜻을 가리킬 수 있다
   * (실측 669행 · 1.5% — `part` 명사/동사 · `show` · `light` · `game`). 대개는 둘 다 맞다.
   *
   * 문제는 **한 품사만 모으는 유형**이다. 컴포저는 `primary_pos ?? pos` 를 믿는데, 그러면
   * `other`(pos=형용사 · primary_pos=동사)가 "동사 핵심 300" 1등 근처에 앉는다. 한 품사를
   * 약속한 책에서 그건 바로 보이는 오류다. 일치를 요구해도 동사 4,040개가 남는다.
   */
  require_pos_agreement?: boolean
  /**
   * 빈도 순위가 있는 항목만 남긴다.
   *
   * "빈출" 을 약속하는 유형에서만 켠다 — 순위가 없으면 무엇이 빈출인지 말할 근거가 없고,
   * 정렬은 사실상 알파벳순이 된다.
   */
  require_frequency_rank?: boolean
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
  /** 반대말 짝 — 사전의 `antonyms` 중 같은 풀에 있는 상대와 마주 보게 묶는다 */
  'antonym_pair',
  /**
   * **실제로 헷갈린 짝** — 오답일 때 학습자가 고른 단어와 정답을 한 그룹에.
   *
   * `confusable`(철자 이웃)과 다르다: 저쪽은 사전이 만든 함정이고 이쪽은 그 학습자가
   * 실제로 빠진 함정이다. 근거는 `learning_records.metadata.chosen`.
   */
  'confusion_pair',
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
  /**
   * **짧은 것부터** — 구·관용어처럼 빈도 데이터가 없는 표제어의 순서.
   *
   * 실측 2026-08-15: `word_register='phrase_unit'` 3,635건 중 `frequency_rank` 가 있는 것이
   * **0건**이다. 그 상태로 `frequency` 정렬을 걸면 전부 동률이라 사실상 알파벳순이 되고,
   * "빈출 구동사" 를 약속한 세트가 `a bone of contention · a buyer's market · a chink in
   * somebody's armour` 로 시작한다.
   *
   * 낱말 수가 적은 구(`give up` · `look after`)가 곧 자주 쓰는 구라는 것은 완벽하진 않지만
   * **데이터로 뒷받침되는 유일한 대리지표**다. 없는 빈도를 있는 척하는 것보다 낫다.
   */
  'phrase_brevity',
  /**
   * 주제 내 중심도 — 그 주제를 대표하는 낱말부터.
   *
   * 전역 빈도로 정렬하면 어느 주제든 `round · total · bank · career` 같은 범용어가
   * 앞자리를 차지한다(주제 트리는 '이 장면에서 쓰이는 낱말' 을 담으므로 범용어도 태그된다).
   * 이 순위는 주제 고유성(최상위 주제를 몇 개나 걸치나) × 어휘 특이성(너무 흔하지도
   * 너무 희소하지도 않은가)으로 계산해 백필했다.
   */
  'topic_rank',
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
  /**
   * 이 크기를 넘는 그룹은 **번호를 붙여 쪼갠다** (`V5 (1/3)` · `V5 (2/3)` …).
   *
   * 시중 베스트가 잘하는 것 중 하나가 분량 설계다 — 한 챕터가 한 자리에서 끝난다.
   * 우리 그룹은 원리(레벨·품사·주제)로 갈리므로 크기가 들쭉날쭉하고, 500개짜리 챕터는
   * 목차가 있으나 마나다. 원리를 유지한 채 소화 가능한 크기로 자르는 것이 이 옵션이다.
   */
  max_group_size?: number | null
  /**
   * 챕터 크기 창(window) 안에서 **연상 고리가 있는 단어를 앞세운다**.
   *
   * 시중 연상 보카가 파는 것이 이 요소인데(기준선 0.1~0.5), 우리 사전은 `mnemonic_ko` 12.6% 라
   * 아무 개입이 없으면 그 비율이 그대로 나온다. 하드 필터로 걸면 유형이 왜곡되므로
   * (빈도순 단어장이 "연상 있는 단어장" 이 되어 버린다) **순서만** 바꾼다 —
   * 한 단어가 움직이는 거리는 챕터 하나를 넘지 않으므로 난이도 진행이 보존된다.
   */
  prefer_mnemonic?: boolean
  /**
   * 챕터 창 안에서 **이 필드를 가진 항목을 앞세운다** (연상·연어 등).
   *
   * prefer_mnemonic 의 일반화다 — 유형마다 "카드를 잘 가르칠 수 있게 하는 필드" 가 다르다.
   * 구동사 책은 전형적 쓰임(연어)이 그것이고, 연상 보카는 연상이 그것이다.
   * 하드 필터가 아니라 순서이므로 유형이 왜곡되지 않는다.
   */
  prefer_fields?: RequirableField[]
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
  /** 굴절형 — 예문이 표제어를 담고 있는지 판정할 때 쓴다 (come/came 같은 불규칙) */
  inflected_forms: string[]
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
  /**
   * 이 표제어가 **다른 표제어의 굴절형**인가 ( · ).
   * 차집합 좌변(어휘 전체)이 살아 있을 때만 판정할 수 있어 resolve 단계에서 채운다 —
   * 뺀 뒤에는 기본형이 사라져 알 수 없다.
   */
  is_inflection?: boolean
  /**
   * 주제 **내** 중심도 순위 ().
   * 낮을수록 그 주제를 대표한다. 주제 유형의 정렬 근거다.
   */
  topic_rank?: number
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
