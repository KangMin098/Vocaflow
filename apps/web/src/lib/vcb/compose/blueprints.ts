// apps/web/src/lib/vcb/compose/blueprints.ts
//
// Blueprint 카탈로그 — 시중 단어장 26 유형 + 이 플랫폼만 만들 수 있는 4 유형.
//
// 분류 축은 **"무엇이 목차를 결정하는가"** 다 (출판사·타깃 같은 마케팅 축이 아니다).
// 컴포저가 구현해야 하는 것이 정확히 그것이기 때문이다:
//   list      — 모집단이 목차를 결정 (빈도·시험·교육과정·학술·등급·분야·기출)
//   structure — 어휘 내적 구조가 결정 (어원·family·품사·의미장·유의·반의·혼동·연어·구동사·다의·라임)
//   corpus    — 콘텐츠가 결정 (도서·챕터·기사·스크립트)
//   delivery  — 학습 방법이 결정 (N일 완성·연상·그림·오디오)
//   unique    — 지면 매체가 구조상 불가 (해금·재등장·면 보장·실오답)
//
// 각 항목의 `status` 는 자산 실측에서 나온 판정이다 (docs/VCB_REDESIGN.md §1):
//   ready — 지금 만들 수 있다 · partial — 자산 충전율이 낮아 규모가 제한된다
//   asset_gap — 자산이 0 이라 설계로 못 메운다 · data_gate — 학습 데이터가 쌓이면 열린다

import type { FacetId } from '@/lib/framework/axes'
import type { Cefr } from '../types'
import type {
  ComposeSegment,
  GroupBy,
  OrderWithin,
  PopulationSpec,
  Recipe,
  RequirableField,
  SelectFilters,
  Objective,
} from './types'
import { NOISE_REGISTERS, RECIPE_VERSION } from './types'
import { requiredFieldsFor } from './facets'

// ── 적합 규칙 — blueprint 고유 조건 ─────────────────────────────────
//
// 선언으로 둔 이유: 평가기가 유형별 조건을 하드코딩하면 새 유형을 추가할 때 평가기도 고쳐야 한다.
// 규칙을 데이터로 들고 있으면 카탈로그 한 줄로 유형이 늘어난다.

export type FitRule =
  /** 모든 항목이 이 필드를 갖고 있어야 한다 */
  | { kind: 'all_have_field'; field: RequirableField }
  /** '미상/짝없음' 그룹에 들어간 항목이 없어야 한다 */
  | { kind: 'all_grouped' }
  /** 모든 그룹의 크기가 이 값 이상 — 짝 유형의 핵심 조건 */
  | { kind: 'min_group_size'; n: number }
  /** 커버리지 목표를 실제로 달성했는가 */
  | { kind: 'coverage_met' }
  /** 뜻이 n개 이상인 항목만 */
  | { kind: 'senses_min'; n: number }
  /** 모든 항목이 코퍼스 문장을 들고 있어야 한다 */
  | { kind: 'has_corpus_sentence' }
  /** 대조군(일반 빈도순) 대비 우위가 있어야 한다 */
  | { kind: 'beats_baseline'; metric: 'sentence_unlock' | 'future_encounters' }
  /** 그룹 수가 이 값 이상 — 목차가 실제로 갈렸는가 */
  | { kind: 'min_groups'; n: number }
  /**
   * 모든 항목이 **재생 가능**한가 — 녹음(audio_url) 또는 런타임 TTS 중 하나로.
   *
   * `all_have_field: audio_url` 이 아닌 이유: 그 규칙은 audio_url 0% 때문에 오디오 유형을
   * "만들 수 없음" 으로 판정했는데, 제품에는 이미 흘려듣기 큐가 있고 그것은 audio_url 을
   * 쓰지 않는다(`components/wordvault/hooks/useListenQueue.ts` → `useSpeech`).
   * 즉 못 만드는 게 아니라 **녹음본이 없을 뿐**이다. 그 구분을 detail 에 그대로 남긴다.
   */
  | { kind: 'audio_playable' }

export interface BlueprintParams {
  slug?: string
  title?: string
  description?: string
  cover_emoji?: string
  count?: number
  tags?: string[]
  themes?: string[]
  root_ids?: number[]
  book_id?: string
  text_ids?: string[]
  chapter_from?: number
  chapter_to?: number
  user_id?: string
  days?: number
  per_day?: number
  v_level_min?: number | null
  v_level_max?: number | null
  cefr_levels?: Cefr[]
  coverage_target?: number
  group_cap?: number | null
  segment?: ComposeSegment | null
  /** 기출 문항유형 — 수능 문항 번호. 비우면 문항유형을 가리지 않는다 */
  question_nos?: number[]
  /** 기출 빈출 등급 하한 */
  frequency_tier_min?: number
}

export interface Blueprint {
  id: string
  family: 'list' | 'structure' | 'corpus' | 'delivery' | 'unique'
  /** 시중 분류 번호 (docs/VCB_REDESIGN.md §2) — 고유 유형은 U1~U4 */
  taxon: string
  title: string
  /** 시중 예 — 무엇을 대체하는지 한 줄 */
  market_example: string
  /** 목차를 무엇이 결정하나 — 도움말이 그대로 읽는다 */
  organizing_principle: string
  status: 'ready' | 'partial' | 'asset_gap' | 'data_gate'
  /** partial/asset_gap/data_gate 인 이유 — 실측 수치를 적는다 */
  gap_note?: string
  /** 이 유형이 요구하는 파라미터 (UI 가 무엇을 물어야 하는지) */
  requires_params: (keyof BlueprintParams)[]
  fit_rules: FitRule[]
  /** 평가 가중치 — 유형마다 무엇이 중요한지 다르다 */
  weights: Partial<Record<MetricId, number>>
  build: (p: BlueprintParams) => Recipe
}

export type MetricId =
  | 'fill'
  | 'level_fit'
  | 'noise'
  | 'novelty'
  | 'organize'
  | 'blueprint_fit'
  | 'value'

// ── 기본값 헬퍼 ─────────────────────────────────────────────────────

const filters = (partial: Partial<SelectFilters> = {}): SelectFilters => ({
  v_level_min: null,
  v_level_max: null,
  cefr_levels: [],
  freq_bands: [],
  primary_pos: [],
  verified_only: false,
  exclude_registers: [...NOISE_REGISTERS],
  require_fields: [],
  ...partial,
})

interface RecipeSeed {
  blueprint: string
  slug: string
  title: string
  description: string
  emoji: string
  category: string
  subcategory?: string | null
  segment?: ComposeSegment | null
  cefr?: Cefr[]
  population: PopulationSpec
  filters?: Partial<SelectFilters>
  objective?: Objective
  group_by?: GroupBy
  group_order?: 'size_desc' | 'alpha' | 'v_level' | 'source_order'
  group_cap?: number | null
  order_within?: OrderWithin
  pacing?: { days: number; per_day: number } | null
  keep_pairs_together?: boolean
  min_group_size?: number | null
  max_group_size?: number | null
  prefer_fields?: RequirableField[]
  facets: FacetId[]
  card_fields?: RequirableField[]
  contrast?: 'none' | 'antonym' | 'confusable' | 'sense' | 'synonym'
  group_label?: 'auto' | 'root_gloss' | 'topic_ko' | 'day_number' | 'chapter_title'
  subtract_known_for?: string | null
  family_collapse?: 'none' | 'base_only'
}

