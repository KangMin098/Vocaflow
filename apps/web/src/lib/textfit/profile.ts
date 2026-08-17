// apps/web/src/lib/textfit/profile.ts
//
// 레벨 프로파일 — 한 지문이 **여러 학습자 레벨에서 각각 어떻게 보이는지** 를 한 번에 낸다.
//
// 왜 이게 따로 필요한가:
//   TextFit(coverage.ts)은 "이 학습자 × 이 지문" 을 잰다. 개인 기억 상태가 있어야 한다.
//   그런데 **교사에게는 개인 기억이 없다** — 교사의 질문은 "내가 아는가" 가 아니라
//   "우리 반(고2)에게 이 지문이 맞나" 이고, 심지어 "이건 몇 학년용인가" 다.
//   즉 레벨 기준 판정은 로그인 모드의 열화판이 아니라 **교사에게는 정확한 모드**다.
//
// 경쟁 지형: Lexile·ATOS 는 지문에 **숫자 하나**를 붙인다(독자 점수는 따로 잰다).
//   여기서는 지문 하나에 **레벨별 곡선**을 붙인다 — "고1 88% · 고2 93% · 수능 96%".
//   그래서 "몇 학년용" 이라는 교사의 실제 질문에 직접 답한다.
//
// 데이터 경로: `shared_words`(v_level 보유 20,776 표제어)는 anon 이 읽을 수 있다.
//   `shared_dictionary` 는 authenticated 전용이라 공개 화면에서 쓸 수 없다(2026-08-17 실측).

import { BAND_THRESHOLDS, bandFor } from './coverage'
import type { FitBand } from './types'

/** 진단 V-Level 축. 0·11 은 양 끝 특수값이라 프로파일에서 제외한다. */
export const PROFILE_LEVELS = [3, 4, 5, 6, 7, 8, 9, 10] as const
export type ProfileLevel = (typeof PROFILE_LEVELS)[number]

/**
 * V-Level → 한국 학습자가 자기를 알아보는 이름.
 *
 * 이 표는 새로 만든 것이 아니라 `components/library/vocab/categories.ts` 의
 * `CATEGORY_VLEVEL`(middle 4 · high 6 · csat 7 · business 8 · eng_test 9)을 따른다 —
 * 두 곳에서 레벨의 뜻이 갈리면 같은 학습자가 화면마다 다른 학년으로 불린다.
 */
export const LEVEL_LABEL: Record<ProfileLevel, string> = {
  3: '초등 고학년',
  4: '중1–2',
  5: '중3',
  6: '고1',
  7: '고2 · 수능 기본',
  8: '수능 심화 · 실무',
  9: '공인영어 · 토익',
  10: '학술 · 원서',
}

/** 한 단어의 공개 모드 판정 — 개인 기억이 없으므로 레벨과 해석 여부만 본다. */
export type PublicWordStatus =
  /** `shared_words` 에서 v_level 을 찾았다 */
  | 'leveled'
  /** 실재하는 영단어인데(`lexicon_clean`) 학습 어휘 목록 밖 — 레벨 미상 */
  | 'unleveled'
  /** 사전 어디에도 없다 — 고유명사·오탈자·비영어 토큰일 가능성 */
  | 'unresolved'

export interface PublicWord {
  /** 원문 표면형 */
  surface: string
  /** 해석된 표제어 (없으면 표면형 그대로) */
  lemma: string
  /** 이 지문에서의 출현 횟수 */
  count: number
  status: PublicWordStatus
  /** `leveled` 일 때만 채워진다 */
  vLevel: number | null
}

/** 레벨 하나에서의 판정. */
export interface LevelReading {
  level: ProfileLevel
  label: string
  /** 레벨 미상을 **전부 안다고** 볼 때 — 낙관 상한 */
  coverageHigh: number
  /** 레벨 미상을 **전부 모른다고** 볼 때 — 보수 하한 */
  coverageLow: number
  /** 중앙 추정 — 레벨 미상의 절반을 안다고 본다 */
  coverage: number
  band: FitBand
  /** 이 레벨 학습자에게 미지어인 단어 수 (레벨 미상 제외) */
  unknownWords: number
}

export interface LevelProfile {
  /** 러닝 워드 수 — 커버리지 분모 */
  totalTokens: number
  /** 학습 대상 unique 단어 수 */
  uniqueContentWords: number
  /** 레벨별 판정 — PROFILE_LEVELS 순서 */
  readings: LevelReading[]
  /**
   * **적정 레벨** — 다독 적정(0.95)에 처음 닿는 가장 낮은 레벨. 없으면 null.
   * 교사의 "이거 몇 학년용?" 에 대한 한 줄 답이다.
   */
  fitLevel: ProfileLevel | null
  /** 이 지문의 어휘 난도 대표값 — 내용어 V-Level 의 P75(추출 RPC 와 같은 통계) */
  textVLevel: number | null
  /** 레벨 해석이 된 토큰 비율 0~1 — 낮을수록 판정 범위가 넓어진다 */
  resolvedShare: number
  /** 가장 어려운 단어들 — V-Level 내림차순, 동률은 빈도순 */
  hardestWords: PublicWord[]
  /** 상태별 토큰 수 (합 + 기능어 = totalTokens) */
  breakdown: Record<PublicWordStatus | 'function_word', number>
}

