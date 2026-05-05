// apps/web/src/lib/srs/__tests__/queue-builder.test.ts
//
// CLAUDE.md §17.6 인지 축 — buildQueue 동작 검증

import { describe, it, expect } from 'vitest';
import { buildQueue } from '../queue-builder';
import type { SrsCard } from '../types';

function makeCard(id: string): SrsCard {
  return {
    id,
    difficulty: 6.0,
    stability: 1.0,
    lastReviewAt: null,
    nextReviewAt: null,
    moduleHistory: [],
    reviewCount: 0,
  };
}

const cardsABC = [makeCard('A'), makeCard('B'), makeCard('C')];
const cardsAB = [makeCard('A'), makeCard('B')];

describe('buildQueue — blocked', () => {
  it('각 카드를 blockedRepeats회 연속 반복', () => {
    const queue = buildQueue(cardsABC, { strategy: 'blocked', blockedRepeats: 3 });
    expect(queue).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C']);
  });

  it('default blockedRepeats=3', () => {
    const queue = buildQueue(cardsABC, { strategy: 'blocked' });
    expect(queue).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C']);
  });

  it('blockedRepeats=0 → 빈 배열', () => {
    const queue = buildQueue(cardsABC, { strategy: 'blocked', blockedRepeats: 0 });
    expect(queue).toEqual([]);
  });
});

describe('buildQueue — hybrid', () => {
  it('라운드 로빈 — [A,B] × 2 → [A,B,A,B]', () => {
    const queue = buildQueue(cardsAB, { strategy: 'hybrid', hybridRepeats: 2 });
    expect(queue).toEqual(['A', 'B', 'A', 'B']);
  });

  it('default hybridRepeats=2', () => {
    const queue = buildQueue(cardsAB, { strategy: 'hybrid' });
    expect(queue).toEqual(['A', 'B', 'A', 'B']);
  });

  it('hybridRepeats=3 — [A,B,C] × 3', () => {
    const queue = buildQueue(cardsABC, { strategy: 'hybrid', hybridRepeats: 3 });
    expect(queue).toEqual(['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C']);
  });
});

describe('buildQueue — interleaved', () => {
  it('결정성 — 같은 seed는 같은 결과', () => {
    const cards = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(makeCard);
    const q1 = buildQueue(cards, { strategy: 'interleaved', seed: 42 });
    const q2 = buildQueue(cards, { strategy: 'interleaved', seed: 42 });
    expect(q1).toEqual(q2);
  });

  it('서로 다른 seed는 서로 다른 결과 (충분히 큰 입력에서)', () => {
    const cards = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(makeCard);
    const q1 = buildQueue(cards, { strategy: 'interleaved', seed: 1 });
    const q2 = buildQueue(cards, { strategy: 'interleaved', seed: 2 });
    expect(q1).not.toEqual(q2);
  });

  it('인접 중복 없음', () => {
    const cards = ['A', 'B', 'C', 'D', 'E'].map(makeCard);
    const queue = buildQueue(cards, { strategy: 'interleaved', seed: 7 });
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i]).not.toBe(queue[i - 1]);
    }
  });

  it('모든 입력 카드 포함 (셔플은 순열)', () => {
    const cards = ['A', 'B', 'C', 'D', 'E'].map(makeCard);
    const queue = buildQueue(cards, { strategy: 'interleaved', seed: 99 });
    expect([...queue].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('buildQueue — maxLength', () => {
  it('blocked가 maxLength 초과 시 잘라냄', () => {
    const queue = buildQueue(cardsABC, {
      strategy: 'blocked',
      blockedRepeats: 5,
      maxLength: 7,
    });
    expect(queue).toEqual(['A', 'A', 'A', 'A', 'A', 'B', 'B']);
    expect(queue.length).toBe(7);
  });

  it('default maxLength=20', () => {
    const cards = Array.from({ length: 10 }, (_, i) => makeCard(String(i)));
    const queue = buildQueue(cards, { strategy: 'hybrid', hybridRepeats: 5 });
    // 10 × 5 = 50 → 20에서 잘림
    expect(queue.length).toBe(20);
  });

  it('maxLength=0 → 빈 배열', () => {
    const queue = buildQueue(cardsABC, { strategy: 'blocked', maxLength: 0 });
    expect(queue).toEqual([]);
  });
});

describe('buildQueue — 엣지 케이스', () => {
  it('빈 cards 입력 → 빈 배열 (모든 strategy)', () => {
    expect(buildQueue([], { strategy: 'blocked' })).toEqual([]);
    expect(buildQueue([], { strategy: 'hybrid' })).toEqual([]);
    expect(buildQueue([], { strategy: 'interleaved' })).toEqual([]);
  });

  it('카드 1개 — blocked는 N회 반복', () => {
    const queue = buildQueue([makeCard('X')], { strategy: 'blocked', blockedRepeats: 3 });
    expect(queue).toEqual(['X', 'X', 'X']);
  });

  it('카드 1개 — interleaved는 그대로', () => {
    const queue = buildQueue([makeCard('X')], { strategy: 'interleaved' });
    expect(queue).toEqual(['X']);
  });
});
