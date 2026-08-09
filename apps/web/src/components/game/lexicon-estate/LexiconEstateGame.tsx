// apps/web/src/components/game/lexicon-estate/LexiconEstateGame.tsx
// Lexicon Estate — 청사진 저택 3층 건축. 계획 → 드래프트 → 감정(인출) → 배치.
//
// 한 층:
//   ⓪ 계획(2·3층) — 카드를 한 장도 보기 전에 **정초석 자리**를 선언할 수 있다(선택).
//   ① 드래프트에서 **영단어만 적힌** 방 카드를 고른다.
//   ② 감정(鑑定) — 그 단어의 뜻을 4지선다로 인출한다. 맞혀야 자재(양식)가 드러난다.
//   ③ 배치 — 같은 양식 방과 상하좌우로 붙이면 복도가 이어지고 점수가 붙는다.
//
// v07.9 반증 감사 대응. 이전 판(v07.8)에서 측정된 구멍 6개를 막았다.
//   ① 정초석이 무위험 공짜 옵션이었다 — 배치 직전(완전 정보)에 걸 수 있었고 실패해도
//      "이 층 복도 점수 절반"이라 복도가 0이면 손실도 0이었다. 이제 **층 시작 시점에
//      빈 칸을 선언**하고(이웃이 1개 이하인 칸만), 정산은 승/본전/패 3등급이다.
//   ② '감정 없이 짓기'가 공짜 정답 공개 버튼이었다 — 배치 바와 도면에 뜻을 그대로
//      인쇄했다. 이제 스킵한 방의 뜻은 **끝 화면에서만** 공개한다.
//   ③ 오답 보기를 층을 만들 때 미리 구워서, 이미 도면에 인쇄된 뜻이 보기로 나와
//      소거법이 통했다. 이제 카드를 집는 순간 **그때의 도면**을 피해서 만든다(카드당 1회 고정).
//   ④ 전량 스킵으로 45초 만에 완주해도 폭죽 + '3층 완공' 배지가 떴다. 이제 스킵에 시간
//      비용이 붙고, 축하는 성과 조건부다.
//   ⑤ 시간이 130초 단일 시계 + 가산 상한 97.5초라 잘할수록 시계가 장식이 됐다.
//      이제 **층별 예산**(54/40/31초)이고 가산 상한은 층 예산의 35%, 남은 시간은 점수가 된다.
//   ⑥ 층 완공 대기 420ms 창에서 칸 소모 없이 점수를 더 벌 수 있었다 — 즉시 잠근다.
//
// FSRS 무결성: 모르는 단어는 **정직하게 오답으로 올라간다**. 스킵도 onWrong 이다(뜻을
// 보여주지 않으므로 assisted 가 아니다). 뜻이 이미 도면에 인쇄된 단어를 다시 감정하게
// 되는 경로가 생기면 그때만 { assisted: true } 를 붙인다. 같은 단어 재출제는 폐지했다.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  GameMusic,
  ParticleBurst,
  FeedbackIcon,
  TimerBar,
  Kbd,
  useSfx,
  useCountUp,
  useCountdown,
  useCombo,
  usePersonalBest,
  shuffle,
  type Word,
} from '@/components/game/_shared/gamekit';

interface ResultOpts {
  assisted?: boolean;
}

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// ─── 자재(양식) ─────────────────────────────────────────────────────────────
// 색만으로 구분하지 않는다 — 이름(석조/목조/유리) + 전용 글리프 + 색의 3중 인코딩.
type Style = 'stone' | 'timber' | 'glass';
const STYLES: Style[] = ['stone', 'timber', 'glass'];
const STYLE_KO: Record<Style, string> = { stone: '석조', timber: '목조', glass: '유리' };
const STYLE_COLOR: Record<Style, string> = { stone: '#7C8AA8', timber: '#C08A3E', glass: '#3FA9B8' };

function StyleGlyph({ s, size = 13 }: { s: Style; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={STYLE_KO[s]}
      className="le-glyph"
    >
      {s === 'stone' && (
        <>
          <rect x="2" y="3.5" width="12" height="4.2" rx="0.6" />
          <rect x="2" y="8.3" width="12" height="4.2" rx="0.6" />
          <path d="M8 3.5v4.2M5 8.3v4.2M11 8.3v4.2" />
        </>
      )}
      {s === 'timber' && (
        <>
          <path d="M2 4.4h12M2 8h12M2 11.6h12" />
          <path d="M6.2 4.4v3.6M10 8v3.6" />
        </>
      )}
      {s === 'glass' && (
        <>
          <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1.2" />
          <path d="M8 2.6v10.8M2.6 8h10.8" />
        </>
      )}
    </svg>
  );
}

function PlainGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="무양식"
      className="le-glyph"
    >
      <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1.2" strokeDasharray="2.6 2.4" />
    </svg>
  );
}

// ─── 맛보기 뱅크 ────────────────────────────────────────────────────────────
// 내 단어장이 부족할 때만 쓰인다(스캐폴드가 wordPool 을 넘기지 못하는 경우).
// 실제 학습은 언제나 wordPool 우선. 재출제를 폐지했으므로 한 판에 최대 22개를 쓴다.
const BANK: Word[] = [
  { en: 'grief', ko: '깊은 슬픔' }, { en: 'hope', ko: '희망' }, { en: 'dread', ko: '공포·불안' },
  { en: 'relief', ko: '안도' }, { en: 'envy', ko: '질투' }, { en: 'pride', ko: '자부심' },
  { en: 'valley', ko: '계곡' }, { en: 'desert', ko: '사막' }, { en: 'harbor', ko: '항구' },
  { en: 'meadow', ko: '초원' }, { en: 'glacier', ko: '빙하' }, { en: 'canopy', ko: '숲우듬지' },
  { en: 'spine', ko: '척추' }, { en: 'nerve', ko: '신경' }, { en: 'lung', ko: '폐' },
  { en: 'tendon', ko: '힘줄' }, { en: 'pulse', ko: '맥박' }, { en: 'marrow', ko: '골수' },
  { en: 'debt', ko: '빚' }, { en: 'wage', ko: '임금' }, { en: 'budget', ko: '예산' },
  { en: 'levy', ko: '부과금' }, { en: 'yield', ko: '수익률' }, { en: 'ledger', ko: '장부' },
  { en: 'vow', ko: '맹세' }, { en: 'grant', ko: '보조금' }, { en: 'quarry', ko: '채석장' },
  { en: 'draft', ko: '초안' }, { en: 'beam', ko: '들보' }, { en: 'hinge', ko: '경첩' },
  { en: 'thresh', ko: '탈곡하다' }, { en: 'dwell', ko: '거주하다' }, { en: 'mend', ko: '고치다' },
  { en: 'linger', ko: '오래 머물다' }, { en: 'gauge', ko: '가늠하다' }, { en: 'forge', ko: '벼려 만들다' },
];

/** 스캐폴드 minWords 와 같은 값. 22턴을 전부 새 단어로 채우려면 이 정도가 필요하다. */
const MIN_POOL = 20;

// ─── 층 설계 ────────────────────────────────────────────────────────────────
// 층이 올라갈수록 (1) 기존 구조물이 늘어 배치 자유도가 줄고 (2) 자재 구성이 치우쳐
// 계획이 어려워지며 (3) 복도 배수가 커지고 (4) **턴당 시간이 줄어든다**.
//
// budgetMs 근거 — 관측 대신 보수적 추정으로 계산한 턴당 여유(초):
//   벽시계 소요 ≈ 정답 4.6s / 오답 5.2s / 스킵 3.4s.
//   1층 54s ÷ 9칸 = 6.0s, 2층 40s ÷ 7칸 = 5.7s, 3층 31s ÷ 6칸 = 5.2s.
//   가산 상한(FLOOR_EXTEND_CAP)까지 더한 실효 여유는 3.3 → 2.9 → 2.4초로 단조 감소한다.
//   이전 판은 130초 단일 시계 + 가산 상한 97.5초라 정답률 0.8 이면 100초 넘게 남았다.
interface FloorPlan {
  name: string;
  short: string;
  mult: number;
  fixed: number;
  /** 자재 3종에 배분되는 카드 수(합 = 9 − fixed). 층마다 더 치우친다. */
  comp: [number, number, number];
  /** 이 층에만 주어지는 공사 시간(ms). 다음 층으로 이월되지 않는다. */
  budgetMs: number;
  note: string;
}
const FLOORS: FloorPlan[] = [
  { name: '1층 · 착공', short: '1층', mult: 1, fixed: 0, comp: [3, 3, 3], budgetMs: 54_000, note: '자재가 고르게 들어옵니다' },
  { name: '2층 · 증축', short: '2층', mult: 1.5, fixed: 2, comp: [3, 2, 2], budgetMs: 40_000, note: '기존 구조물 2 · 정초석을 걸 수 있어요' },
  { name: '3층 · 완공', short: '3층', mult: 2, fixed: 3, comp: [3, 2, 1], budgetMs: 31_000, note: '기존 구조물 3 · 복도 ×2 · 가장 빠듯한 층' },
];

