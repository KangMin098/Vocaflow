// packages/library-pipeline/src/compose/review.ts
//
// ACP §20 — 초안 검수. **드레인이 쓴 글을 스스로 다시 보는 단계.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 게이트(I12~I17 · A1~A2)는 **법적·구조적 위험**만 본다. 통과해도 학습 자료로 나쁠 수 있다.
// 실제로 첫 산출물 세 편을 사람이 읽어 보니 게이트가 전부 통과시킨 채 이런 것들이 남아 있었다:
//   · 수능형 첫 문장이 34어절 — 목표 평균 22어절의 1.5배라 진입이 무겁다
//   · 일반형이 같은 사실을 두 번 말한다 — "about twenty percent" 와 "One fifth of the country's power"
//   · 적응판이 원문의 의의("우주 구조 진화의 이정표")를 통째로 잃었다
// 이걸 잡는 루틴이 없었다. 발행 화면의 "교육적 적합성 확인" 은 사람 단계인데 판단할 근거를
// 아무도 만들어 주지 않았다.
//
// ── 무엇을 재고 무엇을 넘기는가 ──────────────────────────────────────
// 이 모듈은 **잴 수 있는 것만** 잰다. 나머지는 판단 목록으로 넘긴다 — 기계가 못 보는 것을
// 본 척하는 게 가장 나쁘다.
//
//   잰다   : 문장 길이 분포 · 진입 부담 · 문단 구성 · 어휘 밴드 · 사실 커버리지 · 표기 유무
//   넘긴다 : 의의 보존 · 사실 정확성 · 같은 사실의 중복 진술 · 개념 재노출 · 소재 적절성
//
// ⚠️ 어휘 다양도(TTR)는 **의도적으로 빼 두었다.** 재 보니 레벨이 아니라 길이를 재고 있었다
//   (VOA 312토큰 0.643 vs PLOS 3,024토큰 0.374 — 완전한 역상관). 길이에 강건한 대안을
//   보정하기 전에는 넣지 않는다.

import { ATTRIBUTION_PREFIX, ADAPTATION_PREFIX, stripAttribution } from './attribution'
import { GRADE_BANDS, profileBand, type BandProfile, type GradeBandKey, type SpineWord } from './spine'

export interface ReviewInput {
  /** 초안 본문 (출처 표기 포함 가능 — 여기서 떼고 잰다) */
  text: string
  /** 발주가 정한 목표 */
  spec: {
    words: { min: number; max: number }
    avgSentenceWords: number
    band: GradeBandKey
  }
  /** 사실 원장의 전체 사실 id (재저작일 때만. 적응이면 빈 배열) */
  ledgerFactIds?: ReadonlyArray<string>
  /** 초안이 실제로 쓴 사실 순서 */
  factOrder?: ReadonlyArray<string>
  /** 초안 어휘와 V-Level */
  words: ReadonlyArray<SpineWord>
}

export interface ReviewFinding {
  code: string
  label: string
  /** 'measured' 는 수치가 말한다. 'judge' 는 사람/LLM 이 답해야 한다. */
  kind: 'measured'
  detail: string
}

export interface ReviewMetrics {
  words: number
  sentences: number
  paragraphs: number
  avgSentenceWords: number
  medianSentenceWords: number
  firstSentenceWords: number
  longestSentenceWords: number
  /** 문단별 문장 수 */
  paragraphSentences: number[]
  band: BandProfile
  hasAttribution: boolean
}

export interface ReviewReport {
  metrics: ReviewMetrics
  /** 잰 결과 나온 지적 — 없으면 수치상 문제가 없다는 뜻이지 좋은 글이라는 뜻이 아니다. */
  findings: ReviewFinding[]
  /** 기계가 못 보는 것 — 드레인이 초안을 다시 읽고 답해야 한다. */
  judgeChecklist: string[]
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function splitSentences(p: string): string[] {
  return p
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const wc = (s: string): number => s.split(/\s+/).filter(Boolean).length

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m]! : Math.round((a[m - 1]! + a[m]!) / 2)
}

/**
 * 판단이 필요한 항목 — **드레인이 초안을 다시 읽고 답한다.**
 *
 * 왜 코드가 아니라 목록인가: 아래는 전부 의미 판정이라 문자열 처리로는 닿지 않는다.
 * 실측 예 — "about twenty percent of the electricity" 와 "One fifth of the country's power" 는
 * 같은 사실인데 내용어가 하나도 겹치지 않는다(어휘 겹침 0). 어떤 임계값으로도 못 잡는다.
 */
export const REVIEW_JUDGE_CHECKLIST: ReadonlyArray<string> = [
  '이 글이 왜 중요한지가 남아 있는가 — 사실만 나열하고 의의를 잃지 않았는가.',
  '같은 사실을 다른 말로 두 번 말하지 않는가 (어휘가 달라 기계는 못 잡는다).',
  '같은 개념을 계속 같은 단어로 부르는가 — 저레벨에서 동의어로 바꾸면 재인이 끊긴다.',
  '수치·시점·주체가 사실 원장과 정확히 일치하는가.',
  '이 소재를 목표 학령 독자가 읽어도 되는가 (사건사고·분쟁·죽음).',
  '첫 문장이 독자를 끌어들이는가 — 사건 요약으로 열면 원문 전개를 따라가기 쉽다.',
]