/**
 * 레시피 조립 — 면(facet) 선언에서 요구 필드를 **자동으로** 끌어온다.
 *
 * 이것이 이 설계의 결합점이다: "Use 면을 훈련한다" 고 선언하면 예문 없는 단어가 후보에서
 * 빠진다. 선언과 데이터가 갈라질 자리를 없앤 것이고, 그래서 평가기의 `fill` 이 1.0 이 된다.
 */
function recipe(seed: RecipeSeed): Recipe {
  const auto = requiredFieldsFor(seed.facets)
  const declared = seed.filters?.require_fields ?? []
  // 뜻이 읽히지 않는 항목은 어떤 유형에도 들어가면 안 된다 — 시중 베스트는 편집자가 교열하므로
  // 이 요소에서 지면과 동률조차 되지 못한다 (실측: 한국어 뜻 자리에 영단어 1,642건).
  const merged = new Set<RequirableField>([...auto, ...declared, 'meaning_clean'])

  // 발음 표기 — 지면 베스트는 표제어마다 발음기호를 싣는다(기준선 1.00). 사전 pool 은 단어 90.5%
  // 이므로 요구하지 않으면 그 요소에서 진다. 단 두 경우는 요구하지 않는다:
  //   · 구·관용어 유형 — 구는 IPA 8.3% 이고 지면 책도 구에 발음기호를 싣지 않는다
  //   · 코퍼스 유형 — 그 책에 나오는 단어를 IPA 유무로 빼면 목록이 거짓이 된다
  const posTargets = seed.filters?.primary_pos ?? []
  const isPhraseType = posTargets.some((p) => p === 'idiom' || p === 'phrasal_verb')
  const isCorpusType = seed.population.kind === 'corpus'
  if (!isPhraseType && !isCorpusType) merged.add('ipa')

  return {
    version: RECIPE_VERSION,
    blueprint: seed.blueprint,
    meta: {
      slug: seed.slug,
      title: seed.title,
      description: seed.description,
      cover_emoji: seed.emoji,
      category: seed.category,
      subcategory: seed.subcategory ?? null,
      target_segment: seed.segment ?? null,
      target_cefr_range: seed.cefr ?? [],
    },
    population: seed.population,
    select: {
      filters: filters({ ...seed.filters, require_fields: [...merged] }),
      objective: seed.objective ?? { kind: 'count', n: 500 },
      subtract_known_for: seed.subtract_known_for ?? null,
      family_collapse: seed.family_collapse ?? 'none',
      must_include: [],
      must_exclude: [],
    },
    organize: {
      group_by: seed.group_by ?? 'none',
      group_order: seed.group_order ?? 'size_desc',
      group_cap: seed.group_cap ?? null,
      order_within: seed.order_within ?? 'frequency',
      pacing: seed.pacing ?? null,
      keep_pairs_together: seed.keep_pairs_together ?? false,
      min_group_size: seed.min_group_size ?? null,
      // 기본 30 — 한 챕터가 한 자리에서 끝나는 크기. 시중 "하루 20~40개" 관행과 같은 축이고,
      // 원리(레벨·품사·주제)는 그대로 두고 번호만 붙여 쪼갠다. 짝 유형에는 적용되지 않는다.
      max_group_size: seed.max_group_size ?? 30,
      // 연상 고리가 있는 단어를 챕터 창 안에서 앞세운다 — 시중 연상 보카가 파는 요소를
      // 유형 왜곡 없이 끌어올리는 유일한 방법이다 (하드 필터로 걸면 빈도순이 연상순이 된다).
      prefer_mnemonic: true,
      // 유형마다 '카드를 잘 가르칠 수 있게 하는 필드' 가 다르다 — 구동사 책은 전형적 쓰임(연어)이다.
      prefer_fields: seed.prefer_fields ?? ['mnemonic_ko'],
    },
    present: {
      facets: seed.facets,
      card_fields: seed.card_fields ?? ['meaning_ko', 'example_en', 'ipa'],
      contrast: seed.contrast ?? 'none',
      group_label: seed.group_label ?? 'auto',
    },
  }
}

const W_DEFAULT: Partial<Record<MetricId, number>> = {
  fill: 0.25,
  level_fit: 0.15,
  noise: 0.15,
  novelty: 0.1,
  organize: 0.15,
  blueprint_fit: 0.1,
  value: 0.1,
}

/** 조직이 곧 유형인 blueprint — organize/blueprint_fit 를 무겁게 준다. */
const W_STRUCTURE: Partial<Record<MetricId, number>> = {
  fill: 0.2,
  level_fit: 0.1,
  noise: 0.1,
  novelty: 0.1,
  organize: 0.25,
  blueprint_fit: 0.2,
  value: 0.05,
}

/** 고유 유형 — 우위 증명(blueprint_fit)이 절반이다. 우위 없으면 고유가 아니다. */
const W_UNIQUE: Partial<Record<MetricId, number>> = {
  fill: 0.15,
  level_fit: 0.05,
  noise: 0.1,
  novelty: 0.05,
  organize: 0.15,
  blueprint_fit: 0.4,
  value: 0.1,
}

// ── A. list-driven — 7종 ────────────────────────────────────────────

