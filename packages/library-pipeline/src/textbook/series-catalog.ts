// packages/library-pipeline/src/textbook/series-catalog.ts
//
// **상품 라인 정본 — 시리즈가 여럿이다.**
//
// ── 왜 이 파일이 필요한가 (실측 2026-09-06) ──────────────────────────
// 카탈로그가 오래 (유형 × 학령) 42칸 격자를 그렸는데, **시장은 그 축으로 안 판다.**
// 서점에서 파는 것은 「독해 고1」이 아니라 **「리딩튜터 주니어 Level 2」** 이고,
// 한 브랜드가 학령 전체를 계단으로 잇는다.
//
// 코퍼스 실측(`scripts/textbook-corpus/market-series.mjs`):
//   시리즈 **22개** · 출판사 6곳 — NE능률 한 곳이 13개를 굴린다.
//   유형별로는 독해 16 · 어휘 3 · 구문 2 · 내신 1.
//
// 우리는 **시리즈가 하나**다(`SERIES_SPINE` = Vocaflow Reading 7단). 그래서 어휘 28.8만 ·
// 구문 15.4만 문항이 담길 책이 없다 — 카탈로그가 「담을 책이 없는 재고 11칸」으로 세는 그 수다.
// 막힌 것은 생산이 아니라 **상품 정의**이고, 이 파일이 그 자리다.
//
// ⚠️ **여기 있는 수는 전부 실측이다.** 재고는 `textbook_shelf_inventory()` 에서 그날 읽었고,
//   시장 시리즈 수는 코퍼스 리포트에서 왔다. 짐작으로 단을 만들면 화면이 "낼 수 있다" 고
//   말한 뒤 조판이 빈 권을 낸다 — 이 저장소가 이미 겪은 사고다.

import { SERIES_BRAND, SERIES_SPINE, type SeriesItemType, type SeriesRung } from './series'

/** 한 권에 드는 문항 수. 조판 기록 실측(20단원 × 3문항). */
const ITEMS_PER_VOLUME = 60

export type SeriesId = 'reading' | 'vocab' | 'syntax'

export interface SeriesDef {
  id: SeriesId
  /** 브랜드 이름 — 표지와 판권면이 그대로 쓴다. */
  brand: string
  /** 이 시리즈가 답하는 학습자의 물음. 카탈로그 카드 부제. */
  question: string
  /**
   * 이 시리즈가 겨루는 **시장 시리즈 수** — 코퍼스 실측.
   * 분모다: 「우리 1 / 시장 16」처럼 읽는다.
   */
  marketSeries: number
  /** 시장에서 이 자리를 차지한 브랜드 몇 개. 이름은 근거지 목표가 아니다. */
  marketExamples: readonly string[]
  rungs: readonly SeriesRung[]
  /**
   * 표지 색 계열 — **시리즈를 눈으로 가르는 유일한 축**이다.
   * 한 매대에 여러 시리즈를 놓았을 때 색이 같으면 같은 책으로 읽힌다.
   */
  accent: string
  /**
   * 지금 팔고 있는가.
   *   · `shipping` — 조판돼 나간 권이 있다
   *   · `draft`    — 단은 정의됐고 재고도 찼는데 **아직 안 찍었다**
   */
  status: 'shipping' | 'draft'
  /** `draft` 면 다음 한 걸음. `shipping` 이면 null. */
  nextStep: string | null
}

/* ───────────────────── 어휘·구문 시리즈의 계단 ───────────────────── */

/**
 * 계단 하나를 만든다 — **재고가 있는 밴드만 넘긴다.**
 *
 * `SERIES_SPINE` 의 학령 이름을 그대로 빌린다. 눈금이 둘이면 반드시 갈리고,
 * 그 갈림은 조판과 화면이 다른 계단을 말할 때 드러난다(`series.ts` 머리말 참조).
 */
function rungFrom(step: number, brand: string, suffix: string, types: SeriesItemType[], rationale: string): SeriesRung {
  const base = SERIES_SPINE.find((r) => r.step === step)
  if (!base) throw new Error(`사다리에 ${step}단이 없다 — 학령 눈금은 series.ts 가 정본이다`)
  return {
    step,
    vLevels: [...base.vLevels],
    schoolBand: base.schoolBand,
    volumeTitle: `${brand} ${suffix}`,
    types,
    rationale,
  }
}

const VOCAB_BRAND = 'Vocaflow Vocab'
const SYNTAX_BRAND = 'Vocaflow Syntax'

/** 계단 이름 — 시장이 쓰는 말(Starter/Basic/…)을 따른다. 새 말을 지으면 매대에서 안 읽힌다. */
const SUFFIX: Record<number, string> = {
  2: 'Starter',
  3: 'Basic',
  4: 'Intermediate',
  5: 'Advanced',
  6: 'Master',
  7: 'Final',
}

