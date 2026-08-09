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
/**
 * 보드에 **동시에** 올라가는 서로 다른 단어의 상한(하드 캡).
 * ACTIVE 는 '아직 덜 나온 단어'의 정원 — 이미 두 번 나온 단어는 정원에서 빠져
 * 새 단어가 들어올 자리를 만든다(보드 회전). 회전을 pickTarget 이 아니라 보드
 * 생성 쪽에서 만드는 게 핵심이다: 출제는 균등 무작위여야 정보가 새지 않는다.
 */
export const DISTINCT_MAX = 8;
export const DISTINCT_ACTIVE = 6;
export const DISTINCT_MIN = 5;
/** 한 단어가 보드를 삼키지 않게 하는 장수 상한. */
export const COPY_MAX = 3;
/** 이 횟수만큼 출제된 단어는 더 복제하지 않는다 — 자리를 비워 다음 단어를 부른다. */
export const RETIRE_ASKED = 2;

// ─── 통화(currency) 상수 ──────────────────────────────────────────────────
// 감사 지적: 낙차12·뭉치45·돌70 이 **전부 점수**라 "어느 장을 짚나"가 결정이 안 됐다
// (최선-최저 격차 8점 = 숙고 0.2초 비용). 세 갈래를 서로 다른 통화로 가른다.
//   · 돌 옆의 장 → 다음 뜻의 **시간**
//   · 뭉친 장   → 예약된 **낙석 취소**(보드) + 만조(목숨)
//   · 낮은 장   → **점수**. 대신 2막부터 깊은 낙차는 보드를 흔들어 낙석을 부른다(비용).

/** 속도 보너스 가중치. 140 → 70: 숙고 1초의 값이 54점/초 → 27점/초로 내려간다. */
export const SPEED_PT = 70;
/** 낙차 1칸당 점수 — '낮은 장 = 점수' 통화. */
export const FALL_PT = 12;
/** 돌 1개 파괴 → 다음 뜻 제한시간 가산. */
export const ROCK_TIME_MS = 900;
/** 한 턴에 얻을 수 있는 시간 상한(돌 2개분). */
export const ROCK_TIME_CAP_MS = 1800;
/** 이 낙차 이상이면 보드가 흔들려 낙석이 하나 예약된다(2막부터). */
export const DEEP_FELL = 4;
/** 만조 게이지가 이만큼 차면 물방울 하나. */
export const TIDE_NEED = 2;
/**
 * 세션당 물방울 환급 상한 — 콤보 순환으로 목숨을 무한 환급하던 구멍의 뚜껑.
 * 2 인 이유: 고의로 '맞히다 틀리다'를 순환하는 플레이어의 완주 하한 정확도를
 * 시뮬로 재면 상한 4 → 85.7%, 3 → 87.5%, 2 → 88.9% 다(구판 콤보 순환은 90.9%).
 * 2 여야 "환급을 노리고 일부러 끊는" 쪽이 구판보다 유의하게 유리해지지 않는다.
 */
export const TIDE_MAX_REFUND = 2;

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

/** 이 칸이 돌과 맞닿아 있는가 — 어포던스 표식용(정답과 무관하므로 정보 누출 없음). */
export function touchesRock(b: Board, i: number): boolean {
  for (const n of neighborsOf(i)) {
    const c = b[n];
    if (c && c.kind === 'rock') return true;
  }
  return false;
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

/**
 * 막별 낙석 주기(인출 n회마다 1개). 0 = 낙석 없음.
 * 6/4 였을 때 세션 전체 예약 낙석이 4개뿐이라 보드 위 돌이 평균 0.4개였고
 * "3막 압력의 실체가 시계 하나뿐"이라는 감사 지적을 받았다. 3/2 로 올려
 * 무실수 플레이 기준 평균 0.7개(측정) — 돌이 실제로 보드에 남아 통화가 된다.
 */
export function rockCadence(act: 1 | 2 | 3): number {
  return act === 1 ? 0 : act === 2 ? 3 : 2;
}

// ─── 동의어 충돌 ──────────────────────────────────────────────────────────
//
// '줄이다/줄어들다', '측정하다/측정' 처럼 뜻이 겹치는 두 단어가 같은 보드에 오르면
// **뜻을 아는 학습자가 오답 처리**된다(구판은 ko 완전일치만 걷어냈다).
// 풀에서 지우지 않고 **같은 보드에 동시에 올리지 않는** 제약으로만 푼다 —
// 지워 버리면 그 단어는 세션에서 영영 학습되지 않는다.

/** 비교용 정규화 — 공백·중점·괄호 주석 제거. */
export function normKo(ko: string): string {
  return ko
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s·,~]/g, '')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[b.length];
}

/**
 * 두 뜻이 같은 보드에서 충돌하는가.
 *  (a) 한쪽이 다른 쪽을 통째로 품는다 — 측정 ⊂ 측정하다, 경향 ⊂ ~하는 경향이 있는
 *  (b) 3글자 이상끼리 편집거리 2 이하 — 줄이다 ↔ 줄어들다, 내성적인 ↔ 내향적인
 *
 * (b)의 '3글자 이상' 이 중요하다. 두 글자 명사에까지 편집거리를 적용하면
 * 결과/결정 · 용기/용서 · 실수/실패 · 능력/능률 처럼 **전혀 헷갈리지 않는** 쌍이
 * 무더기로 걸려 보드 다양성이 무너진다(측정: 한글 2자 명사는 한 음절만 달라도
 * 편집거리 1). 헷갈리는 쌍은 대개 어간을 공유하는 3자 이상 용언이다.
 */
export function koClash(a: string, b: string): boolean {
  const x = normKo(a);
  const y = normKo(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x))) return true;
  if (Math.min(x.length, y.length) < 3) return false;
  return levenshtein(x, y) <= 2;
}

/** 풀 전체의 충돌 쌍표 — 보드 생성에서 "이 단어는 지금 못 올린다" 판정에 쓴다. */
export function buildClashMap(words: Word[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const w of words) m.set(w.en, new Set<string>());
  // 풀이 아주 큰 경우 O(n²) 를 피한다 — 그때는 완전일치 중복만 이미 제거된 상태로 둔다.
  if (words.length > 400) return m;
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      if (!koClash(words[i].ko, words[j].ko)) continue;
      m.get(words[i].en)!.add(words[j].en);
      m.get(words[j].en)!.add(words[i].en);
    }
  }
  return m;
}