const A: Blueprint[] = [
  {
    id: 'freq-tier',
    family: 'list',
    taxon: 'A1',
    title: '빈도순 N,000',
    market_example: 'NGSL 3000 · COCA 빈출 단어장',
    organizing_principle: '국제 말뭉치 빈도 — 자주 만나는 것부터',
    status: 'ready',
    requires_params: ['count'],
    fit_rules: [{ kind: 'all_have_field', field: 'meaning_ko' }],
    weights: { ...W_DEFAULT, value: 0.2, organize: 0.05 },
    build: (p) =>
      recipe({
        blueprint: 'freq-tier',
        slug: p.slug ?? 'freq-top-2k',
        title: p.title ?? '빈출 어휘 2,000',
        description: p.description ?? '국제 말뭉치 빈도 상위 어휘. 가장 자주 만나는 것부터 익힌다.',
        emoji: p.cover_emoji ?? '📊',
        category: 'themed',
        subcategory: 'frequency',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['A2', 'B1'],
        population: { kind: 'list', tags: p.tags ?? ['ngsl_1.2'], mode: 'any' },
        filters: { freq_bands: ['top1k', 'top2k'] },
        objective: { kind: 'count', n: p.count ?? 2000 },
        group_by: 'freq_band',
        group_order: 'alpha',
        order_within: 'frequency',
        facets: ['recognize', 'spell', 'use'],
      }),
  },
  {
    id: 'exam-list',
    family: 'list',
    taxon: 'A2',
    title: '시험 빈출',
    market_example: '수능 보카 · TOEIC 기출 단어장 · 공무원 영단어',
    organizing_principle: '출제 기관·시험 빈출 리스트',
    status: 'ready',
    requires_params: ['tags'],
    fit_rules: [{ kind: 'all_have_field', field: 'meaning_ko' }],
    weights: W_DEFAULT,
    build: (p) =>
      recipe({
        blueprint: 'exam-list',
        slug: p.slug ?? 'csat-core-2k',
        title: p.title ?? '수능 필수 2,000',
        description: p.description ?? '수능 빈출 핵심 어휘. 출제 리스트 소속으로 모집단을 고정한다.',
        emoji: p.cover_emoji ?? '🎯',
        category: 'csat',
        subcategory: 'exam_list',
        segment: p.segment ?? 'high_school',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'list', tags: p.tags ?? ['csat-prep-core-2k'], mode: 'any' },
        objective: { kind: 'count', n: p.count ?? 2000 },
        group_by: 'v_level',
        group_order: 'v_level',
        order_within: 'frequency',
        facets: ['recognize', 'spell', 'use'],
      }),
  },
  {
    id: 'curriculum-grade',
    family: 'list',
    taxon: 'A3',
    title: '교육과정 학년별',
    market_example: '중학 교과서 기본어휘 · 고교 필수어휘',
    organizing_principle: '2022 개정 교육과정 기본어휘 목록',
    status: 'ready',
    requires_params: ['tags'],
    fit_rules: [{ kind: 'all_have_field', field: 'meaning_ko' }],
    weights: W_DEFAULT,
    build: (p) =>
      recipe({
        blueprint: 'curriculum-grade',
        slug: p.slug ?? 'curriculum-mid',
        title: p.title ?? '교육과정 기본어휘 (중등)',
        description: p.description ?? '2022 개정 교육과정 기본어휘. 학교 진도와 같은 순서로 익힌다.',
        emoji: p.cover_emoji ?? '🏫',
        category: 'middle',
        subcategory: 'curriculum',
        segment: p.segment ?? 'middle_school',
        cefr: p.cefr_levels ?? ['A1', 'A2', 'B1'],
        population: { kind: 'list', tags: p.tags ?? ['kcurr2022_2'], mode: 'any' },
        objective: { kind: 'all' },
        group_by: 'cefr',
        group_order: 'alpha',
        order_within: 'v_level',
        facets: ['recognize', 'spell'],
      }),
  },
  {
    id: 'academic-awl',
    family: 'list',
    taxon: 'A4',
    title: '학술 어휘',
    market_example: 'AWL/NAWL 학술 영단어',
    organizing_principle: '학술 말뭉치 전용 어휘 목록',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'example_en' }],
    weights: W_DEFAULT,
    build: (p) =>
      recipe({
        blueprint: 'academic-awl',
        slug: p.slug ?? 'academic-nawl',
        title: p.title ?? '학술 어휘 NAWL',
        description: p.description ?? '논문·강의에 쓰이는 학술 어휘. 편입·유학 대비.',
        emoji: p.cover_emoji ?? '🎓',
        category: 'themed',
        subcategory: 'academic',
        segment: p.segment ?? 'academic',
        cefr: p.cefr_levels ?? ['B2', 'C1'],
        population: { kind: 'list', tags: p.tags ?? ['nawl_1.2'], mode: 'any' },
        objective: { kind: 'all' },
        group_by: 'pos',
        group_order: 'size_desc',
        order_within: 'frequency',
        facets: ['recognize', 'use'],
      }),
  },
  {
    id: 'level-band',
    family: 'list',
    taxon: 'A5',
    title: '등급별 (CEFR·V-Level)',
    market_example: 'A1~C2 단계별 보카 · 레벨드 어휘집',
    organizing_principle: '어휘 난이도 등급 밴드',
    status: 'ready',
    requires_params: ['v_level_min', 'v_level_max'],
    fit_rules: [{ kind: 'min_groups', n: 2 }],
    weights: { ...W_DEFAULT, level_fit: 0.3, value: 0.05, novelty: 0.05, noise: 0.1 },
    build: (p) =>
      recipe({
        blueprint: 'level-band',
        slug: p.slug ?? 'level-v4-v7',
        title: p.title ?? '레벨 중급 (V4-V7)',
        description: p.description ?? '진단 레벨 기준 i+1 밴드. 지금 읽을 만한 난이도만 모은다.',
        emoji: p.cover_emoji ?? '📚',
        category: 'themed',
        subcategory: 'level',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: {
          v_level_min: (p.v_level_min ?? 4) as never,
          v_level_max: (p.v_level_max ?? 7) as never,
          verified_only: true,
        },
        objective: { kind: 'count', n: p.count ?? 800 },
        group_by: 'v_level',
        group_order: 'v_level',
        order_within: 'frequency',
        facets: ['recognize', 'spell', 'use'],
      }),
  },
  {
    id: 'domain-specialty',
    family: 'list',
    taxon: 'A6',
    title: '분야 전문',
    market_example: '의학·금융·법률 영어 단어장 · 여행 영어',
    organizing_principle: '분야 말뭉치 전용 어휘',
    status: 'ready',
    requires_params: ['tags'],
    fit_rules: [{ kind: 'all_have_field', field: 'meaning_ko' }],
    weights: W_DEFAULT,
    build: (p) =>
      recipe({
        blueprint: 'domain-specialty',
        slug: p.slug ?? 'domain-medical',
        title: p.title ?? '의학 영어 (MOEL)',
        description: p.description ?? '해당 분야 문헌에 집중적으로 쓰이는 어휘.',
        emoji: p.cover_emoji ?? '🔬',
        category: 'themed',
        subcategory: 'domain',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B2', 'C1'],
        population: { kind: 'list', tags: p.tags ?? ['moel_1.0'], mode: 'any' },
        objective: { kind: 'all' },
        group_by: 'pos',
        group_order: 'size_desc',
        order_within: 'frequency',
        facets: ['recognize', 'use'],
      }),
  },
  {
    id: 'exam-items',
    family: 'list',
    taxon: 'A7',
    title: '기출 문항 기반',
    market_example: '수능 기출 문항유형별 어휘',
    organizing_principle: '실제 출제 문항에서 역산한 어휘 — 문항유형(번호)까지 가릴 수 있다',
    status: 'ready',
    requires_params: ['question_nos', 'frequency_tier_min'],
    fit_rules: [{ kind: 'all_have_field', field: 'meaning_ko' }],
    weights: W_DEFAULT,
    build: (p) =>
      recipe({
        blueprint: 'exam-items',
        slug: p.slug ?? 'kice-blank',
        title: p.title ?? '수능 빈칸추론 빈출',
        description: p.description ?? '해당 문항유형 기출에서 반복 등장한 어휘.',
        emoji: p.cover_emoji ?? '📝',
        category: 'csat',
        subcategory: 'exam_items',
        segment: p.segment ?? 'high_school',
        cefr: p.cefr_levels ?? ['B2'],
        population: {
          kind: 'exam_items',
          source_key: 'kice_csat',
          // legacy KICE 세트 4종이 모두 min_years 3 + question_nos 조합이었다 — 같은 조합을 유지한다.
          min_years: 3,
          question_nos: p.question_nos,
          frequency_tier_min: p.frequency_tier_min,
        },
        objective: { kind: 'all' },
        group_by: 'v_level',
        group_order: 'v_level',
        order_within: 'frequency',
        facets: ['recognize', 'use'],
      }),
  },
]

// ── B. structure-driven — 11종 ──────────────────────────────────────

