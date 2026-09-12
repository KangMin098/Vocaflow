// apps/web/src/components/game/connections/puzzle.ts
// Connections 격자 생성기 — 학습자 단어장에서 "숨은 규칙 격자"를 절차적으로 만든다.
//
// 설계 근거 (v07.9 재설계)
//   이전 판은 큐레이션 퍼즐 5개를 순환했고 타일마다 한글 뜻을 인쇄했다. 그래서
//   ① 영어를 몰라도 한글만 읽고 20초에 풀렸고 ② 5판이면 콘텐츠가 소진됐고
//   ③ 학습자 단어장을 한 글자도 쓰지 않아 learning_records 가 0건이었다.
//
//   해결의 핵심은 **어느 쪽을 숨기느냐**다. 보드에는 한국어 뜻만 인쇄하고,
//   그룹을 잇는 규칙은 **숨겨진 영단어의 형태**에 둔다. 그러면
//     · 뜻 → 영단어를 머릿속에서 인출하지 않으면 규칙 자체가 보이지 않는다(Active Recall)
//     · 규칙은 철자처럼 **객관적으로 검증 가능**해서 판정이 불공정할 여지가 없다
//     · 어떤 단어 묶음에서도 절차적으로 생성되므로 매 판 새 격자가 나온다
//
// v07.10 적대적 반증 대응 — 세 구멍을 생성기 차원에서 막았다.
//   A) **정찰 익스플로짓**: 라운드 1을 끝내면 확정 막대가 12단어의 en 을 인쇄하는데,
//      다음 격자가 같은 풀에서 다시 뽑혀 2·3라운드 보드의 40~98%(실측)가 "이미 철자를
//      본 타일"이었다. 인출 게임이 세션의 3분의 2에서 기억력 게임으로 무너진다.
//      → `exposed`(en 을 이미 인쇄한 타일 id)를 받아 **그룹 단어는 거기서 뽑지 않는다**.
//   B) **품사 규칙 누수**: 한국어 뜻이 품사를 그대로 노출한다(동사 뜻의 99%가 '~다'
//      종결). '품사' 칩이 뜨면 한글 어미만 훑어 4개를 공짜로 특정할 수 있었고, 실측
//      28.0% 의 라운드에 이 규칙이 들어갔다. → POS 규칙 **제거**. 대신 철자를 통째로
//      인출해야만 판정되는 '들어 있는 글자'(has) 규칙을 넣어 규칙 종류 수를 유지한다.
//   C) **동일 kind 함정**: 칩은 규칙의 "종류"만 공개하는데, 같은 종류의 **다른** 규칙이
//      보드에서 정확히 4개를 만족하면 칩이 거짓말이 된다(실측 79.9% 의 보드에 존재).
//      → 침입자까지 확정한 **최종 보드**를 다시 검사해 그런 시도는 기각한다.
//
// v07.11 풀 크기 스케일 다운 — "16칸 × 3격자" 고정 규격을 버렸다.
//   문제: 규격이 고정이라 세 격자를 겹치지 않게 채우는 데 48타일이 필요했고, 그래서
//   진입 하한이 24단어였다. DB 실측상 공용 단어장·도서 챕터 653세트의 **43.2%** 가
//   24단어에 미달한다 — 학습자가 고른 챕터의 절반 가까이를 거절하고 있었다.
//   해결: 보드 칸 수·그룹 수·침입자 수·라운드 수를 **전부 풀 크기의 함수**로 만든다.
//     · groupCap(noise) = floor(16 / (4 × (1 + noise)))  — 보드 상한 16칸에서 역산
//     · intrudersFor(g, noise) = clamp(round(4g × noise), 4, 16 − 4g)
//     · planFor(P) = 각 격자가 `4·Σ그룹 + 침입자 + 탐색여지 4 ≤ P` 를 만족하는
//       최대 라운드 / 최대 그룹 조합 (20타일이면 3격자, 44타일이면 v07.10 규격 그대로)
//   품질 하한은 **함수가 아니라 상수**로 남긴다 — 침입자는 어떤 보드에서도 최소 4칸이다.
//   침입자가 0이면 마지막 그룹이 소거법으로 공짜가 되므로, 그룹 수를 깎아서라도
//   침입자 4칸을 먼저 확보한다(seatIntruders). 그래서 최소 보드는 4+4 = 8칸이고
//   그것이 이 게임의 구조적 하한이다.
//
// 격자 불변식 (이걸 깨면 문제가 불공정해진다)
//   1. 선택된 규칙 하나당 보드 위 만족 단어가 **정확히 4개**.
//   2. 각 그룹 단어는 선택된 규칙 중 **자기 규칙 하나만** 만족.
//   3. 침입자(어느 그룹에도 없는 단어)는 선택된 규칙을 **하나도** 만족하지 않는다.
//      그리고 침입자는 **항상 4칸 이상** — 소거법으로 마지막 그룹이 확정되지 않는다.
//   4. (v07.10) 보드 위에 **선택 규칙과 같은 종류이면서 정확히 4개를 만족하는 다른
//      규칙**이 없다 — 칩에 적힌 종류로 좁힌 답이 유일하다.
//   5. 보드에 같은 타일 id 가 두 번 오르지 않는다(중복 타일 = 불공정).
//   위 다섯이 보장되면 정답 분할은 유일하고, 칩은 거짓말을 하지 않는다.

