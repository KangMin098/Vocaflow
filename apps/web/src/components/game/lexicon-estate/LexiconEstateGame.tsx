// apps/web/src/components/game/lexicon-estate/LexiconEstateGame.tsx
// Lexicon Estate — 청사진 저택 3층 건축. 드래프트 → 감정(인출) → 배치.
//
// 한 턴:
//   ① 도면 옆 드래프트에서 **영단어만 적힌** 방 카드를 고른다.
//   ② 감정(鑑定) — 그 단어의 뜻을 4지선다로 인출한다. 맞혀야 자재(양식)가 드러난다.
//      맞히면 +5초·연쇄 상승, 틀리면 뜻을 공개하고 −6초·연쇄 소멸 + 그 방은 '무양식'이 된다.
//   ③ 배치 — 같은 양식 방과 상하좌우로 붙이면 복도가 이어지고 점수가 붙는다(연쇄 배수 적용).
//
// v07.8 전면 재설계. 이전 판은 카드에 의미장 배지와 한국어 뜻을 함께 인쇄해
// **영어를 한 글자도 몰라도 만점**이 나왔고(색 맞추기), 배치마다 무조건 onCorrect 를 불러
// FSRS 에 가짜 정답을 적재했으며, 타이머·연쇄·실패가 없어 9번의 같은 클릭으로 끝났다.
// 지금은 제출(감정) 전에 화면 어디에도 그 단어의 뜻이 없고, 점수·시간·연쇄가 전부
// 인출 성공에 걸려 있다. 배치는 인출 이후의 '설계' 층위로 분리됐다.

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

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
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
// 내 단어장이 12개 미만일 때만 쓰인다(스캐폴드가 wordPool 을 넘기지 못하는 경우).
// 실제 학습은 언제나 wordPool 우선 — 이전 판은 wordPool 을 통째로 버렸다.
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

// ─── 층 설계 ────────────────────────────────────────────────────────────────
// 층이 올라갈수록 (1) 기존 구조물이 늘어 배치 자유도가 줄고 (2) 자재 구성이 치우쳐
// 계획이 어려워지며 (3) 복도 배수가 커진다. 클라이맥스가 마지막에 오도록.
interface FloorPlan {
  name: string;
  short: string;
  mult: number;
  fixed: number;
  /** 자재 3종에 배분되는 카드 수(합 = 9 − fixed). 층마다 더 치우친다. */
  comp: [number, number, number];
  note: string;
}
const FLOORS: FloorPlan[] = [
  { name: '1층 · 착공', short: '1층', mult: 1, fixed: 0, comp: [3, 3, 3], note: '자재가 고르게 들어옵니다' },
  { name: '2층 · 증축', short: '2층', mult: 1.5, fixed: 2, comp: [3, 2, 2], note: '기존 구조물 2 · 정초석을 걸 수 있어요' },
  { name: '3층 · 완공', short: '3층', mult: 2, fixed: 3, comp: [3, 2, 1], note: '기존 구조물 3 · 복도 배수 ×2' },
];

const TOTAL_CELLS = FLOORS.reduce((n, f) => n + (9 - f.fixed), 0); // 22 배치
const TOTAL_MS = 130_000;
const APPRAISE_PTS = 10;
const CORRIDOR_PTS = 12;
const CORNERSTONE_PTS = 100;
const TIME_ON_CORRECT = 5_000;
const TIME_PER_CORRIDOR = 1_500;
const TIME_ON_WRONG = 6_000;

interface Card {
  id: string;
  en: string;
  ko: string;
  style: Style;
  options: string[];
}
interface Room {
  en: string;
  ko: string;
  /** null = 무양식(감정 실패·미감정) — 복도를 만들지 못한다. */
  style: Style | null;
  fixed: boolean;
}
interface Pending {
  slot: number;
  card: Card;
  style: Style | null;
  kind: 'correct' | 'wrong' | 'skip';
}

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

/** 오답 선택지 — 정답과 겹치지 않고, 가능하면 화면에 이미 인쇄된 뜻은 피한다. */
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
}