const B: Blueprint[] = [
  {
    id: 'root-etymology',
    family: 'structure',
    taxon: 'B8',
    title: '어원·어근·접사',
    market_example: 'Word Power Made Easy · 어원편 보카',
    organizing_principle: '어근/접두·접미사 — 챕터가 어근 하나',
    status: 'ready',
    requires_params: [],
    fit_rules: [
      { kind: 'all_have_field', field: 'morphology' },
      { kind: 'all_grouped' },
      { kind: 'min_groups', n: 20 },
    ],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'root-etymology',
        slug: p.slug ?? 'etymology-core',
        title: p.title ?? '어원으로 익히는 핵심 영단어',
        description: p.description ?? '어근 하나가 챕터 하나. 한 조각을 알면 여러 단어가 함께 열린다.',
        emoji: p.cover_emoji ?? '🌱',
        category: 'etymology',
        subcategory: 'etymology',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2', 'C1'],
        population: { kind: 'roots', root_ids: p.root_ids },
        filters: { v_level_min: 3 as never, v_level_max: 11 as never },
        objective: { kind: 'count', n: p.count ?? 1500 },
        group_by: 'root',
        group_order: 'size_desc',
        group_cap: p.group_cap ?? 10,
        order_within: 'frequency',
        facets: ['recognize', 'build', 'use'],
        card_fields: ['meaning_ko', 'example_en', 'ipa'],
        group_label: 'root_gloss',
      }),
  },
  {
    id: 'word-family',
    family: 'structure',
    taxon: 'B9',
    title: '파생어 family',
    market_example: 'word family 보카 (nation/national/nationality)',
    organizing_principle: '한 기본형의 파생 형태를 한 카드로',
    status: 'partial',
    gap_note: 'base_word 7%(3,234) · derived_forms 31%(14,313) — 사전 전체로는 규모가 제한된다',
    requires_params: [],
    fit_rules: [
      { kind: 'all_have_field', field: 'morphology' },
      { kind: 'min_group_size', n: 2 },
    ],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'word-family',
        slug: p.slug ?? 'word-family-core',
        title: p.title ?? '파생어 한 묶음',
        description: p.description ?? '기본형과 그 파생형을 함께 본다. 접사가 뜻을 어떻게 바꾸는지 익힌다.',
        emoji: p.cover_emoji ?? '🧬',
        category: 'etymology',
        subcategory: 'family',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { require_fields: ['morphology'], v_level_min: 2 as never, v_level_max: 10 as never },
        objective: { kind: 'count', n: p.count ?? 600 },
        group_by: 'family',
        group_order: 'size_desc',
        order_within: 'frequency',
        // family 는 묶음이 곧 유형이다 — 기본형 하나만 남으면 파생어 단어장이 아니다.
        keep_pairs_together: true,
        min_group_size: 2,
        facets: ['recognize', 'build'],
      }),
  },
  {
    id: 'pos-focus',
    family: 'structure',
    taxon: 'B10',
    title: '품사별 집중',
    market_example: '동사만 · 형용사만 모은 보카',
    organizing_principle: '품사 — 약점 품사를 몰아서',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'min_groups', n: 1 }],
    weights: W_DEFAULT,
    build: (p) =>
      recipe({
        blueprint: 'pos-focus',
        slug: p.slug ?? 'pos-verbs',
        title: p.title ?? '동사 핵심 300',
        description: p.description ?? '문장의 뼈대가 되는 품사부터. 같은 품사끼리 모아 쓰임을 비교한다.',
        emoji: p.cover_emoji ?? '🧩',
        category: 'themed',
        subcategory: 'pos',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['A2', 'B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { primary_pos: ['verb'], freq_bands: ['top1k', 'top2k', 'top3k'] },
        objective: { kind: 'count', n: p.count ?? 300 },
        group_by: 'v_level',
        group_order: 'v_level',
        order_within: 'frequency',
        facets: ['recognize', 'use'],
      }),
  },
  {
    id: 'topic-field',
    family: 'structure',
    taxon: 'B11',
    title: '의미장·주제',
    market_example: '주제별 그림 보카 · 테마 어휘집',
    organizing_principle: '의미 분류 트리 (L1 테마 → L2 챕터)',
    status: 'ready',
    requires_params: ['themes'],
    fit_rules: [{ kind: 'all_grouped' }, { kind: 'min_groups', n: 3 }],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'topic-field',
        slug: p.slug ?? 'topic-travel',
        title: p.title ?? '여행 주제 어휘',
        description: p.description ?? '같은 장면에서 함께 쓰이는 말을 묶어 익힌다.',
        emoji: p.cover_emoji ?? '🗺',
        category: 'themed',
        subcategory: 'topic',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['A2', 'B1'],
        population: { kind: 'topics', themes: p.themes ?? ['여행'], rollup_level: 2 },
        filters: { v_level_min: 3 as never, v_level_max: 11 as never },
        objective: { kind: 'count', n: p.count ?? 500 },
        group_by: 'topic',
        group_order: 'size_desc',
        group_cap: p.group_cap ?? 150,
        order_within: 'frequency',
        facets: ['recognize', 'use'],
        group_label: 'topic_ko',
      }),
  },
  {
    id: 'synonym-cluster',
    family: 'structure',
    taxon: 'B12',
    title: '유의어 클러스터',
    market_example: '유의어 대조 보카 · thesaurus 어휘집',
    organizing_principle: '뜻이 겹치는 말끼리 — 차이를 비교하며',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'synonyms' }, { kind: 'min_group_size', n: 2 }],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'synonym-cluster',
        slug: p.slug ?? 'synonym-clusters',
        title: p.title ?? '비슷한 말 비교',
        description: p.description ?? '뜻이 겹치는 말을 나란히 놓고 어디가 다른지 본다.',
        emoji: p.cover_emoji ?? '🔗',
        category: 'themed',
        subcategory: 'synonym',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { require_fields: ['synonyms'], freq_bands: ['top1k', 'top2k', 'top3k', 'top5k'] },
        objective: { kind: 'count', n: p.count ?? 400 },
        group_by: 'synonym_cluster',
        group_order: 'size_desc',
        order_within: 'frequency',
        facets: ['recognize', 'use'],
        contrast: 'synonym',
        keep_pairs_together: true,
        min_group_size: 2,
      }),
  },
  {
    id: 'antonym-pair',
    family: 'structure',
    taxon: 'B13',
    title: '반의어 대조쌍',
    market_example: '반대말 보카',
    organizing_principle: '뜻이 맞서는 짝 — 함께 외우면 둘이 남는다',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'antonyms' }],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'antonym-pair',
        slug: p.slug ?? 'antonym-pairs',
        title: p.title ?? '반대말 짝',
        description: p.description ?? '맞서는 뜻을 짝으로 본다. 하나를 떠올리면 다른 하나가 함께 온다.',
        emoji: p.cover_emoji ?? '↔',
        category: 'themed',
        subcategory: 'antonym',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['A2', 'B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { require_fields: ['antonyms'], freq_bands: ['top1k', 'top2k', 'top3k'] },
        objective: { kind: 'count', n: p.count ?? 300 },
        group_by: 'pos',
        group_order: 'size_desc',
        order_within: 'frequency',
        facets: ['recognize', 'use'],
        contrast: 'antonym',
      }),
  },
  {
    id: 'confusable',
    family: 'structure',
    taxon: 'B14',
    title: '혼동어·유사철자',
    market_example: 'Confusing Words · 헷갈리는 단어 정리',
    organizing_principle: '철자·소리가 닮은 것끼리 — 짝으로만',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'all_grouped' }, { kind: 'min_group_size', n: 2 }],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'confusable',
        slug: p.slug ?? 'confusable-pairs',
        title: p.title ?? '헷갈리는 짝',
        description: p.description ?? '한 글자 차이로 뜻이 갈리는 말을 나란히 놓는다.',
        emoji: p.cover_emoji ?? '⚠',
        category: 'themed',
        subcategory: 'confusable',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['A2', 'B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { freq_bands: ['top1k', 'top2k', 'top3k'] },
        objective: { kind: 'count', n: p.count ?? 300 },
        group_by: 'confusable',
        group_order: 'size_desc',
        order_within: 'alpha',
        facets: ['recognize', 'spell'],
        contrast: 'confusable',
        keep_pairs_together: true,
        min_group_size: 2,
      }),
  },
  {
    id: 'collocation',
    family: 'structure',
    taxon: 'B15',
    title: '연어 중심',
    market_example: 'English Collocations in Use',
    organizing_principle: '함께 쓰이는 말 묶음 — 허브 낱말이 챕터',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'collocations' }, { kind: 'all_grouped' }],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'collocation',
        slug: p.slug ?? 'collocation-hubs',
        title: p.title ?? '함께 쓰는 말',
        description: p.description ?? '단어 하나가 아니라 묶음으로 외운다. 시험과 회화에서 그대로 쓰인다.',
        emoji: p.cover_emoji ?? '🤝',
        category: 'themed',
        subcategory: 'collocation',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { require_fields: ['collocations'] },
        objective: { kind: 'count', n: p.count ?? 400 },
        group_by: 'collocation_hub',
        group_order: 'size_desc',
        group_cap: p.group_cap ?? 20,
        order_within: 'frequency',
        facets: ['recognize', 'use'],
      }),
  },
  {
    id: 'phrasal-idiom',
    family: 'structure',
    taxon: 'B16',
    title: '구동사·관용어',
    market_example: 'Phrasal Verbs in Use · 관용어 모음',
    organizing_principle: '구 단위 표현 — 낱말로 쪼개면 뜻이 안 나오는 것들',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'example_en' }],
    weights: W_DEFAULT,
    build: (p) =>
      recipe({
        blueprint: 'phrasal-idiom',
        slug: p.slug ?? 'phrasal-idioms',
        title: p.title ?? '구동사와 관용어',
        description: p.description ?? '낱말 뜻을 합쳐도 안 나오는 표현. 예문 없이는 외워지지 않는다.',
        emoji: p.cover_emoji ?? '🗣',
        category: 'themed',
        subcategory: 'phrasal',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: {
          primary_pos: ['idiom', 'phrasal_verb'],
          exclude_registers: NOISE_REGISTERS.filter((r) => r !== 'phrase_unit'),
          // ⚠️ 한때 require_frequency_rank: true 였다. 사전식 변형 표제어를 막으려던 것인데
          // 순위 있는 구가 26개뿐이라 **세트가 10개로 쪼그라들었다**(실측). 변형 표제어는
          // exclude_variant_headwords 가 이미 막으므로(1,466 → 984 사용 가능) 하드 필터는 뺀다.
        },
        // 기본 90 — 연어(전형적 쓰임)를 갖춘 구가 94개다. 200개를 약속하면 절반이 '뜻만 있는 구' 가
        // 되어 구동사 책의 핵심 요소에서 진다. **데이터가 지탱하는 크기**로 약속을 맞춘다.
        objective: { kind: 'count', n: p.count ?? 90 },
        group_by: 'pos',
        group_order: 'size_desc',
        order_within: 'frequency',
        // 구동사 책이 파는 것은 전형적 쓰임이다 — 연어를 가진 항목을 챕터 안에서 앞세운다.
        prefer_fields: ['collocations', 'mnemonic_ko'],
        facets: ['recognize', 'use'],
      }),
  },
  {
    id: 'polysemy',
    family: 'structure',
    taxon: 'B17',
    title: '다의어',
    market_example: '다의어 정복 · 한 단어 여러 뜻',
    organizing_principle: '뜻 개수 — 아는 뜻 하나가 함정이 되는 단어들',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'senses_min', n: 2 }],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'polysemy',
        slug: p.slug ?? 'polysemy-core',
        title: p.title ?? '뜻이 여러 개인 단어',
        description: p.description ?? '아는 뜻 하나로 읽으면 문장이 어긋나는 단어들.',
        emoji: p.cover_emoji ?? '🔀',
        category: 'themed',
        subcategory: 'polysemy',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { require_fields: ['senses_multi'], freq_bands: ['top1k', 'top2k', 'top3k'] },
        objective: { kind: 'count', n: p.count ?? 300 },
        group_by: 'sense',
        group_order: 'source_order',
        order_within: 'sense_count',
        facets: ['recognize', 'use'],
        contrast: 'sense',
      }),
  },
  {
    id: 'rhyme-phonics',
    family: 'structure',
    taxon: 'B18',
    title: '라임·발음',
    market_example: 'phonics 카드 · 라임 단어집',
    organizing_principle: '끝소리가 같은 것끼리 — 소리로 묶는 목차',
    status: 'ready',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'rhyme_key' }, { kind: 'min_group_size', n: 2 }],
    weights: W_STRUCTURE,
    build: (p) =>
      recipe({
        blueprint: 'rhyme-phonics',
        slug: p.slug ?? 'rhyme-families',
        title: p.title ?? '소리가 닮은 말',
        description: p.description ?? '끝소리가 같은 말을 모아 소리 규칙을 몸에 익힌다.',
        emoji: p.cover_emoji ?? '🎵',
        category: 'themed',
        subcategory: 'phonics',
        segment: p.segment ?? 'elementary',
        cefr: p.cefr_levels ?? ['A1', 'A2'],
        population: { kind: 'dictionary' },
        filters: { require_fields: ['rhyme_key', 'ipa'], freq_bands: ['top1k', 'top2k'] },
        objective: { kind: 'count', n: p.count ?? 300 },
        group_by: 'rhyme',
        group_order: 'size_desc',
        order_within: 'alpha',
        // 라임은 같은 소리끼리 나란히 있어야 규칙이 보인다 — 혼자 있는 라임은 규칙을 못 만든다.
        keep_pairs_together: true,
        min_group_size: 2,
        facets: ['recognize', 'sound', 'spell'],
        card_fields: ['meaning_ko', 'ipa', 'example_en'],
      }),
  },
]