import { shuffle, type Word } from '@/components/game/_shared/gamekit';

export type RuleKind = 'start' | 'end' | 'prefix' | 'suffix' | 'len' | 'has' | 'spell';

export interface TileWord extends Word {
  /** 보드 키 — 정규화 철자(중복 제거 후 유일). */
  id: string;
  /** 소문자 알파벳만 남긴 철자 — 모든 규칙 판정의 기준. */
  norm: string;
  /** 학습자 단어장에서 온 단어인가 — false 면 FSRS 에 적재하지 않는다. */
  own: boolean;
}

export interface Rule {
  id: string;
  kind: RuleKind;
  /** 제출 전에 공개되는 것 — "무엇에 관한 규칙인가"(값은 감춘다). */
  kindLabel: string;
  /** 제출 후에만 공개되는 것 — 규칙의 실제 값. */
  valueLabel: string;
  /** 1(명백) ~ 4(까다로움). 점수 배수의 기준. kind 마다 고정이라 칩에 미리 공개해도
   *  정답 정보가 새지 않는다(어느 타일이 속하는지는 여전히 감춰져 있다). */
  tier: number;
  test: (t: TileWord) => boolean;
}

export interface PuzzleGroup {
  rule: Rule;
  tiles: TileWord[];
}

export interface Grid {
  round: number;
  /** 보드에 깔리는 타일 전체(그룹 단어 + 침입자, 섞인 상태). */
  tiles: TileWord[];
  groups: PuzzleGroup[];
  intruders: TileWord[];
  /** 미노출 재료가 모자라 노출 단어를 다시 쓴 격자인가 — 게임 쪽 계측용. */
  reusedExposed: boolean;
}

// ─── 규격 상수 ────────────────────────────────────────────────────────────
// 여기 있는 것만 상수다. 나머지(보드 칸 수·그룹 수·라운드 수·침입자 수)는 전부
// 풀 크기의 함수다.

/** 한 그룹의 크기. 4는 UI 계약(확인 (n/4) 버튼 · 4열 격자)이자 인지부하 상한이다. */
export const GROUP_SIZE = 4;
/** 한 보드의 그룹 상한 — 칩 4개 이상은 동시 4항목 원칙(Cognitive Load)을 넘는다. */
export const MAX_GROUPS = 3;
/** 보드 칸 상한 — 390px 4열에서 4행까지가 스크롤 없이 읽히는 한계. */
export const BOARD_MAX = 16;
/** 침입자 하한 — **품질 바닥**. 0이면 마지막 그룹이 소거법으로 공짜가 된다.
 *  4칸이면 마지막 그룹 앞에서도 C(8,4)=70 가지가 남아 소거가 성립하지 않는다. */
export const MIN_INTRUDERS = 4;
/** 격자 하나가 성립하는 구조적 최소 타일 수 = 그룹 4 + 침입자 4. */
export const MIN_TILES = GROUP_SIZE + MIN_INTRUDERS;
/**
 * 생성기가 **고를 여지**로 남겨 두는 여분 타일.
 *
 * 계획이 미노출 타일을 한 칸도 남김없이 쓰면 마지막 격자는 재료가 딱 맞아떨어져
 * 배치가 단 하나로 굳는다. 그러면 불변식 4(칩 종류가 같은 다른 정확히-4 규칙 금지)를
 * 어기는 배치가 나와도 피할 데가 없다 — 실측으로 최소 풀에서 함정 격자가 9.7% 였다.
 * 여분 4칸을 남기면 240회 탐색이 실제로 다른 배치를 볼 수 있다.
 */
const SEARCH_SLACK = GROUP_SIZE;

/** 내 단어가 이보다 적을 때만 맛보기로 자리를 메운다 — 3격자 곡선이 서는 최소 풀
 *  (= 4 그룹 + 4 침입자 + 여분 4 을 세 격자에 굴리는 데 필요한 20칸).
 *  20 이상이면 한 타일도 섞지 않는다. 내가 고른 자료로만 도는 것이 먼저다. */
export const PAD_FLOOR = 20;
/** 내 단어가 아예 없는 맛보기 진입 — 이때는 온전한 3격자(16칸 × 3) 규격으로 돈다. */
export const DEMO_TILES = 48;

/** 마지막 격자가 아닌 곳의 잡음 비율(그룹 타일 대비). g=3 에서 침입자 4칸 = 보드의 1/4. */
const NOISE_EARLY = 1 / 3;
/** 마지막 격자 — 보드의 절반이 잡음. */
const NOISE_FINAL = 1;

/** 규칙 하나가 물어도 되는 최대 단어 수의 절대 상한(넓은 규칙 = 침입자 고갈). */
const MAX_MEMBERS_CAP = 9;

// ─── 정규화 ───────────────────────────────────────────────────────────────

function normEn(en: string): string {
  return en.toLowerCase().replace(/[^a-z]/g, '');
}

/** Word[] → 규칙 판정이 가능한 타일. 철자가 너무 짧거나 뜻이 없는 항목은 제외. */
export function buildTiles(words: Word[], own: boolean): TileWord[] {
  const seen = new Set<string>();
  const out: TileWord[] = [];
  for (const w of words) {
    const norm = normEn(w.en ?? '');
    const ko = (w.ko ?? '').trim();
    if (norm.length < 3 || norm.length > 14) continue;
    if (!ko) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push({ ...w, ko, id: norm, norm, own });
  }
  return out;
}

