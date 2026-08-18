// packages/library-pipeline/src/compose/benchmark.ts
//
// ACP §20 — **외부 플랫폼 기준선.** "글로벌 수준 이상" 을 숫자로 고정한다.
//
// ── 왜 숫자만 보관하는가 ─────────────────────────────────────────────
// 남의 본문은 저장하지 않는다. 재저작 파이프라인이 소스 본문을 지문만 남기고 버리는 것과
// 같은 규율이다. 여기 남는 것은 **측정 결과와 출처 주소**뿐이고, 다시 재고 싶으면
// `scripts/compose/bench-text.mjs` 로 그때 열어서 재면 된다.
//
// ── 어떻게 쟀나 (2026-08-19) ────────────────────────────────────────
// 우리 산출물과 **완전히 같은 계측기**로 쟀다 — `tokenizeForBand` 로 원문 토큰을 뽑아
// `shared_dictionary.v_level` 을 조회하고, 밴드 상한을 넘는 서로 다른 단어의 비율을 낸다.
// 추출 어휘로 재면 기능어가 빠져 분모가 작아지고(같은 글 26.8% vs 14.8%) 남의 글에는
// 우리 추출 파이프라인을 돌릴 수도 없어서, 비교가 성립하는 방법은 이것뿐이다.

import type { GradeBandKey } from './spine'

export interface BenchmarkSample {
  platform: string
  /** 그 플랫폼이 부르는 레벨 이름 */
  level: string
  /** 우리 밴드로 환산 */
  band: GradeBandKey
  slug: string
  url: string
  words: number
  sentences: number
  avgSentenceWords: number
  /** 밴드 상한을 넘는 서로 다른 단어의 비율 (0~1) */
  aboveShare: number
}

/**
 * 측정한 외부 표본.
 *
 * News in Levels 를 고른 이유: 같은 사건을 3개 레벨로 다시 쓰는 구조가 우리 "원장 1개 →
 * 렌더링 N개" 와 같아서, 레벨별 산출물을 직접 견줄 수 있는 몇 안 되는 공개 자료다.
 * Breaking News English 는 수집기를 403 으로 거절해서 넣지 못했다 — 우회하지 않는다.
 */
export const BENCHMARK_SAMPLES: ReadonlyArray<BenchmarkSample> = [
  {
    platform: 'News in Levels',
    level: 'Level 1',
    band: 'elementary',
    slug: 'school-costs-in-europe',
    url: 'https://www.newsinlevels.com/products/school-costs-in-europe-level-1/',
    words: 116,
    sentences: 13,
    avgSentenceWords: 8.9,
    aboveShare: 0.0,
  },
  {
    platform: 'News in Levels',
    level: 'Level 1',
    band: 'elementary',
    slug: 'living-forever',
    url: 'https://www.newsinlevels.com/products/living-forever-level-1/',
    words: 117,
    sentences: 12,
    avgSentenceWords: 9.8,
    aboveShare: 0.03,
  },
  {
    platform: 'News in Levels',
    level: 'Level 1',
    band: 'elementary',
    slug: 'finns-love-blueberries',
    url: 'https://www.newsinlevels.com/products/finns-love-blueberries-level-1/',
    words: 111,
    sentences: 14,
    avgSentenceWords: 7.9,
    aboveShare: 0.073,
  },
  {
    platform: 'News in Levels',
    level: 'Level 1',
    band: 'elementary',
    slug: 'how-ants-changed-kenya',
    url: 'https://www.newsinlevels.com/products/how-ants-changed-kenya-level-1/',
    words: 113,
    sentences: 13,
    avgSentenceWords: 8.7,
    aboveShare: 0.083,
  },
  {
    platform: 'News in Levels',
    level: 'Level 1',
    band: 'elementary',
    slug: 'what-sauna-does-to-your-body',
    url: 'https://www.newsinlevels.com/products/what-sauna-does-to-your-body-level-1/',
    words: 112,
    sentences: 11,
    avgSentenceWords: 10.2,
    aboveShare: 0.095,
  },
  {
    platform: 'News in Levels',
    level: 'Level 3',
    band: 'high',
    slug: 'living-forever',
    url: 'https://www.newsinlevels.com/products/living-forever-level-3/',
    words: 155,
    sentences: 11,
    avgSentenceWords: 14.1,
    aboveShare: 0.011,
  },
  {
    platform: 'News in Levels',
    level: 'Level 2',
    band: 'middle',
    slug: 'school-costs-in-europe',
    url: 'https://www.newsinlevels.com/products/school-costs-in-europe-level-2/',
    words: 128,
    sentences: 9,
    avgSentenceWords: 14.2,
    aboveShare: 0.0,
  },
  {
    platform: 'News in Levels',
    level: 'Level 2',
    band: 'middle',
    slug: 'finns-love-blueberries',
    url: 'https://www.newsinlevels.com/products/finns-love-blueberries-level-2/',
    words: 112,
    sentences: 10,
    avgSentenceWords: 11.2,
    aboveShare: 0.017,
  },
  {
    platform: 'News in Levels',
    level: 'Level 2',
    band: 'middle',
    slug: 'what-sauna-does-to-your-body',
    url: 'https://www.newsinlevels.com/products/what-sauna-does-to-your-body-level-2/',
    words: 129,
    sentences: 7,
    avgSentenceWords: 18.4,
    aboveShare: 0.042,
  },
  {
    platform: 'News in Levels',
    level: 'Level 2',
    band: 'middle',
    slug: 'living-forever',
    url: 'https://www.newsinlevels.com/products/living-forever-level-2/',
    words: 119,
    sentences: 10,
    avgSentenceWords: 11.9,
    aboveShare: 0.047,
  },
  {
    platform: 'News in Levels',
    level: 'Level 2',
    band: 'middle',
    slug: 'how-ants-changed-kenya',
    url: 'https://www.newsinlevels.com/products/how-ants-changed-kenya-level-2/',
    words: 119,
    sentences: 10,
    avgSentenceWords: 11.9,
    aboveShare: 0.055,
  },
  {
    platform: 'News in Levels',
    level: 'Level 3',
    band: 'high',
    slug: 'what-sauna-does-to-your-body',
    url: 'https://www.newsinlevels.com/products/what-sauna-does-to-your-body-level-3/',
    words: 166,
    sentences: 8,
    avgSentenceWords: 20.8,
    aboveShare: 0.022,
  },
]