// ── C. corpus-driven — 4종 ──────────────────────────────────────────

const C: Blueprint[] = [
  {
    id: 'book-companion',
    family: 'corpus',
    taxon: 'C19',
    title: '원서 도서별',
    market_example: '"해리포터 단어장" 류 원서 부록',
    organizing_principle: '그 책에 나오는 단어 — 목차가 책 목차',
    status: 'ready',
    requires_params: ['book_id'],
    fit_rules: [{ kind: 'has_corpus_sentence' }, { kind: 'all_grouped' }],
    weights: { ...W_DEFAULT, fill: 0.3, organize: 0.2, novelty: 0.05, level_fit: 0.1 },
    build: (p) =>
      recipe({
        blueprint: 'book-companion',
        slug: p.slug ?? 'book-companion',
        title: p.title ?? '이 책의 단어장',
        description: p.description ?? '이 책에 실제로 나오는 단어만. 예문은 그 책의 문장이다.',
        emoji: p.cover_emoji ?? '📖',
        category: 'themed', // 학습자 카탈로그 9 카테고리에 'library_book' 이 없다 — themed 로 노출하고 출처는 curation_query.source_book_id 로 남긴다
        subcategory: 'companion',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'corpus', scope: 'book', ids: p.book_id ? [p.book_id] : [] },
        filters: { min_corpus_freq: 2 },
        objective: { kind: 'count', n: p.count ?? 500 },
        group_by: 'source_chapter',
        group_order: 'source_order',
        order_within: 'unlock_yield',
        facets: ['recognize', 'use'],
        group_label: 'chapter_title',
      }),
  },
  {
    id: 'chapter-companion',
    family: 'corpus',
    taxon: 'C20',
    title: '챕터별 부록',
    market_example: '리더스 챕터 단어 목록',
    organizing_principle: '읽는 범위 — 오늘 읽을 챕터의 단어만',
    status: 'ready',
    requires_params: ['book_id', 'chapter_from', 'chapter_to'],
    fit_rules: [{ kind: 'has_corpus_sentence' }],
    weights: { ...W_DEFAULT, fill: 0.3, novelty: 0.05 },
    build: (p) =>
      recipe({
        blueprint: 'chapter-companion',
        slug: p.slug ?? 'chapter-companion',
        title: p.title ?? '이 챕터의 단어',
        description: p.description ?? '지금 읽을 범위에만 집중한다. 읽기 직전 10분용.',
        emoji: p.cover_emoji ?? '🔖',
        category: 'themed',
        subcategory: 'chapter',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1'],
        population: {
          kind: 'corpus',
          scope: 'chapter_range',
          ids: p.book_id ? [p.book_id] : [],
          chapter_from: p.chapter_from ?? 1,
          chapter_to: p.chapter_to ?? 3,
        },
        objective: { kind: 'count', n: p.count ?? 60 },
        group_by: 'source_chapter',
        group_order: 'source_order',
        order_within: 'unlock_yield',
        facets: ['recognize', 'use'],
        group_label: 'chapter_title',
      }),
  },
  {
    id: 'news-article',
    family: 'corpus',
    taxon: 'C21',
    title: '시사·기사별',
    market_example: '뉴스 영어 단어장',
    organizing_principle: '그 기사에 나온 단어 — 오늘 읽은 것에서',
    status: 'ready',
    requires_params: ['text_ids'],
    fit_rules: [{ kind: 'has_corpus_sentence' }],
    weights: { ...W_DEFAULT, fill: 0.3, novelty: 0.05 },
    build: (p) =>
      recipe({
        blueprint: 'news-article',
        slug: p.slug ?? 'news-article-set',
        title: p.title ?? '오늘 기사 단어장',
        description: p.description ?? '읽은 기사에서 나온 단어. 맥락이 아직 머리에 남아 있을 때.',
        emoji: p.cover_emoji ?? '📰',
        category: 'themed',
        subcategory: 'article',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'corpus', scope: 'article', ids: p.text_ids ?? [] },
        objective: { kind: 'count', n: p.count ?? 40 },
        group_by: 'none',
        order_within: 'unlock_yield',
        facets: ['recognize', 'use'],
      }),
  },
  {
    id: 'script-media',
    family: 'corpus',
    taxon: 'C22',
    title: '영상·스크립트',
    market_example: '미드·영화 영어 단어장',
    organizing_principle: '스크립트 대사에 나온 단어',
    status: 'partial',
    gap_note: 'texts 275건은 사용자 입력 본문 — 영상 스크립트 전용 코퍼스는 별도 수집 과제',
    requires_params: ['text_ids'],
    fit_rules: [{ kind: 'has_corpus_sentence' }],
    weights: { ...W_DEFAULT, fill: 0.3, novelty: 0.05 },
    build: (p) =>
      recipe({
        blueprint: 'script-media',
        slug: p.slug ?? 'script-media-set',
        title: p.title ?? '스크립트 단어장',
        description: p.description ?? '대사에 나온 말만. 들으면서 확인할 수 있는 것부터.',
        emoji: p.cover_emoji ?? '🎬',
        category: 'themed',
        subcategory: 'script',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1'],
        population: { kind: 'corpus', scope: 'text', ids: p.text_ids ?? [] },
        objective: { kind: 'count', n: p.count ?? 60 },
        group_by: 'none',
        order_within: 'unlock_yield',
        facets: ['recognize', 'use', 'sound'],
      }),
  },
]