/** 층별 최대 배치 수(미개발 부지가 없을 때). */
const BASE_CELLS = FLOORS.reduce((n, f) => n + (9 - f.fixed), 0); // 22

const APPRAISE_PTS = 10;
const CORRIDOR_PTS = 12;
/**
 * 정초석 정산 — 승 +80×배수 / 본전 / 패 −60×배수.
 * 시뮬(5,000판, 정답률 0.7, 그리디 배치) 기준 승 22% · 본전 55% · 패 23% 라
 * 기대값은 층당 +3점 안팎 = **거의 0**. 즉 "공짜 점수"가 아니라 분산을 사는 판돈이다.
 * 이전 판은 배치 직전에 걸 수 있어 승률 100% · 최대 +350점(= 22턴 감정 점수 총합보다 컸다).
 */
const CORNERSTONE_WIN = 80;
const CORNERSTONE_LOSS = 60;
/** 층당 '설계 보류'(스킵해도 연쇄가 끊기지 않는 횟수). 이게 없으면 전량 스킵이 지배 전략이 된다. */
const SKIP_SHELTER = 2;

const TIME_ON_CORRECT = 4_000;
const TIME_PER_CORRIDOR = 1_200;
const TIME_ON_WRONG = 5_000;
/**
 * 스킵 −2.5초 — 오답(−5초)의 절반. 시간만 놓고 보면 모르는 단어엔 스킵이 유리하고,
 * 점수·연쇄를 놓고 보면 찍기가 유리하다. 어느 쪽도 항상 이기지 않게 만든 값이다.
 * (이전 판은 스킵 비용이 0 이라 "시간 여유가 있으면 무조건 찍기"가 지배 전략이었다.)
 */
const TIME_ON_SKIP = 2_500;
/** 층을 끝내고 남은 시간 1초 = 1점. 시계가 장식이 되지 않게 하는 환류. */
const TIME_BONUS_PTS_PER_SEC = 1;
/**
 * 게임 쪽 가산 상한 — 층 예산의 35%.
 * 공용 useCountdown 의 기본 상한은 총량의 75% 라 층 예산에는 너무 헐겁다(54s → 40.5s).
 * 여기서 먼저 조여서 TIME_ON_CORRECT 가 층당 4~5번만 실효를 갖게 한다.
 */
const FLOOR_EXTEND_CAP = 0.35;
const WARN_MS = 10_000;

/** 축하 게이트 — 0점 완주를 승리로 축하하지 않는다(Calm UI). 시뮬상 정답률 0.55 근처가 경계. */
const CELEBRATE_MIN_OK = 12;
const CELEBRATE_MIN_SCORE = 250;

interface Card {
  id: string;
  en: string;
  ko: string;
  style: Style;
  /** 뜻이 이미 도면에 인쇄된 적이 있는 단어인가 — FSRS 에 assisted 로 올린다. */
  assisted: boolean;
}
interface Room {
  en: string;
  ko: string;
  /** null = 무양식(감정 실패·미감정) — 복도를 만들지 못한다. */
  style: Style | null;
  fixed: boolean;
  /** true = 뜻을 아직 공개하지 않는다(감정을 건너뛴 방). 끝 화면에서만 공개. */
  hideKo: boolean;
}
interface Pending {
  slot: number;
  card: Card;
  style: Style | null;
  kind: 'correct' | 'wrong' | 'skip';
}
type Stage = 'wager' | 'build';

const NEIGH = (i: number): number[] => {
  const r = Math.floor(i / 3), c = i % 3, out: number[] = [];
  if (r > 0) out.push(i - 3);
  if (r < 2) out.push(i + 3);
  if (c > 0) out.push(i - 1);
  if (c < 2) out.push(i + 1);
  return out;
};

function countPairs(g: (Room | null)[]): number {
  let p = 0;
  for (let i = 0; i < 9; i++) {
    const a = g[i];
    if (!a || !a.style) continue;
    const r = Math.floor(i / 3), c = i % 3;
    if (c < 2) { const b = g[i + 1]; if (b && b.style === a.style) p++; }
    if (r < 2) { const b = g[i + 3]; if (b && b.style === a.style) p++; }
  }
  return p;
}

function linkedCells(g: (Room | null)[]): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < 9; i++) {
    const a = g[i];
    if (!a || !a.style) continue;
    for (const j of NEIGH(i)) {
      const b = g[j];
      if (b && b.style === a.style) { s.add(i); s.add(j); }
    }
  }
  return s;
}

function sameStyleNeighbors(g: (Room | null)[], cell: number): number {
  const a = g[cell];
  if (!a || !a.style) return 0;
  let n = 0;
  for (const j of NEIGH(cell)) { const b = g[j]; if (b && b.style === a.style) n++; }
  return n;
}

/**
 * 정초석을 걸 수 있는 칸 — 빈 칸이고, 선언 시점에 **이미 정해진 이웃이 1개 이하**.
 * 왜 1개 이하인가: 같은 자재 이웃 2개가 조건인데 이웃이 2개 이상 정해져 있으면
 * "이미 같은 자재 2개가 붙은 칸"을 고르는 것으로 결과를 확정할 수 있다.
 * 최소 하나는 아직 감정하지 않은 카드로 채워야 하므로 결과가 확정되지 않는다.
 */
function eligibleCornerstoneCells(g: (Room | null)[], vacant: readonly number[]): number[] {
  const dead = new Set(vacant);
  const out: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (g[i] || dead.has(i)) continue;
    const settled = NEIGH(i).filter((j) => g[j] !== null || dead.has(j)).length;
    if (settled <= 1) out.push(i);
  }
  return out;
}

/** 오답 선택지 — 정답과 겹치지 않고, 화면에 이미 인쇄된 뜻은 피한다(소거법 차단). */
function pickKoOptions(pool: Word[], correctKo: string, avoid: Set<string>): string[] {
  const uniq: string[] = [];
  const seen = new Set<string>([correctKo]);
  for (const w of pool) {
    if (seen.has(w.ko)) continue;
    seen.add(w.ko);
    uniq.push(w.ko);
  }
  const out: string[] = [];
  for (const k of shuffle(uniq.filter((k) => !avoid.has(k)))) {
    if (out.length >= 3) break;
    out.push(k);
  }
  // 후보가 모자랄 때만 인쇄된 뜻을 허용한다(단어장이 22개 미만인 경우).
  for (const k of shuffle(uniq)) {
    if (out.length >= 3) break;
    if (!out.includes(k)) out.push(k);
  }
  return shuffle([correctKo, ...out]);
}

interface FloorBuild {
  grid: (Room | null)[];
  deck: Card[];
  comp: { s: Style; n: number }[];
  /** 새 단어가 모자라 이번 층에 짓지 못하는 칸 — 같은 단어를 다시 내는 대신 층을 작게 짓는다. */
  vacant: number[];
}

