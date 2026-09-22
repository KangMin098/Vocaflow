// apps/web/src/lib/csat/__tests__/fixtures.ts
//
// **공장 화면들의 공용 표본.**
//
// 왜 한곳에 모으나: 같은 모양의 가짜 데이터를 렌더 테스트마다 따로 적어 두면, 타입이 바뀔 때
// 세 군데를 고쳐야 하고 한 군데를 빠뜨리면 그 화면만 낡은 모양으로 검사된다. 그리고 밀집도
// 하네스(`density.test.tsx`)는 **모든 화면을 같은 표본으로** 재야 화면끼리 비교가 성립한다.
//
// ⚠️ 이 파일은 테스트 파일이 아니다(`*.test.ts` 아님) — vitest 가 수집하지 않는다.

import type { BenchPublisher } from '../factory-bench'
import type { BlueprintView, MarketView } from '../factory-lab-model'
import type { AuthorView, PressView, ReviewView } from '../factory-line-model'
// `import type` 이라 런타임에 사라진다 — `source-console.ts` 의 `server-only` 가 안 끌려온다.
import type { ReviewDefectView } from '../review-defects-model'
import type { SourceConsoleView } from '../source-console'
import type { KidSourcePanel } from '@/lib/textbook/kid-source-stats'
import { FACTORY_STAGES, type StageState } from '../factory-model'
import {
  NOT_MAKING,
  SERIES_STEPS,
  type SeriesCatalogView,
  type SeriesRow,
  type VolumeStatus,
} from '../series-model'

/** 공정 한 칸 — 실측에 가까운 모양으로. */
export function stageFixture(
  id: string,
  status: StageState['status'],
  gauges: StageState['gauges'] = [],
  blocker: string | null = null,
): StageState {
  const def = FACTORY_STAGES.find((s) => s.id === id)!
  return {
    def,
    status,
    gauges,
    blocker,
    nextCommands: [
      { cmd: `node scripts/csat/${id}.mjs --limit 6`, why: `${def.name} 남은 몫`, writes: true },
      { cmd: `Claude Code: ${def.name} 청크를 채운다`, why: '배치가 채운다', claudeCode: true },
    ],
  }
}

/** 2026-09-05 실측을 그대로 옮긴 8칸. 화면이 "실제로 보게 되는 모양" 이어야 밀집도가 의미 있다. */
export const STAGES_REAL: StageState[] = [
  stageFixture('evidence', 'pass', [
    { label: '독해 실점 0 회차', num: 29, den: 29, unit: 'ratio' },
  ]),
  stageFixture(
    'market',
    'short',
    [
      { label: '구속 출판사 지수 (EBS)', num: 1.199, den: null, unit: 'index', target: 1.2 },
      { label: '합본 지수', num: 1.424, den: null, unit: 'index', target: 1.2 },
    ],
    '구속점은 EBS 1.199 — 합본 평균이 이걸 감춘다',
  ),
  stageFixture('blueprint', 'pass', [
    { label: '사다리가 선언한 유형 중 생산 가능', num: 10, den: 10, unit: 'ratio' },
    { label: '단계 게이트 임계 (S1~S5)', num: 5, den: 5, unit: 'ratio' },
  ]),
  stageFixture(
    'source',
    'short',
    [
      { label: '게이트가 있는 밴드 중 지문 보유', num: 4, den: 5, unit: 'ratio' },
      { label: '지문 재고', num: 616, den: null, unit: 'count' },
    ],
    'S5 밴드에 지문이 0편 — 그 단계 책은 지금 못 만든다',
  ),
  stageFixture('author', 'pass', [
    { label: '사다리 칸 중 재고 있음', num: 26, den: 26, unit: 'ratio' },
    {
      label: '저장 문항 (추정)',
      num: 654390,
      den: null,
      unit: 'count',
      approx: true,
      unmeasuredReason: '플래너 통계값이다 — 정확한 수는 집필 화면이 칸을 더해서 낸다',
    },
  ]),
  stageFixture(
    'explain',
    'unmeasured',
    [
      {
        label: '해설 보유',
        num: null,
        den: null,
        unit: 'ratio',
        target: 1,
        unmeasuredReason:
          'PostgREST 가 이 표를 전수로 못 센다 — 집계 RPC 승인 후에 잰다',
      },
    ],
    '해설 보유율을 못 잰다 — 집계 RPC 가 붙기 전까지는 이 칸이 통과인지 아닌지 알 수 없다',
  ),
  stageFixture(
    'review',
    'short',
    [
      { label: 'L1 기계 게이트 — 조판 교정 기록', num: 7, den: 7, unit: 'ratio', target: 1 },
      // 실측 2026-09-16 의 모양 — 조판된 권의 교재 문항을 센다(기출 802/802 가 아니다).
      { label: 'L2 3인 페르소나 — 조판된 권의 교재 문항', num: 4, den: 408, unit: 'ratio', target: 1 },
      { label: 'L3 교차 대조 — 정답 번호 쏠림 검정', num: 7, den: 7, unit: 'ratio', target: 1 },
      { label: 'L4 외부 대조 — 시중 대비 잰 축', num: 10, den: 28, unit: 'ratio', target: 1 },
    ],
    '층이 하나라도 비면 그 책은 검수를 받은 것이 아니다',
  ),
  stageFixture('press', 'pass', [
    { label: '조판된 계단', num: 7, den: 7, unit: 'ratio', target: 1 },
  ]),
]