/**
 * 초안 검수.
 *
 * 지적이 0건이어도 **좋은 글이라는 뜻이 아니다** — 잰 항목에 걸리지 않았다는 뜻뿐이다.
 * 그래서 항상 `judgeChecklist` 를 함께 돌려준다.
 */
export function reviewDraft(input: ReviewInput): ReviewReport {
  const raw = input.text ?? ''
  const hasAttribution =
    raw.includes(ATTRIBUTION_PREFIX) || raw.includes(ADAPTATION_PREFIX)
  const body = stripAttribution(raw)

  const paragraphs = splitParagraphs(body)
  const perParagraph = paragraphs.map((p) => splitSentences(p))
  const sentences = perParagraph.flat()
  const lens = sentences.map(wc)
  const words = wc(body)
  const target = input.spec.avgSentenceWords
  const band = profileBand(input.words, input.spec.band)

  const metrics: ReviewMetrics = {
    words,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgSentenceWords: sentences.length ? Math.round((words / sentences.length) * 10) / 10 : 0,
    medianSentenceWords: median(lens),
    firstSentenceWords: lens[0] ?? 0,
    longestSentenceWords: lens.length ? Math.max(...lens) : 0,
    paragraphSentences: perParagraph.map((s) => s.length),
    band,
    hasAttribution,
  }

  const findings: ReviewFinding[] = []
  const add = (code: string, label: string, detail: string): void => {
    findings.push({ code, label, kind: 'measured', detail })
  }

  // R1 발주 어수 — 범위를 벗어나면 유형 연습이 되지 않는다.
  if (words < input.spec.words.min || words > input.spec.words.max) {
    add(
      'R1',
      '발주 어수 이탈',
      `${words}어 (발주 ${input.spec.words.min}~${input.spec.words.max}). 출처 표기는 제외한 본문 기준이다.`,
    )
  }

  // R2 진입 부담 — 첫 문장이 목표를 넘고 **동시에** 그 글에서 가장 긴 축이면 진입이 무겁다.
  //   길이 하나만 보면 임의 기준이 되므로 글 안에서의 상대 위치를 함께 본다.
  if (lens.length >= 3 && metrics.firstSentenceWords > target) {
    const longerThan = lens.filter((l) => l < metrics.firstSentenceWords).length / lens.length
    if (longerThan >= 0.8) {
      add(
        'R2',
        '진입 부담',
        `첫 문장이 ${metrics.firstSentenceWords}어절로 목표 평균 ${target}어절을 넘고, 이 글 문장 중 상위 ${Math.round((1 - longerThan) * 100)}% 안에 든다. 가장 무거운 문장으로 글을 열고 있다.`,
      )
    }
  }

  // R3 문장 길이 — 평균이 목표에서 크게 벗어나면 레벨 자체가 어긋난다.
  if (sentences.length >= 3) {
    const dev = metrics.avgSentenceWords - target
    if (Math.abs(dev) > target * 0.3) {
      add(
        'R3',
        '문장 길이 이탈',
        `평균 ${metrics.avgSentenceWords}어절 (목표 ${target}). ${dev > 0 ? '길다 — 문장을 나눈다.' : '짧다 — 목표 유형의 호흡이 아니다.'}`,
      )
    }
  }

  // R4 문단 구성 — 문단은 이해 단위이자 구문 연습 문항의 생성 단위다(4~6문장).
  const badParagraphs = perParagraph
    .map((s, i) => ({ i, n: s.length }))
    .filter((p) => p.n > 0 && (p.n < 3 || p.n > 7))
  if (paragraphs.length > 1 && badParagraphs.length > 0) {
    add(
      'R4',
      '문단 구성',
      `문단 ${badParagraphs.map((p) => `${p.i}(${p.n}문장)`).join(' · ')} — 4~6문장이 이해 단위이고 구문 연습 문항도 그 범위에서만 생성된다.`,
    )
  }
  if (paragraphs.length === 1 && sentences.length > 7) {
    add(
      'R4',
      '문단 구성',
      `${sentences.length}문장이 한 문단이다. 빈 줄로 나눠야 문단이 된다 — 단일 개행은 문단 구분이 아니다.`,
    )
  }

  // R5 어휘 밴드 — 넘는 단어가 누구인지까지 말한다.
  const tol = band.aboveShare
  const label = GRADE_BANDS[input.spec.band].label
  if (band.offenders.length > 0) {
    add(
      'R5',
      '밴드 초과 어휘',
      `${label} 밴드(V≤${GRADE_BANDS[input.spec.band].vRange.max}) 초과 ${(tol * 100).toFixed(1)}% — ${band.offenders
        .slice(0, 6)
        .map((o) => `${o.word}(V${o.v})`)
        .join(' · ')}. 주제어라 뺄 수 없으면 그대로 두고, 아니면 쉬운 말로 바꾼다.`,
    )
  }

  // R6 사실 커버리지 — 원장에 있는데 안 쓴 사실. 발주가 아깝게 남는다.
  if (input.ledgerFactIds && input.ledgerFactIds.length > 0) {
    const used = new Set(input.factOrder ?? [])
    const unused = input.ledgerFactIds.filter((id) => !used.has(id))
    if (unused.length > 0) {
      add(
        'R6',
        '쓰지 않은 사실',
        `원장 ${input.ledgerFactIds.length}건 중 ${unused.length}건을 쓰지 않았다. 일부러 뺀 것이면 괜찮지만, 잊은 것이면 글이 얇아진다.`,
      )
    }
  }

  // R7 출처 표기 — 없으면 발행하면 안 된다.
  if (!hasAttribution) {
    add('R7', '출처 표기 없음', '재저작·적응 글은 본문에 출처 표기가 있어야 한다.')
  }

  return { metrics, findings, judgeChecklist: [...REVIEW_JUDGE_CHECKLIST] }
}