function buildFloor(
  floorIdx: number,
  pool: Word[],
  usedEn: Set<string>,
  built: Room[],
  revealedEn: Set<string>,
): FloorBuild {
  const plan = FLOORS[floorIdx];
  const grid: (Room | null)[] = Array(9).fill(null);

  // 기존 구조물 — 앞 층에서 제대로 지은 방을 이월한다(연속성 + 배치 제약).
  // 이미 뜻이 공개된 방만 이월하므로 도면에 뜻이 적혀도 정답이 새지 않는다.
  const carried: Room[] = shuffle(built.filter((r) => r.style !== null && !r.hideKo))
    .filter((r, i, a) => a.findIndex((x) => x.en === r.en) === i)
    .slice(0, plan.fixed)
    .map((r) => ({ ...r, fixed: true }));
  if (carried.length < plan.fixed) {
    for (const w of shuffle(pool.filter((x) => !usedEn.has(x.en.toLowerCase())))) {
      if (carried.length >= plan.fixed) break;
      usedEn.add(w.en.toLowerCase());
      revealedEn.add(w.en.toLowerCase()); // 도면에 뜻이 인쇄된다 — 다시 물으면 assisted
      carried.push({
        en: w.en,
        ko: w.ko,
        style: STYLES[Math.floor(Math.random() * STYLES.length)],
        fixed: true,
        hideKo: false,
      });
    }
  }

  const blockedEn = new Set(carried.map((r) => r.en.toLowerCase()));
  const need = 9 - carried.length;
  // 재출제 폐지 — 60~120초 전에 뜻을 본 단어를 다시 내면 인출이 아니라 재인이고,
  // 감정 정답률이 인위적으로 100%에 붙는다. 새 단어가 모자라면 층을 작게 짓는다.
  const fresh = shuffle(pool.filter((w) => !usedEn.has(w.en.toLowerCase()) && !blockedEn.has(w.en.toLowerCase())));
  const chosen = fresh.slice(0, need);
  chosen.forEach((w) => usedEn.add(w.en.toLowerCase()));

  // 자재 배분 — 어느 자재가 많이 들어올지는 판마다 달라진다(도면 하단 범례로 공개).
  const order = shuffle(STYLES);
  const bag: Style[] = [];
  order.forEach((s, i) => { for (let k = 0; k < plan.comp[i]; k++) bag.push(s); });
  while (bag.length < chosen.length) bag.push(order[bag.length % order.length]);
  const styleBag = shuffle(bag.slice(0, chosen.length));

  const deck: Card[] = chosen.map((w, i) => ({
    id: `f${floorIdx}-${i}-${w.en}`,
    en: w.en,
    ko: w.ko,
    style: styleBag[i],
    assisted: revealedEn.has(w.en.toLowerCase()),
  }));

  const cells = shuffle(Array.from({ length: 9 }, (_, i) => i));
  cells.slice(0, carried.length).forEach((cell, i) => { grid[cell] = carried[i]; });
  const shortfall = need - chosen.length;
  const vacant = cells.slice(carried.length, carried.length + shortfall);

  const counts: Record<Style, number> = { stone: 0, timber: 0, glass: 0 };
  styleBag.forEach((s) => { counts[s] += 1; });
  const comp = STYLES.map((s) => ({ s, n: counts[s] })).filter((c) => c.n > 0);

  return { grid, deck, comp, vacant };
}

