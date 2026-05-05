// apps/web/src/components/pairflip/constants.ts
// CLAUDE.md §17.5 SDT 자율성 + §17.6 인지 부하 정합

import type { PairFlipLevelConfig } from './types'

/**
 * 5단계 난이도 v3 (v06.17.2) — 모든 레벨 2줄 고정
 *
 * Easy   4쌍  8장  → 4×2 ★ MIN
 * Normal 5쌍 10장  → 5×2 ★ DEFAULT
 * Hard   6쌍 12장  → 6×2
 * Expert 8쌍 16장  → 8×2
 * Master 10쌍 20장 → 10×2
 *
 * 좁은 화면에서 가로 스크롤 (Grid `overflow-x-auto` + minmax 카드 너비).
 */
export const PAIRFLIP_LEVELS: PairFlipLevelConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    emoji: '🌱',
    pairCount: 4,
    cardCount: 8,
    timeLimit: 90,
    gridCols: 4,
    description: '워밍업',
  },
  {
    id: 'normal',
    label: 'Normal',
    emoji: '🎯',
    pairCount: 5,
    cardCount: 10,
    timeLimit: 120,
    gridCols: 5,
    description: '기본 추천',
  },
  {
    id: 'hard',
    label: 'Hard',
    emoji: '🔥',
    pairCount: 6,
    cardCount: 12,
    timeLimit: 150,
    gridCols: 6,
    description: '도전',
  },
  {
    id: 'expert',
    label: 'Expert',
    emoji: '🚀',
    pairCount: 8,
    cardCount: 16,
    timeLimit: 210,
    gridCols: 8,
    description: '심화',
  },
  {
    id: 'master',
    label: 'Master',
    emoji: '👑',
    pairCount: 10,
    cardCount: 20,
    timeLimit: 270,
    gridCols: 10,
    description: '마스터',
  },
]

export const DEFAULT_LEVEL: PairFlipLevelConfig = PAIRFLIP_LEVELS[1] // Normal

/**
 * 점수 시스템 — Skinner Variable Ratio 정합
 *
 * 매번 같은 보상은 도파민 둔화 → 콤보 단계별 보상 가속.
 */
export const PAIRFLIP_SCORE = {
  matchBase: 100,
  comboMultiplier: {
    1: 1.0,
    2: 1.2,
    3: 1.5, // 시각 보상 단계 1
    4: 1.8,
    5: 2.5, // 시각 보상 단계 2
    7: 4.0, // 시각 보상 단계 3 (무지개 폭발)
  } as Record<number, number>,
  hintPenalty: -30,
  timeBonus: 2, // 남은 시간 1초당 (게임 종료 시)
  perfectBonus: 500, // 첫 시도 100% 매칭 (실패 0회)
}

/** 콤보 시각 보상 단계 (도파민 가속) */
export const COMBO_TIERS = {
  3: 'sparkle', // 별 1개 폭발
  5: 'burst', // 별 6개 폭발 + 텍스트 "GREAT!"
  7: 'rainbow', // 무지개 별 8개 + 텍스트 "AMAZING!"
} as const

export function getComboMultiplier(combo: number): number {
  // descending lookup — 가장 높은 충족 단계 채택
  const tiers = [7, 5, 4, 3, 2, 1]
  for (const t of tiers) {
    if (combo >= t && PAIRFLIP_SCORE.comboMultiplier[t]) {
      return PAIRFLIP_SCORE.comboMultiplier[t]
    }
  }
  return 1.0
}

/**
 * FSRS rating 매핑 (CLAUDE.md §17.4 정합)
 *
 * 첫 시도 매칭     → 4 (Easy)
 * 2회 시도 매칭    → 3 (Good)
 * 3~4회 시도 매칭  → 2 (Hard)
 * 5회+ 또는 미매칭 → 1 (Again)
 */
export function pairAttemptsToFSRSRating(
  attempts: number,
  matched: boolean,
): 1 | 2 | 3 | 4 {
  if (!matched) return 1
  if (attempts <= 1) return 4
  if (attempts <= 2) return 3
  if (attempts <= 4) return 2
  return 1
}

/** Empathetic Feedback 카피 (CLAUDE.md "공감 피드백" 정합) */
export function getResultCopy(accuracy: number): { title: string; sub: string } {
  if (accuracy >= 100) return { title: '완벽해요!', sub: '모든 짝을 찾았어요' }
  if (accuracy >= 70) return { title: '잘했어요!', sub: '거의 다 맞췄네요' }
  if (accuracy >= 40) return { title: '좋은 도전이었어요', sub: '다시 만나봐요' }
  return { title: '한 번 더 해볼까요', sub: '곧 익숙해질 거예요' }
}

/** sessionStorage 키 — config / result 전달용 */
export const STORAGE_KEYS = {
  config: 'pairflip-config',
  result: 'pairflip-result',
} as const