// ─── 규칙 후보 ────────────────────────────────────────────────────────────
// 전부 **철자 기반**이다. 의미장(감정/날씨 …)으로 묶지 않는 이유: 임의의 학습자 단어
// 묶음에서 의미장을 자동 분류하면 오분류가 반드시 생기고, 그 순간 "단어를 정확히
// 아는데도 목숨을 잃는" 불공정이 발생한다. 철자 규칙은 학습자가 정답 공개 후 100%
// 스스로 검증할 수 있다.
//
// 품사 규칙이 사라진 이유(v07.10): 품사는 철자가 아니라 **한국어 뜻**에 드러난다.
// 실 DB 실측으로 동사 뜻의 99.0% 가 '다'로 끝나고 명사는 0.2% 다. 그래서 '품사' 칩은
// 영어를 한 글자도 떠올리지 않고 한글 어미만으로 4개를 특정하게 해줬다 — 이 게임의
// 존재 이유(뜻 → 영단어 인출)를 정면으로 무효화하는 규칙이라 후보에서 제거했다.

const PREFIXES = [
  'un', 're', 'dis', 'in', 'im', 'pre', 'ex', 'con', 'com', 'pro', 'sub',
  'inter', 'over', 'under', 'mis', 'trans', 'de', 'en', 'fore', 'out',
  'non', 'anti', 'semi', 'auto', 'multi',
];

const SUFFIXES = [
  'tion', 'sion', 'ment', 'ness', 'ance', 'ence', 'able', 'ible', 'ous',
  'ive', 'ful', 'less', 'ward', 'ship', 'hood', 'ity', 'ify', 'ize', 'ise',
  'ate', 'ary', 'ory', 'ing', 'ed', 'ly', 'er', 'or', 'al', 'ic', 'y',
];

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** 후보 규칙이 되려면 만족 단어가 정확히 GROUP_SIZE 개 이상. */
const MIN_MEMBERS = GROUP_SIZE;

/**
 * 규칙 하나가 물어도 되는 최대 단어 수 — **풀 크기의 함수**다.
 *
 * 너무 넓은 규칙은 침입자 후보를 고갈시켜(불변식 3) 격자를 못 만들게 한다. 큰 풀에서
 * 이 상한이 하던 일은 그대로다('들어 있는 글자' 중 e·a·t 처럼 흔한 글자를 탈락시킨다).
 * 작은 풀에서는 상한 자체가 훨씬 빡빡해야 한다 — 8타일 풀에서 5개를 무는 규칙을 쓰면
 * 남는 칸이 3개뿐이라 침입자 4칸을 못 채운다. 그래서
 *   room = 풀 − 침입자 하한 − 다른 그룹들이 최소로 쓸 자리
 * 를 상한으로 삼는다(8타일·1그룹 → 4, 48타일·3그룹 → 9).
 */
function maxMembersFor(poolSize: number, groups: number): number {
  const room = poolSize - MIN_INTRUDERS - GROUP_SIZE * Math.max(0, groups - 1);
  return Math.min(MAX_MEMBERS_CAP, Math.max(GROUP_SIZE, room));
}

interface Candidate {
  rule: Rule;
  members: TileWord[];
}

function makeCandidate(rule: Rule, tiles: TileWord[], maxMembers: number): Candidate | null {
  const members = tiles.filter(rule.test);
  if (members.length < MIN_MEMBERS || members.length > maxMembers) return null;
  return { rule, members };
}