const publisher = (o: Partial<BenchPublisher>): BenchPublisher => ({
  publisher: 'EBS',
  docs: 3,
  pages: 698,
  overallIndex: 1.199,
  reachableMax: 1.199,
  targetReachable: false,
  axesMeasured: 2,
  axesTotal: 7,
  gaps: ['해설 축 A1~A4'],
  axes: [
    {
      id: 'A1',
      name: '해설 보유율',
      ours: 1,
      market: 1,
      unit: '%',
      why: '해설이 없으면 혼자 공부할 수 없다',
      index: null,
      ceiling: null,
      insufficient: '이 코퍼스에 해당 출판사의 정답해설 문서가 0건',
    },
    {
      id: 'A6',
      name: '지문 어수 규격 적합률',
      ours: 1,
      market: 0.8,
      unit: '%',
      why: '학년대별 지문 길이',
      index: 1.25,
      ceiling: 1.25,
      insufficient: null,
    },
  ],
  ...o,
})

export const MARKET_REAL: MarketView = {
  warehouse: null,
  volume: {
    generatedAt: '2026-09-01T07:33:23.059Z',
    scope: '사다리 7권 — 70단원 · 420문항',
    bindingPublisher: 'EBS',
    bindingIndex: 1.199,
    pooledIndex: 1.424,
    publishers: [
      publisher({}),
      publisher({
        publisher: 'NE능률',
        docs: 60,
        pages: 3486,
        overallIndex: 1.343,
        reachableMax: 1.391,
        targetReachable: true,
        gaps: [],
      }),
    ],
  },
  benchAgeDays: 5,
  target: 1.2,
  platform: { itemAttempts: 1, renderedVolumes: 7, itemAttemptsError: null },
  loadError: null,
}

