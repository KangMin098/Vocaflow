// packages/library-pipeline/src/textbook/academic-reading.ts
import { z } from 'zod'
import { GRADE_BANDS } from '../compose/spine'

export const READING_ENGINE_VERSION = 1
export const READING_SKILLS = {
  R0: 'Fluency',
  R1: 'Vocabulary in Context',
  R2: 'Sentence Meaning',
  R3: 'Relation',
  R4: 'Main Idea',
  R5: 'Function',
  R6: 'Structure',
  R7: 'Paraphrase',
  R8: 'Inference',
  R9: 'Evidence',
  R10: 'Argument',
  R11: 'Multi-text',
  R12: 'Data Integration',
  R13: 'Timed Judgment',
} as const
const skillIds = [
  'R0',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
  'R9',
  'R10',
  'R11',
  'R12',
  'R13',
] as const
export type ReadingSkill = keyof typeof READING_SKILLS
export const AGE_BANDS = [
  'upper_elementary',
  'middle_1',
  'middle_2',
  'middle_3',
  'high_1',
  'high_2',
  'high_3',
] as const
export type ReadingAgeBand = (typeof AGE_BANDS)[number]
export const READING_PROGRESSION: Record<
  ReadingAgeBand,
  { label: string; skills: ReadingSkill[]; series: string; goal: string }
