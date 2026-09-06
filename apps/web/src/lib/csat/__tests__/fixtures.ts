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
import type { AuthorView, PressView, ReviewView, SourceView } from '../factory-line-model'
import { FACTORY_STAGES, type StageState } from '../factory-model'
import { GENRES, STEPS, catalogCoverage, genreCoverage, type CatalogRow } from '../product-model'
import type { CatalogView } from '../product-view'

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
      { label: 'L2 3인 페르소나 — 검수 통과 문항', num: 802, den: 802, unit: 'ratio', target: 1 },
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

export const SOURCE_REAL: SourceView = {
  rows: [
    { band: 'S1', vLevel: 2, count: 15, displayOnly: 0, licenseClasses: ['pd'], cefrLevels: ['A2'] },
    { band: 'S2', vLevel: 3, count: 17, displayOnly: 0, licenseClasses: ['pd'], cefrLevels: ['A2'] },
    { band: 'S3', vLevel: 5, count: 205, displayOnly: 15, licenseClasses: ['pd', 'cc-by'], cefrLevels: ['B1'] },
    { band: 'S4', vLevel: 8, count: 149, displayOnly: 0, licenseClasses: ['cc-by'], cefrLevels: ['C1'] },
  ],
  gateBands: ['S1', 'S2', 'S3', 'S4', 'S5'],
  loadError: null,
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
      passageSpec: null,
    },
  ],
  loadError: null,
}

export const PRESS_REAL: PressView = {
  volumes: [
    {
      band: 6,
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
  loadError: null,
}

/* ── 카탈로그 ─────────────────────────────────────────────────── */

/** 상태 문자열 뒤 `!` = 이미 낸 칸. */
function catalogRow(id: string, statuses: string[], items: number): CatalogRow {
  const cells = statuses.map((raw, i) => {
    const published = raw.endsWith('!')
    const status = (published ? raw.slice(0, -1) : raw) as CatalogRow['cells'][number]['status']
    return {
      genre: id as CatalogRow['genre']['id'],
      step: STEPS[i]?.step ?? i + 1,
      items,
      explained: items,
      blocked: GENRES.find((g) => g.id === id)!.blocked,
      status,
      published,
    }
  })
  const ready = cells.filter((c) => c.status === 'ready')
  return {
    genre: GENRES.find((g) => g.id === id)!,
    cells,
    ready: ready.length,
    published: ready.filter((c) => c.published).length,
  }
}

/** 2026-09-06 실측 — 독해만 찍혔고 어휘·구문·내신은 재고가 있는데 안 냈다. */
export const CATALOG_REAL: CatalogView = (() => {
  const rows = [
    catalogRow('reading', ['empty', 'ready!', 'ready!', 'ready!', 'ready!', 'ready!', 'ready!'], 215032),
    catalogRow('vocab', ['needsItems', 'ready', 'ready', 'ready', 'ready', 'ready', 'ready'], 287614),
    catalogRow('syntax', ['needsItems', 'ready', 'ready', 'ready', 'ready', 'ready', 'ready'], 153720),
    catalogRow('school', ['needsItems', 'ready', 'ready', 'ready', 'ready', 'ready', 'ready'], 143884),
    catalogRow('pastexam', Array(7).fill('blocked'), 0),
    catalogRow('platform', Array(7).fill('blocked'), 0),
  ]
  return { rows, coverage: catalogCoverage(rows), genres: genreCoverage(rows), loadError: null }
})()