export const BLUEPRINT_REAL: BlueprintView = {
  rungs: [
    {
      step: 1,
      schoolBand: '초등 저학년',
      vLevels: [1],
      volumeTitle: 'Vocaflow Reading Starter',
      rationale: '소리·낱말 단위. 지문이 없다.',
      cells: [
        { type: 'rhyme', typeKo: '파닉스 운율', countable: false, count: null },
        { type: 'word_meaning', typeKo: '낱말 뜻', countable: false, count: null },
        { type: 'spell_blank', typeKo: '철자 완성', countable: false, count: null },
      ],
      emptyTypes: [],
    },
    {
      step: 5,
      schoolBand: '고1',
      vLevels: [5],
      volumeTitle: 'Vocaflow Reading 4',
      rationale: '학평 대응. 순서·삽입이 여기서 열린다.',
      cells: [
        { type: 'vocab_choice', typeKo: '어휘', countable: true, count: 4525 },
        { type: 'grammar_choice', typeKo: '어법', countable: true, count: 1256 },
        { type: 'order', typeKo: '순서', countable: true, count: 4807 },
        { type: 'insert', typeKo: '삽입', countable: true, count: 5999 },
      ],
      emptyTypes: [],
    },
  ],
  gates: [
    { stage: 'S1', metric: 'coverage', threshold: 0.98, isLocked: false, note: '입문 다독' },
    { stage: 'S2', metric: 'wpm', threshold: 130, isLocked: true, note: null },
  ],
  typeAxis: [
    { type: 'rhyme', typeKo: '파닉스 운율', countable: false },
    { type: 'word_meaning', typeKo: '낱말 뜻', countable: false },
    { type: 'spell_blank', typeKo: '철자 완성', countable: false },
    { type: 'vocab_choice', typeKo: '어휘', countable: true },
    { type: 'grammar_choice', typeKo: '어법', countable: true },
    { type: 'order', typeKo: '순서', countable: true },
    { type: 'insert', typeKo: '삽입', countable: true },
  ],
  loadError: null,
}

/**
 * ④ 소재 — **스냅샷 콘솔** 표본.
 *
 * 2026-09-15 에 `SOURCE_REAL`(발행분 뷰 기반)을 갈아 치웠다. 옛 표본은 562편을 「지문 재고」로
 * 세던 화면의 모양이라, 그대로 두면 **없어진 결함을 계속 검사**하게 된다.
 * 수치는 2026-09-13 실측의 축약이다 — 밴드 합과 `pool.n`(87,556)이 서로 맞아야 한다.
 */
export const SOURCE_CONSOLE_REAL: SourceConsoleView = {
  takenAt: '2026-09-13T12:20:00.000Z',
  takenBy: 'cron',
  durationMs: 2586,
  prevTakenAt: '2026-09-13T06:20:00.000Z',
  rollup: {
    v: 1,
    rows: 108953,
    byStatus: { ready: 87376, archived: 20385, queued: 937, published: 250, failed: 4 },
    pool: { n: 87556, inMarket: 10338, inRepo: 9627, wcMedian: 727.5 },
    feeds: [],
    sources: [
      {
        src: 'plos',
        n: 47939,
        queued: 0,
        ready: 45081,
        published: 15,
        archived: 2843,
        failed: 0,
        dio: 0,
        lics: ['cc_by'],
      },
    ],
    licenses: [],
    vlevels: [
      { v: 2, n: 1200, wcMed: 140, inMarket: 900, inRepo: 700 },
      { v: 4, n: 8400, wcMed: 190, inMarket: 3100, inRepo: 2600 },
      { v: 6, n: 31000, wcMed: 520, inMarket: 3600, inRepo: 3300 },
      { v: 8, n: 46956, wcMed: 880, inMarket: 2738, inRepo: 3027 },
    ],
    registers: [],
    cefrs: [],
    topics: [],
    purposes: [],
    blockedBy: [],
    codes: [],
    verdicts: [],
    judges: [],
  },
  delta: {
    rows: 312,
    pool: 290,
    inMarket: 41,
    byStatus: { ready: 290, queued: 22 },
    sources: [
      { src: 'plos', d: 298 },
      { src: 'nist', d: 14 },
    ],
  },
  gates: [],
  bands: [
    { band: 'S1', gated: true, audioOnly: false, n: 1200, inMarket: 900, inRepo: 700 },
    { band: 'S2', gated: true, audioOnly: false, n: 8400, inMarket: 3100, inRepo: 2600 },
    { band: 'S3', gated: true, audioOnly: false, n: 31000, inMarket: 3600, inRepo: 3300 },
    { band: 'S4', gated: true, audioOnly: false, n: 46956, inMarket: 2738, inRepo: 3027 },
    { band: 'S5', gated: false, audioOnly: true, n: 0, inMarket: 0, inRepo: 0 },
  ],
  emptyBands: [],
  audioBands: ['S5'],
  segments: [],
  targets: [
    {
      key: 'kid:elem34',
      label: '초3~4',
      scope: 'kid',
      held: 2400,
      quarantined: 40,
      publishable: 2360,
      unjudged: 1900,
      goal: 3120,
      pct: 0.756,
      left: 760,
      mode: 'ratio_of_pool',
      basisLabel: 'V5~V9 재고 31,200 × 0.1',
      note: null,
    },
    {
      key: 'kid:adapted',
      label: '각색 (칸 밖 경로)',
      scope: 'kid',
      held: 260,
      quarantined: 0,
      publishable: 260,
      unjudged: 0,
      goal: 200,
      pct: 1.3,
      left: 0,
      mode: 'fixed',
      basisLabel: null,
      note: null,
    },
  ],
  registry: [],
  audit: {
    unregistered: [
      { src: 'frontiers', n: 1961 },
      { src: 'europe_pmc', n: 1300 },
      { src: 'nist', n: 23 },
    ],
    empty: [],
    licenseMismatch: [],
  },
  published: { articles: 250, books: 312 },
  errors: [],
}