function buildCandidates(
  tiles: TileWord[],
  excludeRuleIds: ReadonlySet<string>,
  maxMembers: number,
): Candidate[] {
  const out: Candidate[] = [];
  const add = (rule: Rule) => {
    if (excludeRuleIds.has(rule.id)) return;
    const c = makeCandidate(rule, tiles, maxMembers);
    if (c) out.push(c);
  };

  const firsts = new Set(tiles.map((t) => t.norm[0]));
  firsts.forEach((L) =>
    add({
      id: `start:${L}`,
      kind: 'start',
      kindLabel: '시작 글자',
      valueLabel: `${L} 로 시작하는 단어`,
      tier: 1,
      test: (t) => t.norm[0] === L,
    }),
  );

  const lasts = new Set(tiles.map((t) => t.norm[t.norm.length - 1]));
  lasts.forEach((L) =>
    add({
      id: `end:${L}`,
      kind: 'end',
      kindLabel: '끝 글자',
      valueLabel: `${L} 로 끝나는 단어`,
      tier: 2,
      test: (t) => t.norm[t.norm.length - 1] === L,
    }),
  );

  SUFFIXES.forEach((s) =>
    add({
      id: `suf:${s}`,
      kind: 'suffix',
      kindLabel: '뒤에 붙는 조각',
      valueLabel: `-${s} 로 끝나는 단어`,
      tier: 2,
      test: (t) => t.norm.length >= s.length + 3 && t.norm.endsWith(s),
    }),
  );

  PREFIXES.forEach((p) =>
    add({
      id: `pre:${p}`,
      kind: 'prefix',
      kindLabel: '앞에 붙는 조각',
      valueLabel: `${p}- 로 시작하는 단어`,
      tier: 3,
      test: (t) => t.norm.length >= p.length + 3 && t.norm.startsWith(p),
    }),
  );

  // 철자를 통째로 떠올려야만 판정되는 규칙 — 제거한 품사 규칙의 자리를 메운다.
  // 첫 글자·끝 글자만 기억나서는 절대 풀 수 없다는 점에서 인출 강도가 가장 높다.
  LETTERS.forEach((L) =>
    add({
      id: `has:${L}`,
      kind: 'has',
      kindLabel: '들어 있는 글자',
      valueLabel: `${L} 가 들어 있는 단어`,
      tier: 3,
      test: (t) => t.norm.includes(L),
    }),
  );

  for (let n = 3; n <= 13; n++) {
    add({
      id: `len:${n}`,
      kind: 'len',
      kindLabel: '글자 수',
      valueLabel: `${n}글자 단어`,
      tier: 3,
      test: (t) => t.norm.length === n,
    });
  }
  [4, 5, 6].forEach((n) =>
    add({
      id: `lenle:${n}`,
      kind: 'len',
      kindLabel: '글자 수',
      valueLabel: `${n}글자 이하인 단어`,
      tier: 3,
      test: (t) => t.norm.length <= n,
    }),
  );
  [8, 9, 10].forEach((n) =>
    add({
      id: `lenge:${n}`,
      kind: 'len',
      kindLabel: '글자 수',
      valueLabel: `${n}글자 이상인 단어`,
      tier: 3,
      test: (t) => t.norm.length >= n,
    }),
  );

  add({
    id: 'sp:double',
    kind: 'spell',
    kindLabel: '철자 생김새',
    valueLabel: '같은 글자가 두 번 잇달아 나오는 단어',
    tier: 4,
    test: (t) => /(.)\1/.test(t.norm),
  });
  add({
    id: 'sp:vowel',
    kind: 'spell',
    kindLabel: '철자 생김새',
    valueLabel: '모음(a·e·i·o·u)으로 시작하는 단어',
    tier: 4,
    test: (t) => 'aeiou'.includes(t.norm[0]),
  });
  add({
    id: 'sp:rare',
    kind: 'spell',
    kindLabel: '철자 생김새',
    valueLabel: 'j·q·x·z 가 들어 있는 단어',
    tier: 4,
    test: (t) => /[jqxz]/.test(t.norm),
  });

  return out;
}

// ─── 라운드 규격 — 전부 풀 크기의 함수 ─────────────────────────────────────
// 긴장 곡선은 풀이 작아져도 그대로 유지된다: 앞 격자는 명백한 규칙 · 낮은 잡음,
// 마지막 격자는 까다로운 규칙 · **보드의 절반이 잡음**. 달라지는 것은 크기뿐이다.

export type TierBias = 'low' | 'any' | 'high';

export interface RoundSpec {
  round: number;
  groups: number;
  intruders: number;
  /** 4 × groups + intruders — 생성기가 실제로 더 적게 낼 수 있는 **목표치**다. */
  board: number;
  noise: number;
  bias: TierBias;
  name: string;
  note: string;
}

/** 침입자 수 — 그룹 수 × 잡음 비율. 하한은 품질 바닥 4, 상한은 보드 16칸에서 남는 자리. */
export function intrudersFor(groups: number, noise: number): number {
  const room = Math.max(MIN_INTRUDERS, BOARD_MAX - GROUP_SIZE * groups);
  const want = Math.round(GROUP_SIZE * groups * noise);
  return Math.min(room, Math.max(MIN_INTRUDERS, want));
}

/** 잡음 비율이 정해지면 보드 상한 16칸에서 그룹 수 상한이 역산된다(1/3 → 3 · 1 → 2). */
function groupCap(noise: number): number {
  return Math.max(1, Math.min(MAX_GROUPS, Math.floor(BOARD_MAX / (GROUP_SIZE * (1 + noise)))));
}

function noiseFor(round: number, rounds: number): number {
  return round === rounds - 1 ? NOISE_FINAL : NOISE_EARLY;
}

/**
 * 라운드 r 시작 시점에 필요한 **미노출** 타일 수 = 지금까지 그룹으로 소모한 타일 + 이번 보드.
 *
 * 그룹 단어는 확정 막대가 en 을 인쇄하므로 세션 내내 다시 못 쓴다(정찰 익스플로짓 차단).
 * 반대로 침입자는 en 이 라운드 중간에 공개되지 않으므로 다음 격자에서 재사용해도
 * 정보가 새지 않는다 — 그래서 누적되는 것은 **그룹 타일뿐**이다. 이 비대칭 덕분에
 * 세 격자를 굴리는 데 48타일이 아니라 20타일이면 된다.
 */
function fits(gs: number[], tiles: number): boolean {
  let burned = 0;
  for (let r = 0; r < gs.length; r++) {
    burned += GROUP_SIZE * gs[r];
    if (burned + intrudersFor(gs[r], noiseFor(r, gs.length)) + SEARCH_SLACK > tiles) return false;
  }
  return true;
}

/** 그룹 수는 라운드가 갈수록 줄어든다(비증가) — 잡음이 늘어나는 곡선과 짝을 이룬다. */
function shapesFor(rounds: number): number[][] {
  const out: number[][] = [];
  const acc: number[] = [];
  const walk = (r: number, prev: number) => {
    if (r === rounds) {
      out.push([...acc]);
      return;
    }
    const cap = Math.min(prev, groupCap(noiseFor(r, rounds)));
    for (let g = cap; g >= 1; g--) {
      acc.push(g);
      walk(r + 1, g);
      acc.pop();
    }
  };
  walk(0, MAX_GROUPS);
  return out;
}