export interface BenchmarkBar {
  band: GradeBandKey
  n: number
  /** 표본 중앙값 — "대등하다" 의 기준 */
  medianAboveShare: number
  /** 표본 최대 — **이걸 넘으면 글로벌 수준 미달**이다 */
  maxAboveShare: number
  medianWords: number
  medianAvgSentenceWords: number
}

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y)
  if (a.length === 0) return 0
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2
}

/** 밴드별 기준선. 표본이 없는 밴드는 돌려주지 않는다 — 없는 기준으로 판정하지 않는다. */
export function benchmarkBar(band: GradeBandKey): BenchmarkBar | null {
  const rows = BENCHMARK_SAMPLES.filter((s) => s.band === band)
  if (rows.length === 0) return null
  return {
    band,
    n: rows.length,
    medianAboveShare: median(rows.map((r) => r.aboveShare)),
    maxAboveShare: Math.max(...rows.map((r) => r.aboveShare)),
    medianWords: median(rows.map((r) => r.words)),
    medianAvgSentenceWords: median(rows.map((r) => r.avgSentenceWords)),
  }
}

export type BenchmarkVerdict = 'above' | 'par' | 'below' | 'no-baseline'

export interface BenchmarkResult {
  verdict: BenchmarkVerdict
  detail: string
}

/**
 * 우리 글 한 편을 기준선에 견준다.
 *
 * `above` 는 **표본 중앙값보다 낫다**는 뜻이지 "세계 최고" 라는 뜻이 아니다. 표본은 6편이고
 * 한 플랫폼에서만 왔다. 이 함수가 말할 수 있는 것은 딱 그만큼이다.
 */
export function compareToBenchmark(band: GradeBandKey, aboveShare: number): BenchmarkResult {
  const bar = benchmarkBar(band)
  if (!bar) {
    return {
      verdict: 'no-baseline',
      detail: `${band} 밴드는 외부 표본이 없어 견줄 수 없다. 표본을 재서 BENCHMARK_SAMPLES 에 넣는다.`,
    }
  }
  const pct = (x: number): string => (x * 100).toFixed(1) + '%'
  if (aboveShare <= bar.medianAboveShare) {
    return {
      verdict: 'above',
      detail: `밴드 초과 ${pct(aboveShare)} ≤ 표본 중앙 ${pct(bar.medianAboveShare)} (n=${bar.n}). 표본 중앙값보다 낫다.`,
    }
  }
  if (aboveShare <= bar.maxAboveShare) {
    return {
      verdict: 'par',
      detail: `밴드 초과 ${pct(aboveShare)} — 표본 범위 안(중앙 ${pct(bar.medianAboveShare)} · 최대 ${pct(bar.maxAboveShare)}, n=${bar.n}). 대등하다.`,
    }
  }
  return {
    verdict: 'below',
    detail: `밴드 초과 ${pct(aboveShare)} > 표본 최대 ${pct(bar.maxAboveShare)} (n=${bar.n}). **글로벌 수준 미달** — 밴드를 넘는 단어를 줄이거나 주제를 바꾼다.`,
  }
}