// ── 사실 밀도 ────────────────────────────────────────────────────────
//
// 발주 어수와 원장의 사실 수는 **짝이 맞아야 한다.** 사실 5개로 320어를 쓰라고 하면
// 쓰는 쪽은 같은 사실을 다른 말로 반복하게 되고, 그건 게이트가 못 잡는다(표현이 다르므로
// I13 도 안 걸린다). 검수의 판단 목록에 "같은 사실을 두 번 말하지 않는가" 가 있는 이유다.
//
// ⚠️ **임계값을 정하지 않는다.** 실측 6편의 밀도는 18.6~36.6어/사실로 흩어져 있고,
//   밀도만으로 결함이 난 사례는 아직 없다(가장 높은 두 편도 검수를 통과했다).
//   그래서 이 함수는 판정하지 않고 **관측 범위 안 어디쯤인지**를 말한다 — 쓰는 쪽이
//   "지금 늘려 써야 하는 자리" 임을 알고 시작하는 것이 목적이다.
//
//   관측을 넘어서는 값(36.6 초과)만 따로 표시한다. 그건 우리가 해낸 적 없는 밀도다.

/** 실측 밀도 분포 (2026-08-19 · 재저작 6편). 새 글이 쌓이면 갱신한다. */
export const OBSERVED_FACT_DENSITY = {
  samples: 6,
  min: 18.6,
  max: 36.6,
  /** 편별 값 — 범위만 남기면 분포가 어떤 모양인지 알 수 없다. */
  values: [18.6, 21.3, 23.5, 27.0, 35.8, 36.6] as const,
} as const

export type FactDensityVerdict = 'comfortable' | 'stretch' | 'beyond-observed'

export interface FactDensityAssessment {
  /** 어수 ÷ 사실 수 */
  density: number
  verdict: FactDensityVerdict
  /** 사람이 읽는 한 줄 */
  detail: string
}

/**
 * 이 발주를 이 원장으로 쓸 수 있는가 — **판정이 아니라 예보**다.
 *
 * 기준 어수는 하한을 쓴다. 하한을 채우는 것이 어려운 쪽이고, 상한은 안 채워도 되기 때문이다.
 */
export function assessFactDensity(wordsMin: number, factCount: number): FactDensityAssessment {
  if (factCount <= 0) {
    return {
      density: Infinity,
      verdict: 'beyond-observed',
      detail: '원장에 사실이 없다 — 쓸 근거가 없으므로 발주를 채울 수 없다.',
    }
  }
  const density = wordsMin / factCount
  const { min, max, samples } = OBSERVED_FACT_DENSITY
  if (density > max) {
    return {
      density,
      verdict: 'beyond-observed',
      detail:
        `사실 ${factCount}개로 ${wordsMin}어를 채우려면 사실당 ${density.toFixed(1)}어가 필요하다. ` +
        `실측 ${samples}편의 최대가 ${max}어/사실이었다 — 해낸 적 없는 밀도다. ` +
        `사실을 더 넣거나(다른 소스에서 확인) 더 짧은 유형으로 발주한다.`,
    }
  }
  if (density > (min + max) / 2) {
    return {
      density,
      verdict: 'stretch',
      detail:
        `사실당 ${density.toFixed(1)}어 — 실측 범위(${min}~${max})의 위쪽이다. ` +
        `늘려 써야 하는 자리이므로 **같은 사실을 다른 말로 두 번 말하지 않도록** 특히 조심한다.`,
    }
  }
  return {
    density,
    verdict: 'comfortable',
    detail: `사실당 ${density.toFixed(1)}어 — 실측 범위(${min}~${max}) 안쪽이다.`,
  }
}
