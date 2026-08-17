// apps/web/src/lib/textfit/coverage.ts
//
// TextFit 엔진 — 순수 계산. DB·네트워크·시계 접근 없음(now 는 주입).
//
// 핵심 아이디어: 어휘 커버리지를 **정적 지표가 아니라 기억 상태의 함수**로 잰다.
//   Lexile·ATOS 는 텍스트만 재고, LingQ 의 known-word 카운트는 이진값이며 망각을 반영하지 않는다.
//   Vocaflow 는 `vocabularies` 에 FSRS stability 를 갖고 있으므로 같은 지문의 커버리지가
//   **복습을 미루면 내려간다**. CLAUDE.md 의 Memory Decay 와 같은 수식을 쓴다:
//     R(t) = exp(ln(0.9) × t / S)
//
// ⚠️ `memory_state` 를 저장하지 않는다는 규약과 정합 — 여기서도 상태는 매번 계산한다.

import type {
  FitBand,
  FsrsState,
  KnownSource,
  Prescription,
  TextFitInput,
  TextFitResult,
  WordVerdict,
} from './types'

// ── 상수 ────────────────────────────────────────────────────────────────────

/**
 * 사전 V-Level 이 학습자 레벨 이하라서 "알 것이다" 로 본 단어의 가중치.
 *
 * 1.0 을 주면 커버리지를 과대평가한다 — 레벨은 분포이지 보장이 아니다. 그렇다고 낮게 잡으면
 * 진단만 마친 학습자가 모든 지문에서 "너무 어렵다" 판정을 받는다. 0.85 는 **보수적 기본값**이며,
 * 학습자가 그 단어를 한 번이라도 known/unknown 으로 답하면 즉시 1.0/0.0 으로 대체된다.
 * 이 값에 기댄 만큼은 신뢰도(confidence)에서 깎이고, 하한/상한 범위로도 노출된다.
 */
export const ASSUMED_WEIGHT = 0.85

/** `csat_stage_gates` 의 coverage 임계 — DB 값과 일치해야 한다(S1 .98 / S2 .95 / S3 .90 / S4 .85). */
export const BAND_THRESHOLDS = {
  flow: 0.98,
  growth: 0.95,
  study: 0.9,
  hard: 0.85,
} as const

/** 처방 목표 — 다독 적정(0.95)과 무보조 이해(0.98). */
export const PRESCRIPTION_TARGETS = [0.95, 0.98] as const

/** 감쇠 예보 기간(일). 2주 = 국내 내신/모의고사 준비 주기의 한 단위. */
export const FORECAST_DAYS = 14

const MS_PER_DAY = 86_400_000
const LN_09 = Math.log(0.9)

// ── FSRS 인출 확률 ──────────────────────────────────────────────────────────

/**
 * R(t) = exp(ln(0.9) × t / S) — t 일 경과 후 인출 확률.
 *
 * S(stability)가 없거나 0 이하면 아직 기억이 형성되지 않은 것으로 본다(0 반환).
 * lastReviewAt 이 없으면 등록만 하고 학습한 적이 없다는 뜻이라 역시 0.
 * 미래 시각이 들어와도(시계 오차) 음수 경과일이 되지 않도록 0 으로 클램프한다.
 */
export function retentionAt(state: FsrsState, now: Date, extraDays = 0): number {
  const s = state.stability
  if (s === null || !Number.isFinite(s) || s <= 0) return 0
  if (state.lastReviewAt === null) return 0

  const elapsedDays = Math.max(0, (now.getTime() - state.lastReviewAt.getTime()) / MS_PER_DAY) + extraDays
  const r = Math.exp((LN_09 * elapsedDays) / s)
  return Math.min(1, Math.max(0, r))
}

// ── 단어 단위 판정 ──────────────────────────────────────────────────────────

