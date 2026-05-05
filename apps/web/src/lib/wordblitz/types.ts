// apps/web/src/lib/wordblitz/types.ts
// WordBlitz 게임 타입 정의

import type { Word, PlushieType } from './data';

export type GamePhase = 'idle' | 'dropping' | 'grabbing' | 'returning' | 'showing-result';

export interface PlushieInstance {
  id: string;
  word: Word;
  type: PlushieType;
  isTarget: boolean;
  /** 박스 안 좌표 [x, y, z] - y는 항상 0.05 (분홍 바닥 위) */
  position: [number, number, number];
  /** 자연스러움을 위한 Y 회전 각도 */
  rotationY: number;
}

export interface GameState {
  clawX: number;
  clawY: number;
  clawSwing: number;
  clawOpen: number;

  phase: GamePhase;
  grabbedPlushieId: string | null;

  plushies: PlushieInstance[];
  targetWord: Word | null;

  score: number;
  captured: number;

  lastResult: {
    word: Word;
    isCorrect: boolean;
    points: number;
  } | null;
}

export interface ClawTargets {
  clawTargetX: number;
  clawTargetY: number;
  clawTargetOpen: number;
  clawSwingVel: number;
  prevX: number;
}

export interface LiveClawState {
  clawX: number;
  clawY: number;
  clawSwing: number;
  clawOpen: number;
}