export const AUTHOR_REAL: AuthorView = {
  cells: [
    { type: 'order', vLevel: 5, count: 4807 },
    { type: 'order', vLevel: 6, count: 66315 },
    { type: 'order', vLevel: 9, count: 3 },
    { type: 'insert', vLevel: 6, count: 90767 },
    { type: 'title', vLevel: 5, count: 17 },
    { type: 'blank_word', vLevel: 7, count: 91474 },
    { type: 'vocab_choice', vLevel: 7, count: null },
  ],
  total: null,
  ladderCells: [
    { type: 'order', vLevel: 5 },
    { type: 'order', vLevel: 6 },
    { type: 'insert', vLevel: 6 },
  ],
  loadError: null,
  inventoryAt: null,
}

export const REVIEW_REAL: ReviewView = {
  layers: [
    {
      id: 'L1',
      name: '기계 게이트',
      looksAt: '인용이 지문에 문자 그대로 있는가 · 정답이 평가원 정답표와 같은가 · 순환논법 8종',
      passed: 7,
      total: 7,
      unmeasuredReason: null,
      cmd: 'node scripts/csat/analysis-drain-validate.mjs',
    },
    {
      id: 'L2',
      name: '3인 페르소나',
      looksAt: '출제자 · 오답분석가 · 현장강사가 각자 읽고 전원 pass 를 줬는가',
      passed: 802,
      total: 802,
      unmeasuredReason: null,
      cmd: 'node scripts/csat/analysis-drain-import.mjs --commit',
    },
    {
      id: 'L3',
      name: '교차 대조',
      looksAt: '정답 번호가 한쪽으로 쏠렸는가 · 지문 규격',
      passed: 3,
      total: 7,
      unmeasuredReason: null,
      cmd: 'pnpm dlx tsx scripts/textbook/item-health-report.mjs',
    },
    {
      id: 'L4',
      name: '외부 대조',
      looksAt: '시중 교재 7축과 견줘 실제로 이기는가',
      passed: null,
      total: null,
      unmeasuredReason: '기획 화면이 재는 축이다',
      cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/market-benchmark.mjs --per-publisher',
    },
  ],
  volumes: [
    {
      band: 6,
      volumeTitle: 'Vocaflow Reading 5',
      items: 60,
      autoPassed: 5,
      autoTotal: 6,
      failedChecks: ['지문 규격'],
      answerBias: { chi2: 3.2, cramersV: 0.04, biased: false },
      proofread: { passages: 20, defective: 0 },
      // 쟀고, 셋이 봤지만 통과가 아닌 문항이 있다 — 「덜 봤다」와 구별돼야 한다.
      personaReview: { quorum: 3, items: 60, passed: 41, settled: 47 },
      passageSpec: '90~200어',
    },
    {
      band: 2,
      volumeTitle: 'Vocaflow Reading 1',
      items: 60,
      autoPassed: 6,
      autoTotal: 6,
      failedChecks: [],
      answerBias: null,
      proofread: null,
      // 옛 조판 기록 — 이 눈금이 붙기 전에 찍힌 권이다. 0 이 아니라 못 잼이다.
      personaReview: null,
      passageSpec: null,
    },
  ],
  loadError: null,
}