> = {
  upper_elementary: {
    label: '초등 고학년',
    skills: ['R0', 'R1', 'R2', 'R3', 'R4'],
    series: 'Foundation Reading',
    goal: '정보 처리와 문장 의미',
  },
  middle_1: {
    label: '중1',
    skills: ['R1', 'R2', 'R3', 'R4'],
    series: 'Bridge Reading',
    goal: '문장 사이의 관계',
  },
  middle_2: {
    label: '중2',
    skills: ['R2', 'R3', 'R4', 'R5'],
    series: 'Bridge Reading',
    goal: '문단 중심내용과 문장 기능',
  },
  middle_3: {
    label: '중3',
    skills: ['R3', 'R4', 'R5', 'R6', 'R7'],
    series: 'Academic Reading Starter',
    goal: '구조와 paraphrase',
  },
  high_1: {
    label: '고1',
    skills: ['R3', 'R4', 'R5', 'R6', 'R7', 'R8'],
    series: 'Academic Reading I',
    goal: '학술 문장과 담화',
  },
  high_2: {
    label: '고2',
    skills: ['R5', 'R6', 'R7', 'R8', 'R9', 'R10'],
    series: 'Academic Reading II',
    goal: '추론·근거·논증',
  },
  high_3: {
    label: '고3',
    skills: ['R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13'],
    series: 'CSAT Academic Reading',
    goal: '압축된 학술 추론과 시간 내 판단',
  },
}
export const READING_SERIES = [
  'Foundation Reading',
  'Bridge Reading',
  'Academic Reading Starter',
  'Academic Reading I',
  'Academic Reading II',
  'CSAT Academic Reading',
  'Advanced Reading',
] as const
export const PRODUCT_FAMILIES = {
  P01: {
    name: 'AI Multi-Level Reader',
    skills: ['R2', 'R4'],
    instruction: '같은 원문의 핵심 명제를 유지하면서 언어 수준을 바꾼다.',
  },
  P02: {
    name: 'Narrative Reading',
    skills: ['R2', 'R3'],
    instruction: '인물·사건·시간순서·원인과 결과를 읽는다.',
  },
  P03: {
    name: 'Knowledge Reader',
    skills: ['R2', 'R4'],
    instruction: '공개기관의 설명문에서 정보를 이해하고 요약한다.',
  },
  P04: {
    name: 'Science/Social/History Reader',
    skills: ['R3', 'R4'],
    instruction: '교과 개념을 영어로 읽되 전문지식 시험을 만들지 않는다.',
  },
  P05: {
    name: 'Vocabulary-in-Context',
    skills: ['R1'],
    instruction: '문맥 속 의미와 대체 표현을 근거와 연결한다.',
  },
  P06: {
    name: 'Academic Sentence Reading',
    skills: ['R2', 'R7'],
    instruction: '긴 주어·명사화·관계절·분사·삽입·병렬을 의미 이해로 다룬다.',
  },
  P07: {
    name: 'Main Idea Reading',
    skills: ['R4'],
    instruction: '중심 명제와 이를 지지하는 정보를 구분한다.',
  },
  P08: {
    name: 'Structure Reading',
    skills: ['R5', 'R6'],
    instruction: '문장 기능과 글 전체의 전개를 연결한다.',
  },
  P09: {
    name: 'Relation Reading',
    skills: ['R3'],
    instruction: '동일·예시·인과·대조·시간·문제 해결·일반 구체 관계를 명시한다.',
  },
  P10: {
    name: 'Inference Reading',
    skills: ['R8'],
    instruction: '본문 근거로 성립하는 추론과 가능성만 있는 추측을 구분한다.',
  },
  P11: { name: 'Evidence Reading', skills: ['R9'], instruction: '모든 정답에 본문 근거를 붙인다.' },
  P12: {
    name: 'Argument & Critical Reading',
    skills: ['R10'],
    instruction: '주장·근거·가정·반론·결론을 분석한다.',
  },
  P13: {
    name: 'Comparative Reading',
    skills: ['R11'],
    instruction: '제공된 두 글을 비교한다. 두 번째 글을 지어내지 않는다.',
  },
  P14: {
    name: 'Text + Data Reading',
    skills: ['R12'],
    instruction: '제공된 표·그래프의 실제 수치와 본문을 통합한다.',
  },
  P15: {
    name: 'Current Issues Reader',
    skills: ['R3', 'R9'],
    instruction: '사실·의견을 구분하고 발행일과 정보의 시점을 유지한다.',
  },
  P16: {
    name: 'Knowledge Builder',
    skills: ['R2', 'R4'],
    instruction: '배경 설명을 명시하고 원문에 없는 사실은 출처를 붙인다.',
  },
  P17: {
    name: 'Exam Bridge',
    skills: ['R7', 'R8', 'R9'],
    instruction: '시험 능력 구조만 참고하고 지문과 문제는 독자 생성한다.',
  },
  P18: {
    name: 'KICE Academic Reading',
    skills: ['R6', 'R7', 'R8', 'R13'],
    instruction: '짧고 압축된 담화·paraphrase·오답 왜곡·시간 내 판단을 다룬다.',
  },
  P19: {
    name: 'Reading Intervention',
    skills: ['R1', 'R2'],
    instruction: '현재 어려운 언어 요소를 줄이고 한 번에 하나의 능력을 연습한다.',
  },
  P20: {
    name: 'Advanced Academic/LSAT Bridge',
    skills: ['R8', 'R10', 'R11'],
    instruction: '고밀도 논증과 비교 추론을 다루되 시험 원문을 복제하지 않는다.',
  },
} as const
const familyIds = [
  'P01',
  'P02',
  'P03',
  'P04',
  'P05',
  'P06',
  'P07',
  'P08',
  'P09',
  'P10',
  'P11',
  'P12',
  'P13',
  'P14',
  'P15',
  'P16',
  'P17',
  'P18',
  'P19',
  'P20',
] as const
export const SOURCE_ROLES = [
  'generation',
  'age_anchor',
  'benchmark',
  'discovery',
  'restricted',
] as const
export type ReadingSourceRole = (typeof SOURCE_ROLES)[number]
const anchors = new Set([
  'storyweaver',
  'african_storybook',
  'gdl',
  'global_storybooks',
  'space_place',
  'frym',
  'eia_kids',
])
const discovery = new Set(['openalex', 'europe_pmc', 'doaj', 'econstor'])
const benchmark = new Set([
  'kice',
  'newsela',
  'readworks',
  'commonlit',
  'openstax',
  'the_conversation',
  'psat',
  'sat',
  'act',
  'toefl',
  'lsat',
])
const generation = new Set([
  'nih_news_in_health',
  'nih',
  'futurity',
  'nasa',
  'noaa',
  'usgs',
  'nist',
  'voa',
  'global_voices',
  'plos',
  'frontiers',
  'elife',
  'olh',
  'scielo',
  'bls',
  'nps',
])
export function readingSourceRole(source: string): ReadingSourceRole {
  if (anchors.has(source)) return 'age_anchor'
  if (discovery.has(source)) return 'discovery'
  if (benchmark.has(source)) return 'benchmark'
  return generation.has(source) ? 'generation' : 'restricted'
}
// 사용자 설계 목표다. 코퍼스 실측 또는 KICE 분포로 표시하지 않는다.
export const DOMAIN_TARGET_MIX = {
  natural_science: 18,
  technology_engineering: 10,
  health_biology: 12,
  environment: 10,
  psychology: 10,
  economics: 8,
  sociology_anthropology: 8,
  history: 8,
  philosophy_ideas: 6,
  art_culture_language: 6,
  general_other: 4,
} as const
export const SOURCE_SCORE_WEIGHTS = {
  license_suitability: 15,
  language_quality: 10,
  content_reliability: 10,
  age_adaptability: 10,
  academic_value: 10,
  discourse_richness: 10,
  paraphrase_potential: 10,
  question_generation_potential: 10,
  background_knowledge_value: 5,
  domain_balance_contribution: 5,
  csat_relevance: 5,
} as const
export const SOURCE_PRIORITIES = {
  upper_elementary: [
    'space_place',
    'eia_kids',
    'storyweaver',
    'african_storybook',
    'frym',
    'gdl',
    'global_storybooks',
  ],
  middle_1: ['frym', 'nasa', 'usgs', 'eia_kids', 'nih_news_in_health', 'voa', 'storyweaver'],
  middle_2: ['frym', 'nih_news_in_health', 'nasa', 'usgs', 'noaa', 'eia_kids', 'futurity'],
  middle_3: [
    'frym',
    'nih_news_in_health',
    'futurity',
    'nasa',
    'noaa',
    'usgs',
    'nist',
    'voa',
    'global_voices',
  ],
  high_1: [
    'futurity',
    'nih_news_in_health',
    'nasa',
    'noaa',
    'usgs',
    'nist',
    'frym',
    'plos',
    'frontiers',
    'elife',
  ],
  high_2: [
    'futurity',
    'plos',
    'frontiers',
    'elife',
    'olh',
    'noaa',
    'nasa',
    'nist',
    'usgs',
    'nih_news_in_health',
    'bls',
    'nps',
  ],
  high_3: [
    'plos',
    'frontiers',
    'elife',
    'futurity',
    'olh',
    'nasa',
    'noaa',
    'nist',
    'usgs',
    'nih_news_in_health',
    'bls',
    'nps',
  ],
} as const
const url = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//.test(v), 'HTTP(S) URL required')
const resource = z
  .object({
    kind: z.enum(['text', 'data']),
    canonical_source: z
      .string()
      .refine(
        (s) => ['generation', 'age_anchor'].includes(readingSourceRole(s)),
        'resource must be a generation source'
      ),
    canonical_url: url,
    content: z.string().min(20),
    license_evidence: z.string().min(20),
    license: z.string().min(3),
    license_url: url,
    commercial_use: z.literal(true),
    derivative_use: z.literal(true),
    ai_processing: z.literal('allowed'),
    third_party_text: z.literal(false),
    share_alike: z.boolean(),
    attribution: z.string().min(8),
    checked_at: z.string().datetime({ offset: true }),
  })
  .strict()