// ── D. delivery-driven — 4종 ────────────────────────────────────────

const D: Blueprint[] = [
  {
    id: 'day-pacing',
    family: 'delivery',
    taxon: 'D23',
    title: 'N일 완성 페이싱',
    market_example: '30일 완성 · 하루 20단어 보카',
    organizing_principle: '학습 일정 — 목차가 날짜',
    status: 'ready',
    requires_params: ['days', 'per_day'],
    fit_rules: [{ kind: 'min_groups', n: 5 }, { kind: 'all_grouped' }],
    weights: { ...W_DEFAULT, organize: 0.25, novelty: 0.05, level_fit: 0.1 },
    build: (p) => {
      const days = p.days ?? 30
      const perDay = p.per_day ?? 20
      return recipe({
        blueprint: 'day-pacing',
        slug: p.slug ?? `day-${days}-plan`,
        title: p.title ?? `${days}일 완성 (하루 ${perDay}개)`,
        description: p.description ?? '하루치가 눈에 보이는 분량으로 잘려 있다. 오늘 것만 하면 된다.',
        emoji: p.cover_emoji ?? '📅',
        category: 'themed',
        subcategory: 'pacing',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['A2', 'B1'],
        population: { kind: 'list', tags: p.tags ?? ['ngsl_1.2'], mode: 'any' },
        filters: { freq_bands: ['top1k', 'top2k'] },
        objective: { kind: 'count', n: days * perDay },
        group_by: 'day',
        group_order: 'source_order',
        order_within: 'frequency',
        pacing: { days, per_day: perDay },
        facets: ['recognize', 'spell'],
        group_label: 'day_number',
      })
    },
  },
  {
    id: 'mnemonic-story',
    family: 'delivery',
    taxon: 'D24',
    title: '연상·스토리',
    market_example: '해마학습법 · 연상 암기 보카',
    organizing_principle: '연상 장치가 있는 단어만',
    status: 'partial',
    gap_note: 'mnemonic_ko 11%(5,062) — 규모가 5천 선에서 막힌다',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'mnemonic_ko' }],
    weights: { ...W_DEFAULT, fill: 0.35, value: 0.05, level_fit: 0.1 },
    build: (p) =>
      recipe({
        blueprint: 'mnemonic-story',
        slug: p.slug ?? 'mnemonic-core',
        title: p.title ?? '연상으로 외우는 단어',
        description: p.description ?? '소리·모양에서 이야기를 만들어 붙인 단어들.',
        emoji: p.cover_emoji ?? '💡',
        category: 'themed',
        subcategory: 'mnemonic',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: { require_fields: ['mnemonic_ko'] },
        objective: { kind: 'count', n: p.count ?? 500 },
        group_by: 'v_level',
        group_order: 'v_level',
        order_within: 'frequency',
        facets: ['recognize', 'spell'],
        card_fields: ['meaning_ko', 'mnemonic_ko', 'example_en'],
      }),
  },
  {
    id: 'picture-dict',
    family: 'delivery',
    taxon: 'D25',
    title: '그림 단어장',
    market_example: 'picture dictionary · 시각 연상 보카',
    organizing_principle: '그림 — 뜻을 글로 읽지 않고 본다',
    status: 'asset_gap',
    gap_note: 'image_url 0% (45,688행 전부 NULL) — 설계로 못 메운다. 이미지 자산 수집이 선행 과제',
    requires_params: [],
    fit_rules: [{ kind: 'all_have_field', field: 'image_url' }],
    weights: { ...W_DEFAULT, fill: 0.4, noise: 0.1, novelty: 0.05, level_fit: 0.1 },
    build: (p) =>
      recipe({
        blueprint: 'picture-dict',
        slug: p.slug ?? 'picture-basic',
        title: p.title ?? '그림으로 보는 기초 단어',
        description: p.description ?? '한국어를 거치지 않고 그림에서 바로 뜻으로.',
        emoji: p.cover_emoji ?? '🖼',
        category: 'themed',
        subcategory: 'picture',
        segment: p.segment ?? 'elementary',
        cefr: p.cefr_levels ?? ['A1', 'A2'],
        population: { kind: 'topics', themes: p.themes ?? ['동물'], rollup_level: 2 },
        filters: { require_fields: ['image_url'] },
        objective: { kind: 'count', n: p.count ?? 200 },
        group_by: 'topic',
        group_order: 'size_desc',
        order_within: 'frequency',
        facets: ['recognize'],
        card_fields: ['image_url', 'meaning_ko'],
        group_label: 'topic_ko',
      }),
  },
  {
    id: 'audio-only',
    family: 'delivery',
    taxon: 'D26',
    title: '오디오 단어장',
    market_example: '듣기 전용 보카 · 흘려듣기 mp3',
    organizing_principle: '소리 — 화면을 보지 않고 듣는다',
    status: 'partial',
    gap_note:
      'audio_url 0% (45,688행 전부 NULL) — 재생은 런타임 TTS 로 성립한다(WordVault 흘려듣기 큐가 이미 그렇게 돈다). 없는 것은 **녹음본**이고, 그래서 (1) 오프라인 다운로드 (2) 원어민 억양 두 가지가 빠진다. 평가기는 이 세트의 Sound 면을 fallback(0.7) 로 계산한다',
    requires_params: [],
    fit_rules: [{ kind: 'audio_playable' }],
    weights: { ...W_DEFAULT, fill: 0.4, noise: 0.1, novelty: 0.05, level_fit: 0.1 },
    build: (p) =>
      recipe({
        blueprint: 'audio-only',
        slug: p.slug ?? 'audio-core',
        title: p.title ?? '듣는 단어장',
        description: p.description ?? '화면 없이 듣기만으로 복습한다.',
        emoji: p.cover_emoji ?? '🎧',
        category: 'themed',
        subcategory: 'audio',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['A2', 'B1'],
        population: { kind: 'list', tags: p.tags ?? ['ngsl_spoken_1.2'], mode: 'any' },
        // 녹음본을 요구하면 후보가 0 이 된다. IPA 는 `recipe()` 가 이미 필수로 넣으므로
        // 여기서는 **말할 수 있는 항목** 만 남기면 된다 — 예문이 있으면 문장 흘려듣기도 된다.
        filters: {},
        objective: { kind: 'count', n: p.count ?? (p.days ?? 15) * (p.per_day ?? 20) },
        // 목차가 **듣기 세션**이다. mp3 보카는 트랙 하나가 통짜라 "어디까지 들었는지" 를
        // 사람이 기억해야 한다 — 회차로 잘라 두면 이동 시간 한 번에 한 회차가 끝난다.
        group_by: 'day',
        group_order: 'source_order',
        order_within: 'frequency',
        pacing: { days: p.days ?? 15, per_day: p.per_day ?? 20 },
        facets: ['sound', 'recognize'],
        prefer_fields: ['audio_url', 'example_en'],
        card_fields: ['meaning_ko', 'ipa', 'example_en'],
        group_label: 'day_number',
      }),
  },
]