function buildFloor(floorIdx: number, pool: Word[], usedEn: Set<string>, built: Room[]): FloorBuild {
  const plan = FLOORS[floorIdx];
  const grid: (Room | null)[] = Array(9).fill(null);

  // 기존 구조물 — 앞 층에서 제대로 지은 방을 이월한다(연속성 + 배치 제약).
  // 이미 뜻이 공개된 방만 이월하므로 도면에 뜻이 적혀도 정답이 새지 않는다.
  const carried: Room[] = shuffle(built.filter((r) => r.style !== null))
    .filter((r, i, a) => a.findIndex((x) => x.en === r.en) === i)
    .slice(0, plan.fixed)
    .map((r) => ({ ...r, fixed: true }));
  if (carried.length < plan.fixed) {
    for (const w of shuffle(pool.filter((x) => !usedEn.has(x.en.toLowerCase())))) {
      if (carried.length >= plan.fixed) break;
      usedEn.add(w.en.toLowerCase());
      carried.push({ en: w.en, ko: w.ko, style: STYLES[Math.floor(Math.random() * STYLES.length)], fixed: true });
    }
  }

  const blockedEn = new Set(carried.map((r) => r.en.toLowerCase()));
  const need = 9 - carried.length;
  const fresh = shuffle(pool.filter((w) => !usedEn.has(w.en.toLowerCase()) && !blockedEn.has(w.en.toLowerCase())));
  const recycled = shuffle(pool.filter((w) => usedEn.has(w.en.toLowerCase()) && !blockedEn.has(w.en.toLowerCase())));
  const chosen = [...fresh, ...recycled].slice(0, need);
  chosen.forEach((w) => usedEn.add(w.en.toLowerCase()));

  // 자재 배분 — 어느 자재가 많이 들어올지는 판마다 달라진다(도면 하단 범례로 공개).
  const order = shuffle(STYLES);
  const bag: Style[] = [];
  order.forEach((s, i) => { for (let k = 0; k < plan.comp[i]; k++) bag.push(s); });
  while (bag.length < chosen.length) bag.push(order[bag.length % order.length]);
  const styleBag = shuffle(bag.slice(0, chosen.length));

  // 오답 보기 후보 — 도면에 이미 인쇄된 기존 구조물의 뜻은 언제나 뺀다(눈으로 지워지니까).
  // 이 층 덱의 뜻까지 빼는 건 후보가 넉넉할 때만: 좁은 단어장에서 그러면 모든 카드가
  // **똑같은 오답 3개**를 공유하게 되고, "낯선 보기 = 정답"이라는 무지성 공략이 생긴다.
  const poolKo = new Set(pool.map((w) => w.ko));
  const deckKo = new Set(chosen.map((w) => w.ko));
  const carriedKo = new Set(carried.map((r) => r.ko));
  let outsideKo = 0;
  poolKo.forEach((k) => { if (!deckKo.has(k) && !carriedKo.has(k)) outsideKo += 1; });
  const avoid = outsideKo >= 6 ? new Set<string>([...deckKo, ...carriedKo]) : carriedKo;

  const deck: Card[] = chosen.map((w, i) => ({
    id: `f${floorIdx}-${i}-${w.en}`,
    en: w.en,
    ko: w.ko,
    style: styleBag[i],
    options: pickKoOptions(pool, w.ko, avoid),
  }));

  shuffle(Array.from({ length: 9 }, (_, i) => i))
    .slice(0, carried.length)
    .forEach((cell, i) => { grid[cell] = carried[i]; });

  const counts: Record<Style, number> = { stone: 0, timber: 0, glass: 0 };
  styleBag.forEach((s) => { counts[s] += 1; });
  const comp = STYLES.map((s) => ({ s, n: counts[s] })).filter((c) => c.n > 0);

  return { grid, deck, comp };
}