/**
 * 한 단어의 근거와 가중치를 정한다. 우선순위:
 *   1) 자기보고 known           → 1.0        (학습자가 직접 답한 것이 가장 강하다)
 *   2) FSRS 카드 있음           → R(t)       (학습 중 — 정직하게 감쇠를 반영)
 *   3) 자기보고 unknown         → 0.0
 *   4) 사전 v_level ≤ 학습자    → 0.85       (추정)
 *   5) 그 외                    → 0.0
 *
 * 2)가 3)보다 앞서는 이유: unknown 이라 답한 뒤 그 단어를 단어장에 넣어 학습을 시작했다면
 * 최신 사실은 FSRS 쪽이다. 반대로 1)이 2)보다 앞서는 이유는 known 자기보고가
 * "이미 아는 단어라 카드가 필요 없다" 는 진술이기 때문이다.
 */
function verdictFor(
  lemma: string,
  count: number,
  input: TextFitInput,
  extraDays: number,
): WordVerdict {
  const vLevel = input.dictVLevel.get(lemma) ?? null
  const self = input.familiarity.get(lemma)

  if (self === 'known') {
    return { lemma, count, source: 'self_known', weight: 1, vLevel }
  }

  const card = input.fsrs.get(lemma)
  if (card) {
    const r = retentionAt(card, input.now, extraDays)
    return { lemma, count, source: 'fsrs', weight: r, vLevel, retention: r }
  }

  if (self === 'unknown') {
    return { lemma, count, source: 'self_unknown', weight: 0, vLevel }
  }

  if (input.userVLevel !== null && vLevel !== null && vLevel <= input.userVLevel) {
    return { lemma, count, source: 'level_assumed', weight: ASSUMED_WEIGHT, vLevel }
  }

  return { lemma, count, source: 'none', weight: 0, vLevel }
}

// ── 커버리지 ────────────────────────────────────────────────────────────────

/**
 * 내용어 판정 목록에서 토큰 기준 커버리지를 낸다.
 *
 * 분모는 **기능어를 포함한 러닝 워드 수**(Hu & Nation 의 정의). 토크나이저가 뺀 stopword·
 * 비어휘 표기는 학습 대상이 아니므로 기지어로 본다 — 중고생 이상 타깃에서 the/of/a 를
 * 미지어로 세면 커버리지가 실제 이해도와 무관해진다.
 *
 * 하이픈 복합어는 부분+전체가 모두 카운트되므로 Σcount 가 러닝 워드 수를 넘을 수 있다.
 * 그래서 미지 질량을 분모로 클램프한다 — 넘치면 커버리지가 음수가 되어 화면이 거짓말을 한다.
 */
function coverageFrom(verdicts: WordVerdict[], totalTokens: number): number {
  if (totalTokens <= 0) return 1

  let unknownMass = 0
  for (const v of verdicts) unknownMass += v.count * (1 - v.weight)

  const clamped = Math.min(unknownMass, totalTokens)
  return Math.min(1, Math.max(0, 1 - clamped / totalTokens))
}

/** 커버리지 → 대역. 임계는 `csat_stage_gates` 와 같은 값을 쓴다. */
export function bandFor(coverage: number): FitBand {
  if (coverage >= BAND_THRESHOLDS.flow) return 'flow'
  if (coverage >= BAND_THRESHOLDS.growth) return 'growth'
  if (coverage >= BAND_THRESHOLDS.study) return 'study'
  if (coverage >= BAND_THRESHOLDS.hard) return 'hard'
  return 'overload'
}

/** 대역 → 이 지문이 지원하는 학습 단계. overload 는 어느 단계도 지원하지 않는다. */
export function stageFor(band: FitBand): 'S1' | 'S2' | 'S3' | 'S4' | null {
  switch (band) {
    case 'flow':
      return 'S1'
    case 'growth':
      return 'S2'
    case 'study':
      return 'S3'
    case 'hard':
      return 'S4'
    case 'overload':
      return null
  }
}

// ── 처방 (역산) ─────────────────────────────────────────────────────────────

