// apps/web/src/lib/srs/queue-builder.ts
//
// Vocaflow SRS — 큐 빌더
// CLAUDE.md §17 학습 모델 v2.0 — [6] 인지 축
//
// 추천 엔진이 결정한 strategy(blocked / hybrid / interleaved)에 따라
// SrsCard 배열을 학습 ID 시퀀스로 변환한다. DB에 의존하지 않는 순수 로직.
//
// 근거: Hwang(2025) Language Learning + Brunmair 메타분석
//   - Stability < 1d  → BLOCKED       (Cold default — 같은 단어 N회 반복)
//   - 1d ≤ S < 7d    → HYBRID        (Warm default — 라운드 로빈)
//   - S ≥ 7d         → INTERLEAVED   (Hot default — 결정적 셔플)

import type { SrsCard } from './types';

export type QueueStrategy = 'blocked' | 'hybrid' | 'interleaved';

export interface QueueOptions {
  strategy: QueueStrategy;
  /** Blocked: 각 카드 연속 반복 횟수 (default 3) */
  blockedRepeats?: number;
  /** Hybrid: 라운드 로빈 순환 횟수 (default 2) */
  hybridRepeats?: number;
  /** 큐 최대 길이 (default 20) */
  maxLength?: number;
  /** Interleaved 결정적 셔플 시드 (default 1) */
  seed?: number;
}

const DEFAULT_BLOCKED_REPEATS = 3;
const DEFAULT_HYBRID_REPEATS = 2;
const DEFAULT_MAX_LENGTH = 20;
const DEFAULT_SEED = 1;

/**
 * SrsCard 배열을 학습 큐(카드 ID 시퀀스)로 변환.
 *
 * @param cards  학습 대상 카드 배열 (이미 우선순위 정렬되어 있다고 가정)
 * @param options strategy + 세부 파라미터
 * @returns 카드 ID 시퀀스 (빈 입력 또는 maxLength ≤ 0 → 빈 배열)
 */
export function buildQueue(cards: SrsCard[], options: QueueOptions): string[] {
  if (cards.length === 0) return [];

  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  if (maxLength <= 0) return [];

  let raw: string[];
  switch (options.strategy) {
    case 'blocked':
      raw = buildBlocked(cards, options.blockedRepeats ?? DEFAULT_BLOCKED_REPEATS);
      break;
    case 'hybrid':
      raw = buildHybrid(cards, options.hybridRepeats ?? DEFAULT_HYBRID_REPEATS);
      break;
    case 'interleaved':
      raw = buildInterleaved(cards, options.seed ?? DEFAULT_SEED);
      break;
  }

  return raw.length > maxLength ? raw.slice(0, maxLength) : raw;
}

function buildBlocked(cards: SrsCard[], repeats: number): string[] {
  if (repeats <= 0) return [];
  const out: string[] = [];
  for (const card of cards) {
    for (let i = 0; i < repeats; i++) out.push(card.id);
  }
  return out;
}

function buildHybrid(cards: SrsCard[], repeats: number): string[] {
  if (repeats <= 0) return [];
  const out: string[] = [];
  for (let r = 0; r < repeats; r++) {
    for (const card of cards) out.push(card.id);
  }
  return out;
}

function buildInterleaved(cards: SrsCard[], seed: number): string[] {
  const ids = cards.map((c) => c.id);
  const shuffled = seededShuffle(ids, seed);
  return removeAdjacentDuplicates(shuffled);
}

// ─────────────────────────────────────────────────────────────────────
// 결정적 셔플 — Fisher-Yates + mulberry32 PRNG
// ─────────────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  const rand = mulberry32(seed >>> 0);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

// Why mulberry32: 32비트 시드 → 결정적 출력. 짧고 의존성 없음.
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function removeAdjacentDuplicates(arr: string[]): string[] {
  if (arr.length <= 1) return arr.slice();
  const out: string[] = [arr[0] as string];
  for (let i = 1; i < arr.length; i++) {
    const cur = arr[i] as string;
    if (cur !== out[out.length - 1]) out.push(cur);
  }
  return out;
}