/** 확정 기회(=총 그룹 수)를 먼저 최대화하고, 같으면 라운드 간 낙차가 작은 쪽을 고른다. */
function rank(gs: number[]): number {
  const total = gs.reduce((a, b) => a + b, 0);
  const spread = gs[0] - gs[gs.length - 1];
  return total * 100 - spread * 10 + gs[0];
}

function specFor(groups: number, round: number, rounds: number): RoundSpec {
  const noise = noiseFor(round, rounds);
  const intruders = intrudersFor(groups, noise);
  const bias: TierBias =
    rounds === 1 ? 'any' : round === 0 ? 'low' : round === rounds - 1 ? 'high' : 'any';
  const note =
    rounds > 1 && round === rounds - 1
      ? `규칙 ${groups}개 · 보드의 절반이 잡음입니다`
      : round === 0
        ? `숨은 규칙 ${groups}개 · 나머지 ${intruders}칸은 어디에도 속하지 않아요`
        : `규칙 ${groups}개 · 규칙이 덜 뻔해집니다 · 앞 격자 단어는 다시 안 나와요`;
  return {
    round,
    groups,
    intruders,
    board: GROUP_SIZE * groups + intruders,
    noise,
    bias,
    name: `격자 ${round + 1}`,
    note,
  };
}

/**
 * 풀 크기 → 세션 규격.
 *
 * 라운드 수를 먼저 최대화하고(3막 곡선이 먼저다), 그 안에서 확정 기회를 최대화한다.
 * 실측 사다리(타일 수 → 계획 · 보드):
 *   12~15 → [1]           8
 *   16~19 → [1,1]         8·8
 *   20~23 → [1,1,1]       8·8·8          ← 게임이 풀을 여기까지 보강하므로 실질 하한
 *   24~27 → [2,1,1]       12·8·8
 *   28~31 → [2,2,1]       12·12·8
 *   32~35 → [3,2,1]       16·12·8
 *   36~39 → [3,3,1]       16·16·8
 *   40~43 → [3,2,2]       16·12·16
 *   44~   → [3,3,2]       16·16·16       (v07.10 규격과 동일)
 * 12타일 미만이면 빈 배열 — 격자 하나(8칸)에 탐색 여지 4칸을 더할 재료가 없다.
 */
export function planFor(tiles: number): RoundSpec[] {
  for (let rounds = 3; rounds >= 1; rounds--) {
    let best: number[] | null = null;
    for (const gs of shapesFor(rounds)) {
      if (!fits(gs, tiles)) continue;
      if (!best || rank(gs) > rank(best)) best = gs;
    }
    if (best) return best.map((g, r) => specFor(g, r, best!.length));
  }
  return [];
}

// ─── 격자 조립 ────────────────────────────────────────────────────────────

interface Chosen {
  rule: Rule;
  tiles: TileWord[];
}

interface BuildOptions {
  spec: RoundSpec;
  excludeRuleIds: ReadonlySet<string>;
  /** en 을 이미 화면에 인쇄한 타일 — 그룹 단어로 다시 쓰지 않는다(정찰 익스플로짓 차단). */
  exposed: ReadonlySet<string>;
}

const ATTEMPTS = 240;

function keyOf(tiles: TileWord[]): string {
  return tiles
    .map((t) => t.id)
    .sort()
    .join('|');
}

/**
 * 불변식 4 검사 — 완성된 보드에 "칩이 가리킬 수 있는 다른 정답"이 있는가.
 *
 * 칩은 규칙의 **종류**만 공개한다. 그래서 같은 종류의 다른 규칙이 보드에서 정확히
 * 4개를 만족하면, 그 4개를 고른 학습자는 규칙을 정확히 읽어내고도 목숨을 잃는다.
 * 반증 실측: 현행 생성기의 보드 79.9% 에 이런 함정이 최소 하나씩 있었다.
 * (상한을 보드 크기로 열어 둔다 — 여기서는 "정확히 4개"만 보므로 상한이 답을 가리면 안 된다.)
 */
function hasSameKindTrap(board: TileWord[], chosen: Chosen[]): boolean {
  const kinds = new Set(chosen.map((c) => c.rule.kindLabel));
  const answerKeys = new Set(chosen.map((c) => keyOf(c.tiles)));
  const cands = buildCandidates(board, new Set<string>(), board.length);
  for (const c of cands) {
    if (c.members.length !== GROUP_SIZE) continue;
    if (!kinds.has(c.rule.kindLabel)) continue;
    if (answerKeys.has(keyOf(c.members))) continue;
    return true;
  }
  return false;
}

interface Assembled {
  chosen: Chosen[];
  intruders: TileWord[];
  board: TileWord[];
  reusedExposed: boolean;
}

/**
 * 침입자 자리 채우기 — **그룹 수보다 침입자 하한이 우선**이다.
 *
 * 작은 풀에서 그룹을 욕심껏 세우면 남는 칸이 없어 침입자가 0~2칸으로 쪼그라들고,
 * 그 순간 마지막 그룹이 소거법으로 공짜가 된다(3라운드에서 막은 익스플로짓의 부활).
 * 그래서 침입자 4칸을 못 채우면 그룹을 하나씩 덜어내며 다시 센다. 그룹 1개까지
 * 줄여도 못 채우면 그 시도는 버린다 — 불공정한 판을 내느니 다른 배치를 찾는다.
 */