/**
 * 어휘 시리즈 6단 (V2~V7).
 *
 * 재고 실측 2026-09-06 — 세 유형(문맥 어휘·본문 어휘·빈칸 낱말)의 합:
 *   V2 1,158 · V3 1,163 · V4 6,935 · V5 67,369 · V6 45,333 · V7 165,651
 * **전 단이 한 권(60문항)을 넘는다.** V1(초등 저학년)은 빼는데, 그 밴드의 어휘 재고가
 * 518문항뿐이고 그중 대부분이 낱말 단위라 `SERIES_SPINE` 1단(소리·낱말)이 이미 덮는다.
 */
const VOCAB_RUNGS: readonly SeriesRung[] = [2, 3, 4, 5, 6, 7].map((step) =>
  rungFrom(
    step,
    VOCAB_BRAND,
    SUFFIX[step]!,
    ['vocab_choice', 'unit_vocab', 'blank_word'],
    '문맥에서 고르기(객관식) + 본문 어휘(내신형) + 빈칸에 쓰기(단답). ' +
      '고르기만 있으면 재인에 머무르므로 **쓰는 유형을 반드시 섞는다**(원칙 1 Active Recall).',
  ),
)

/**
 * 구문 시리즈 6단 (V2~V7).
 *
 * 재고 실측 2026-09-06 — 네 유형(어법 고르기·고쳐쓰기·단원 문법·영작 배열)의 합:
 *   V2 1,120 · V3 1,152 · V4 4,332 · V5 33,044 · V6 25,887 · V7 88,178
 */
const SYNTAX_RUNGS: readonly SeriesRung[] = [2, 3, 4, 5, 6, 7].map((step) =>
  rungFrom(
    step,
    SYNTAX_BRAND,
    SUFFIX[step]!,
    ['grammar_choice', 'grammar_fix', 'unit_grammar', 'word_order'],
    '고르기 → 고쳐쓰기 → 배열로 **인출 강도를 올린다**. 배열(word_order)이 가장 세고, ' +
      '그것만으로는 학습자가 막히므로 고르기부터 계단을 놓는다(원칙 3 Desirable Difficulty).',
  ),
)

/* ───────────────────────── 상품 라인 ───────────────────────── */

export const SERIES_CATALOG: readonly SeriesDef[] = [
  {
    id: 'reading',
    brand: SERIES_BRAND,
    question: '글 전체의 논지를 잡는가',
    marketSeries: 16,
    marketExamples: ['리딩튜터 주니어', '빠른독해 바른독해', '달곰한 Literacy'],
    rungs: SERIES_SPINE,
    accent: '#2E7D5A',
    status: 'shipping',
    nextStep: null,
  },
  {
    id: 'vocab',
    brand: VOCAB_BRAND,
    question: '문맥에서 낱말을 고르고 쓰는가',
    marketSeries: 3,
    marketExamples: ['능률VOCA', 'TED 어휘'],
    rungs: VOCAB_RUNGS,
    accent: '#8B5CF6',
    status: 'draft',
    nextStep: '조판을 한 번도 안 돌렸다 — 단은 정의됐고 재고도 찼다',
  },
  {
    id: 'syntax',
    brand: SYNTAX_BRAND,
    question: '문장 구조와 어법을 다루는가',
    marketSeries: 2,
    marketExamples: ['천일문', '빠른독해 바른독해 - 구문독해'],
    rungs: SYNTAX_RUNGS,
    accent: '#B5803A',
    status: 'draft',
    nextStep: '조판을 한 번도 안 돌렸다 — 단은 정의됐고 재고도 찼다',
  },
] as const

/**
 * **내신 시리즈를 만들지 않은 이유.**
 *
 * 재고는 있다(14.3만). 그런데 시중 내신 교재는 **학교가 쓰는 교과서 본문**에 맞춰 나오고,
 * 그 본문은 출판사 저작물이라 우리가 못 싣는다(`school-types.ts` 의 `own_textbook`).
 * 우리 경로는 학습자가 자기 본문을 넣는 BYO 뿐이라 **미리 찍어 두는 상품이 아니다** —
 * 시리즈로 세우면 매대에 못 올릴 책을 「낼 수 있다」고 세게 된다.
 *
 * 평가 요소표의 `school_exam_fit` 이 이것을 **열위**로 적고 있고, 두 곳이 같은 말을 한다.
 */
export const SCHOOL_SERIES_BLOCKED =
  '학교 교과서 본문이 있어야 하는데 그것은 출판사 저작물이다 — 우리 경로는 학습자가 본문을 넣는 BYO 뿐이라 미리 찍어 두는 상품이 아니다'

/** 시장 시리즈 총수 — 코퍼스 실측(기출 제외). 화면이 분모로 쓴다. */
export const MARKET_SERIES_TOTAL = 22

/** 지금 조판돼 나가는 시리즈 수 / 정의된 시리즈 수. */
export function seriesShipping(catalog: readonly SeriesDef[] = SERIES_CATALOG): {
  shipping: number
  defined: number
  market: number
} {
  return {
    shipping: catalog.filter((s) => s.status === 'shipping').length,
    defined: catalog.length,
    market: MARKET_SERIES_TOTAL,
  }
}

/** 한 시리즈가 한 권에 필요한 문항 수를 채웠는지 판정할 때 쓰는 분모. */
export { ITEMS_PER_VOLUME as SERIES_ITEMS_PER_VOLUME }