export function LexiconEstateGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  // 내 단어장 우선 — MIN_POOL 이상이면 실제 학습 단어로 저택을 짓는다.
  const pool = useMemo(() => {
    const src = wordPool && wordPool.length >= MIN_POOL ? wordPool : BANK;
    const seen = new Set<string>();
    const out: Word[] = [];
    for (const w of src) {
      const en = (w.en ?? '').trim();
      const ko = (w.ko ?? '').trim();
      if (!en || !ko) continue;
      const key = en.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ en, ko });
    }
    // 재출제를 폐지했으므로 풀이 얕으면 3층이 통째로 미개발 부지가 된다.
    // MIN_POOL 미만이면 맛보기 뱅크로 돌려 세 층이 항상 성립하게 한다.
    return out.length >= MIN_POOL ? out : BANK;
  }, [wordPool]);

  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [outcome, setOutcome] = useState<'complete' | 'timeup'>('complete');
  const [earned, setEarned] = useState(false);
  const [transit, setTransit] = useState<'in' | 'out' | null>(null);
  const [stage, setStage] = useState<Stage>('build');
  const [locked, setLocked] = useState(false);

  const [floorIdx, setFloorIdx] = useState(0);
  const [grid, setGrid] = useState<(Room | null)[]>(Array(9).fill(null));
  const [vacant, setVacant] = useState<number[]>([]);
  const [draft, setDraft] = useState<(Card | null)[]>([null, null, null]);
  const [comp, setComp] = useState<{ s: Style; n: number }[]>([]);
  const [heldIdx, setHeldIdx] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [shelter, setShelter] = useState(SKIP_SHELTER);

  const [score, setScore] = useState(0);
  const [corridors, setCorridors] = useState(0);
  const [placedTotal, setPlacedTotal] = useState(0);
  const [plannedTotal, setPlannedTotal] = useState(BASE_CELLS);
  const [appraise, setAppraise] = useState({ ok: 0, tried: 0, skipped: 0 });
  const [missed, setMissed] = useState<{ en: string; ko: string }[]>([]);
  const [cornerstone, setCornerstone] = useState<number | null>(null);

  const [flash, setFlash] = useState('');
  const [flashKind, setFlashKind] = useState<'correct' | 'wrong' | 'near' | 'info'>('info');
  const [just, setJust] = useState<{ cell: number; gain: number } | null>(null);
  const [ghost, setGhost] = useState<{ cell: number; gain: number } | null>(null);
  const [bestInfo, setBestInfo] = useState<{ improved: boolean; prev: number | null } | null>(null);

  const deckRef = useRef<Card[]>([]);
  const usedRef = useRef<Set<string>>(new Set());
  const revealedRef = useRef<Set<string>>(new Set());
  const builtRef = useRef<Room[]>([]);
  const optionsRef = useRef<Map<string, string[]>>(new Map());
  const scoreRef = useRef(0);
  const floorRef = useRef(0);
  const plannedRef = useRef(BASE_CELLS);
  const shelterRef = useRef(SKIP_SHELTER);
  const grantRef = useRef(0);
  const clockFloorRef = useRef(-1);
  const finishedRef = useRef(false);
  const submittedRef = useRef(false);
  const tierUpRef = useRef(false);
  const timers = useRef<number[]>([]);
  // 정초석은 점수 정산과 얽혀 있어 상태 갱신 함수 안에서 부수효과를 내면 안 된다
  // (StrictMode 이중 호출 시 점수가 두 번 오른다). ref 를 진실로 두고 state 는 렌더용 거울.
  const csRef = useRef<number | null>(null);
  const setCs = useCallback((cell: number | null) => {
    csRef.current = cell;
    setCornerstone(cell);
  }, []);
  // 감정 집계도 종료 시점(축하 게이트)에 즉시 읽어야 해서 ref 를 진실로 둔다.
  const apRef = useRef({ ok: 0, tried: 0, skipped: 0 });
  const setAp = useCallback((next: { ok: number; tried: number; skipped: number }) => {
    apRef.current = next;
    setAppraise(next);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const pb = usePersonalBest('lexicon-estate', true);

  const combo = useCombo({
    onTierUp: (tier, c) => {
      tierUpRef.current = true;
      setFlash(`${tier.label ?? '연쇄'} · 연쇄 ${c} · 복도 ×${tier.mult}`);
      setFlashKind('correct');
    },
    onBreak: (lost) => {
      setFlash(`연쇄 ${lost}이 끊겼어요 — 다시 이어 봐요`);
      setFlashKind('near');
    },
  });
  const comboRef = useRef(combo);
  comboRef.current = combo;

  const finish = useCallback((why: 'complete' | 'timeup') => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers(); // 예약된 층 전환·고스트 정리 — 끝난 뒤에 판이 움직이지 않게
    // 축하는 성과에만. 전량 스킵 완주(감정 0/22)까지 폭죽으로 축하하던 구멍을 막는다.
    const won =
      why === 'complete' &&
      apRef.current.ok >= CELEBRATE_MIN_OK &&
      scoreRef.current >= CELEBRATE_MIN_SCORE;
    setEarned(won);
    setOutcome(why);
    setHeldIdx(null);
    setPending(null);
    if (won) sfx.fanfare();
    setPhase('done');
  }, [sfx, clearTimers]);

  const cd = useCountdown({
    totalMs: FLOORS[0].budgetMs,
    running: phase === 'play' && transit === null && stage === 'build' && !locked,
    warnAtMs: WARN_MS,
    onWarn: () => { setFlash('이 층 남은 시간이 10초 아래예요'); setFlashKind('near'); },
    onEnd: () => finish('timeup'),
  });
  const cdRef = useRef(cd);
  cdRef.current = cd;

  /** 층 예산 안에서만 시간을 준다 — 공용 훅의 75% 상한보다 먼저 조인다. */
  const grantTime = useCallback((ms: number) => {
    const cap = FLOORS[floorRef.current].budgetMs * FLOOR_EXTEND_CAP;
    const allow = Math.max(0, Math.min(ms, cap - grantRef.current));
    if (allow <= 0) return;
    grantRef.current += allow;
    cdRef.current.extend(allow);
  }, []);

  /** 새 층을 편다. 돌려주는 값 = 이번 층에 실제로 지을 방 수(0 이면 지을 게 없다). */
  const openFloor = useCallback((idx: number): number => {
    const built = buildFloor(idx, pool, usedRef.current, builtRef.current, revealedRef.current);
    deckRef.current = built.deck.slice();
    optionsRef.current = new Map();
    setGrid(built.grid);
    setVacant(built.vacant);
    setComp(built.comp);
    setDraft([deckRef.current.shift() ?? null, deckRef.current.shift() ?? null, deckRef.current.shift() ?? null]);
    setHeldIdx(null);
    setPending(null);
    setGhost(null);
    setJust(null);
    setLocked(false);
    setCs(null);
    grantRef.current = 0;
    shelterRef.current = SKIP_SHELTER;
    setShelter(SKIP_SHELTER);
    plannedRef.current -= built.vacant.length;
    setPlannedTotal(plannedRef.current);
    // 정초석은 카드를 한 장도 보기 전에만 선언할 수 있다(완전 정보 차단).
    const canWager = idx >= 1 && built.deck.length > 0 && eligibleCornerstoneCells(built.grid, built.vacant).length > 0;
    setStage(canWager ? 'wager' : 'build');
    return built.deck.length;
  }, [pool, setCs]);

  const start = useCallback(() => {
    clearTimers();
    finishedRef.current = false;
    submittedRef.current = false;
    usedRef.current = new Set();
    revealedRef.current = new Set();
    builtRef.current = [];
    scoreRef.current = 0;
    floorRef.current = 0;
    plannedRef.current = BASE_CELLS;
    clockFloorRef.current = -1;
    setScore(0);
    setCorridors(0);
    setPlacedTotal(0);
    setPlannedTotal(BASE_CELLS);
    setAp({ ok: 0, tried: 0, skipped: 0 });
    setMissed([]);
    setBestInfo(null);
    setEarned(false);
    setFloorIdx(0);
    setTransit(null);
    setFlash('');
    setFlashKind('info');
    comboRef.current.reset();
    openFloor(0);
    setPhase('play');
  }, [clearTimers, openFloor, setAp]);

  useEffect(() => {
    start();
    // 최초 1회 + 단어 풀 교체 시에만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  // 층 예산은 계획 단계가 끝나고 첫 카드 직전에 시작한다 — 전환 애니메이션·정초석 고민에
  // 예산을 먹히지 않게.
  useEffect(() => {
    if (phase !== 'play' || transit !== null || stage !== 'build') return;
    if (clockFloorRef.current === floorIdx) return;
    clockFloorRef.current = floorIdx;
    grantRef.current = 0;
    cdRef.current.reset(FLOORS[floorIdx].budgetMs);
  }, [phase, transit, stage, floorIdx]);

  useEffect(() => {
    if (phase !== 'done' || submittedRef.current) return;
    submittedRef.current = true;
    setBestInfo(pb.submit(scoreRef.current));
  }, [phase, pb]);

  const plan = FLOORS[floorIdx];
  const linked = useMemo(() => linkedCells(grid), [grid]);
  const vacantSet = useMemo(() => new Set(vacant), [vacant]);
  const eligible = useMemo(
    () => (stage === 'wager' ? new Set(eligibleCornerstoneCells(grid, vacant)) : new Set<number>()),
    [stage, grid, vacant],
  );
  const shownScore = useCountUp(score);
  const planning = stage === 'wager';
  const busy = phase !== 'play' || transit !== null || locked || planning;
  // 층 예산은 계획이 끝난 뒤 시작한다 — 그 전까지 게이지는 앞 층의 잔량이 아니라
  // 이번 층의 만량을 보여줘야 시계가 거짓말하지 않는다.
  const clockPending = planning || transit === 'in';

  const bump = useCallback((n: number) => {
    scoreRef.current = Math.max(0, scoreRef.current + n);
    setScore(scoreRef.current);
  }, []);

  // ── ⓪ 계획 — 정초석 선언 ────────────────────────────────────────────────
  const declareCornerstone = useCallback((cell: number) => {
    if (phase !== 'play' || transit !== null || stage !== 'wager') return;
    if (!eligible.has(cell)) return;
    sfx.coin();
    setCs(cell);
    setStage('build');
    setFlash(`◆ ${cell + 1}번 터에 정초석을 걸었어요 — 같은 자재 방 2개와 이어 보세요`);
    setFlashKind('info');
  }, [phase, transit, stage, eligible, sfx, setCs]);

  const declineWager = useCallback(() => {
    if (stage !== 'wager') return;
    sfx.click();
    setCs(null);
    setStage('build');
    setFlash('정초석 없이 안전하게 갑니다');
    setFlashKind('info');
  }, [stage, sfx, setCs]);

  // ── ① 카드 고르기 ────────────────────────────────────────────────────────
  // 오답 보기는 **집는 순간** 만든다. 층을 만들 때 미리 구우면 그 뒤에 지어진 방의 뜻이
  // 보기로 남아 소거법이 통했다. 카드당 한 번만 굽고 캐시한다 — 다시 집어도 보기가
  // 바뀌지 않아야 두 번 집어 교집합을 내는 우회로가 막힌다.
  const holdCard = useCallback((i: number) => {
    if (busy || pending) return;
    const card = draft[i];
    if (!card) return;
    if (!optionsRef.current.has(card.id)) {
      const avoid = new Set<string>();
      grid.forEach((r) => { if (r && !r.hideKo) avoid.add(r.ko); });
      optionsRef.current.set(card.id, pickKoOptions(pool, card.ko, avoid));
    }
    sfx.click();
    setGhost(null);
    setHeldIdx((h) => (h === i ? null : i));
  }, [busy, pending, draft, sfx, grid, pool]);

  const heldCard = heldIdx !== null ? draft[heldIdx] : null;
  const heldOptions = heldCard ? optionsRef.current.get(heldCard.id) ?? [] : [];

  // ── ② 감정(인출) ─────────────────────────────────────────────────────────
  const appraiseAnswer = useCallback((choice: string | null) => {
    if (busy || heldIdx === null) return;
    const card = draft[heldIdx];
    if (!card) return;
    const w: Word = { en: card.en, ko: card.ko };
    // 뜻이 이미 도면에 인쇄됐던 단어라면 인출이 아니다 — FSRS 카드를 건드리지 않게 표시.
    const opts: ResultOpts | undefined = card.assisted ? { assisted: true } : undefined;
    const slot = heldIdx;
    setHeldIdx(null);
    setGhost(null);

    if (choice === null) {
      // 설계 보류(감정 없이 짓기) — **정답을 보여주지 않는다**. 뜻은 끝 화면에서만 공개.
      // 모르는 단어는 정직하게 오답으로 올라가야 복습이 잡힌다(FSRS 무결성).
      sfx.click();
      const sheltered = shelterRef.current > 0;
      if (sheltered) {
        shelterRef.current -= 1;
        setShelter(shelterRef.current);
      } else {
        combo.miss();
      }
      onWrong?.(w, opts);
      cd.drain(TIME_ON_SKIP);
      setAp({ ...apRef.current, skipped: apRef.current.skipped + 1 });
      setMissed((m) => [...m, { en: card.en, ko: card.ko }]);
      setPending({ slot, card, style: null, kind: 'skip' });
      setFlash(
        sheltered
          ? `설계 보류 · 시간 −2.5초 · 연쇄는 지켰어요 (남은 보류 ${shelterRef.current}회)`
          : '설계 보류 · 시간 −2.5초 · 보류를 다 써서 연쇄가 끊겼어요',
      );
      setFlashKind('info');
      return;
    }

    if (choice === card.ko) {
      tierUpRef.current = false;
      const c = combo.hit();
      sfx.correct(c, tierUpRef.current);
      onCorrect?.(w, opts);
      grantTime(TIME_ON_CORRECT);
      bump(Math.round(APPRAISE_PTS * plan.mult));
      setAp({ ...apRef.current, ok: apRef.current.ok + 1, tried: apRef.current.tried + 1 });
      setPending({ slot, card, style: card.style, kind: 'correct' });
      if (!tierUpRef.current) {
        setFlash(`감정 성공 · +${Math.round(APPRAISE_PTS * plan.mult)}점 · 시간 +4초`);
        setFlashKind('correct');
      }
      return;
    }

    sfx.wrong();
    combo.miss();
    onWrong?.(w, opts);
    cd.drain(TIME_ON_WRONG);
    revealedRef.current.add(card.en.toLowerCase());
    setAp({ ...apRef.current, tried: apRef.current.tried + 1 });
    setMissed((m) => [...m, { en: card.en, ko: card.ko }]);
    setPending({ slot, card, style: null, kind: 'wrong' });
    setFlash(`${card.en}은 “${card.ko}”였어요 · 시간 −5초`);
    setFlashKind('wrong');
  }, [busy, heldIdx, draft, sfx, combo, onCorrect, onWrong, cd, grantTime, bump, plan.mult, setAp]);

  const cancelAppraise = useCallback(() => {
    if (heldIdx === null) return;
    sfx.click();
    setHeldIdx(null);
  }, [heldIdx, sfx]);

  // ── ③ 배치 ───────────────────────────────────────────────────────────────
  const advanceFloor = useCallback((g: (Room | null)[]) => {
    const notes: string[] = [];
    // 정초석 정산 — 승(같은 자재 2개 이상) / 본전(1개) / 패(0개).
    const cell = csRef.current;
    if (cell !== null) {
      const n = sameStyleNeighbors(g, cell);
      if (n >= 2) {
        const win = Math.round(CORNERSTONE_WIN * FLOORS[floorRef.current].mult);
        bump(win);
        sfx.coin();
        notes.push(`정초석이 ${n}개 방과 이어졌어요 +${win}점`);
      } else if (n === 1) {
        notes.push('정초석이 겨우 하나와 이어졌어요 — 본전');
      } else {
        const loss = Math.round(CORNERSTONE_LOSS * FLOORS[floorRef.current].mult);
        bump(-loss);
        sfx.nearMiss();
        notes.push(`정초석이 외로웠어요 −${loss}점`);
      }
    }
    setCs(null);

    // 남은 시간 → 점수. 시계가 장식이 되지 않도록 아낀 시간에 값을 매긴다.
    const leftSec = Math.max(0, Math.floor(cdRef.current.remainMs / 1000));
    if (leftSec > 0) {
      const bonus = leftSec * TIME_BONUS_PTS_PER_SEC;
      bump(bonus);
      notes.push(`남은 ${leftSec}초 +${bonus}점`);
    }
    if (notes.length > 0) {
      setFlash(notes.join(' · '));
      setFlashKind(cell !== null && sameStyleNeighbors(g, cell) === 0 ? 'near' : 'correct');
    }

    setTransit('out');
    later(() => {
      const next = floorRef.current + 1;
      if (next >= FLOORS.length) { finish('complete'); return; }
      floorRef.current = next;
      setFloorIdx(next);
      // 새 단어가 바닥나 지을 방이 하나도 없으면 층을 억지로 열지 않는다(진행 불가 방지).
      if (openFloor(next) === 0) { finish('complete'); return; }
      setTransit('in');
      later(() => setTransit(null), 440);
    }, 620);
  }, [bump, sfx, later, finish, openFloor, setCs]);

  const place = useCallback((cell: number) => {
    if (busy || !pending || grid[cell] || vacantSet.has(cell)) return;
    const room: Room = {
      en: pending.card.en,
      ko: pending.card.ko,
      style: pending.style,
      fixed: false,
      hideKo: pending.kind === 'skip',
    };
    const before = countPairs(grid);
    const g = grid.slice();
    g[cell] = room;
    const gained = countPairs(g) - before;

    // 니어미스 — 0개를 만든 배치 직후, 더 나은 자리가 있었으면 조용히 보여준다.
    let bestAlt = 0, bestCell = -1;
    if (pending.style && gained === 0) {
      for (let i = 0; i < 9; i++) {
        if (grid[i] || i === cell || vacantSet.has(i)) continue;
        const t = grid.slice();
        t[i] = room;
        const gg = countPairs(t) - before;
        if (gg > bestAlt) { bestAlt = gg; bestCell = i; }
      }
    }

    setGrid(g);
    if (pending.style) builtRef.current.push(room);
    if (!room.hideKo) revealedRef.current.add(room.en.toLowerCase());
    setPlacedTotal((p) => p + 1);

    if (gained > 0) {
      const pts = Math.round(gained * CORRIDOR_PTS * plan.mult * combo.mult);
      bump(pts);
      setCorridors((c) => c + gained);
      grantTime(gained * TIME_PER_CORRIDOR);
      sfx.coin();
      setJust({ cell, gain: gained });
      later(() => setJust(null), 720);
      setFlash(`복도 +${gained} · +${pts}점${combo.mult > 1 ? ` (연쇄 ×${combo.mult})` : ''}`);
      setFlashKind('correct');
    } else if (bestAlt > 0) {
      sfx.nearMiss();
      setGhost({ cell: bestCell, gain: bestAlt });
      later(() => setGhost(null), 1500);
      setFlash(`저 자리였다면 복도 +${bestAlt}`);
      setFlashKind('near');
    } else {
      sfx.click();
    }

    const slot = pending.slot;
    setDraft((d) => { const nd = d.slice(); nd[slot] = deckRef.current.shift() ?? null; return nd; });
    setPending(null);

    // 층이 다 찼으면 **즉시 잠근다**. 이전 판은 420ms 대기 창에서 카드 소비 없이
    // 감정·점수·시간을 더 벌 수 있었다.
    if (g.every((r, i) => r !== null || vacantSet.has(i))) {
      setLocked(true);
      later(() => advanceFloor(g), 420);
    }
  }, [busy, pending, grid, vacantSet, plan.mult, combo.mult, bump, grantTime, sfx, later, advanceFloor]);

  const onCellClick = useCallback((i: number) => {
    if (planning) { declareCornerstone(i); return; }
    place(i);
  }, [planning, declareCornerstone, place]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  // ── 키보드 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (planning) {
        if (e.key === 'Escape') { e.preventDefault(); declineWager(); return; }
        const c = Number(e.key);
        if (Number.isInteger(c) && c >= 1 && c <= 9 && eligible.has(c - 1)) {
          e.preventDefault();
          declareCornerstone(c - 1);
        }
        return;
      }
      if (e.key === 'Escape' && heldCard) { e.preventDefault(); cancelAppraise(); return; }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (heldCard) {
        const opt = heldOptions[n - 1];
        if (opt) { e.preventDefault(); appraiseAnswer(opt); }
        return;
      }
      if (!pending && n <= 3) { e.preventDefault(); holdCard(n - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, planning, eligible, declineWager, declareCornerstone, heldCard, heldOptions, pending, cancelAppraise, appraiseAnswer, holdCard]);

  // ─── 완료 화면 ────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const complete = outcome === 'complete';
    const attempted = appraise.tried + appraise.skipped;
    const uniqueMissed = missed.filter((m, i) => missed.findIndex((x) => x.en === m.en) === i).slice(0, 8);
    const lead = earned
      ? '저택이 완성됐어요'
      : complete
        ? '저택은 섰어요 — 아직 빈 방이 많네요'
        : '여기까지 지었어요';
    const hint = !complete
      ? '이 층 예산 안에서만 지을 수 있어요 — 아는 단어부터 감정하면 시간이 남아요.'
      : !earned
        ? '감정을 건너뛴 방은 복도를 못 만들어요. 다음 판엔 반쯤 아는 단어도 한번 골라 보세요.'
        : bestInfo?.improved
          ? `다음 판 목표: 복도 ${corridors + 2}개`
          : pb.best != null && pb.best > score
            ? `개인 최고까지 ${pb.best - score}점 남았어요`
            : `다음 판 목표: 복도 ${corridors + 2}개`;

    return (
      <div className="gk-root le-root">
        <GameMusic gameId="lexicon-estate" />
        <div className="gk-sr" aria-live="polite">{flash}</div>
        <GameKitStyles />
        <AmbientBackground center="#E4ECF5" mid="#A9BFD8" edge="#152238" glow="rgba(120,180,255,.3)" glowAt="50% 30%" watermark="lexicon-estate" />
        <style dangerouslySetInnerHTML={{ __html: LE_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="lexicon-estate"
          lead={lead}
          celebrate={earned}
          badge={
            bestInfo?.improved ? (
              <><FeedbackIcon kind="correct" /> 개인 최고 갱신</>
            ) : earned ? (
              <><FeedbackIcon kind="correct" /> 3층 완공</>
            ) : complete ? (
              <><FeedbackIcon kind="near" /> 완주 · 감정 {appraise.ok}/{attempted}</>
            ) : undefined
          }
          reveal={
            uniqueMissed.length > 0 ? (
              <div className="le-reveal">
                <span className="le-reveal-title">
                  다시 볼 단어{appraise.skipped > 0 ? ` · 보류한 ${appraise.skipped}개 포함` : ''}
                </span>
                <ul className="le-reveal-list">
                  {uniqueMissed.map((m) => (
                    <li key={m.en}><b>{m.en}</b><span>{m.ko}</span></li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          stats={[
            { num: `${score}`, label: '점수', accent: true },
            { num: `${corridors}`, label: '이어진 복도' },
            // 스킵을 분모에서 빼면 전량 스킵이 '0/0'으로 보였다 — 시도 전체를 분모로.
            { num: `${appraise.ok}/${attempted}`, label: '감정 성공' },
            { num: `${combo.best}`, label: '최고 연쇄' },
          ]}
          best={{ prev: bestInfo?.prev ?? null, now: score, label: '점수', improved: !!bestInfo?.improved }}
          restartHint={hint}
          restartLabel="새 저택"
          onRestart={start}
          onExit={handleExit}
        />
      </div>
    );
  }

  // ─── 플레이 ───────────────────────────────────────────────────────────────
  return (
    <div className="gk-root le-root">
      <GameMusic gameId="lexicon-estate" />
      <div className="gk-sr" aria-live="polite">{flash}</div>
      <GameKitStyles />
      <AmbientBackground center="#E4ECF5" mid="#A9BFD8" edge="#152238" glow="rgba(120,180,255,.28)" glowAt="50% 20%" watermark="lexicon-estate" />
      <style dangerouslySetInnerHTML={{ __html: LE_CSS }} />
      <Hud
        score={shownScore}
        progress={placedTotal / Math.max(1, plannedTotal)}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <TimerBar
            frac={clockPending ? 1 : cd.frac}
            warning={!clockPending && cd.warning}
            seconds={clockPending ? Math.round(plan.budgetMs / 1000) : cd.remainSec}
            label={`${plan.short} 공사 시간`}
          />
        }
      />

      <main className="gk-stage le-stage">
        <p className="le-help">
          <b>영단어 카드</b>를 골라 뜻을 맞히면 자재가 드러나요. 같은 자재 방을 상하좌우로 붙여 <b>복도</b>를 이어 보세요.
        </p>

        <div className="le-floor">
          <span className="le-floor-name">{plan.name}</span>
          <span className="le-floor-mult">복도 ×{plan.mult}</span>
          <span className="le-floor-budget">{Math.round(plan.budgetMs / 1000)}초 예산</span>
          <span className="le-floor-note">{plan.note}</span>
        </div>

        <div
          className="le-estate"
          role="group"
          aria-label={`${plan.short} 도면`}
          data-transit={transit ?? 'idle'}
          data-hot={combo.tierIndex >= 2 ? '1' : '0'}
        >
          {grid.map((room, i) => {
            const isVacant = vacantSet.has(i);
            const isLinked = linked.has(i);
            const ghostGain = ghost && ghost.cell === i ? ghost.gain : 0;
            const justGain = just && just.cell === i ? just.gain : 0;
            // disabled 대신 aria-disabled — 이미 지은 방도 키보드·스크린리더로 읽혀야
            // 도면을 훑어 다음 수를 계획할 수 있다(포커스를 뺏지 않는다).
            const canDrop = !planning && !!pending && !room && !isVacant && !busy;
            const canPick = planning && eligible.has(i);
            return (
              <button
                key={i}
                type="button"
                className={[
                  'le-cell',
                  room ? 'le-cell--room' : isVacant ? 'le-cell--vacant' : 'le-cell--empty',
                  room && !room.style ? 'le-cell--plainroom' : '',
                  room?.fixed ? 'le-cell--fixed' : '',
                  isLinked ? 'le-cell--linked' : '',
                  justGain > 0 ? 'le-cell--just' : '',
                  cornerstone === i ? 'le-cell--corner' : '',
                  canDrop ? 'le-cell--target' : '',
                  canPick ? 'le-cell--pick' : '',
                  ghostGain > 0 ? 'le-cell--ghost' : '',
                ].filter(Boolean).join(' ')}
                style={room?.style ? ({ ['--sc' as string]: STYLE_COLOR[room.style] }) : undefined}
                onClick={() => onCellClick(i)}
                aria-disabled={!canDrop && !canPick}
                aria-label={
                  room
                    ? `${room.en} ${room.hideKo ? '뜻 미확인' : room.ko} · ${room.style ? STYLE_KO[room.style] : '무양식'}${room.fixed ? ' · 기존 구조물' : ''}${isLinked ? ' · 복도 연결됨' : ''}`
                    : isVacant
                      ? `미개발 부지 ${i + 1} — 이번 층에는 짓지 않아요`
                      : canPick
                        ? `빈 터 ${i + 1} — 여기에 정초석 걸기`
                        : canDrop ? `빈 터 ${i + 1} — 여기에 짓기` : `빈 터 ${i + 1}`
                }
              >
                {room ? (
                  <>
                    <span className="le-cell-badge">
                      {room.style ? <StyleGlyph s={room.style} size={11} /> : <PlainGlyph size={11} />}
                      <span>{room.style ? STYLE_KO[room.style] : '무양식'}{room.fixed ? ' · 기존' : ''}</span>
                    </span>
                    <span className="le-cell-en">{room.en}</span>
                    <span className={`le-cell-ko${room.hideKo ? ' le-cell-ko--hidden' : ''}`}>
                      {room.hideKo ? '뜻 미확인' : room.ko}
                    </span>
                    {isLinked && <span className="le-cell-link" aria-hidden="true">⇿</span>}
                    {cornerstone === i && <span className="le-cell-corner" aria-hidden="true">◆</span>}
                    {justGain > 0 && (
                      <ParticleBurst
                        intensity={Math.min(3, justGain)}
                        colors={room.style ? [STYLE_COLOR[room.style], 'var(--combo)'] : undefined}
                      />
                    )}
                  </>
                ) : isVacant ? (
                  <span className="le-cell-vacant" aria-hidden="true">미개발</span>
                ) : (
                  <>
                    <span className="le-cell-plus" aria-hidden="true">{canPick ? '◇' : '＋'}</span>
                    {canPick && <span className="le-cell-picknum" aria-hidden="true">{i + 1}</span>}
                    {cornerstone === i && <span className="le-cell-corner" aria-hidden="true">◆</span>}
                    {ghostGain > 0 && <span className="le-cell-ghosttag" aria-hidden="true">+{ghostGain}</span>}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="le-legend" role="group" aria-label="이 층에 들어올 자재">
          <span className="le-legend-label">이 층 자재</span>
          {comp.map(({ s, n }) => (
            <span key={s} className="le-legend-chip" style={{ ['--sc' as string]: STYLE_COLOR[s] }}>
              <StyleGlyph s={s} size={12} />
              {STYLE_KO[s]} {n}
            </span>
          ))}
          {!planning && (
            <span className="le-legend-shelter">
              설계 보류 {shelter}/{SKIP_SHELTER}
            </span>
          )}
        </div>

        <div className="le-action">
          {planning ? (
            <div className="le-wager">
              <p className="le-wager-lead">
                <span className="le-wager-mark" aria-hidden="true">◆</span>
                {plan.short} 계획 — 정초석을 놓을 자리를 먼저 정할 수 있어요
              </p>
              <p className="le-wager-sub">
                도면의 <b>◇ 빈 터</b> 하나를 고르세요(숫자 키도 됩니다). 층이 끝날 때 그 방이 같은 자재 방
                <b> 2개 이상</b>과 이어지면 <b>+{Math.round(CORNERSTONE_WIN * plan.mult)}점</b>, 하나면 본전,
                하나도 없으면 <b>−{Math.round(CORNERSTONE_LOSS * plan.mult)}점</b>. 카드는 아직 한 장도 보지 않았어요.
              </p>
              <button type="button" className="le-mini le-mini--quiet" onClick={declineWager}>
                정초석 없이 시작 <Kbd>Esc</Kbd>
              </button>
            </div>
          ) : heldCard ? (
            <div className="le-appraise">
              <p className="le-ask">
                <span className="le-ask-en">{heldCard.en}</span>
                <span className="le-ask-q">의 뜻은?</span>
              </p>
              <div className="le-opts">
                {heldOptions.map((o, i) => (
                  <button key={o} type="button" className="le-opt" onClick={() => appraiseAnswer(o)}>
                    <Kbd>{i + 1}</Kbd>
                    <span>{o}</span>
                  </button>
                ))}
              </div>
              <div className="le-subrow">
                <button type="button" className="le-mini" onClick={() => appraiseAnswer(null)}>
                  설계 보류 <span className="le-mini-sub">
                    시간 −2.5초 · {shelter > 0 ? `연쇄 유지 ${shelter}회 남음` : '연쇄가 끊겨요'} · 뜻은 끝나고 확인
                  </span>
                </button>
                <button type="button" className="le-mini le-mini--quiet" onClick={cancelAppraise}>
                  다른 카드 보기 <Kbd>Esc</Kbd>
                </button>
              </div>
            </div>
          ) : pending ? (
            <div className="le-place" data-kind={pending.kind}>
              <p className="le-place-lead">
                <FeedbackIcon kind={pending.kind === 'correct' ? 'correct' : pending.kind === 'wrong' ? 'wrong' : 'near'} />
                <b className="le-place-en">{pending.card.en}</b>
                {/* 보류한 단어의 뜻은 여기서 공개하지 않는다 — 공짜 정답 공개 버튼이 되던 구멍. */}
                {pending.kind === 'skip'
                  ? <span className="le-place-ko le-place-ko--hidden">뜻은 끝 화면에서</span>
                  : <span className="le-place-ko">{pending.card.ko}</span>}
                <span className="le-place-style" style={pending.style ? ({ ['--sc' as string]: STYLE_COLOR[pending.style] }) : undefined}>
                  {pending.style ? <StyleGlyph s={pending.style} size={12} /> : <PlainGlyph size={12} />}
                  {pending.style ? STYLE_KO[pending.style] : '무양식'}
                </span>
              </p>
              <p className="le-place-sub">
                {pending.style
                  ? '도면의 빈 터를 눌러 지으세요 — 같은 자재 옆이면 복도가 이어져요.'
                  : '이 방은 복도를 만들지 못해요. 덜 아까운 자리에 놓아 보세요.'}
              </p>
            </div>
          ) : (
            <div className="le-draft" role="group" aria-label="드래프트 방 카드">
              <span className="le-draft-label">감정할 방을 골라 보세요</span>
              <div className="le-cards">
                {draft.map((c, i) =>
                  c ? (
                    <button
                      key={c.id}
                      type="button"
                      className="le-card"
                      onClick={() => holdCard(i)}
                      disabled={busy}
                      aria-label={`${c.en} 감정하기`}
                    >
                      <span className="le-card-en">{c.en}</span>
                      <span className="le-card-hint">감정하기</span>
                      <Kbd>{i + 1}</Kbd>
                    </button>
                  ) : (
                    <span key={`empty-${i}`} className="le-card le-card--gone" aria-hidden="true">—</span>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <p className={`le-flash le-flash--${flashKind}`}>
          {flash || ' '}
        </p>
      </main>
    </div>
  );
}

const LE_CSS = `
  .le-stage { gap: clamp(8px, 1.6vh, 16px); justify-content: flex-start; padding-top: clamp(8px, 2vh, 18px); overflow-y: auto; }
  .le-help { margin: 0; max-width: 46ch; font-size: 12.5px; line-height: 1.5; color: var(--t2); text-align: center; }
  .le-help b { color: var(--t1); }

  .le-floor { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .le-floor-name { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); letter-spacing: -.01em; }
  .le-floor-mult { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; color: var(--combo);
    border: 1px solid color-mix(in srgb, var(--combo) 45%, var(--bd)); background: color-mix(in srgb, var(--combo) 10%, transparent); }
  .le-floor-budget { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; color: var(--t2);
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); }
  .le-floor-note { font-size: 11px; color: var(--t3); }

  /* ── 청사진 도면 ── */
  .le-estate { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; width: min(392px, 90vw, 44vh); aspect-ratio: 1; padding: 9px; border-radius: 14px;
    --grid-line: #3a6ea8;
    background: color-mix(in srgb, #1a3a6e 12%, var(--bg)); border: 1px solid color-mix(in srgb, var(--grid-line) 40%, var(--bd));
    background-image: linear-gradient(color-mix(in srgb, var(--grid-line) 16%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--grid-line) 16%, transparent) 1px, transparent 1px);
    background-size: 24px 24px;
    transition: transform .38s var(--ease-settle, ease-out), opacity .38s ease, border-color .4s ease, background-image .4s ease; }
  /* 연쇄가 높아지면 도면 잉크 색이 바뀐다 — 클라이맥스 신호(숫자 콤보와 이중 인코딩). */
  .le-estate[data-hot="1"] { --grid-line: #C08A3E; border-color: color-mix(in srgb, #C08A3E 55%, var(--bd)); }
  .le-estate[data-transit="out"] { transform: translateY(-24px); opacity: 0; }
  .le-estate[data-transit="in"] { animation: le-rise .44s var(--ease-settle, ease-out); }
  @keyframes le-rise { from { transform: translateY(26px); opacity: 0; } to { transform: none; opacity: 1; } }

  .le-cell { position: relative; overflow: visible; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 4px; border-radius: 10px; cursor: pointer;
    transition: transform .14s var(--ease-spring, ease-out), box-shadow .18s ease, border-color .18s ease, background .2s ease; }
  .le-cell--empty { border: 1.5px dashed color-mix(in srgb, var(--grid-line) 48%, var(--bd)); background: color-mix(in srgb, var(--bg) 38%, transparent); color: color-mix(in srgb, var(--grid-line) 70%, var(--t3)); }
  .le-cell--vacant { border: 1.5px dotted color-mix(in srgb, var(--t3) 40%, var(--bd)); background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--t3) 7%, transparent) 0 6px, transparent 6px 12px); color: var(--t4, var(--t3)); cursor: default; }
  .le-cell-vacant { font-size: 10.5px; font-weight: 700; letter-spacing: .02em; }
  .le-cell[aria-disabled="true"] { cursor: default; }
  .le-cell--empty[aria-disabled="true"] { opacity: .78; }
  .le-cell--target { border-style: solid; border-color: var(--combo); background: color-mix(in srgb, var(--combo) 12%, var(--bg)); color: var(--combo); }
  .le-cell--target:hover { transform: scale(1.04); box-shadow: 0 0 0 2px var(--combo); }
  .le-cell--target:active { transform: scale(.96); }
  .le-cell--pick { border-style: solid; border-color: var(--streak); background: color-mix(in srgb, var(--streak) 12%, var(--bg)); color: var(--streak); }
  .le-cell--pick:hover { transform: scale(1.04); box-shadow: 0 0 0 2px var(--streak); }
  .le-cell--pick:active { transform: scale(.96); }
  .le-cell-picknum { position: absolute; bottom: 4px; right: 6px; font-family: var(--font-english, monospace); font-size: 10px; font-weight: 800; opacity: .8; }
  .le-cell:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 38%, transparent); }
  .le-cell--pick:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--streak) 42%, transparent); }
  .le-cell-plus { font-size: 21px; font-weight: 300; }

  .le-cell--room { border: 1.5px solid color-mix(in srgb, var(--sc, var(--bd)) 50%, var(--bd)); background: color-mix(in srgb, var(--sc, var(--bg)) 9%, var(--bg)); }
  .le-cell--plainroom { --sc: var(--t3); border-style: dashed; }
  .le-cell--fixed { opacity: .86; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t1) 8%, transparent); }
  .le-cell--linked { border-color: var(--sc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sc) 52%, transparent), 0 0 18px -4px color-mix(in srgb, var(--sc) 55%, transparent); }
  .le-cell--corner { box-shadow: 0 0 0 2px var(--streak), 0 0 20px -4px color-mix(in srgb, var(--streak) 60%, transparent); }
  .le-cell--just { animation: gk-pop .5s ease-out; }
  .le-cell--ghost { border-color: var(--warning); border-style: dashed; background: color-mix(in srgb, var(--warning) 12%, transparent); animation: le-ghost 1.5s ease-out forwards; }
  @keyframes le-ghost { 0% { opacity: 0; } 12% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: .35; } }
  .le-cell-ghosttag { position: absolute; top: 3px; right: 5px; font-size: 11px; font-weight: 800; color: var(--warning); }
  .le-cell-link { position: absolute; top: 2px; right: 4px; font-size: 11px; font-weight: 800; color: var(--sc); }
  .le-cell-corner { position: absolute; top: 2px; left: 4px; font-size: 10px; color: var(--streak); }

  .le-cell-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 800; line-height: 1;
    padding: 2px 6px; border-radius: 999px; color: color-mix(in srgb, var(--sc) 72%, var(--t1)); background: color-mix(in srgb, var(--sc) 14%, transparent); }
  .le-cell-en { font-family: var(--font-english, system-ui); font-size: clamp(11px, 2.6vw, 14px); font-weight: 800; color: var(--t1); line-height: 1.08; text-align: center; word-break: break-word; }
  .le-cell-ko { font-size: 10px; color: var(--t3); text-align: center; line-height: 1.1; }
  .le-cell-ko--hidden { font-style: italic; opacity: .72; }
  .le-glyph { flex: none; }

  /* ── 자재 범례 ── */
  .le-legend { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: center; }
  .le-legend-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .le-legend-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px;
    color: color-mix(in srgb, var(--sc) 74%, var(--t1)); border: 1px solid color-mix(in srgb, var(--sc) 42%, var(--bd)); background: color-mix(in srgb, var(--sc) 10%, transparent); }
  .le-legend-shelter { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; color: var(--t2);
    border: 1px dashed var(--bd); background: color-mix(in srgb, var(--bg) 66%, transparent); }

  /* ── 행동 구역 (계획 / 감정 / 배치 / 드래프트) ── */
  .le-action { display: flex; align-items: center; justify-content: center; width: min(560px, 94vw); min-height: 152px; }

  .le-wager { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; padding: 11px 14px; border-radius: var(--r-lg, 14px);
    border: 1px solid color-mix(in srgb, var(--streak) 40%, var(--bd)); background: color-mix(in srgb, var(--streak) 7%, transparent); animation: gk-pop .32s ease-out; }
  .le-wager-lead { margin: 0; display: flex; align-items: center; gap: 7px; font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; color: var(--t1); text-align: center; }
  .le-wager-mark { color: var(--streak); font-size: 13px; }
  .le-wager-sub { margin: 0; max-width: 48ch; font-size: 12px; line-height: 1.55; color: var(--t2); text-align: center; }
  .le-wager-sub b { color: var(--t1); }

  .le-appraise { display: flex; flex-direction: column; align-items: center; gap: 9px; width: 100%; }
  .le-ask { margin: 0; display: flex; align-items: baseline; gap: 7px; }
  .le-ask-en { font-family: var(--font-english, system-ui); font-size: clamp(20px, 5vw, 27px); font-weight: 800; color: var(--t1); letter-spacing: -.01em; }
  .le-ask-q { font-size: 13px; color: var(--t3); }
  .le-opts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; width: 100%; }
  @media (min-width: 620px) { .le-opts { grid-template-columns: repeat(4, 1fr); } }
  .le-opt { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 52px; padding: 8px 10px; border-radius: var(--r-md, 10px);
    border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 700; text-align: center; cursor: pointer;
    transition: transform .16s var(--ease-spring, ease-out), border-color .15s ease, background .15s ease, box-shadow .15s ease; }
  .le-opt:hover:not(:disabled) { border-color: var(--combo); transform: translateY(-2px); box-shadow: 0 8px 20px -10px color-mix(in srgb, var(--combo) 55%, transparent); }
  .le-opt:active:not(:disabled) { transform: translateY(0) scale(.97); }
  .le-opt:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .le-opt:disabled { opacity: .5; cursor: default; }
  .le-opt .gk-kbd { opacity: .7; }

  .le-subrow { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .le-mini { display: inline-flex; flex-direction: column; align-items: center; gap: 1px; min-height: 46px; padding: 6px 14px; border-radius: var(--r-md, 10px);
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, transparent); color: var(--t2); font-family: var(--font-display, system-ui); font-size: 12.5px; font-weight: 700; cursor: pointer;
    transition: transform .16s var(--ease-spring, ease-out), border-color .15s ease, color .15s ease, background .15s ease; }
  .le-mini:hover:not(:disabled) { color: var(--t1); border-color: var(--t3); }
  .le-mini:active:not(:disabled) { transform: scale(.97); }
  .le-mini:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .le-mini:disabled { opacity: .5; cursor: default; }
  .le-mini--quiet { font-weight: 600; color: var(--t3); }
  .le-mini-sub { font-size: 10.5px; font-weight: 600; color: var(--t3); }

  .le-place { display: flex; flex-direction: column; align-items: center; gap: 7px; width: 100%; padding: 11px 14px; border-radius: var(--r-lg, 14px);
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 78%, transparent); animation: gk-pop .32s ease-out; }
  .le-place[data-kind="correct"] { border-color: color-mix(in srgb, var(--success) 45%, var(--bd)); color: var(--success); }
  .le-place[data-kind="wrong"] { border-color: color-mix(in srgb, var(--warning) 55%, var(--bd)); color: var(--warning); }
  .le-place[data-kind="skip"] { border-color: var(--bd); color: var(--t3); }
  .le-place-lead { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .le-place-en { font-family: var(--font-english, system-ui); font-size: 19px; font-weight: 800; color: var(--t1); }
  .le-place-ko { font-size: 14px; font-weight: 700; color: var(--t2); }
  .le-place-ko--hidden { font-size: 12px; font-weight: 600; font-style: italic; color: var(--t3); }
  .le-place-style { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px;
    color: color-mix(in srgb, var(--sc, var(--t3)) 74%, var(--t1)); border: 1px solid color-mix(in srgb, var(--sc, var(--bd)) 45%, var(--bd)); background: color-mix(in srgb, var(--sc, transparent) 10%, transparent); }
  .le-place-sub { margin: 0; font-size: 12px; color: var(--t3); text-align: center; }

  .le-draft { display: flex; flex-direction: column; align-items: center; gap: 9px; }
  .le-draft-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .le-cards { display: flex; gap: 10px; }
  .le-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: clamp(96px, 27vw, 124px); min-height: 76px; padding: 11px 8px; border-radius: 12px;
    border: 1.5px solid var(--bd); border-top: 3px solid color-mix(in srgb, var(--t1) 22%, var(--bd)); background: var(--bg); color: var(--t1); cursor: pointer;
    transition: transform .16s var(--ease-spring, ease-out), box-shadow .18s ease, border-color .18s ease; }
  .le-card:hover:not(:disabled) { transform: translateY(-3px); border-color: var(--combo); box-shadow: 0 10px 22px -10px rgba(20,34,56,.45); }
  .le-card:active:not(:disabled) { transform: translateY(0) scale(.97); }
  .le-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .le-card:disabled { opacity: .5; cursor: default; }
  .le-card--gone { display: grid; place-items: center; color: var(--t4); cursor: default; border-style: dashed; border-top-style: dashed; background: transparent; }
  .le-card-en { font-family: var(--font-english, system-ui); font-size: 16px; font-weight: 800; color: var(--t1); text-align: center; word-break: break-word; line-height: 1.1; }
  .le-card-hint { font-size: 10.5px; color: var(--t3); }

  .le-flash { margin: 0; min-height: 18px; font-size: 12.5px; font-weight: 700; text-align: center; color: var(--t3); }
  .le-flash--correct { color: var(--success); }
  .le-flash--wrong { color: var(--warning); }
  .le-flash--near { color: var(--t2); }

  .le-reveal { display: flex; flex-direction: column; gap: 8px; }
  .le-reveal-title { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .le-reveal-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px 16px; }
  .le-reveal-list li { display: flex; align-items: baseline; gap: 8px; font-size: 13.5px; }
  .le-reveal-list b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }
  .le-reveal-list span { color: var(--t3); }

  @media (max-height: 720px) {
    .le-help { display: none; }
    .le-estate { width: min(360px, 88vw, 40vh); }
    .le-action { min-height: 140px; }
    .le-wager-sub { font-size: 11.5px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .le-cell, .le-card, .le-opt, .le-mini, .le-estate { transition: none; }
    .le-cell--just, .le-place, .le-wager, .le-estate[data-transit="in"] { animation: none; }
    .le-cell--ghost { animation: none; opacity: 1; }
  }
`;