function seatIntruders(pool: TileWord[], chosen: Chosen[], opts: BuildOptions): Assembled | null {
  let picked = chosen;
  const seat = (intruders: TileWord[]): Assembled => ({
    chosen: picked,
    intruders,
    board: [...picked.flatMap((g) => g.tiles), ...intruders],
    reusedExposed: [...picked.flatMap((g) => g.tiles), ...intruders].some((t) =>
      opts.exposed.has(t.id),
    ),
  });
  while (picked.length >= 1) {
    // 규칙이 계획보다 적게 서면 그만큼 **잡음을 늘려** 보드 크기를 지킨다 — 규칙이
    // 적은 판이 오히려 쉬워지는 역전을 막는다(계획 보드 16칸 · 규칙 2개 → 침입자 8칸).
    const want = Math.max(MIN_INTRUDERS, opts.spec.board - GROUP_SIZE * picked.length);
    const usedIds = new Set(picked.flatMap((g) => g.tiles.map((t) => t.id)));
    const eligible = pool.filter(
      (t) => !usedIds.has(t.id) && picked.every((g) => !g.rule.test(t)),
    );
    // 노출 단어를 침입자로 깔면 "en 을 아는 타일 = 침입자"라는 소거 오라클이 생긴다.
    // 미노출 침입자를 먼저 채우고, 정말 모자랄 때만 노출 단어를 섞는다.
    const freshOnes = eligible.filter((t) => !opts.exposed.has(t.id));
    if (freshOnes.length >= MIN_INTRUDERS) {
      return seat(shuffle(freshOnes).slice(0, Math.min(want, freshOnes.length)));
    }
    if (picked.length > 1) {
      picked = picked.slice(0, picked.length - 1);
      continue;
    }
    const stale = eligible.filter((t) => opts.exposed.has(t.id));
    const all = [...shuffle(freshOnes), ...shuffle(stale)];
    if (all.length < MIN_INTRUDERS) return null;
    return seat(all.slice(0, Math.min(want, all.length)));
  }
  return null;
}

/** 그룹이 많은 배치가 낫고, 같은 그룹 수면 노출 단어를 한 칸도 안 쓴 배치가 낫다. */
function better(a: Assembled, b: Assembled | null): boolean {
  if (!b) return true;
  if (a.chosen.length !== b.chosen.length) return a.chosen.length > b.chosen.length;
  return !a.reusedExposed && b.reusedExposed;
}

function buildGrid(pool: TileWord[], opts: BuildOptions): Grid | null {
  const fresh = pool.filter((t) => !opts.exposed.has(t.id));
  // 재료가 빠듯할 때의 **양보 순서**가 이 게임의 품질을 가른다.
  //   ① 그룹 단어는 끝까지 미노출로 — 여기가 뚫리면 "1격자를 정찰로 쓰고 나머지는
  //      기억으로 푼다"는 v07.10 의 치명 익스플로짓이 그대로 부활한다.
  //   ② 그다음이 그룹 수 — 침입자 4칸(소거법 차단)보다 그룹 하나를 먼저 포기한다.
  //   ③ 마지막이 침입자의 신선도 — 노출 단어가 침입자로 깔리면 "철자를 아는 타일 =
  //      침입자"라는 약한 오라클이 생기지만, ①②를 파는 것보다는 훨씬 싸다.
  let target = Math.max(1, opts.spec.groups);
  while (target > 1 && fresh.length < GROUP_SIZE * target) target--;
  const groupPool = fresh.length >= GROUP_SIZE * target ? fresh : pool;
  const candidates = buildCandidates(
    groupPool,
    opts.excludeRuleIds,
    maxMembersFor(groupPool.length, target),
  );
  if (candidates.length === 0) return null;

  let clean: Assembled | null = null;
  let dirty: Assembled | null = null;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const bias = opts.spec.bias;
    const ordered = candidates
      .map((c) => ({
        c,
        k:
          Math.random() +
          (bias === 'low' ? c.rule.tier * 0.3 : bias === 'high' ? -c.rule.tier * 0.3 : 0) -
          // 내 단어로 네 칸을 채울 수 있는 규칙을 먼저 본다 — 맛보기로 메운 자리가
          // 확정 막대(=학습 산출물)를 차지하지 않게. 풀이 전부 내 단어면 무효한 항이다.
          0.3 * Math.min(1, c.members.filter((m) => m.own).length / GROUP_SIZE),
      }))
      .sort((a, b) => a.k - b.k);

    const chosen: Chosen[] = [];
    const used = new Set<string>();
    const kinds = new Set<RuleKind>();

    for (const { c } of ordered) {
      if (chosen.length >= target) break;
      // 같은 종류 규칙 둘은 안 쓴다 — 종류 라벨을 미리 공개하므로 중복되면 읽히지 않는다.
      if (kinds.has(c.rule.kind)) continue;
      // 이미 확정한 그룹의 단어가 이 규칙도 만족하면 불변식 2 위반.
      if (chosen.some((ch) => ch.tiles.some((t) => c.rule.test(t)))) continue;
      const avail = c.members.filter(
        (m) => !used.has(m.id) && chosen.every((ch) => !ch.rule.test(m)),
      );
      if (avail.length < GROUP_SIZE) continue;
      // 같은 값이면 **내 단어**를 그룹에 올린다 — 맛보기로 메운 자리는 침입자로 밀린다.
      // (그룹 단어만 확정 막대에 en+ko 로 인쇄되고 FSRS 에 올라간다.)
      const picked = shuffle(avail)
        .sort((a, b) => Number(b.own) - Number(a.own))
        .slice(0, GROUP_SIZE);
      chosen.push({ rule: c.rule, tiles: picked });
      kinds.add(c.rule.kind);
      picked.forEach((t) => used.add(t.id));
    }

    if (chosen.length < 1) continue;
    const asm = seatIntruders(pool, chosen, opts);
    if (!asm) continue;

    if (better(asm, dirty)) dirty = asm;
    if (hasSameKindTrap(asm.board, asm.chosen)) continue;
    if (better(asm, clean)) clean = asm;
    // better() 는 타입 가드가 아니라 clean 이 여전히 null 일 수 있다(첫 배치가 함정인 경우).
    if (clean && clean.chosen.length >= target && !clean.reusedExposed) break;
  }

  // 함정 없는 배치를 못 찾으면 "판이 없는 것"보다는 낫다 — 있는 것 중 최선을 낸다.
  const best = clean ?? dirty;
  if (!best) return null;

  return {
    round: opts.spec.round,
    tiles: shuffle(best.board),
    groups: best.chosen.map((g) => ({ rule: g.rule, tiles: g.tiles })),
    intruders: best.intruders,
    reusedExposed: best.reusedExposed,
  };
}

