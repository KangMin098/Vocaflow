// packages/library-pipeline/src/textbook/apparatus.ts
//
// **교재의 구성요소(apparatus) 정본 — "우리 것이 시중만 한가" 를 *책*으로 묻는 자.**
//
// ── 왜 이 축이 따로 필요한가 (2026-09-06) ───────────────────────────
// `market-benchmark.mjs` 는 **문항과 해설**을 잰다(A1~A7). 그 자로 우리는 이미 1.2 근처다.
// 그런데 학습자가 교재를 고를 때 보는 것은 문항 지수가 아니라 **책의 껍데기 전부**다 —
// 표지 · 머리말 · 이 책의 구성과 특징 · 목차 · 학습 계획표 · 단원 도입 · 어휘 정리 ·
// 직독직해 · 복습 · 정답과 해설 · 전문 해석 · 부록 · 판권지 · 부가자료.
//
// 문항 지수가 1.2 여도 껍데기가 1축이면 학습자에게 그것은 교재가 아니라 문제 목록이다.
// 실제로 그랬다(실측 2026-09-06: 학습자 상세면 `/library/textbooks/4` 는 14축 중 **1축**).
//
// ── 시중 기준선은 짐작이 아니라 실측이다 ────────────────────────────
// `scripts/textbook-corpus/apparatus-probe.mjs` 가 시중 교재 코퍼스(79문서)를 시리즈 단위로
// 묶어 20종을 같은 자로 셌다. 그 결과가 아래 `MARKET_APPARATUS` 다.
//
// ⚠️ **이 값을 손으로 고치지 말 것.** 코퍼스가 늘면 probe 를 다시 돌려 갱신하고,
//   측정일을 함께 바꾼다. 근거 없이 올린 기준선은 목표가 아니라 짐작이다.
//
// ── 왜 화면에서 정규식으로 안 세는가 ────────────────────────────────
// 시중 교재는 PDF 본문뿐이라 표지어를 정규식으로 찾을 수밖에 없다. 그런데 **우리 화면**을
// 같은 방식으로 세면 오탐이 난다 — "목차" 라는 낱말이 도움말에 한 번 나오면 목차가 생긴다.
// 그래서 우리 쪽은 **선언**으로 센다: 구성요소를 실제로 렌더하는 자리에
// `data-apparatus="<key>"` 를 붙이고, 그것만 센다. 선언은 거짓말을 하기 어렵다 —
// 붙이려면 그 자리에 실제 내용이 있어야 하기 때문이다.

/** 구성요소 열쇠 — 시중·우리 양쪽이 같은 이름을 쓴다. */
export type ApparatusKey =
  | 'cover'
  | 'preface'
  | 'features'
  | 'toc'
  | 'studyplan'
  | 'unitopener'
  | 'wordlist'
  | 'syntax'
  | 'review'
  | 'answerkey'
  | 'translation'
  | 'appendix'
  | 'colophon'
  | 'extras'
  | 'difficulty'

export interface ApparatusSpec {
  key: ApparatusKey
  /** 화면·리포트에 쓰는 한국어 이름. */
  label: string
  /** 이 요소가 학습자에게 하는 일 — 없으면 왜 아쉬운지. */
  says: string
  /**
   * 시중 20종 중 이 요소를 가진 종의 비율(0~1).
   *
   * `null` 은 **못 잰 것**이지 0 이 아니다 — 표지는 텍스트 추출물에서 검출할 수 없다
   * (코퍼스는 본문 텍스트라 표지 이미지가 남지 않는다). 0 으로 세면 없는 승리를 적게 된다.
   */
  marketRate: number | null
}

/**
 * 시중 실측 (2026-09-06 · 코퍼스 94문서 → 20종 · 20쪽 이상만).
 *
 * 생성: `node scripts/textbook-corpus/apparatus-probe.mjs --json`
 *
 * ⚠️ `wordlist` 0% 는 **자의 한계**다 — 어휘 별책은 코퍼스에서 20쪽 미만이라 전부 제외됐고
 *   (단어장 역할 문서는 9쪽 하나뿐), 본책에는 "어휘리스트 제공" 안내 몇 줄만 남는다.
 *   실제 시중 교재는 어휘 별책을 거의 다 낸다. 그래서 이 축은 **우리가 유리하게 보이는
 *   축이므로 우위 계산에서 빼지 않고 그대로 두되**, 여기에 근거를 남긴다.
 */
export const MARKET_APPARATUS_MEASURED_AT = '2026-09-06' as const

/** 시중 한 종이 가진 구성요소 수 — 중앙값과 최다. 우위 계산의 분모다. */
export const MARKET_APPARATUS_COUNT = {
  /** 20종의 중앙값. */
  median: 5,
  /** 20종 중 최다 — NE능률 「달곰한 Literacy」. */
  max: 8,
  /** 잰 종 수. */
  series: 20,
} as const