/**
 * 목표 커버리지에 닿는 **최소 단어 수** 를 구한다.
 *
 * 각 단어의 기여는 `count × (1 - weight) / totalTokens` 로 서로 독립이므로,
 * 기여도 내림차순 그리디가 정확히 최적이다(교환 논증). 근사가 아니다.
 *
 * 미지어를 전부 익혀도 목표에 못 닿는 경우가 있다 — 하이픈 복합어로 미지 질량이 분모를
 * 넘겼을 때다. 그때는 reachable=false 로 정직하게 표시하고 도달 가능한 최대치를 준다.
 */
export function prescribe(
  candidates: WordVerdict[],
  totalTokens: number,
  currentCoverage: number,
  target: number,
): Prescription {
  if (currentCoverage >= target) {
    return {
      target,
      wordsNeeded: 0,
      words: [],
      projectedCoverage: currentCoverage,
      reachable: true,
    }
  }
  if (totalTokens <= 0) {
    return { target, wordsNeeded: 0, words: [], projectedCoverage: 1, reachable: true }
  }

  // 기여도 = 남은 미지 질량. 동률이면 lemma 사전순 — 결정론(같은 입력 → 같은 처방).
  const ranked = [...candidates]
    .map((v) => ({ v, gain: (v.count * (1 - v.weight)) / totalTokens }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => (b.gain !== a.gain ? b.gain - a.gain : a.v.lemma.localeCompare(b.v.lemma)))

  const picked: WordVerdict[] = []
  let projected = currentCoverage

  for (const { v, gain } of ranked) {
    if (projected >= target) break
    picked.push(v)
    projected = Math.min(1, projected + gain)
  }

  return {
    target,
    wordsNeeded: picked.length,
    words: picked,
    projectedCoverage: projected,
    reachable: projected >= target - 1e-9,
  }
}

// ── 엔트리포인트 ────────────────────────────────────────────────────────────

/** 근거별 토큰 수 집계 — 커버리지가 어디서 왔는지 화면에서 검증 가능하게 한다. */
function breakdownOf(verdicts: WordVerdict[], totalTokens: number): Record<KnownSource, number> {
  const acc: Record<KnownSource, number> = {
    self_known: 0,
    self_unknown: 0,
    fsrs: 0,
    level_assumed: 0,
    function_word: 0,
    none: 0,
  }
  let content = 0
  for (const v of verdicts) {
    acc[v.source] += v.count
    content += v.count
  }
  // 남은 것은 토크나이저가 뺀 기능어·비어휘 표기다. 음수가 되지 않게 클램프.
  acc.function_word = Math.max(0, totalTokens - content)
  return acc
}

/**
 * 지문 하나를 학습자 기준으로 판정한다.
 *
 * 반환값의 모든 수치는 **재계산 가능**하다 — 저장하지 않는다(memory_state 금지 규약과 동일 원칙).
 */
export function analyzeTextFit(input: TextFitInput): TextFitResult {
  const entries = Object.entries(input.counts)
  const totalTokens = Math.max(0, input.totalTokens)

  const verdicts = entries.map(([lemma, count]) => verdictFor(lemma, count, input, 0))
  const coverage = coverageFrom(verdicts, totalTokens)

  // 추정에 기댄 질량 — 하한/상한과 신뢰도의 근거.
  let assumedMass = 0
  for (const v of verdicts) if (v.source === 'level_assumed') assumedMass += v.count

  const assumedShare = totalTokens > 0 ? Math.min(1, assumedMass / totalTokens) : 0
  // 추정 단어가 전부 미지어였다면 0.85 만큼 더 깎이고, 전부 기지어였다면 0.15 만큼 오른다.
  const coverageLow = Math.max(0, coverage - assumedShare * ASSUMED_WEIGHT)
  const coverageHigh = Math.min(1, coverage + assumedShare * (1 - ASSUMED_WEIGHT))
  const confidence = Math.min(1, Math.max(0, 1 - assumedShare))

  // 14일 뒤 — FSRS 카드만 감쇠한다. 자기보고·추정은 시간과 무관하다고 본다.
  const futureVerdicts = entries.map(([lemma, count]) => verdictFor(lemma, count, input, FORECAST_DAYS))
  const coverageIn14Days = coverageFrom(futureVerdicts, totalTokens)

  const byCountDesc = (a: WordVerdict, b: WordVerdict) =>
    b.count !== a.count ? b.count - a.count : a.lemma.localeCompare(b.lemma)

  // 미지어와 "잊은 단어" 를 가른다 — 커버리지 기여는 둘 다 0 이지만 학습자에게는 다른 단어다.
  //   실측(2026-08-17): 검증 계정 135장 중 19장이 review_count=13 인데 stability≈0 이었다.
  //   R(t) 만 보면 처음 보는 단어와 구분되지 않는데, 그렇게 부르면 학습자에게 거짓말이 된다.
  const unknown = verdicts.filter((v) => v.weight <= 0 && v.source !== 'fsrs').sort(byCountDesc)
  const fading = verdicts
    .filter((v) => v.source === 'fsrs' && v.weight < 0.9)
    .sort((a, b) => (a.weight !== b.weight ? a.weight - b.weight : byCountDesc(a, b)))

  // 처방 후보 = 미지어 + 흔들리는 단어 (둘 다 익히면 커버리지가 오른다).
  const candidates = verdicts.filter((v) => v.weight < 1)
  const prescriptions = PRESCRIPTION_TARGETS.map((t) =>
    prescribe(candidates, totalTokens, coverage, t),
  )

  const band = bandFor(coverage)

  return {
    totalTokens,
    uniqueContentWords: entries.length,
    coverage,
    coverageLow,
    coverageHigh,
    confidence,
    band,
    stage: stageFor(band),
    unknown,
    fading,
    coverageIn14Days,
    prescriptions,
    breakdown: breakdownOf(verdicts, totalTokens),
  }
}

// ── 표시용 문구 ─────────────────────────────────────────────────────────────

/**
 * 대역별 한 줄 판정 — CLAUDE.md 의 Empathetic Feedback 원칙에 맞춘 톤.
 * 압박("너무 어려움")이 아니라 다음 행동("먼저 N개")을 말한다.
 */
export const BAND_COPY: Record<FitBand, { label: string; verdict: string; action: string }> = {
  flow: {
    label: '술술 읽힘',
    verdict: '사전 없이 읽을 수 있어요.',
    action: '속도를 올려 다독하기 좋아요.',
  },
  growth: {
    label: '지금 딱 좋음',
    verdict: '새 단어를 맥락에서 익히기에 가장 좋은 구간이에요.',
    action: '그대로 읽으면서 모르는 단어만 담아 두세요.',
  },
  study: {
    label: '정독 구간',
    verdict: '한 번에 읽히진 않지만, 뜯어보면 얻는 게 많아요.',
    action: '단어를 먼저 훑고 읽으면 훨씬 수월해요.',
  },
  hard: {
    label: '도전 구간',
    verdict: '지금 실력보다 한 단계 위예요.',
    action: '문항 훈련용으로 쓰거나, 단어를 먼저 익히고 오세요.',
  },
  overload: {
    label: '아직 이른 글',
    verdict: '읽기보다 해독에 가까워져요.',
    action: '조금 쉬운 글로 올라온 다음 다시 만나요.',
  },
}

/** 판정 근거를 사람 말로 — 화면에서 "왜 이 숫자인가" 를 되짚을 수 있게 한다. */
export const SOURCE_COPY: Record<KnownSource, string> = {
  self_known: '내가 안다고 표시',
  self_unknown: '내가 모른다고 표시',
  fsrs: '학습 중 (기억 강도 반영)',
  level_assumed: '내 레벨로 추정',
  function_word: '기능어 · 비학습 표기',
  none: '처음 보는 단어',
}