/**
 * 라운드 격자 생성.
 *
 * excludeRuleIds(앞 격자에서 이미 쓴 규칙)는 **선호**이지 제약이 아니다.
 * 실측(단어 22개 · 34개 풀 각 400세션): 제약으로 강제하면 2번째 격자가 규칙을
 * 3개 채우지 못해 목표 3그룹 달성률이 절반으로 떨어졌다. 규칙이 모자라면
 * 중복 금지를 풀어 더 많은 그룹을 얻는 쪽을 택한다 — 판의 형태가 먼저다.
 *
 * exposed(en 을 이미 인쇄한 타일)는 반대로 **강한 제약**이다. 여기가 뚫리면 게임의
 * 전제(뜻 → 영단어 인출)가 무너지기 때문에, 그룹 단어를 채울 재료가 물리적으로
 * 모자랄 때만 풀린다.
 */
export function generateGrid(
  pool: TileWord[],
  spec: RoundSpec,
  excludeRuleIds: ReadonlySet<string>,
  exposed: ReadonlySet<string>,
): Grid | null {
  const preferred = buildGrid(pool, { spec, excludeRuleIds, exposed });
  if (preferred && preferred.groups.length >= spec.groups) return preferred;
  const relaxed = buildGrid(pool, { spec, excludeRuleIds: new Set<string>(), exposed });
  if (!preferred) return relaxed;
  if (relaxed && relaxed.groups.length > preferred.groups.length) return relaxed;
  return preferred;
}

