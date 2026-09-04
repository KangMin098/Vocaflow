// apps/web/src/lib/marketing/hero-demo.ts
//
// 랜딩 히어로의 **작동하는 증명** — 지문 하나를 서버에서 실제로 분석해 내려보낸다.
//
// 왜 이게 필요했나 (2026-09-04 실측):
//   랜딩은 "글의 난이도가 아니라 내가 아는 비율" 이라고 **말만** 하고 있었다. 그 주장은
//   본질적으로 **그림**인데(지문 위에 아는 낱말과 모르는 낱말이 갈려 보이는 것) 산문으로 쓰면
//   증명이 사라지고 주장만 남는다. 그리고 그것을 눈으로 보려면 랜딩 CTA → `/fit` → 예시 →
//   분석까지 **클릭 3번**이 필요했다. 그 사이가 전부 이탈 구간이다.
//   → 규칙으로 못 박고(`DESIGN_SYSTEM.md §🎯` I1·I2·I3) 여기서 이행한다.
//
// ── 왜 미리 계산해서 통째로 내려보내나 ──────────────────────────────
//   방문자가 레벨을 바꿀 때마다 API 를 부르면 (a) 200ms 안에 못 돌아오고 (b) 랜딩 트래픽이
//   `/fit` 레이트리밋 버킷을 먹는다. 레벨축은 8칸뿐이라 **8개 판정을 한 번에 계산해 두면**
//   조작은 순수 클라이언트 상태 전환이 된다 — 네트워크 0, 지연 0.
//
// ── 왜 지문이 상수인가 ──────────────────────────────────────────────
//   증명의 목적은 "이 지문이 어렵다" 가 아니라 **"같은 글이 사람마다 다른 숫자를 낸다"** 이다.
//   지문이 매번 바뀌면 그 대조가 성립하지 않는다. 그리고 상수 지문이라야 하루 한 번 계산해
//   캐시할 수 있다(랜딩은 `revalidate = 86400`).
//
// ⚠️ 지문은 **직접 쓴 문장**이다. 인용이 아니므로 출처 표기 문제가 없고, 레벨 분포가
//    초등~학술까지 고르게 퍼지도록 어휘를 골랐다(이게 곡선을 보여 주는 조건이다).

import { analyzeCounts } from '@/lib/textfit/analyze'
import type { LevelReading, ProfileLevel } from '@/lib/textfit/profile'
import { tokenizeText } from '@/lib/text-extract/tokenize'

/** 히어로 데모 지문 — 자체 작성. 러닝 워드 약 70. */
export const HERO_PASSAGE =
  'Every reader encounters the same page differently. A familiar word slips past almost unnoticed, ' +
  'while an unfamiliar one interrupts the sentence and demands to be decoded. Comprehension therefore ' +
  'depends less on the intrinsic difficulty of a passage than on the proportion of its vocabulary you ' +
  'already command. That proportion is measurable, and it fluctuates as your memory of each word ' +
  'consolidates or decays.'

/** 화면에 그려질 조각 하나 — 낱말이거나 그 사이의 공백·문장부호다. */
export interface HeroToken {
  /** 원문 표면형 그대로 (대소문자·문장부호 보존) */
  t: string
  /**
   * 사전 V-Level. `null` 은 **레벨 미상**(실재하는 낱말이지만 학습 어휘 목록 밖).
   * `undefined` 는 애초에 학습 대상이 아니다 — 기능어·문장부호·공백.
   */
  v?: number | null
}

export interface HeroDemo {
  tokens: HeroToken[]
  /** 레벨별 판정 — `PROFILE_LEVELS` 순서 */
  readings: LevelReading[]
  /** 다독 적정(95%)에 처음 닿는 레벨 */
  fitLevel: ProfileLevel | null
  /** 러닝 워드 수 — 커버리지 분모 */
  totalTokens: number
}

/**
 * 원문을 낱말 / 비낱말로 쪼갠다 — 순서와 문장부호를 그대로 살려 다시 그려야 한다.
 *
 * export 인 이유: **이어 붙이면 원문과 글자 하나까지 같아야 한다**는 것이 이 화면의 정직성
 * 조건이다(지문을 조용히 잘라 놓고 그 지문의 커버리지라고 말하면 안 된다). 회귀가 그것을 잰다.
 */
export function splitSurface(text: string): string[] {
  return text.split(/([A-Za-z]+(?:'[A-Za-z]+)?)/).filter((s) => s.length > 0)
}

/**
 * 히어로 데모를 계산한다. 실패하면 `null` — **히어로가 사라지는 게 아니라 증명만 빠진다.**
 *
 * 빈 값을 만들어 넣지 않는다. 0% 커버리지가 그려지면 그건 분석 실패가 아니라
 * "이 글은 아무도 못 읽는다" 로 읽히고, 그건 거짓이다.
 */
export async function buildHeroDemo(): Promise<HeroDemo | null> {
  try {
    const tokenization = tokenizeText(HERO_PASSAGE)
    const { profile, words, lemmaBySurface } = await analyzeCounts(
      tokenization.counts,
      tokenization.totalWords,
      // 지문이 상수이므로 전체 레벨 맵(콜드 88초)을 올리지 않는다 — 이 낱말들만 묻는다.
      { targetedLevels: true },
    )
    if (profile.readings.length === 0) return null

    const levelByLemma = new Map(words.map((w) => [w.lemma, w.vLevel]))

    const tokens: HeroToken[] = splitSurface(HERO_PASSAGE).map((piece) => {
      if (!/^[A-Za-z]/.test(piece)) return { t: piece }
      const lemma = lemmaBySurface.get(piece.toLowerCase())
      // 토크나이저가 뺀 것(기능어 등)은 학습 대상이 아니다 — 칠하지 않는다.
      if (lemma === undefined) return { t: piece }
      return { t: piece, v: levelByLemma.get(lemma) ?? null }
    })

    return {
      tokens,
      readings: profile.readings,
      fitLevel: profile.fitLevel,
      totalTokens: profile.totalTokens,
    }
  } catch (err) {
    // 랜딩은 뜬다. 증명만 빠진다 — 그 사실은 로그에 남긴다.
    console.error('[hero-demo] 계산 실패:', err)
    return null
  }
}
