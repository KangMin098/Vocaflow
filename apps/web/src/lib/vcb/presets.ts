// apps/web/src/lib/vcb/presets.ts
// 9 프리셋 카탈로그 + custom — 사용자 페르소나별 빠른 진입.
// 각 프리셋은 Step 2 필터를 prefill 하고, slug/title 추천도 제공.
// shared_dictionary 실측 분포 정합 (정찰 결과).

import type { Segment, Cefr } from './types'
import type { VocabFilters, VocabLimits, TagMatchMode } from './filters'

export interface PresetVariant {
  id: string
  label: string
  hint: string // "1,200 단어 예상" 같은 추정
  filters: VocabFilters
  limits: VocabLimits
  slug_suggestion: string
  title_suggestion: string
  target_segment: Segment
  target_cefr_range: Cefr[]
}

export interface VcbPreset {
  id: string
  emoji: string
  title: string
  description: string
  persona: string // "중학생", "고교생", "TOEIC 준비" 등
  accent: string // CSS color
  variants: PresetVariant[]
}

const f = (
  partial: Partial<VocabFilters>,
): VocabFilters => ({
  v_level_min: null,
  v_level_max: null,
  cefr_levels: [],
  list_tags: [],
  list_tags_mode: 'any' as TagMatchMode,
  freq_bands: [],
  primary_pos: [],
  verified_only: false,
  ...partial,
})

const l = (max: number | null, sort: VocabLimits['sort_by'] = 'frequency_rank'): VocabLimits => ({
  max_words: max,
  sort_by: sort,
})