export function LexiconEstateGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  // 내 단어장 우선 — 12개 이상이면 실제 학습 단어로 저택을 짓는다.
  const pool = useMemo(() => {
    const src = wordPool && wordPool.length >= 12 ? wordPool : BANK;
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
    return out.length >= 12 ? out : BANK;
  }, [wordPool]);

  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [outcome, setOutcome] = useState<'complete' | 'timeup'>('complete');
  const [transit, setTransit] = useState<'in' | 'out' | null>(null);

  const [floorIdx, setFloorIdx] = useState(0);
  const [grid, setGrid] = useState<(Room | null)[]>(Array(9).fill(null));
  const [draft, setDraft] = useState<(Card | null)[]>([null, null, null]);
  const [comp, setComp] = useState<{ s: Style; n: number }[]>([]);
  const [heldIdx, setHeldIdx] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const [score, setScore] = useState(0);
  const [corridors, setCorridors] = useState(0);
  const [placedTotal, setPlacedTotal] = useState(0);
  const [appraise, setAppraise] = useState({ ok: 0, tried: 0, skipped: 0 });
  const [missed, setMissed] = useState<{ en: string; ko: string }[]>([]);
  const [cornerstone, setCornerstone] = useState<{ armed: boolean; left: number; cell: number | null }>({
    armed: false, left: 0, cell: null,
  });

  const [flash, setFlash] = useState('');
  const [flashKind, setFlashKind] = useState<'correct' | 'wrong' | 'near' | 'info'>('info');
  const [just, setJust] = useState<{ cell: number; gain: number } | null>(null);
  const [ghost, setGhost] = useState<{ cell: number; gain: number } | null>(null);
  const [bestInfo, setBestInfo] = useState<{ improved: boolean; prev: number | null } | null>(null);

  const deckRef = useRef<Card[]>([]);
  const usedRef = useRef<Set<string>>(new Set());
  const builtRef = useRef<Room[]>([]);
  const scoreRef = useRef(0);
  const floorPtsRef = useRef(0);
  const floorRef = useRef(0);
  const finishedRef = useRef(false);
  const submittedRef = useRef(false);
  const tierUpRef = useRef(false);
  const timers = useRef<number[]>([]);
  // 정초석은 점수 정산과 얽혀 있어 상태 갱신 함수 안에서 부수효과를 내면 안 된다
  // (StrictMode 이중 호출 시 점수가 두 번 오른다). ref 를 진실로 두고 state 는 렌더용 거울.
  const csRef = useRef<{ armed: boolean; left: number; cell: number | null }>({ armed: false, left: 0, cell: null });
  const setCs = useCallback((next: { armed: boolean; left: number; cell: number | null }) => {
    csRef.current = next;
    setCornerstone(next);
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
    setOutcome(why);
    setHeldIdx(null);
    setPending(null);
    // 폭죽은 진짜 완공에만. 시간이 다한 마무리는 조용히 둔다(Calm UI).
    if (why === 'complete') sfx.fanfare();
    setPhase('done');
  }, [sfx, clearTimers]);

  const cd = useCountdown({
    totalMs: TOTAL_MS,
    running: phase === 'play' && transit === null,
    warnAtMs: 20_000,
    onWarn: () => { setFlash('남은 시간이 20초 아래예요'); setFlashKind('near'); },
    onEnd: () => finish('timeup'),
  });
  const cdRef = useRef(cd);
  cdRef.current = cd;

  const openFloor = useCallback((idx: number) => {
    const built = buildFloor(idx, pool, usedRef.current, builtRef.current);
    deckRef.current = built.deck.slice();
    setGrid(built.grid);
    setComp(built.comp);
    setDraft([deckRef.current.shift() ?? null, deckRef.current.shift() ?? null, deckRef.current.shift() ?? null]);
    setHeldIdx(null);
    setPending(null);
    setGhost(null);
    setJust(null);
    floorPtsRef.current = 0;
    setCs({ armed: false, left: idx >= 1 ? 1 : 0, cell: null });
  }, [pool, setCs]);

  const start = useCallback(() => {
    clearTimers();
    finishedRef.current = false;
    submittedRef.current = false;
    usedRef.current = new Set();
    builtRef.current = [];
    scoreRef.current = 0;
    floorRef.current = 0;
    setScore(0);
    setCorridors(0);
    setPlacedTotal(0);
    setAppraise({ ok: 0, tried: 0, skipped: 0 });
    setMissed([]);
    setBestInfo(null);
    setFloorIdx(0);
    setTransit(null);
    setFlash('');
    setFlashKind('info');
    comboRef.current.reset();
    openFloor(0);
    setPhase('play');
    cdRef.current.reset();
  }, [clearTimers, openFloor]);

  useEffect(() => {
    start();
    // 최초 1회 + 단어 풀 교체 시에만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  useEffect(() => {
    if (phase !== 'done' || submittedRef.current) return;
    submittedRef.current = true;
    setBestInfo(pb.submit(scoreRef.current));
  }, [phase, pb]);

  const plan = FLOORS[floorIdx];
  const linked = useMemo(() => linkedCells(grid), [grid]);
  const shownScore = useCountUp(score);
  const busy = phase !== 'play' || transit !== null;

  const bump = useCallback((n: number) => {
    scoreRef.current = Math.max(0, scoreRef.current + n);
    setScore(scoreRef.current);
  }, []);

  // ── ① 카드 고르기 ────────────────────────────────────────────────────────
  const holdCard = useCallback((i: number) => {
    if (busy || pending || !draft[i]) return;
    sfx.click();
    setGhost(null);
    setHeldIdx((h) => (h === i ? null : i));
  }, [busy, pending, draft, sfx]);

  // ── ② 감정(인출) ─────────────────────────────────────────────────────────
  const appraiseAnswer = useCallback((choice: string | null) => {
    if (busy || heldIdx === null) return;
    const card = draft[heldIdx];
    if (!card) return;
    const w: Word = { en: card.en, ko: card.ko };
    const slot = heldIdx;
    setHeldIdx(null);
    setGhost(null);

    if (choice === null) {
      // 감정 없이 짓기 — 시간도 안 잃고 오답 기록도 남기지 않는 안전 선택.
      // 대신 무양식 방이라 복도를 못 만들고 연쇄가 끊긴다(칸만 소모).
      sfx.click();
      combo.miss();
      setAppraise((a) => ({ ...a, skipped: a.skipped + 1 }));
      setMissed((m) => [...m, { en: card.en, ko: card.ko }]);
      setPending({ slot, card, style: null, kind: 'skip' });
      setFlash('감정을 건너뛰었어요 — 무양식 방이 됩니다');
      setFlashKind('info');
      return;
    }

    if (choice === card.ko) {
      tierUpRef.current = false;
      const c = combo.hit();
      sfx.correct(c, tierUpRef.current);
      onCorrect?.(w);
      cd.extend(TIME_ON_CORRECT);
      bump(Math.round(APPRAISE_PTS * plan.mult));
      setAppraise((a) => ({ ...a, ok: a.ok + 1, tried: a.tried + 1 }));
      setPending({ slot, card, style: card.style, kind: 'correct' });
      if (!tierUpRef.current) {
        setFlash(`감정 성공 · +${Math.round(APPRAISE_PTS * plan.mult)}점 · 시간 +5초`);
        setFlashKind('correct');
      }
      return;
    }

    sfx.wrong();
    combo.miss();
    onWrong?.(w);
    cd.drain(TIME_ON_WRONG);
    setAppraise((a) => ({ ...a, tried: a.tried + 1 }));
    setMissed((m) => [...m, { en: card.en, ko: card.ko }]);
    setPending({ slot, card, style: null, kind: 'wrong' });
    setFlash(`${card.en}은 “${card.ko}”였어요 · 시간 −6초`);
    setFlashKind('wrong');
  }, [busy, heldIdx, draft, sfx, combo, onCorrect, onWrong, cd, bump, plan.mult]);

  const cancelAppraise = useCallback(() => {
    if (heldIdx === null) return;
    sfx.click();
    setHeldIdx(null);
  }, [heldIdx, sfx]);

  // ── ③ 배치 ───────────────────────────────────────────────────────────────
  const advanceFloor = useCallback((g: (Room | null)[]) => {
    // 정초석 정산 — 판돈을 건 방이 같은 양식 2개 이상과 이어져 있는가.
    const cs = csRef.current;
    if (cs.cell !== null) {
      const n = sameStyleNeighbors(g, cs.cell);
      if (n >= 2) {
        const win = Math.round(CORNERSTONE_PTS * FLOORS[floorRef.current].mult);
        bump(win);
        sfx.coin();
        setFlash(`정초석이 ${n}개 방과 이어졌어요 · +${win}점`);
        setFlashKind('correct');
      } else {
        const loss = Math.round(floorPtsRef.current / 2);
        bump(-loss);
        sfx.nearMiss();
        setFlash(loss > 0 ? `정초석이 외로웠어요 · 이 층 복도 점수 −${loss}` : '정초석이 외로웠어요');
        setFlashKind('near');
      }
    }
    setCs({ armed: false, left: cs.left, cell: null });

    setTransit('out');
    later(() => {
      const next = floorRef.current + 1;
      if (next >= FLOORS.length) { finish('complete'); return; }
      floorRef.current = next;
      setFloorIdx(next);
      openFloor(next);
      setTransit('in');
      later(() => setTransit(null), 440);
    }, 620);
  }, [bump, sfx, later, finish, openFloor, setCs]);

  const place = useCallback((cell: number) => {
    if (busy || !pending || grid[cell]) return;
    const room: Room = { en: pending.card.en, ko: pending.card.ko, style: pending.style, fixed: false };
    const before = countPairs(grid);
    const g = grid.slice();
    g[cell] = room;
    const gained = countPairs(g) - before;

    // 니어미스 — 0개를 만든 배치 직후, 더 나은 자리가 있었으면 조용히 보여준다.
    let bestAlt = 0, bestCell = -1;
    if (pending.style && gained === 0) {
      for (let i = 0; i < 9; i++) {
        if (grid[i] || i === cell) continue;
        const t = grid.slice();
        t[i] = room;
        const gg = countPairs(t) - before;
        if (gg > bestAlt) { bestAlt = gg; bestCell = i; }
      }
    }

    setGrid(g);
    if (pending.style) builtRef.current.push(room);
    setPlacedTotal((p) => p + 1);

    const armedHere = csRef.current.armed;
    if (armedHere) setCs({ armed: false, left: Math.max(0, csRef.current.left - 1), cell });

    if (gained > 0) {
      const pts = Math.round(gained * CORRIDOR_PTS * plan.mult * combo.mult);
      bump(pts);
      floorPtsRef.current += pts;
      setCorridors((c) => c + gained);
      cd.extend(gained * TIME_PER_CORRIDOR);
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
      if (armedHere) { setFlash('정초석을 놓았어요 — 층이 끝날 때 정산돼요'); setFlashKind('info'); }
    }

    const slot = pending.slot;
    setDraft((d) => { const nd = d.slice(); nd[slot] = deckRef.current.shift() ?? null; return nd; });
    setPending(null);

    if (g.every((r) => r !== null)) later(() => advanceFloor(g), 420);
  }, [busy, pending, grid, plan.mult, combo.mult, bump, cd, sfx, later, advanceFloor, setCs]);

  const armCornerstone = useCallback(() => {
    if (busy || !pending || pending.style === null) return;
    const cs = csRef.current;
    if (cs.left <= 0) return;
    sfx.click();
    setCs({ armed: !cs.armed, left: cs.left, cell: cs.cell });
  }, [busy, pending, sfx, setCs]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  // ── 키보드 ───────────────────────────────────────────────────────────────
  const heldCard = heldIdx !== null ? draft[heldIdx] : null;
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && heldCard) { e.preventDefault(); cancelAppraise(); return; }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (heldCard) {
        const opt = heldCard.options[n - 1];
        if (opt) { e.preventDefault(); appraiseAnswer(opt); }
        return;
      }
      if (!pending && n <= 3) { e.preventDefault(); holdCard(n - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, heldCard, pending, cancelAppraise, appraiseAnswer, holdCard]);

  // ─── 완료 화면 ────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const complete = outcome === 'complete';
    const uniqueMissed = missed.filter((m, i) => missed.findIndex((x) => x.en === m.en) === i).slice(0, 8);
    const lead = complete ? '저택이 완성됐어요' : '여기까지 지었어요';
    const hint = !complete
      ? '감정 하나가 +5초예요 — 아는 단어부터 먼저 지으면 시간이 남아요.'
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
          celebrate={complete}
          badge={
            bestInfo?.improved ? (
              <><FeedbackIcon kind="correct" /> 개인 최고 갱신</>
            ) : complete ? (
              <><FeedbackIcon kind="correct" /> 3층 완공</>
            ) : undefined
          }
          reveal={
            uniqueMissed.length > 0 ? (
              <div className="le-reveal">
                <span className="le-reveal-title">
                  다시 볼 단어{appraise.skipped > 0 ? ` · 건너뛴 ${appraise.skipped}개 포함` : ''}
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
            { num: `${appraise.ok}/${appraise.tried}`, label: '감정 성공' },
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
        progress={placedTotal / TOTAL_CELLS}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<TimerBar frac={cd.frac} warning={cd.warning} seconds={cd.remainSec} label="남은 공사 시간" />}
      />

      <main className="gk-stage le-stage">
        <p className="le-help">
          <b>영단어 카드</b>를 골라 뜻을 맞히면 자재가 드러나요. 같은 자재 방을 상하좌우로 붙여 <b>복도</b>를 이어 보세요.
        </p>

        <div className="le-floor">
          <span className="le-floor-name">{plan.name}</span>
          <span className="le-floor-mult">복도 ×{plan.mult}</span>
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
            const isLinked = linked.has(i);
            const ghostGain = ghost && ghost.cell === i ? ghost.gain : 0;
            const justGain = just && just.cell === i ? just.gain : 0;
            // disabled 대신 aria-disabled — 이미 지은 방도 키보드·스크린리더로 읽혀야
            // 도면을 훑어 다음 수를 계획할 수 있다(포커스를 뺏지 않는다).
            const canDrop = !!pending && !room && !busy;
            return (
              <button
                key={i}
                type="button"
                className={[
                  'le-cell',
                  room ? 'le-cell--room' : 'le-cell--empty',
                  room && !room.style ? 'le-cell--plainroom' : '',
                  room?.fixed ? 'le-cell--fixed' : '',
                  isLinked ? 'le-cell--linked' : '',
                  justGain > 0 ? 'le-cell--just' : '',
                  cornerstone.cell === i ? 'le-cell--corner' : '',
                  canDrop ? 'le-cell--target' : '',
                  ghostGain > 0 ? 'le-cell--ghost' : '',
                ].filter(Boolean).join(' ')}
                style={room?.style ? ({ ['--sc' as string]: STYLE_COLOR[room.style] }) : undefined}
                onClick={() => place(i)}
                aria-disabled={!canDrop}
                aria-label={
                  room
                    ? `${room.en} ${room.ko} · ${room.style ? STYLE_KO[room.style] : '무양식'}${room.fixed ? ' · 기존 구조물' : ''}${isLinked ? ' · 복도 연결됨' : ''}`
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
                    <span className="le-cell-ko">{room.ko}</span>
                    {isLinked && <span className="le-cell-link" aria-hidden="true">⇿</span>}
                    {cornerstone.cell === i && <span className="le-cell-corner" aria-hidden="true">◆</span>}
                    {justGain > 0 && (
                      <ParticleBurst
                        intensity={Math.min(3, justGain)}
                        colors={room.style ? [STYLE_COLOR[room.style], 'var(--combo)'] : undefined}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <span className="le-cell-plus" aria-hidden="true">＋</span>
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
        </div>

        <div className="le-action">
          {heldCard ? (
            <div className="le-appraise">
              <p className="le-ask">
                <span className="le-ask-en">{heldCard.en}</span>
                <span className="le-ask-q">의 뜻은?</span>
              </p>
              <div className="le-opts">
                {heldCard.options.map((o, i) => (
                  <button key={o} type="button" className="le-opt" onClick={() => appraiseAnswer(o)}>
                    <Kbd>{i + 1}</Kbd>
                    <span>{o}</span>
                  </button>
                ))}
              </div>
              <div className="le-subrow">
                <button type="button" className="le-mini" onClick={() => appraiseAnswer(null)}>
                  감정 없이 짓기 <span className="le-mini-sub">시간은 지키지만 복도가 안 생겨요</span>
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
                <span className="le-place-ko">{pending.card.ko}</span>
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
              {cornerstone.left > 0 && pending.style && (
                <button
                  type="button"
                  className={`le-mini le-mini--wager ${cornerstone.armed ? 'le-mini--on' : ''}`}
                  onClick={armCornerstone}
                  aria-pressed={cornerstone.armed}
                >
                  ◆ 정초석으로 짓기 (이 층 1회)
                  <span className="le-mini-sub">
                    층이 끝날 때 같은 자재 2개 이상과 이어지면 +{Math.round(CORNERSTONE_PTS * plan.mult)}점, 아니면 이 층 복도 점수 절반
                  </span>
                </button>
              )}
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
          {flash || ' '}
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
  .le-cell[aria-disabled="true"] { cursor: default; }
  .le-cell--empty[aria-disabled="true"] { opacity: .78; }
  .le-cell--target { border-style: solid; border-color: var(--combo); background: color-mix(in srgb, var(--combo) 12%, var(--bg)); color: var(--combo); }
  .le-cell--target:hover { transform: scale(1.04); box-shadow: 0 0 0 2px var(--combo); }
  .le-cell--target:active { transform: scale(.96); }
  .le-cell:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 38%, transparent); }
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
  .le-glyph { flex: none; }

  /* ── 자재 범례 ── */
  .le-legend { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: center; }
  .le-legend-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .le-legend-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px;
    color: color-mix(in srgb, var(--sc) 74%, var(--t1)); border: 1px solid color-mix(in srgb, var(--sc) 42%, var(--bd)); background: color-mix(in srgb, var(--sc) 10%, transparent); }

  /* ── 행동 구역 (감정 / 배치 / 드래프트) ── */
  .le-action { display: flex; align-items: center; justify-content: center; width: min(560px, 94vw); min-height: 152px; }

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
  .le-mini--wager { border-color: color-mix(in srgb, var(--streak) 40%, var(--bd)); color: var(--t1); }
  .le-mini--wager:hover { border-color: var(--streak); }
  .le-mini--on { background: color-mix(in srgb, var(--streak) 14%, transparent); border-color: var(--streak); color: var(--t1); }

  .le-place { display: flex; flex-direction: column; align-items: center; gap: 7px; width: 100%; padding: 11px 14px; border-radius: var(--r-lg, 14px);
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 78%, transparent); animation: gk-pop .32s ease-out; }
  .le-place[data-kind="correct"] { border-color: color-mix(in srgb, var(--success) 45%, var(--bd)); color: var(--success); }
  .le-place[data-kind="wrong"] { border-color: color-mix(in srgb, var(--warning) 55%, var(--bd)); color: var(--warning); }
  .le-place[data-kind="skip"] { border-color: var(--bd); color: var(--t3); }
  .le-place-lead { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .le-place-en { font-family: var(--font-english, system-ui); font-size: 19px; font-weight: 800; color: var(--t1); }
  .le-place-ko { font-size: 14px; font-weight: 700; color: var(--t2); }
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
  }

  @media (prefers-reduced-motion: reduce) {
    .le-cell, .le-card, .le-opt, .le-mini, .le-estate { transition: none; }
    .le-cell--just, .le-place, .le-estate[data-transit="in"] { animation: none; }
    .le-cell--ghost { animation: none; opacity: 1; }
  }
`;