// ── U. 이 플랫폼만 만들 수 있는 유형 — 4종 ──────────────────────────

const U: Blueprint[] = [
  {
    id: 'unlock',
    family: 'unique',
    taxon: 'U1',
    title: '콘텐츠 해금 최적',
    market_example: '(지면 불가) — 인쇄 시점에 학습자의 기지 어휘를 알 수 없다',
    organizing_principle:
      '이 책을 읽으려면 무엇부터 — 문장이 완전히 읽히게 되는 순서로. 아는 단어는 차감한다',
    status: 'ready',
    // coverage_target 은 선택 — 주면 개수 대신 "이 책의 몇 %" 가 멈춤 조건이 된다.
    requires_params: ['book_id', 'coverage_target'],
    fit_rules: [
      { kind: 'has_corpus_sentence' },
      { kind: 'beats_baseline', metric: 'sentence_unlock' },
    ],
    weights: W_UNIQUE,
    build: (p) =>
      recipe({
        blueprint: 'unlock',
        slug: p.slug ?? 'unlock-book',
        title: p.title ?? '이 책 해금 단어장',
        description:
          p.description ??
          '이 책의 문장이 가장 빨리 읽히게 되는 순서. 이미 아는 단어는 빼고, 남은 조각부터 채운다.',
        emoji: p.cover_emoji ?? '🔓',
        category: 'themed',
        subcategory: 'unlock',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'corpus', scope: 'book', ids: p.book_id ? [p.book_id] : [] },
        // 커버리지 목표를 주면 "몇 개" 대신 "이 책의 몇 %" 로 지시한다 — 학습자가 실제로
        // 원하는 형태이고, 필요한 단어 수는 책마다 다르므로 개수로는 표현할 수 없다.
        objective:
          p.coverage_target != null
            ? { kind: 'coverage', target: p.coverage_target, max_words: p.count ?? 2000 }
            : { kind: 'count', n: p.count ?? 300 },
        group_by: 'none',
        order_within: 'unlock_yield',
        facets: ['recognize', 'use'],
        subtract_known_for: p.user_id ?? null,
      }),
  },
  {
    id: 'recycle',
    family: 'unique',
    taxon: 'U2',
    title: '재등장 우선 (narrow reading)',
    market_example: '(지면 불가) — 앞으로 몇 번 더 나오는지는 그 책의 챕터 분포를 알아야 나온다',
    organizing_principle:
      '배운 직후 다시 만나는 단어부터 — 노출 8회를 인공 반복이 아니라 읽기로 채운다',
    status: 'ready',
    requires_params: ['book_id', 'chapter_from'],
    fit_rules: [
      { kind: 'has_corpus_sentence' },
      { kind: 'beats_baseline', metric: 'future_encounters' },
    ],
    weights: W_UNIQUE,
    build: (p) =>
      recipe({
        blueprint: 'recycle',
        slug: p.slug ?? 'recycle-book',
        title: p.title ?? '다시 만날 단어부터',
        description:
          p.description ??
          '앞으로 읽을 챕터에 다시 나오는 단어부터. 외운 다음에 책이 대신 복습해 준다.',
        emoji: p.cover_emoji ?? '♻',
        category: 'themed',
        subcategory: 'recycle',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1'],
        population: {
          kind: 'corpus',
          scope: 'chapter_range',
          ids: p.book_id ? [p.book_id] : [],
          chapter_from: p.chapter_from ?? 1,
          chapter_to: p.chapter_to ?? 5,
        },
        objective: { kind: 'count', n: p.count ?? 80 },
        group_by: 'source_chapter',
        group_order: 'source_order',
        order_within: 'recycle_soon',
        facets: ['recognize', 'use'],
        group_label: 'chapter_title',
      }),
  },
  {
    id: 'facet-ladder',
    family: 'unique',
    taxon: 'U3',
    title: '6면 보장 단어장',
    market_example: '(지면 불가) — 지면은 재인(F1) 하나만 지원한다',
    organizing_principle:
      '각 항목이 어느 면까지 실제로 훈련 가능한지 데이터로 검증된 것만 — 선언이 곧 보장',
    status: 'ready',
    requires_params: [],
    fit_rules: [
      { kind: 'all_have_field', field: 'example_en' },
      { kind: 'all_have_field', field: 'morphology' },
      { kind: 'all_have_field', field: 'ipa' },
    ],
    weights: W_UNIQUE,
    build: (p) =>
      recipe({
        blueprint: 'facet-ladder',
        slug: p.slug ?? 'facet-ladder-core',
        title: p.title ?? '여섯 면이 다 열리는 단어',
        description:
          p.description ??
          '뜻·철자·소리·조립·문맥·속도 여섯 면을 전부 연습할 수 있는 단어만 모았다. 한 단어를 끝까지 데려간다.',
        emoji: p.cover_emoji ?? '🪜',
        category: 'themed',
        subcategory: 'facet',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? ['B1', 'B2'],
        population: { kind: 'dictionary' },
        filters: {
          require_fields: ['example_en', 'ipa', 'morphology'],
          freq_bands: ['top1k', 'top2k', 'top3k', 'top5k'],
        },
        objective: { kind: 'count', n: p.count ?? 300 },
        group_by: 'v_level',
        group_order: 'v_level',
        order_within: 'frequency',
        facets: ['recognize', 'spell', 'sound', 'build', 'use', 'fluency'],
        card_fields: ['meaning_ko', 'example_en', 'ipa', 'collocations'],
      }),
  },
  {
    id: 'confusion-log',
    family: 'unique',
    taxon: 'U4',
    title: '실오답 기반 혼동 세트',
    market_example: '(지면 불가) — 오답은 인쇄 후에 생긴다',
    organizing_principle: '이 학습자가 실제로 틀린 짝 — 남의 함정이 아니라 내 함정',
    status: 'data_gate',
    gap_note:
      'dev 환경 학습 기록이 얕다 (vocabularies hot 4건). 오답 로그가 쌓이면 파라미터 없이 자동 활성',
    requires_params: ['user_id'],
    fit_rules: [{ kind: 'min_group_size', n: 2 }],
    weights: W_UNIQUE,
    build: (p) =>
      recipe({
        blueprint: 'confusion-log',
        slug: p.slug ?? 'confusion-mine',
        title: p.title ?? '내가 헷갈린 짝',
        description: p.description ?? '실제로 틀린 단어와 그때 고른 단어를 나란히 놓는다.',
        emoji: p.cover_emoji ?? '🔁',
        category: 'themed',
        subcategory: 'confusion',
        segment: p.segment ?? 'general',
        cefr: p.cefr_levels ?? [],
        population: { kind: 'learner', user_id: p.user_id ?? '', state: 'risk' },
        objective: { kind: 'count', n: p.count ?? 100 },
        group_by: 'confusable',
        group_order: 'size_desc',
        order_within: 'alpha',
        facets: ['recognize', 'spell'],
        contrast: 'confusable',
        keep_pairs_together: true,
        min_group_size: 2,
      }),
  },
]