export const TEXTBOOK_APPARATUS: readonly ApparatusSpec[] = [
  {
    key: 'cover',
    label: '표지',
    says: '매대에서 눈에 걸리는 일은 표지가 한다. 없으면 상품이 아니라 목록이다.',
    // 텍스트 코퍼스에서는 표지를 검출할 수 없다 — 0 이 아니라 못 잰 것이다.
    marketRate: null,
  },
  {
    key: 'preface',
    label: '머리말',
    says: '이 책이 왜 이렇게 짜였는지 지은이가 직접 말하는 자리.',
    marketRate: 0.2,
  },
  {
    key: 'features',
    label: '이 책의 구성과 특징',
    says: '어디부터 어떻게 쓰는지. 첫 펼침에서 길을 잃지 않게 한다.',
    marketRate: 0.45,
  },
  {
    key: 'toc',
    label: '목차',
    says: '무엇이 몇 개 들었는지 한눈에. 분량을 가늠하는 유일한 자리다.',
    marketRate: 0.55,
  },
  {
    key: 'studyplan',
    label: '학습 계획표',
    says: '언제까지 끝나는지. 끝이 보이면 시작한다.',
    marketRate: 0.05,
  },
  {
    key: 'unitopener',
    label: '단원 도입 · 학습 목표',
    says: '오늘 무엇을 확인하는지 먼저 알려 준다.',
    marketRate: 0.2,
  },
  {
    key: 'wordlist',
    label: '어휘 정리',
    says: '지문에 나온 낱말이 뒤에 다시 모인다.',
    marketRate: 0,
  },
  {
    key: 'syntax',
    label: '직독직해 · 구문 분석',
    says: '문장을 끊어 읽는 법. 해석이 막히는 자리를 푼다.',
    marketRate: 0.7,
  },
  {
    key: 'review',
    label: '복습 · 단원 평가',
    says: '몇 단원마다 돌아본다. 잊기 직전에 다시 만나는 자리.',
    marketRate: 0.55,
  },
  {
    key: 'answerkey',
    label: '정답과 해설',
    says: '왜 그것이 답이고 나머지는 왜 아닌지.',
    marketRate: 0.85,
  },
  {
    key: 'translation',
    label: '전문 해석',
    says: '지문 전체의 우리말. 대충 읽은 것과 읽은 것을 가른다.',
    marketRate: 0.3,
  },
  {
    key: 'appendix',
    label: '부록',
    says: '출처 일람·색인처럼 본문에 못 넣는 것.',
    marketRate: 0.05,
  },
  {
    key: 'colophon',
    label: '판권지',
    says: '누가 언제 어떤 규격으로 냈는지. 검증할 수 있게 만드는 것.',
    marketRate: 0.5,
  },
  {
    key: 'extras',
    label: '부가 자료 안내',
    says: '음원·시험지처럼 책 밖에서 받는 것.',
    marketRate: 0.45,
  },
  {
    key: 'difficulty',
    label: '난이도 표시',
    says: '내 학년에 맞는지. 고르는 사람이 가장 먼저 확인하는 값.',
    marketRate: 0.2,
  },
]

/** 열쇠로 사양을 찾는다. */
export const APPARATUS_BY_KEY: Readonly<Record<ApparatusKey, ApparatusSpec>> = Object.fromEntries(
  TEXTBOOK_APPARATUS.map((a) => [a.key, a]),
) as Record<ApparatusKey, ApparatusSpec>

/** 모든 열쇠 — 화면이 `data-apparatus` 로 선언할 수 있는 값의 전부. */
export const APPARATUS_KEYS: readonly ApparatusKey[] = TEXTBOOK_APPARATUS.map((a) => a.key)

/**
 * 우위 지수 — 우리가 세운 축 수 ÷ 시중 기준.
 *
 * 기준을 **최다(8축)** 로 잡는다. 사용자가 견주는 것은 평균적인 교재가 아니라
 * 서점에서 눈에 띄는 좋은 교재이고, 중앙값(5)을 분모로 쓰면 6축만 세워도 1.2 가 되어
 * "우위" 라는 말이 헐거워진다.
 *
 * @param ours 학습자 표면이 실제로 선언한 축 수
 * @param against 'max'(기본) 또는 'median'
 */
export function apparatusIndex(ours: number, against: 'max' | 'median' = 'max'): number {
  const base = against === 'max' ? MARKET_APPARATUS_COUNT.max : MARKET_APPARATUS_COUNT.median
  return base > 0 ? ours / base : 0
}

/** 목표(120% 우위)를 넘기려면 몇 축이 필요한가 — 소수는 올린다(축은 쪼갤 수 없다). */
export function apparatusTarget(ratio = 1.2, against: 'max' | 'median' = 'max'): number {
  const base = against === 'max' ? MARKET_APPARATUS_COUNT.max : MARKET_APPARATUS_COUNT.median
  return Math.ceil(base * ratio)
}