/**
 * 레벨 프로파일을 계산한다.
 *
 * 분모는 기능어를 포함한 러닝 워드(Hu & Nation 정의). 토크나이저가 뺀 stopword 는
 * 기지어로 본다 — 중고생 이상 타깃에서 the/of/a 를 미지어로 세면 숫자가 의미를 잃는다.
 */
export function buildLevelProfile(words: PublicWord[], totalTokens: number): LevelProfile {
  const total = Math.max(0, totalTokens)

  let leveledTokens = 0
  let unleveledTokens = 0
  let unresolvedTokens = 0
  for (const w of words) {
    if (w.status === 'leveled') leveledTokens += w.count
    else if (w.status === 'unleveled') unleveledTokens += w.count
    else unresolvedTokens += w.count
  }
  const contentTokens = leveledTokens + unleveledTokens + unresolvedTokens

  // 레벨 미상 = 안다고도 모른다고도 할 수 없는 질량. 범위로 정직하게 노출한다.
  const uncertainTokens = unleveledTokens + unresolvedTokens
  const uncertainShare = total > 0 ? Math.min(1, uncertainTokens / total) : 0

  const readings: LevelReading[] = PROFILE_LEVELS.map((level) => {
    let unknownMass = 0
    let unknownWords = 0
    for (const w of words) {
      if (w.status !== 'leveled' || w.vLevel === null) continue
      if (w.vLevel > level) {
        unknownMass += w.count
        unknownWords += 1
      }
    }

    const clamped = total > 0 ? Math.min(unknownMass, total) : 0
    // 상한: 레벨 미상을 전부 안다고 본다 → 미지 질량은 leveled 분만.
    const coverageHigh = total > 0 ? Math.min(1, Math.max(0, 1 - clamped / total)) : 1
    // 하한: 레벨 미상을 전부 모른다고 본다.
    const coverageLow = Math.max(0, coverageHigh - uncertainShare)
    // 중앙: 절반. 어느 쪽으로도 유리하게 기울이지 않는다.
    const coverage = Math.max(0, Math.min(1, coverageHigh - uncertainShare / 2))

    return {
      level,
      label: LEVEL_LABEL[level],
      coverage,
      coverageLow,
      coverageHigh,
      band: bandFor(coverage),
      unknownWords,
    }
  })

  // 적정 레벨 = 중앙 추정이 다독 적정(0.95)에 처음 닿는 가장 낮은 레벨.
  //   상한이 아니라 중앙으로 판정한다 — 낙관값으로 학년을 낮게 부르면 교사가 헛수고를 한다.
  const fit = readings.find((r) => r.coverage >= BAND_THRESHOLDS.growth)

  const hardestWords = words
    .filter((w) => w.status === 'leveled' && w.vLevel !== null)
    .sort((a, b) => (b.vLevel! !== a.vLevel! ? b.vLevel! - a.vLevel! : b.count - a.count))
    .slice(0, 24)

  return {
    totalTokens: total,
    uniqueContentWords: words.length,
    readings,
    fitLevel: fit ? fit.level : null,
    textVLevel: percentile75(words),
    resolvedShare: contentTokens > 0 ? leveledTokens / contentTokens : 0,
    hardestWords,
    breakdown: {
      leveled: leveledTokens,
      unleveled: unleveledTokens,
      unresolved: unresolvedTokens,
      function_word: Math.max(0, total - contentTokens),
    },
  }
}

/**
 * 지문의 어휘 난도 대표값 — 내용어 V-Level 의 P75.
 *
 * 평균이 아니라 P75 인 이유: 평균은 쉬운 단어가 다수라 항상 낮게 나와서 지문 간 변별이 없다.
 * `extract_vocabulary_for_user_v2` 가 이미 같은 통계(percentile_disc 0.75)를 쓰므로
 * **추출 화면과 공개 화면이 같은 숫자를 말하게** 맞춘다.
 * type 기준(단어 종류)으로 센다 — token 기준이면 반복되는 쉬운 단어가 지배한다.
 */
function percentile75(words: PublicWord[]): number | null {
  const levels = words
    .filter((w) => w.status === 'leveled' && w.vLevel !== null)
    .map((w) => w.vLevel!)
    .sort((a, b) => a - b)

  if (levels.length === 0) return null
  // percentile_disc — 실제 존재하는 값 하나를 고른다(보간 없음). Postgres 와 같은 정의.
  const idx = Math.ceil(levels.length * 0.75) - 1
  return levels[Math.max(0, Math.min(levels.length - 1, idx))]!
}

/** 프로파일 한 줄 요약 — 교사가 제일 먼저 읽는 문장. */
export function profileHeadline(p: LevelProfile): string {
  if (p.uniqueContentWords === 0) return '분석할 영어 단어가 아직 없어요.'
  if (p.fitLevel === null) {
    return '이 지문은 학술 원서 수준이에요 — 고등 교육과정 범위를 넘어섭니다.'
  }
  return `이 지문은 ${LEVEL_LABEL[p.fitLevel]} 수준이면 편하게 읽혀요.`
}
