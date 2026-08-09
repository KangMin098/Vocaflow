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
// 격자 불변식 (이걸 깨면 문제가 불공정해진다)
//   1. 선택된 규칙 하나당 보드 위 만족 단어가 **정확히 4개**.
//   2. 각 그룹 단어는 선택된 규칙 중 **자기 규칙 하나만** 만족.
//   3. 침입자(어느 그룹에도 없는 단어)는 선택된 규칙을 **하나도** 만족하지 않는다.
//   4. (v07.10) 보드 위에 **선택 규칙과 같은 종류이면서 정확히 4개를 만족하는 다른
//      규칙**이 없다 — 칩에 적힌 종류로 좁힌 답이 유일하다.
//   위 넷이 보장되면 정답 분할은 유일하고, 칩은 거짓말을 하지 않는다.

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

/** 후보 규칙이 되려면 보드 재료 안에 만족 단어가 4~9개. 너무 넓은 규칙은
 *  침입자 후보를 고갈시켜(불변식 3) 격자를 못 만들게 한다.
 *  '들어 있는 글자'가 이 상한 덕에 자동으로 걸러진다 — e·a·t 처럼 흔한 글자는
 *  48타일 풀에서 30개 이상을 물어 후보에서 탈락하고, b·k·p·w 같은 글자만 남는다. */
const MIN_MEMBERS = 4;
const MAX_MEMBERS = 9;

interface Candidate {
  rule: Rule;
  members: TileWord[];
}

function makeCandidate(rule: Rule, tiles: TileWord[]): Candidate | null {
  const members = tiles.filter(rule.test);
  if (members.length < MIN_MEMBERS || members.length > MAX_MEMBERS) return null;
  return { rule, members };
}