export const readingTargetSchema = z
  .object({
    family: z.enum(familyIds),
    age_band: z.enum(AGE_BANDS),
    language_band: z.enum(['elementary', 'middle', 'high', 'exam']),
    reasoning_band: z.enum(AGE_BANDS),
    passage_v_level: z.number().int().min(0).max(11),
    skills: z
      .array(z.enum(skillIds))
      .min(1)
      .refine((v) => new Set(v).size === v.length, 'duplicate skills'),
    exam: z.enum(['none', 'psat_8_9', 'sat', 'act', 'toefl', 'csat', 'lsat']),
    words: z
      .object({ min: z.number().int().positive(), max: z.number().int().positive() })
      .strict(),
    share_alike: z.boolean(),
    resources: z.array(resource).default([]),
  })
  .strict()
  .superRefine((t, ctx) => {
    const band = GRADE_BANDS[t.language_band]
    if (t.passage_v_level < band.vRange.min || t.passage_v_level > band.vRange.max)
      ctx.addIssue({ code: 'custom', message: 'passage_v_level is outside language_band' })
    if (t.words.min > t.words.max) ctx.addIssue({ code: 'custom', message: 'invalid word window' })
    if (!t.share_alike && t.resources.some((r) => r.share_alike))
      ctx.addIssue({ code: 'custom', message: 'resource requires share-alike delivery' })
    if (!PRODUCT_FAMILIES[t.family].skills.some((s) => t.skills.includes(s)))
      ctx.addIssue({
        code: 'custom',
        message: 'family requires at least one of its reading skills',
      })
    if (
      (t.family === 'P13' || t.skills.includes('R11')) &&
      !t.resources.some((r) => r.kind === 'text')
    )
      ctx.addIssue({ code: 'custom', message: 'multi-text requires a licensed second text' })
    if (
      (t.family === 'P14' || t.skills.includes('R12')) &&
      !t.resources.some((r) => r.kind === 'data')
    )
      ctx.addIssue({ code: 'custom', message: 'data integration requires licensed data' })
    if (t.skills.includes('R13') && t.exam === 'none')
      ctx.addIssue({ code: 'custom', message: 'timed judgment requires an exam target' })
  })