// ── 9 프리셋 ──────────────────────────────────────
export const VCB_PRESETS: VcbPreset[] = [
  {
    id: 'v-level-tier',
    emoji: '📚',
    title: '레벨별 V-Level',
    description: '진단 V-Level 기반 자기 레벨 단어장. Krashen i+1 학습 최적.',
    persona: '진단 완료 사용자',
    accent: '#8B5CF6',
    variants: [
      {
        id: 'v-level-tier-beginner',
        label: '초보 (V1-V3)',
        hint: '약 2,800단어 풀 → 상위 500',
        filters: f({ v_level_min: 1, v_level_max: 3, verified_only: true }),
        limits: l(500),
        slug_suggestion: 'v-level-beginner-v1-v3',
        title_suggestion: '레벨 입문 (V1-V3)',
        target_segment: 'middle_school',
        target_cefr_range: ['A1', 'A2'],
      },
      {
        id: 'v-level-tier-intermediate',
        label: '중급 (V4-V7)',
        hint: '약 7,300단어 풀 → 상위 800',
        filters: f({ v_level_min: 4, v_level_max: 7, verified_only: true }),
        limits: l(800),
        slug_suggestion: 'v-level-intermediate-v4-v7',
        title_suggestion: '레벨 중급 (V4-V7)',
        target_segment: 'high_school',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'v-level-tier-advanced',
        label: '고급 (V8-V10)',
        hint: '약 13,900단어 풀 → 상위 1,000',
        filters: f({ v_level_min: 8, v_level_max: 10, verified_only: true }),
        limits: l(1000),
        slug_suggestion: 'v-level-advanced-v8-v10',
        title_suggestion: '레벨 고급 (V8-V10)',
        target_segment: 'general',
        target_cefr_range: ['C1', 'C2'],
      },
    ],
  },
  {
    id: 'csat-core',
    emoji: '🎯',
    title: '수능 코어',
    description: '수능 빈출 핵심 어휘. 한국 고교 수능 직전 학습자 최적.',
    persona: '고3 · 수능 준비',
    accent: '#F59E0B',
    variants: [
      {
        id: 'csat-core-essential',
        label: '필수 2,000 (CSAT Core)',
        hint: '약 1,838단어 (csat-prep-core-2k)',
        filters: f({ list_tags: ['csat-prep-core-2k'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'csat-core-essential-2k',
        title_suggestion: '수능 필수 2,000',
        target_segment: 'high_school',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'csat-core-extended',
        label: '확장 1,800 (CSAT Ext)',
        hint: '약 1,097단어 (csat-prep-ext-1.8k)',
        filters: f({ list_tags: ['csat-prep-ext-1.8k'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'csat-extension-1-8k',
        title_suggestion: '수능 확장 1,800',
        target_segment: 'high_school',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'csat-core-combined',
        label: '코어 + 확장 (3,800)',
        hint: '약 2,935단어 통합',
        filters: f({
          list_tags: ['csat-prep-core-2k', 'csat-prep-ext-1.8k'],
          list_tags_mode: 'any',
          verified_only: true,
        }),
        limits: l(null),
        slug_suggestion: 'csat-combined-3-8k',
        title_suggestion: '수능 전체 (코어+확장)',
        target_segment: 'high_school',
        target_cefr_range: ['B1', 'B2'],
      },
    ],
  },
  {
    id: 'ngsl-frequency',
    emoji: '📊',
    title: 'NGSL 빈도',
    description: '국제 영어 빈도 기반. 가장 자주 만나는 단어부터.',
    persona: '범용 · 효율 우선',
    accent: '#3B82F6',
    variants: [
      {
        id: 'ngsl-top-1k',
        label: '최빈출 1,000',
        hint: '약 1,285단어 (top1k)',
        filters: f({ freq_bands: ['top1k'], list_tags: ['ngsl_1.2'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'ngsl-top-1k',
        title_suggestion: 'NGSL 최빈출 1,000',
        target_segment: 'general',
        target_cefr_range: ['A1', 'A2', 'B1'],
      },
      {
        id: 'ngsl-top-2k',
        label: '빈출 2,000',
        hint: '약 999단어 (top2k)',
        filters: f({ freq_bands: ['top2k'], list_tags: ['ngsl_1.2'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'ngsl-top-2k',
        title_suggestion: 'NGSL 빈출 2,000',
        target_segment: 'general',
        target_cefr_range: ['A2', 'B1'],
      },
      {
        id: 'ngsl-top-3k',
        label: '빈출 3,000',
        hint: '약 1,455단어 (top3k)',
        filters: f({ freq_bands: ['top3k'], list_tags: ['ngsl_1.2'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'ngsl-top-3k',
        title_suggestion: 'NGSL 빈출 3,000',
        target_segment: 'general',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'ngsl-conversation',
        label: '회화 우선 (Spoken)',
        hint: '약 675단어 (ngsl_spoken)',
        filters: f({ list_tags: ['ngsl_spoken_1.2'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'ngsl-spoken-conversation',
        title_suggestion: 'NGSL 회화 우선',
        target_segment: 'general',
        target_cefr_range: ['A2', 'B1'],
      },
    ],
  },
  {
    id: 'toeic-business',
    emoji: '💼',
    title: 'TOEIC · 비즈니스',
    description: '비즈니스 영어 + TOEIC 빈출. 직장인·취준생 최적.',
    persona: 'TOEIC · 직장',
    accent: '#0EA5E9',
    variants: [
      {
        id: 'toeic-bsl-full',
        label: 'BSL 전체 1,100',
        hint: '약 1,093단어 (bsl_1.20)',
        filters: f({ list_tags: ['bsl_1.20'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'toeic-bsl-essential',
        title_suggestion: 'TOEIC 비즈니스 핵심',
        target_segment: 'toeic',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'toeic-bsl-top',
        label: 'BSL 상위 500',
        hint: '빈도 상위 500',
        filters: f({ list_tags: ['bsl_1.20'], list_tags_mode: 'any', verified_only: true }),
        limits: l(500, 'frequency_rank'),
        slug_suggestion: 'toeic-bsl-top-500',
        title_suggestion: 'TOEIC 비즈니스 Top 500',
        target_segment: 'toeic',
        target_cefr_range: ['B1', 'B2'],
      },
    ],
  },
  {
    id: 'academic-nawl',
    emoji: '🎓',
    title: '학술 어휘 NAWL',
    description: 'New Academic Word List. 편입·유학·논문 최적.',
    persona: '학술 · 편입 · 유학',
    accent: '#10B981',
    variants: [
      {
        id: 'academic-nawl-full',
        label: 'NAWL 전체 630',
        hint: '약 633단어 (nawl_1.2)',
        filters: f({ list_tags: ['nawl_1.2'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'academic-nawl-essential',
        title_suggestion: '학술 어휘 NAWL',
        target_segment: 'academic',
        target_cefr_range: ['B2', 'C1'],
      },
      {
        id: 'academic-nawl-advanced',
        label: 'NAWL + V8 이상',
        hint: '학술 + 고급 (정밀 필터)',
        filters: f({
          list_tags: ['nawl_1.2'],
          list_tags_mode: 'any',
          v_level_min: 8,
          v_level_max: 11,
          verified_only: true,
        }),
        limits: l(null),
        slug_suggestion: 'academic-nawl-advanced',
        title_suggestion: '학술 고급 (NAWL + V8+)',
        target_segment: 'academic',
        target_cefr_range: ['C1', 'C2'],
      },
    ],
  },
  {
    id: 'theme-specialty',
    emoji: '🔬',
    title: '테마 전문',
    description: '의학·문학·금융·뉴스·여행 전문 단어장.',
    persona: '전문 분야',
    accent: '#A855F7',
    variants: [
      {
        id: 'theme-medical',
        label: '🩺 의학 (MOEL)',
        hint: '약 466단어',
        filters: f({ list_tags: ['moel_1.0'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'theme-medical-moel',
        title_suggestion: '의학 영어 (MOEL)',
        target_segment: 'general',
        target_cefr_range: ['B2', 'C1'],
      },
      {
        id: 'theme-literary',
        label: '📖 문학 (BEL)',
        hint: '약 656단어',
        filters: f({ list_tags: ['bel_1.0'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'theme-literary-bel',
        title_suggestion: '문학 영어 (BEL)',
        target_segment: 'general',
        target_cefr_range: ['B2', 'C1'],
      },
      {
        id: 'theme-financial',
        label: '💰 금융 (FEL)',
        hint: '약 416단어',
        filters: f({ list_tags: ['fel_1.2'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'theme-financial-fel',
        title_suggestion: '금융 영어 (FEL)',
        target_segment: 'business',
        target_cefr_range: ['B2', 'C1'],
      },
      {
        id: 'theme-news',
        label: '📰 뉴스 (NDL)',
        hint: '약 889단어',
        filters: f({ list_tags: ['ndl_1.1'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'theme-news-ndl',
        title_suggestion: '뉴스 영어 (NDL)',
        target_segment: 'general',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'theme-travel',
        label: '✈ 여행 (TSL)',
        hint: '약 887단어',
        filters: f({ list_tags: ['tsl_1.2'], list_tags_mode: 'any', verified_only: true }),
        limits: l(null),
        slug_suggestion: 'theme-travel-tsl',
        title_suggestion: '여행 영어 (TSL)',
        target_segment: 'general',
        target_cefr_range: ['A2', 'B1'],
      },
    ],
  },
  {
    id: 'conversation-boost',
    emoji: '🗣',
    title: '회화 보강',
    description: '관용어·구동사 — 실전 회화의 약점 보완.',
    persona: '회화 · 시험 보완',
    accent: '#EC4899',
    variants: [
      {
        id: 'conv-idioms',
        label: '관용어 (idiom)',
        hint: '약 991단어',
        filters: f({ primary_pos: ['idiom'], verified_only: true }),
        limits: l(300),
        slug_suggestion: 'conversation-idioms',
        title_suggestion: '회화 관용어',
        target_segment: 'general',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'conv-phrasal',
        label: '구동사 (phrasal verbs)',
        hint: '약 460단어',
        filters: f({ primary_pos: ['phrasal_verb'], verified_only: true }),
        limits: l(300),
        slug_suggestion: 'conversation-phrasal-verbs',
        title_suggestion: '회화 구동사',
        target_segment: 'general',
        target_cefr_range: ['B1', 'B2'],
      },
      {
        id: 'conv-both',
        label: '관용어 + 구동사',
        hint: '약 1,451단어',
        filters: f({ primary_pos: ['idiom', 'phrasal_verb'], verified_only: true }),
        limits: l(500),
        slug_suggestion: 'conversation-idioms-phrasal',
        title_suggestion: '회화 관용 + 구동사',
        target_segment: 'general',
        target_cefr_range: ['B1', 'B2'],
      },
    ],
  },
  {
    id: 'pos-focus',
    emoji: '🧩',
    title: '품사별 학습',
    description: '동사·명사·형용사 약점 분야 집중.',
    persona: '약점 보완',
    accent: '#F97316',
    variants: [
      {
        id: 'pos-verbs',
        label: '동사 중심',
        hint: '약 3,997단어 → 상위 300',
        filters: f({ primary_pos: ['verb'], freq_bands: ['top1k', 'top2k', 'top3k'], verified_only: true }),
        limits: l(300),
        slug_suggestion: 'pos-verbs-essential',
        title_suggestion: '동사 핵심 300',
        target_segment: 'general',
        target_cefr_range: ['A2', 'B1', 'B2'],
      },
      {
        id: 'pos-nouns',
        label: '명사 중심',
        hint: '약 25,510단어 → 상위 500',
        filters: f({ primary_pos: ['noun'], freq_bands: ['top1k', 'top2k', 'top3k'], verified_only: true }),
        limits: l(500),
        slug_suggestion: 'pos-nouns-essential',
        title_suggestion: '명사 핵심 500',
        target_segment: 'general',
        target_cefr_range: ['A2', 'B1', 'B2'],
      },
      {
        id: 'pos-adjectives',
        label: '형용사 중심',
        hint: '약 6,459단어 → 상위 300',
        filters: f({ primary_pos: ['adjective'], freq_bands: ['top1k', 'top2k', 'top3k'], verified_only: true }),
        limits: l(300),
        slug_suggestion: 'pos-adjectives-essential',
        title_suggestion: '형용사 핵심 300',
        target_segment: 'general',
        target_cefr_range: ['A2', 'B1', 'B2'],
      },
    ],
  },
  {
    id: 'civil-service',
    emoji: '🏛',
    title: '공무원 시험',
    description: '9급·7급 영어 빈출. 한국 공무원 시험 최적.',
    persona: '공무원 준비',
    accent: '#6366F1',
    variants: [
      {
        id: 'civil-essential',
        label: '공무원 필수 (V5-V8)',
        hint: 'V5-V8 + 빈도 top5k',
        filters: f({
          v_level_min: 5,
          v_level_max: 8,
          freq_bands: ['top3k', 'top5k'],
          verified_only: true,
        }),
        limits: l(600),
        slug_suggestion: 'civil-service-essential',
        title_suggestion: '공무원 영어 필수',
        target_segment: 'civil_service',
        target_cefr_range: ['B1', 'B2'],
      },
    ],
  },
]

export const CUSTOM_PRESET_ID = '__custom__'

export function findVariant(presetId: string, variantId: string): PresetVariant | null {
  const preset = VCB_PRESETS.find((p) => p.id === presetId)
  if (!preset) return null
  return preset.variants.find((v) => v.id === variantId) ?? null
}