// ─── 맛보기 단어 풀 ───────────────────────────────────────────────────────
// wordPool 이 없거나(맛보기 진입) 격자 하나를 세우기에도 모자랄 때 쓰는 폴백.
// 이전 판의 "고정 퍼즐 5개"가 아니라 **단순한 단어 목록**이다 — 격자는 여기서도 매 판
// 새로 조립된다. 이 단어들은 학습자 vocabularies 에 없을 수 있으므로 own=false 로
// 태깅해 FSRS 에 적재하지 않는다.
export const DEMO_POOL: Word[] = [
  { en: 'joy', ko: '기쁨', pos: 'noun' }, { en: 'anger', ko: '분노', pos: 'noun' },
  { en: 'fear', ko: '두려움', pos: 'noun' }, { en: 'grief', ko: '슬픔', pos: 'noun' },
  { en: 'storm', ko: '폭풍', pos: 'noun' }, { en: 'breeze', ko: '산들바람', pos: 'noun' },
  { en: 'drought', ko: '가뭄', pos: 'noun' }, { en: 'frost', ko: '서리', pos: 'noun' },
  { en: 'lawyer', ko: '변호사', pos: 'noun' }, { en: 'surgeon', ko: '외과의사', pos: 'noun' },
  { en: 'architect', ko: '건축가', pos: 'noun' }, { en: 'pilot', ko: '조종사', pos: 'noun' },
  { en: 'sprint', ko: '전력질주하다', pos: 'verb' }, { en: 'crawl', ko: '기어가다', pos: 'verb' },
  { en: 'leap', ko: '도약하다', pos: 'verb' }, { en: 'stroll', ko: '거닐다', pos: 'verb' },
  { en: 'honest', ko: '정직한', pos: 'adjective' }, { en: 'stubborn', ko: '고집 센', pos: 'adjective' },
  { en: 'generous', ko: '관대한', pos: 'adjective' }, { en: 'timid', ko: '소심한', pos: 'adjective' },
  { en: 'tiny', ko: '아주 작은', pos: 'adjective' }, { en: 'massive', ko: '거대한', pos: 'adjective' },
  { en: 'slender', ko: '가느다란', pos: 'adjective' }, { en: 'vast', ko: '광대한', pos: 'adjective' },
  { en: 'biology', ko: '생물학', pos: 'noun' }, { en: 'economics', ko: '경제학', pos: 'noun' },
  { en: 'geography', ko: '지리학', pos: 'noun' }, { en: 'physics', ko: '물리학', pos: 'noun' },
  { en: 'roast', ko: '굽다', pos: 'verb' }, { en: 'simmer', ko: '뭉근히 끓이다', pos: 'verb' },
  { en: 'chop', ko: '썰다', pos: 'verb' }, { en: 'season', ko: '간을 하다', pos: 'verb' },
  { en: 'dawn', ko: '새벽', pos: 'noun' }, { en: 'dusk', ko: '황혼', pos: 'noun' },
  { en: 'decade', ko: '십 년', pos: 'noun' }, { en: 'instant', ko: '순간', pos: 'noun' },
  { en: 'budget', ko: '예산', pos: 'noun' }, { en: 'profit', ko: '이익', pos: 'noun' },
  { en: 'debt', ko: '빚', pos: 'noun' }, { en: 'wage', ko: '임금', pos: 'noun' },
  { en: 'elbow', ko: '팔꿈치', pos: 'noun' }, { en: 'ankle', ko: '발목', pos: 'noun' },
  { en: 'spine', ko: '척추', pos: 'noun' }, { en: 'jaw', ko: '턱', pos: 'noun' },
  { en: 'flood', ko: '홍수', pos: 'noun' }, { en: 'earthquake', ko: '지진', pos: 'noun' },
  { en: 'wildfire', ko: '산불', pos: 'noun' }, { en: 'avalanche', ko: '눈사태', pos: 'noun' },
  { en: 'flute', ko: '플루트', pos: 'noun' }, { en: 'drum', ko: '드럼', pos: 'noun' },
  { en: 'violin', ko: '바이올린', pos: 'noun' }, { en: 'trumpet', ko: '트럼펫', pos: 'noun' },
  { en: 'diamond', ko: '다이아몬드', pos: 'noun' }, { en: 'pearl', ko: '진주', pos: 'noun' },
  { en: 'emerald', ko: '에메랄드', pos: 'noun' }, { en: 'ruby', ko: '루비', pos: 'noun' },
  { en: 'observe', ko: '관찰하다', pos: 'verb' }, { en: 'glance', ko: '힐끗 보다', pos: 'verb' },
  { en: 'gaze', ko: '응시하다', pos: 'verb' }, { en: 'peek', ko: '엿보다', pos: 'verb' },
  { en: 'trade', ko: '거래하다', pos: 'verb' }, { en: 'bargain', ko: '흥정하다', pos: 'verb' },
  { en: 'purchase', ko: '구매하다', pos: 'verb' }, { en: 'refund', ko: '환불하다', pos: 'verb' },
  { en: 'beetle', ko: '딱정벌레', pos: 'noun' }, { en: 'moth', ko: '나방', pos: 'noun' },
  { en: 'wasp', ko: '말벌', pos: 'noun' }, { en: 'valley', ko: '계곡', pos: 'noun' },
  { en: 'cliff', ko: '절벽', pos: 'noun' }, { en: 'plateau', ko: '고원', pos: 'noun' },
  { en: 'canyon', ko: '협곡', pos: 'noun' }, { en: 'arrogant', ko: '오만한', pos: 'adjective' },
  { en: 'greedy', ko: '탐욕스러운', pos: 'adjective' }, { en: 'reckless', ko: '무모한', pos: 'adjective' },
  { en: 'lazy', ko: '게으른', pos: 'adjective' }, { en: 'mumble', ko: '웅얼거리다', pos: 'verb' },
  { en: 'declare', ko: '선언하다', pos: 'verb' }, { en: 'whisper', ko: '속삭이다', pos: 'verb' },
  { en: 'shout', ko: '외치다', pos: 'verb' }, { en: 'unfold', ko: '펼쳐지다', pos: 'verb' },
  { en: 'unlock', ko: '풀다', pos: 'verb' }, { en: 'unusual', ko: '흔치 않은', pos: 'adjective' },
  { en: 'unable', ko: '할 수 없는', pos: 'adjective' }, { en: 'rebuild', ko: '재건하다', pos: 'verb' },
  { en: 'recover', ko: '회복하다', pos: 'verb' }, { en: 'remind', ko: '상기시키다', pos: 'verb' },
  { en: 'reserve', ko: '예약하다', pos: 'verb' }, { en: 'kindness', ko: '친절함', pos: 'noun' },
  { en: 'darkness', ko: '어둠', pos: 'noun' }, { en: 'weakness', ko: '약점', pos: 'noun' },
  { en: 'illness', ko: '병', pos: 'noun' }, { en: 'careful', ko: '조심스러운', pos: 'adjective' },
  { en: 'painful', ko: '고통스러운', pos: 'adjective' }, { en: 'grateful', ko: '고마워하는', pos: 'adjective' },
  { en: 'harmful', ko: '해로운', pos: 'adjective' }, { en: 'quietly', ko: '조용히', pos: 'adverb' },
  { en: 'rarely', ko: '드물게', pos: 'adverb' }, { en: 'boldly', ko: '대담하게', pos: 'adverb' },
  { en: 'gently', ko: '부드럽게', pos: 'adverb' },
];