export const PRESS_REAL: PressView = {
  volumes: [
    {
      band: 6,
      series: 'reading',
      // 사람이 발행 판정을 내린 권 — 사유 없이 approved 는 없다(승인은 사유가 필요 없다).
      publish: { status: 'published', reason: null, at: '2026-09-02T00:00:00Z', by: 'claude' },
      personaBlocked: 0,
      autoPassed: 10,
      autoTotal: 10,
      reach: { href: '/library/textbooks/reading/6', hasContents: true },
      volumeTitle: 'Vocaflow Reading 5',
      step: 6,
      schoolBand: '고2',
      units: 20,
      items: 60,
      missingExplanations: 0,
      typeMixFit: 0.91,
      distinctVolumes: 12,
      articlesWithItems: 1757,
      articlesIdle: 8235,
      brandCurrent: true,
      renderCount: 3,
      renderedAt: '2026-09-01T00:00:00Z',
      outPath: 'volume-v6.html',
    },
    {
      band: 1,
      series: 'vocab',
      // 아무도 판정한 적이 없다 — 'rendered' 로 채우면 「사람이 rendered 라 판정했다」가 된다.
      publish: null,
      personaBlocked: null,
      // 자동 검사가 **안 돌았다** — 0/0 은 「통과」가 아니라 「못 잼」이다.
      autoPassed: 0,
      autoTotal: 0,
      reach: { href: '/library/textbooks/vocab/1', hasContents: false },
      volumeTitle: 'Vocaflow Reading Starter',
      step: 1,
      schoolBand: '초등 저학년',
      units: 20,
      items: 60,
      missingExplanations: 4,
      typeMixFit: null,
      distinctVolumes: null,
      articlesWithItems: null,
      articlesIdle: null,
      brandCurrent: false,
      renderCount: 1,
      renderedAt: null,
      outPath: null,
    },
  ],
  rungs: 7,
  brandFingerprint: 'abcdef0123456789',
  brand: {
    rows: [
      { key: 'ink', label: '본문 잉크', light: '#1A1714', dark: '#F0EAE0' },
      { key: 'rule', label: '괘선 — 표·구분선', light: '#E0DBD0', dark: '#3D362D' },
    ],
    fonts: { english: 'Lora, serif', body: 'DM Sans, sans-serif', mono: 'JetBrains Mono, monospace' },
  },
  loadError: null,
}

/* ── 카탈로그 ─────────────────────────────────────────────────── */

/**
 * 카탈로그 표본 — **시리즈 × 학령**(2026-09-06 축 변경).
 *
 * 값은 실측에서 왔다: 독해 7단 전부 조판됨 · 어휘·구문 각 6단이 재고를 채웠지만 한 번도
 * 안 찍힘. 「초등 저학년」 칸은 어휘·구문에 단이 없다(`noRung`) — 빈칸이지 결함이 아니다.
 */