const U5: Blueprint = {
  id: 'uncovered',
  family: 'unique',
  taxon: 'U5',
  title: '미수록 어휘',
  market_example: '(지면 불가) — 우리 카탈로그가 이미 무엇을 덮고 있는지는 우리만 안다',
  organizing_principle:
    '기존 발행 세트 전체를 빼고 남은 것 — 같은 단어를 다섯 번째로 다시 내지 않기 위해',
  status: 'ready',
  requires_params: [],
  fit_rules: [{ kind: 'all_have_field', field: 'meaning_ko' }, { kind: 'min_groups', n: 2 }],
  // 이 유형의 존재 이유가 신규성이므로 novelty 를 가장 무겁게 둔다.
  weights: {
    fill: 0.15,
    level_fit: 0.1,
    noise: 0.15,
    novelty: 0.3,
    organize: 0.1,
    blueprint_fit: 0.1,
    value: 0.1,
  },
  build: (p) =>
    recipe({
      blueprint: 'uncovered',
      slug: p.slug ?? 'uncovered-core',
      title: p.title ?? '아직 어느 단어장에도 없는 말',
      description:
        p.description ?? '이미 발행된 단어장 전체를 빼고 남은 어휘. 카탈로그의 빈칸을 메운다.',
      emoji: p.cover_emoji ?? '🕳',
      category: 'themed',
      subcategory: 'uncovered',
      segment: p.segment ?? 'general',
      cefr: p.cefr_levels ?? ['B1', 'B2', 'C1'],
      population: {
        kind: 'except',
        of: [
          { kind: 'dictionary' },
          { kind: 'published' },
        ],
      },
      filters: {
        v_level_min: (p.v_level_min ?? 3) as never,
        v_level_max: (p.v_level_max ?? 10) as never,
        freq_bands: ['top1k', 'top2k', 'top3k', 'top5k', 'top10k'],
      },
      objective: { kind: 'count', n: p.count ?? 400 },
      group_by: 'v_level',
      group_order: 'v_level',
      order_within: 'frequency',
      facets: ['recognize', 'use'],
    }),
}

export const BLUEPRINTS: Blueprint[] = [...A, ...B, ...C, ...D, ...U, U5]

export const BLUEPRINT_BY_ID = new Map(BLUEPRINTS.map((b) => [b.id, b]))

export function getBlueprint(id: string): Blueprint | null {
  return BLUEPRINT_BY_ID.get(id) ?? null
}

/** 카탈로그 요약 — 어드민 갤러리와 평가 리포트가 같은 수치를 읽는다. */
export function catalogSummary(): {
  total: number
  by_status: Record<Blueprint['status'], number>
  by_family: Record<Blueprint['family'], number>
  buildable: number
} {
  const byStatus = { ready: 0, partial: 0, asset_gap: 0, data_gate: 0 }
  const byFamily = { list: 0, structure: 0, corpus: 0, delivery: 0, unique: 0 }
  for (const b of BLUEPRINTS) {
    byStatus[b.status] += 1
    byFamily[b.family] += 1
  }
  return {
    total: BLUEPRINTS.length,
    by_status: byStatus,
    by_family: byFamily,
    buildable: byStatus.ready + byStatus.partial,
  }
}