function buildCandidates(tiles: TileWord[], excludeRuleIds: ReadonlySet<string>): Candidate[] {
  const out: Candidate[] = [];
  const add = (rule: Rule) => {
    if (excludeRuleIds.has(rule.id)) return;
    const c = makeCandidate(rule, tiles);
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

// ─── 격자 조립 ────────────────────────────────────────────────────────────

export type TierBias = 'low' | 'any' | 'high';

interface Chosen {
  rule: Rule;
  tiles: TileWord[];
}

interface BuildOptions {
  round: number;
  targetGroups: number;
  boardSize: number;
  tierBias: TierBias;
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
 */
function hasSameKindTrap(board: TileWord[], chosen: Chosen[]): boolean {
  const kinds = new Set(chosen.map((c) => c.rule.kindLabel));
  const answerKeys = new Set(chosen.map((c) => keyOf(c.tiles)));
  const cands = buildCandidates(board, new Set<string>());
  for (const c of cands) {
    if (c.members.length !== 4) continue;
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

function buildGrid(pool: TileWord[], opts: BuildOptions): Grid | null {
  const fresh = pool.filter((t) => !opts.exposed.has(t.id));
  // 그룹 단어는 미노출 타일에서만 뽑는다. 재료가 그룹을 채울 만큼도 없을 때만 제약을 푼다
  // (+2 여유는 규칙 선택의 자유도 — 딱 맞게 남으면 240번을 돌려도 규칙이 안 선다).
  const enough = fresh.length >= opts.targetGroups * 4 + 2;
  const groupPool = enough ? fresh : pool;
  const candidates = buildCandidates(groupPool, opts.excludeRuleIds);
  if (candidates.length === 0) return null;

  let clean: Assembled | null = null;
  let dirty: Assembled | null = null;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const ordered = candidates
      .map((c) => ({
        c,
        k:
          Math.random() +
          (opts.tierBias === 'low' ? c.rule.tier * 0.3 : opts.tierBias === 'high' ? -c.rule.tier * 0.3 : 0),
      }))
      .sort((a, b) => a.k - b.k);

    const chosen: Chosen[] = [];
    const used = new Set<string>();
    const kinds = new Set<RuleKind>();

    for (const { c } of ordered) {
      if (chosen.length >= opts.targetGroups) break;
      // 같은 종류 규칙 둘은 안 쓴다 — 종류 라벨을 미리 공개하므로 중복되면 읽히지 않는다.
      if (kinds.has(c.rule.kind)) continue;
      // 이미 확정한 그룹의 단어가 이 규칙도 만족하면 불변식 2 위반.
      if (chosen.some((ch) => ch.tiles.some((t) => c.rule.test(t)))) continue;
      const avail = c.members.filter(
        (m) => !used.has(m.id) && chosen.every((ch) => !ch.rule.test(m)),
      );
      if (avail.length < 4) continue;
      const picked = shuffle(avail).slice(0, 4);
      chosen.push({ rule: c.rule, tiles: picked });
      kinds.add(c.rule.kind);
      picked.forEach((t) => used.add(t.id));
    }

    if (chosen.length < 2) continue;
    if (dirty && chosen.length < dirty.chosen.length) continue;

    // 불변식 3 — 침입자는 어떤 선택 규칙도 만족하면 안 된다.
    const usedIds = new Set(chosen.flatMap((g) => g.tiles.map((t) => t.id)));
    const eligible = (t: TileWord) => !usedIds.has(t.id) && chosen.every((g) => !g.rule.test(t));
    const want = Math.max(0, opts.boardSize - chosen.length * 4);
    // 노출 단어를 침입자로 깔면 "en 을 아는 타일 = 침입자"라는 소거 오라클이 생긴다.
    // 미노출 침입자를 먼저 채우고, 정말 모자랄 때만 노출 단어를 섞는다.
    const freshIntr = shuffle(pool.filter((t) => eligible(t) && !opts.exposed.has(t.id)));
    let intruders = freshIntr.slice(0, want);
    let reusedExposed = !enough;
    if (intruders.length < want) {
      const taken = new Set(intruders.map((t) => t.id));
      const stale = shuffle(
        pool.filter((t) => eligible(t) && opts.exposed.has(t.id) && !taken.has(t.id)),
      );
      const add = stale.slice(0, want - intruders.length);
      if (add.length > 0) reusedExposed = true;
      intruders = [...intruders, ...add];
    }

    const board = [...chosen.flatMap((g) => g.tiles), ...intruders];
    const asm: Assembled = { chosen, intruders, board, reusedExposed };

    if (!dirty || chosen.length > dirty.chosen.length) dirty = asm;
    if (hasSameKindTrap(board, chosen)) continue;
    if (!clean || chosen.length > clean.chosen.length) clean = asm;
    if (clean.chosen.length >= opts.targetGroups) break;
  }

  // 함정 없는 배치를 못 찾으면 "판이 없는 것"보다는 낫다 — 있는 것 중 최선을 낸다.
  const best = clean ?? dirty;
  if (!best) return null;

  return {
    round: opts.round,
    tiles: shuffle(best.board),
    groups: best.chosen.map((g) => ({ rule: g.rule, tiles: g.tiles })),
    intruders: best.intruders,
    reusedExposed: best.reusedExposed,
  };
}

// ─── 라운드 규격 ──────────────────────────────────────────────────────────
// 긴장 곡선: 보드 크기는 그대로인데 **신호 대 잡음이 나빠지고** 규칙이 미묘해진다.
//   격자 1 — 규칙 3, 침입자 4, 명백한 규칙 우선
//   격자 2 — 규칙 3, 침입자 4, 규칙 종류 무작위
//   격자 3 — 규칙 2, 침입자 8, 까다로운 규칙 우선 (절반이 잡음)
// 실수 예산과 시계는 라운드를 넘어 이어진다 — 뒤로 갈수록 실제로 조인다.
export const ROUND_SPECS: { groups: number; board: number; bias: TierBias; name: string; note: string }[] = [
  { groups: 3, board: 16, bias: 'low', name: '격자 1', note: '숨은 규칙 3개 · 나머지는 어디에도 속하지 않아요' },
  { groups: 3, board: 16, bias: 'any', name: '격자 2', note: '규칙이 덜 뻔해집니다 · 앞 격자 단어는 다시 안 나와요' },
  { groups: 2, board: 16, bias: 'high', name: '격자 3', note: '규칙 2개 · 절반이 잡음입니다' },
];

/**
 * 한 세션이 필요로 하는 타일 수 = 16 × 3라운드 = 48.
 *
 * 세 격자가 **한 단어도 겹치지 않으려면** 이만큼이 있어야 한다. 학습자 단어가 모자라면
 * ConnectionsGame 이 DEMO_POOL 로 여기까지 채운다(own=false → FSRS 미적재).
 * 실측(1,200단어 표본 · 150세션 × 3라운드, 단어장 16/24/34/40/52):
 *   48 → 그룹 단어 재사용 0.0% · 보드 재사용 0.0% · 보드 16칸 100% · 생성 실패 0.0%
 *   44 → 보드 재사용 0.5%(격자3 1.4%) · 격자3 생성 실패 1.3%
 * 44 에서 이미 새기 시작하므로 딱 필요한 48 로 잡는다(그 이상은 맛보기 단어만 늘린다).
 */
export const POOL_TARGET = 48;

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
  round: number,
  excludeRuleIds: ReadonlySet<string>,
  exposed: ReadonlySet<string>,
): Grid | null {
  const spec = ROUND_SPECS[Math.min(round, ROUND_SPECS.length - 1)];
  const opts = {
    round,
    targetGroups: spec.groups,
    boardSize: spec.board,
    tierBias: spec.bias,
    exposed,
  };
  const preferred = buildGrid(pool, { ...opts, excludeRuleIds });
  if (preferred && preferred.groups.length >= spec.groups) return preferred;
  const relaxed = buildGrid(pool, { ...opts, excludeRuleIds: new Set<string>() });
  if (!preferred) return relaxed;
  if (relaxed && relaxed.groups.length > preferred.groups.length) return relaxed;
  return preferred;
}

// ─── 맛보기 단어 풀 ───────────────────────────────────────────────────────
// wordPool 이 없거나 세 격자를 채우기에 모자랄 때 쓰는 폴백. 이전 판의 "고정 퍼즐
// 5개"가 아니라 **단순한 단어 목록**이다 — 격자는 여기서도 매 판 새로 조립된다.
// 이 단어들은 학습자 vocabularies 에 없을 수 있으므로 own=false 로 태깅해 FSRS 에
// 적재하지 않는다.
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
