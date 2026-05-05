// apps/web/src/lib/pirate-quest/types.ts

import type { PirateWord } from './data';

export type GamePhase = 'intro' | 'playing' | 'feedback' | 'complete';

/** 단어가 화면 어느 슬롯에 배치되었는지 (게임 시작 시 결정, 라운드 동안 고정) */
export interface ItemPlacement {
  word: PirateWord;
  slot: { x: number; z: number };
}

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  /** 정답 단어 */
  targetWord: PirateWord | null;
  /** 17개 모든 단어의 화면 배치 (게임 시작 시 셔플, 라운드 변해도 고정) */
  itemPlacements: ItemPlacement[];
  /** 이번 라운드 4개 영단어 선택지 (정답 1 + 오답 3) */
  fourChoices: PirateWord[];
  score: number;
  streak: number;
  maxStreak: number;
  correct: number;
  /** 라운드 시작 시점 (시간 보너스 계산용) */
  roundStartedAt: number;
  /** 이번 라운드 힌트 사용 여부 */
  hintUsed: boolean;
  /** 힌트 활성화 (정답 GLB 외곽선 빛남) */
  hintActive: boolean;
  lastResult: {
    word: PirateWord;
    isCorrect: boolean;
    points: number;
    /** 시간 보너스 (5초 이내 정답) */
    timeBonus: number;
    /** 힌트 패널티 */
    hintPenalty: number;
  } | null;
  collected: PirateWord[];
}