function seriesRow(
  id: SeriesRow['id'],
  brand: string,
  accent: string,
  marketSeries: number,
  status: SeriesRow['status'],
  cells: (VolumeStatus | null)[],
  items: number,
): SeriesRow {
  const volumes = SERIES_STEPS.map((st, i) => {
    const v = cells[i] ?? null
    if (v == null) {
      return {
        step: st.step,
        schoolBand: st.schoolBand,
        title: null,
        items: null,
        explained: null,
        status: 'noRung' as const,
        types: [],
        recipe: null,
      }
    }
    return {
      step: st.step,
      schoolBand: st.schoolBand,
      title: `${brand} ${st.schoolBand}`,
      items,
      explained: items,
      status: v,
      types: ['표본 유형'],
      recipe: '표본 — 왜 이 배합인가를 실제 사다리는 단마다 적는다',
    }
  })
  return {
    id,
    brand,
    question: '표본',
    accent,
    status,
    nextStep: status === 'draft' ? '조판을 한 번도 안 돌렸다' : null,
    marketSeries,
    marketExamples: [],
    volumes,
    ready: volumes.filter((v) => v.status === 'ready').length,
    published: volumes.filter((v) => v.status === 'published').length,
    rungs: volumes.filter((v) => v.status !== 'noRung').length,
  }
}

export const SERIES_REAL: SeriesCatalogView = (() => {
  const P = 'published' as const
  const R = 'ready' as const
  const rows: SeriesRow[] = [
    seriesRow('reading', 'Vocaflow Reading', '#2E7D5A', 16, 'shipping', [P, P, P, P, P, P, P], 215032),
    seriesRow('vocab', 'Vocaflow Vocab', '#8B5CF6', 3, 'draft', [null, R, R, R, R, R, R], 287614),
    seriesRow('syntax', 'Vocaflow Syntax', '#B5803A', 2, 'draft', [null, R, R, R, R, R, R], 153720),
  ]
  return {
    rows,
    counts: { shipping: 1, defined: 3, market: 22 },
    inventoryAt: null,
    notMaking: NOT_MAKING,
    loadError: null,
  }
})()

/** 초·중 원문 재고 — TBP 콘솔에서 ④ 소재로 옮긴 패널(2026-09-06). */
export const KID_SOURCE_REAL: KidSourcePanel = { inventory: null, error: null }

/**
 * ⑦ 검수에서 막힌 문항 — **DB 실측 모양**(2026-09-23).
 *
 * 값은 지어낸 것이 아니라 그날 실제로 잰 분포다:
 *   판정 963행 = pass 303 · revise 501 · fail 159 · 문항 321 · 3인 전원 pass 29
 * 밀집도 하네스가 **채워진 화면**을 재야 예산이 뜻을 갖는다 — 빈 화면을 재면 실제보다
 * 작게 나오고, 데이터가 들어오는 날 아무 경고 없이 예산을 넘는다.
 */
export const REVIEW_DEFECTS_REAL: ReviewDefectView = {
  available: true,
  loadError: null,
  itemsReviewed: 321,
  itemsAllPass: 29,
  itemsBlocked: 292,
  byVerdict: { pass: 303, revise: 501, fail: 159 },
  matrix: [
    { vLevel: 5, pass: 140, revise: 244, fail: 78, items: 154 },
    { vLevel: 6, pass: 121, revise: 198, fail: 61, items: 128 },
    { vLevel: 7, pass: 42, revise: 59, fail: 20, items: 39 },
  ],
  rows: [
    {
      itemId: '3f2a91c7-0000-4000-8000-000000000001',
      type: 'blank_word',
      vLevel: 5,
      persona: 'analyst',
      verdict: 'fail',
      says: '오답 2번과 4번이 같은 이유로 틀린다 — 배제 근거가 하나뿐이다',
      reviewedAt: '2026-09-18T04:11:02.000Z',
    },
    {
      itemId: '91c70a33-0000-4000-8000-000000000002',
      type: 'insert',
      vLevel: 6,
      persona: 'tutor',
      verdict: 'revise',
      says: null,
      reviewedAt: '2026-09-17T23:40:10.000Z',
    },
  ],
}
