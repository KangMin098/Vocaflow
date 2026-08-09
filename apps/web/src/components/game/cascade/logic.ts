// apps/web/src/components/game/cascade/logic.ts
// Cascade 보드 규칙 — 순수 함수만. React 없음(테스트·재사용 가능).
//
// 보드는 COLS×ROWS 격자. index = row*COLS + col, row 0 = 최상단.
// 중력은 아래로 작용하고 빈 칸은 위에서 새 타일이 내려와 채운다.
//
// 규칙 두 개로만 굴러간다:
//   1) 학습자가 짚은 타일 → 그 타일과 **직교로 이어진 같은 단어 뭉치** 전체가 무너진다.
//   2) 무너진 뒤 중력으로 **같은 단어 3칸 이상**이 새로 이어지면 저절로 무너진다(연쇄).
// 그래서 생성 단계에서는 3칸 이상 뭉치를 절대 만들지 않는다 — 연쇄는 오직 낙하의 결과다.

import type { Word } from '@/components/game/_shared/gamekit';

export const COLS = 4;
export const ROWS = 4;
export const SIZE = COLS * ROWS;

/** 완주 조건 — 이만큼 인출하면 세션이 끝난다(2~4분 완결). */
export const GOAL = 40;
/** 물방울(목숨). 오답·시간초과 1회에 하나씩 마른다. */
export const LIVES = 3;
/** 보드가 돌로 굳어 게임이 불가능해지지 않게 하는 상한. */
export const MAX_ROCKS = 5;
/** 보드에 동시에 존재할 서로 다른 단어 수 — 인지 부하 상한(Sweller ~4±)과 스캔 시간의 타협. */
export const DISTINCT_MAX = 8;
export const DISTINCT_MIN = 5;

export type WordCell = { id: number; kind: 'word'; word: Word };
export type RockCell = { id: number; kind: 'rock' };
export type Cell = WordCell | RockCell;
export type Board = (Cell | null)[];

export const at = (r: number, c: number) => r * COLS + c;
export const rowOf = (i: number) => Math.floor(i / COLS);
export const colOf = (i: number) => i % COLS;

export function isWordCell(c: Cell | null | undefined): c is WordCell {
  return !!c && c.kind === 'word';
}

export function neighborsOf(i: number): number[] {
  const r = rowOf(i);
  const c = colOf(i);
  const out: number[] = [];
  if (r > 0) out.push(at(r - 1, c));
  if (r < ROWS - 1) out.push(at(r + 1, c));
  if (c > 0) out.push(at(r, c - 1));
  if (c < COLS - 1) out.push(at(r, c + 1));
  return out;
}

/** 보드에 있는 서로 다른 영단어 목록. */
export function distinctEns(b: Board): string[] {
  const s = new Set<string>();
  for (const cell of b) if (isWordCell(cell)) s.add(cell.word.en);
  return [...s];
}

/** 영단어별 현재 장수. */
export function wordCounts(b: Board): Map<string, number> {
  const m = new Map<string, number>();
  for (const cell of b) if (isWordCell(cell)) m.set(cell.word.en, (m.get(cell.word.en) ?? 0) + 1);
  return m;
}

export function rockCount(b: Board): number {
  let n = 0;
  for (const cell of b) if (cell && cell.kind === 'rock') n += 1;
  return n;
}

export function indexOfId(b: Board, id: number): number {
  for (let i = 0; i < b.length; i++) if (b[i]?.id === id) return i;
  return -1;
}

/** 같은 영단어로 직교 연결된 칸들(자기 자신 포함). */
export function clusterAt(b: Board, start: number): number[] {
  const head = b[start];
  if (!isWordCell(head)) return [];
  const en = head.word.en;
  const seen = new Set<number>([start]);
  const stack = [start];
  const out: number[] = [];
  while (stack.length) {
    const i = stack.pop()!;
    out.push(i);
    for (const n of neighborsOf(i)) {
      if (seen.has(n)) continue;
      const c = b[n];
      if (isWordCell(c) && c.word.en === en) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return out;
}

/** 크기 min 이상인 모든 동일 단어 뭉치(연쇄 대상). */
export function findChains(b: Board, min = 3): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < b.length; i++) {
    if (seen.has(i) || !isWordCell(b[i])) continue;
    const cl = clusterAt(b, i);
    for (const x of cl) seen.add(x);
    if (cl.length >= min) out.push(cl);
  }
  return out;
}

/** 주어진 칸들에 직교로 맞닿은 돌 칸(부서질 돌). */
export function adjacentRocks(b: Board, indices: number[]): number[] {
  const target = new Set(indices);
  const out = new Set<number>();
  for (const i of indices) {
    for (const n of neighborsOf(i)) {
      if (target.has(n)) continue;
      const c = b[n];
      if (c && c.kind === 'rock') out.add(n);
    }
  }
  return [...out];
}

export function removeIds(b: Board, ids: Set<number>): Board {
  return b.map((c) => (c && ids.has(c.id) ? null : c));
}

/** 중력 — 각 열의 칸을 아래로 모은다(리필 없음). fell = 떨어진 총 칸수(낙차). */
export function compact(b: Board): { board: Board; fell: number } {
  const next: Board = new Array(SIZE).fill(null);
  let fell = 0;
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = b[at(r, c)];
      if (!cell) continue;
      next[at(write, c)] = cell;
      if (write !== r) fell += write - r;
      write -= 1;
    }
  }
  return { board: next, fell };
}

/** i 에 en 을 놓으면 3칸 이상 뭉치가 생기는가(생성 단계 금지 조건). */
export function wouldChain(b: Board, i: number, en: string, min = 3): boolean {
  const probe = b.slice();
  probe[i] = { id: -1, kind: 'word', word: { en, ko: '' } };
  return clusterAt(probe, i).length >= min;
}

/**
 * 빈 칸을 아래에서 위로 채운다(중력 방향과 같은 순서라 열의 최하단 빈 칸부터).
 * choose 는 이미 채워진 상태의 보드를 보고 칸 하나를 만들어 돌려준다.
 */
export function fillEmpty(
  b: Board,
  choose: (board: Board, index: number) => Cell,
): { board: Board; newIds: number[] } {
  const next = b.slice();
  const newIds: number[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = at(r, c);
      if (next[i]) continue;
      const cell = choose(next, i);
      next[i] = cell;
      newIds.push(cell.id);
    }
  }
  return { board: next, newIds };
}

export function findAnswerIndexes(b: Board, en: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) if (isWordCell(b[i]) && (b[i] as WordCell).word.en === en) out.push(i);
  // 아래쪽(눈에 잘 띄는 곳)부터
  return out.sort((x, y) => rowOf(y) - rowOf(x));
}

/**
 * 뜻 하나에 주어지는 시간 — 인출을 거듭할수록 좁아진다.
 * 6.4초 → 2.6초. 계단이 아니라 연속 감소라서 "갑자기 불공정해지는" 구간이 없다.
 */
export function windowMsFor(clears: number): number {
  return Math.max(2600, Math.min(6400, 6400 - 95 * clears));
}

/** 막 — 압력 단계. 낙석 주기와 배경 밝기가 여기서 갈린다. */
export function actOf(clears: number): 1 | 2 | 3 {
  if (clears < 14) return 1;
  if (clears < 28) return 2;
  return 3;
}

/** 막별 낙석 주기(인출 n회마다 1개). 0 = 낙석 없음. */
export function rockCadence(act: 1 | 2 | 3): number {
  return act === 1 ? 0 : act === 2 ? 6 : 4;
}