export type ReadingTarget = z.infer<typeof readingTargetSchema>

export const articleLicenseSchema = z
  .object({
    canonical_source: z.string().min(1),
    canonical_url: url,
    original_author: z.string().min(1),
    published_at: z.string().nullable(),
    license: z.string().min(1),
    license_url: url,
    commercial_use: z.boolean(),
    derivative_use: z.boolean(),
    ai_processing: z.enum(['allowed', 'unknown', 'restricted']),
    third_party_text: z.boolean(),
    third_party_image: z.boolean(),
    attribution_required: z.boolean(),
    share_alike: z.boolean(),
    original_work_id: z.string().nullable(),
    discovered_via: z.string().nullable(),
    checked_at: z.string().datetime({ offset: true }),
    evidence: z.string().min(20),
  })
  .strict()
export type ArticleLicense = z.infer<typeof articleLicenseSchema>
export function readingLicenseBlockers(rights: ArticleLicense, target: ReadingTarget): string[] {
  const blockers: string[] = []
  const role = readingSourceRole(rights.canonical_source)
  if (role !== 'generation' && role !== 'age_anchor') blockers.push(`source role: ${role}`)
  if (!rights.commercial_use || !rights.derivative_use)
    blockers.push('commercial adaptation not allowed')
  if (rights.ai_processing !== 'allowed') blockers.push(`AI processing ${rights.ai_processing}`)
  if (rights.third_party_text) blockers.push('third-party text requires separate clearance')
  if (rights.share_alike && !target.share_alike) blockers.push('share-alike delivery is missing')
  return blockers
}
export function readingDirectives(target: ReadingTarget): string[] {
  return [
    PRODUCT_FAMILIES[target.family].instruction,
    `독자 ${READING_PROGRESSION[target.age_band].label}; 언어 ${target.language_band}/V${target.passage_v_level}; 사고 ${READING_PROGRESSION[target.reasoning_band].label}. 세 축을 혼동하지 않는다.`,
    `독해 능력: ${target.skills.map((s) => `${s} ${READING_SKILLS[s]}`).join(', ')}.`,
    '원문의 명제·인과·한정 표현을 유지한다. 추가한 배경 설명은 원문 사실과 구분한다.',
    '열 가지 난이도 축을 근거와 함께 분석한다. passage_level과 item_reasoning_level을 별도로 기록한다.',
    '모든 문항은 실제 각색 본문에서 찾을 수 있는 근거를 제시한다. 근거 없는 문항을 만들지 않는다.',
    'R0는 읽기 활동, R13은 제한시간과 판단 활동을 설계한다. 실제 수행 측정 전 유창성·속도를 달성했다고 쓰지 않는다.',
    '자료·다지문은 제공된 자료만 쓴다. 원문의 권리와 추가 자료의 권리를 각각 확인한다.',
    'age_appropriateness는 어휘가 아니라 소재·발달 적합성을 판단한다. FYM 연구 쌍은 실제 DOI/URL 증거가 있을 때만 연결한다.',
  ]
}
