// apps/web/src/components/game/lexicon-hands/LexiconHandsGame.tsx
// Lexicon Hands — 어휘 납품 계약 (칩 × 배수 엔진).
//
// v07.9 전면 재설계. 이전 판은 카드 앞면에 en·ko·품사·√어근·접두사·도메인을 전부
// 인쇄해 두고 "같은 라벨 찾기"를 시켰다. 인출이 0이었고(감사 learningIntegrity 1/5),
// 그 라벨의 절반은 substring 오검출(often→ten, read→re-)이라 **틀린 형태론을 √기호로
// 단정 교육**하고 있었다. 조커 3장은 UI 장식이고 실제로는 analyze() 안에 상수였다.
//
// 지금의 구조
//   · 주문판(Order)  — 한국어 뜻만 인쇄된다.
//   · 손패(Hand)     — 영단어만 인쇄된다.
//   → 제출 전 화면 어디에도 (en, ko) 쌍이 함께 놓이지 않는다. 학습자가 올려놓은
//     가설만이 쌍을 이룬다. 영단어 뜻을 인출하지 못하면 한 장도 납품할 수 없다.
//
// 판돈 구조 (Balatro 엔진을 껍데기가 아니라 실제로 이식)
//   · 묶음 배수  — 한 번에 채운 주문 수로 ×1 → ×7. 크게 걸수록 크게 번다.
//   · 전부 아니면 전무 — 한 장이라도 어긋나면 그 납품은 통째로 반려된다.
//                        부분 정답 개수를 알려주지 않는다(무위험 탐색 오라클 차단).
//   · 검수(lives) — 반려마다 1 소모. 0 이면 계약 파기. 반려는 플레이를 소모하지 않는다.
//   · 연쇄(combo) — 납품한 카드 수만큼 누적. 반려 한 번에 통째로 소멸.
//   · 감정(hint)  — 카드 1장의 뜻을 공개. 대신 칩 절반 + **FSRS 미적재**
//                   (힌트로 산 정답을 인출로 기록하지 않는다).
//   · 시간        — 2계약부터 카운트다운. 납품은 시간을 벌고, 반려는 시간을 깎는다.
//   · 정산 + 조커 — 계약 사이 남은 자원을 칩으로 환산하고 조커 1장을 영입한다.
//                   조커 8종 전부 실제 점수식에 들어간다(장식 없음).
//
// FSRS 정직성
//   맞게 납품한 카드만 onCorrect. 어긋나 소각된 카드만 onWrong.
//   버림은 전략이지 오답이 아니므로 아무것도 기록하지 않는다. 감정한 카드도 기록하지 않는다.
//   맛보기 풀로 도는 동안(내 단어장이 얇을 때)에는 한 건도 적재하지 않는다.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  GameMusic,
  ParticleBurst,
  FeedbackIcon,
  TimerBar,
  useSfx,
  useCombo,
  useCountdown,
  useCountUp,
  useFlipGrid,
  usePersonalBest,
  shuffle,
  clamp,
  DEFAULT_COMBO_TIERS,
  type Word,
} from '@/components/game/_shared/gamekit';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

// ─── 계약 규격 ────────────────────────────────────────────────────────────
// 목표는 5배씩 오르지만 화력도 같이 오른다(조커 영입 + 연쇄 배수 + 주문판 확대).
// 1계약은 시간 없음 — 규칙을 배우는 판에서 시계를 돌리면 배우기 전에 진다.
interface RoundSpec {
  target: number;
  slots: number;
  hand: number;
  plays: number;
  lives: number;
  discards: number;
  appraisals: number;
  timeMs: number;
  title: string;
  note: string;
}
const ROUNDS: RoundSpec[] = [
  {
    target: 420, slots: 3, hand: 8, plays: 4, lives: 3, discards: 3, appraisals: 2, timeMs: 0,
    title: '첫 계약 · 소량 납품',
    note: '주문 3건. 시계는 아직 돌지 않는다. 한 장씩 안전하게 내면 목표에 닿지 못한다 — 묶어라.',
  },
  {
    target: 1150, slots: 4, hand: 8, plays: 4, lives: 3, discards: 2, appraisals: 2, timeMs: 95_000,
    title: '두 번째 계약 · 정시 납품',
    note: '주문 4건, 95초. 납품 1장당 +3초, 반려 1회당 −8초. 세 장 이상 묶지 않으면 목표가 멀다.',
  },
  {
    target: 2600, slots: 5, hand: 9, plays: 5, lives: 2, discards: 2, appraisals: 1, timeMs: 85_000,
    title: '마지막 계약 · 대량 특송',
    note: '주문 5건, 85초, 검수는 둘뿐. 네 장 묶음이 아니면 시간 안에 목표를 넘기기 어렵다.',
  },
];

// 묶음 배수 — 이 게임의 족보표. 항상 화면에 떠 있다(규칙을 30초에 무료로 이해).
const BUNDLE = [0, 1, 2, 3.5, 5, 7];
const BUNDLE_LABEL = ['', '단품', '겹납품', '연쇄 납품', '대량 납품', '완납 특송'];

const CASH_PLAY = 45;
const CASH_LIFE = 70;
const CASH_APPRAISE = 30;

// 맛보기로 내려가는 하한. 라우트의 minWords(12)보다 낮게 잡는다 — 뜻이 겹치는 단어를
// 걷어내면(buildPool) 12개가 10~11개로 줄 수 있는데, 그때 학습자 단어를 통째로 버리고
// 맛보기로 갈아타면 그 판의 FSRS 적재가 0이 된다. 한 계약이 성립하는 최소치까지는 내 단어로 돈다.
const MIN_POOL = 10;
/** 라우트(play/lexicon-hands/page.tsx)의 minWords — 안내 문구가 게이트와 어긋나지 않게 여기에도 둔다. */
const ROUTE_MIN_WORDS = 12;
const APPRAISED_CHIP_RATIO = 0.5;
const DELIVER_EXTEND_MS = 3_000;
const REJECT_DRAIN_MS = 8_000;

// ─── 조커 ─────────────────────────────────────────────────────────────────
// 전부 scorePlay() 안에서 실제로 계산된다. 보유하지 않으면 아무 일도 일어나지 않는다.
type JokerId =
  | 'scholar' | 'bundler' | 'instinct' | 'closer'
  | 'inspector' | 'steady' | 'ledger' | 'salvage';
interface Joker { id: JokerId; name: string; desc: string; glyph: ReactNode }

const JOKER_POOL: Joker[] = [
  { id: 'scholar', name: '학자', desc: '7글자 이상 단어 1장당 +12칩', glyph: <path d="M3 7l7-3 7 3-7 3-7-3Zm3 4.2V15c0 .9 1.8 1.8 4 1.8s4-.9 4-1.8v-3.8" /> },
  { id: 'bundler', name: '다발상인', desc: '3장 이상 묶으면 묶음 배수 +1.5', glyph: <path d="M4 6h12v10H4zM4 9.5h12M8.5 6v10" /> },
  { id: 'instinct', name: '직감가', desc: '감정하지 않은 카드 1장당 +10칩', glyph: <path d="M10 3.5v13M3.5 10h13M6 6l8 8M14 6l-8 8" /> },
  { id: 'closer', name: '마감꾼', desc: '주문판을 한 번에 비우면 묶음 배수 ×1.5', glyph: <path d="M4 10.5l4 4 8-9" /> },
  { id: 'inspector', name: '검수관', desc: '반려돼도 맞춘 카드는 칩 절반으로 득점', glyph: <path d="M10 3.5l6 2.5v4.5c0 3.4-2.6 5.4-6 6-3.4-.6-6-2.6-6-6V6l6-2.5Z" /> },
  { id: 'steady', name: '무결점', desc: '검수를 한 번도 잃지 않았으면 납품마다 +35칩', glyph: <path d="M10 3.2l2.1 4.4 4.7.6-3.5 3.3.9 4.8L10 14l-4.2 2.3.9-4.8L3.2 8.2l4.7-.6L10 3.2Z" /> },
  { id: 'ledger', name: '이중장부', desc: '연쇄 배수 +0.5', glyph: <path d="M5 4h10v12H5zM7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" /> },
  { id: 'salvage', name: '회수업자', desc: '이 계약에서 소각된 카드 1장당 +18칩', glyph: <path d="M6 7h8l-1 9H7L6 7Zm1.5-2.5h5M4.5 7h11" /> },
];
const JOKER_BY_ID = new Map<JokerId, Joker>(JOKER_POOL.map((j) => [j.id, j]));

// ─── 맛보기 풀 ────────────────────────────────────────────────────────────
// 내 단어장이 아직 얇으면 useGameWordScope 가 wordPool 을 주지 않는다(demo degrade).
// 그때도 놀이는 막지 않되 **이 단어들의 결과는 FSRS 에 한 건도 적재하지 않는다**.
const DEMO_POOL: Word[] = [
  { en: 'inspect', ko: '조사하다' },
  { en: 'portable', ko: '휴대용의' },
  { en: 'predict', ko: '예측하다' },
  { en: 'generous', ko: '관대한' },
  { en: 'shelter', ko: '피난처' },
  { en: 'ancient', ko: '고대의' },
  { en: 'reduce', ko: '줄이다' },
  { en: 'fragile', ko: '부서지기 쉬운' },
  { en: 'harvest', ko: '수확하다' },
  { en: 'declare', ko: '선언하다' },
  { en: 'reluctant', ko: '주저하는' },
  { en: 'summit', ko: '정상' },
  { en: 'vanish', ko: '자취를 감추다' },
  { en: 'stubborn', ko: '고집 센' },
  { en: 'threaten', ko: '위협하다' },
  { en: 'merchant', ko: '상인' },
  { en: 'gratitude', ko: '감사' },
  { en: 'wander', ko: '헤매다' },
  { en: 'severe', ko: '혹독한' },
  { en: 'imitate', ko: '모방하다' },
  { en: 'shallow', ko: '얕은' },
  { en: 'restore', ko: '복원하다' },
  { en: 'anxious', ko: '불안한' },
  { en: 'abundant', ko: '풍부한' },
  { en: 'confess', ko: '자백하다' },
  { en: 'stumble', ko: '발을 헛디디다' },
];

// ─── 자료 정제 ────────────────────────────────────────────────────────────
const normKo = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const r1 = (v: number) => Math.round(v * 10) / 10;
const fmtMult = (m: number) => (m % 1 === 0 ? `${m}` : m.toFixed(1));
const chipsFor = (en: string) => Math.round(12 + Math.min(en.length, 14) * 1.5);

/** 뜻이 겹치면 한 주문에 정답이 둘이 되어 불공정해진다 — en·ko 양쪽으로 중복을 걷어낸다. */
function buildPool(src: Word[]): Word[] {
  const seenEn = new Set<string>();
  const seenKo = new Set<string>();
  const out: Word[] = [];
  for (const w of src) {
    const en = (w.en ?? '').trim();
    const ko = (w.ko ?? '').trim();
    if (!en || !ko) continue;
    if (!/^[A-Za-z][A-Za-z'’-]{1,}$/.test(en)) continue; // 단일 영단어만
    const ke = en.toLowerCase();
    const kk = normKo(ko);
    if (seenEn.has(ke) || seenKo.has(kk)) continue;
    seenEn.add(ke);
    seenKo.add(kk);
    out.push({ ...w, en, ko });
  }
  return out;
}

// ─── 점수식 ───────────────────────────────────────────────────────────────
interface Card { id: number; en: string; ko: string; chips: number; appraised: boolean }
interface Order { id: number; ko: string }

function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}

interface ScoreCtx {
  cards: Card[];
  comboBefore: number;
  jokers: JokerId[];
  livesFull: boolean;
  burnedCount: number;
  fillsAll: boolean;
}
interface ScoreOut { chips: number; bundle: number; comboMult: number; score: number; label: string }

function scorePlay(ctx: ScoreCtx): ScoreOut {
  const has = (id: JokerId) => ctx.jokers.includes(id);
  const n = clamp(ctx.cards.length, 0, 5);
  let chips = 0;
  for (const c of ctx.cards) {
    chips += c.appraised ? Math.round(c.chips * APPRAISED_CHIP_RATIO) : c.chips;
    if (has('scholar') && c.en.length >= 7) chips += 12;
    if (has('instinct') && !c.appraised) chips += 10;
  }
  if (n > 0 && has('steady') && ctx.livesFull) chips += 35;
  if (has('salvage')) chips += 18 * ctx.burnedCount;

  let bundle = BUNDLE[n];
  if (has('bundler') && n >= 3) bundle += 1.5;
  if (has('closer') && ctx.fillsAll && n >= 2) bundle *= 1.5;

  let comboMult = multFor(ctx.comboBefore);
  if (has('ledger')) comboMult += 0.5;

  return {
    chips,
    bundle: r1(bundle),
    comboMult: r1(comboMult),
    score: Math.round(chips * bundle * comboMult),
    label: BUNDLE_LABEL[n],
  };
}

// ─── 납품 결과(제출 후 전면 공개) ─────────────────────────────────────────
interface GradedRow { en: string; guessKo: string; trueKo: string; ok: boolean }
interface PlayResult {
  ok: boolean;
  rows: GradedRow[];
  score: number;
  chips: number;
  bundle: number;
  comboMult: number;
  label: string;
  headline: string;
  consolation: number;
}

// ─── 아이콘 ───────────────────────────────────────────────────────────────
function JokerGlyph({ glyph }: { glyph: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyph}
    </svg>
  );
}
function IconOrder() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3.5h10v13l-2.5-1.6L10 16.5l-2.5-1.6L5 16.5v-13Z" />
      <path d="M7.5 7h5M7.5 10h3" />
    </svg>
  );
}
function IconLens() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8.6" cy="8.6" r="4.6" />
      <path d="M12.2 12.2L16.5 16.5" />
    </svg>
  );
}
function IconBurn() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3c2.6 2.4 4.2 4.4 4.2 6.6A4.2 4.2 0 0 1 10 16a4.2 4.2 0 0 1-4.2-4.4C5.8 9 7.4 6.8 10 3Z" />
    </svg>
  );
}

export function LexiconHandsGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  // ── 자료: 학습자 단어장이 1순위. 얇을 때만 맛보기. ──
  const mine = useMemo(() => buildPool(wordPool ?? []), [wordPool]);
  const demoMode = mine.length < MIN_POOL;
  const pool = useMemo(() => (demoMode ? buildPool(DEMO_POOL) : mine), [demoMode, mine]);

  const emitCorrect = useCallback((w: Word) => { if (!demoMode) onCorrect?.(w); }, [demoMode, onCorrect]);
  const emitWrong = useCallback((w: Word) => { if (!demoMode) onWrong?.(w); }, [demoMode, onWrong]);

  // ── 진행 상태 ──
  // 시작 화면을 따로 두지 않는다 — 첫 계약은 이미 깔린 채로 열리고, 규칙은 보드 위에
  // 접을 수 있는 카드로 얹힌다(Progressive Disclosure). 읽기 전에 클릭 한 번을 요구하면
  // 규칙을 읽을 사람은 어차피 읽고, 안 읽을 사람에게는 문턱만 남는다.
  const [phase, setPhase] = useState<'play' | 'settle' | 'done'>('play');
  const [showIntro, setShowIntro] = useState(true);
  const [roundIdx, setRoundIdx] = useState(0);
  const [hand, setHand] = useState<Card[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [assign, setAssign] = useState<Record<number, number>>({});
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [arm, setArm] = useState<'appraise' | 'discard' | null>(null);

  const [plays, setPlays] = useState(ROUNDS[0].plays);
  const [lives, setLives] = useState(ROUNDS[0].lives);
  const [discards, setDiscards] = useState(ROUNDS[0].discards);
  const [appraisals, setAppraisals] = useState(ROUNDS[0].appraisals);

  const [roundScore, setRoundScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [bestHand, setBestHand] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [delivered, setDelivered] = useState(0);

  const [jokers, setJokers] = useState<JokerId[]>([]);
  const [draft, setDraft] = useState<JokerId[]>([]);
  const [openJoker, setOpenJoker] = useState<JokerId | null>(null);
  const [showRules, setShowRules] = useState(false);

  const [burnedThisRound, setBurnedThisRound] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [note, setNote] = useState('');
  const [burstKey, setBurstKey] = useState(0);
  const [cashOut, setCashOut] = useState<{ plays: number; lives: number; appraisals: number; sum: number } | null>(null);

  const [won, setWon] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; improved: boolean } | null>(null);

  const pb = usePersonalBest('lexicon-hands');
  const spec = ROUNDS[roundIdx];
  const shownRound = useCountUp(roundScore);

  const cardIdRef = useRef(0);
  const orderIdRef = useRef(0);
  const seenRef = useRef(new Map<string, number>());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const noteTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  // 총 칩은 한 턴에 여러 번(득점 → 정산) 더해진다. state 만 쓰면 같은 턴의 두 번째 가산이
  // 첫 번째를 못 보고 덮어써 정산 칩이 조용히 증발한다 — 진실은 ref, state 는 표시용.
  const totalRef = useRef(0);
  const addTotal = useCallback((n: number) => {
    if (n === 0) return;
    totalRef.current += n;
    setTotal(totalRef.current);
  }, []);

  const say = useCallback((text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(''), 2600);
  }, []);

  const combo = useCombo();

  // ── 시간 — 2계약부터. 납품은 시간을 벌고 반려는 깎는다. ──
  const timeUpRef = useRef<(() => void) | null>(null);
  const timer = useCountdown({
    totalMs: Math.max(ROUNDS[0].timeMs, 1_000),
    running: phase === 'play' && ROUNDS[roundIdx].timeMs > 0,
    warnAtMs: 20_000,
    onEnd: () => { if (phaseRef.current === 'play') timeUpRef.current?.(); },
  });
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // ── 손패·주문판 갱신 ──
  const takeWords = useCallback((n: number, excludeEn: Set<string>): Word[] => {
    if (n <= 0) return [];
    const avail = pool.filter((w) => !excludeEn.has(w.en.toLowerCase()));
    // 섞은 뒤 "덜 나온 단어" 우선 — 단어장 전체가 돌아가게 한다(같은 8개만 반복 금지).
    const ranked = shuffle(avail).sort(
      (a, b) => (seenRef.current.get(a.en.toLowerCase()) ?? 0) - (seenRef.current.get(b.en.toLowerCase()) ?? 0),
    );
    const picked = ranked.slice(0, n);
    for (const w of picked) {
      const k = w.en.toLowerCase();
      excludeEn.add(k);
      seenRef.current.set(k, (seenRef.current.get(k) ?? 0) + 1);
    }
    return picked;
  }, [pool]);

  const toCard = useCallback((w: Word): Card => ({
    id: ++cardIdRef.current,
    en: w.en,
    ko: w.ko,
    chips: chipsFor(w.en),
    appraised: false,
  }), []);

  /** 손패를 채우고, 답이 손패를 떠난 주문을 걷어내고, 빈 슬롯을 새 주문으로 메운다. */
  const settleBoard = useCallback(
    (handAfter: Card[], ordersAfter: Order[], s: RoundSpec): { hand: Card[]; orders: Order[] } => {
      const excl = new Set(handAfter.map((c) => c.en.toLowerCase()));
      const drawn = takeWords(s.hand - handAfter.length, excl);
      const nextHand = [...handAfter, ...drawn.map(toCard)];
      const handKo = new Set(nextHand.map((c) => normKo(c.ko)));
      const kept = ordersAfter.filter((o) => handKo.has(normKo(o.ko)));
      const used = new Set(kept.map((o) => normKo(o.ko)));
      const cands = shuffle(nextHand.filter((c) => !used.has(normKo(c.ko))));
      const nextOrders = [...kept];
      while (nextOrders.length < s.slots && cands.length > 0) {
        const c = cands.pop() as Card;
        used.add(normKo(c.ko));
        nextOrders.push({ id: ++orderIdRef.current, ko: c.ko });
      }
      return { hand: nextHand, orders: nextOrders };
    },
    [takeWords, toCard],
  );

  const startRound = useCallback((ri: number) => {
    const s = ROUNDS[ri];
    const board = settleBoard([], [], s);
    setHand(board.hand);
    setOrders(board.orders);
    setAssign({});
    setActiveSlot(board.orders[0]?.id ?? null);
    setArm(null);
    setPlays(s.plays);
    setLives(s.lives);
    setDiscards(s.discards);
    setAppraisals(s.appraisals);
    setRoundScore(0);
    setBurnedThisRound(0);
    setResult(null);
    setNote('');
    setCashOut(null);
    combo.reset();
    timerRef.current.reset(Math.max(s.timeMs, 1_000));
    setPhase('play');
  }, [settleBoard, combo.reset]);

  // ── 런 종료 ──
  const endRun = useCallback((didWin: boolean, reason: string) => {
    setWon(didWin);
    setEndReason(reason);
    setTotal(totalRef.current);
    setBestInfo(pb.submit(totalRef.current));
    setPhase('done');
    if (didWin) sfx.fanfare();
  }, [pb, sfx]);

  // ── 계약 종료 판정 ──
  const finishRound = useCallback(
    (scoreNow: number, playsLeft: number, livesLeft: number, appraisalsLeft: number, reason: string) => {
      const s = ROUNDS[roundIdx];
      const cleared = scoreNow >= s.target;
      if (!cleared) {
        const ratio = s.target > 0 ? scoreNow / s.target : 0;
        if (ratio >= 0.9) sfx.nearMiss();
        else sfx.wrong();
        endRun(false, ratio >= 0.9
          ? `목표까지 ${(s.target - scoreNow).toLocaleString()}점 — 거의 닿았어요`
          : reason);
        return;
      }
      const cash = playsLeft * CASH_PLAY + livesLeft * CASH_LIFE + appraisalsLeft * CASH_APPRAISE;
      addTotal(cash);
      setCashOut({ plays: playsLeft, lives: livesLeft, appraisals: appraisalsLeft, sum: cash });
      if (cash > 0) sfx.coin();
      if (roundIdx + 1 >= ROUNDS.length) {
        endRun(true, '');
        return;
      }
      const owned = new Set(jokers);
      setDraft(shuffle(JOKER_POOL.filter((j) => !owned.has(j.id))).slice(0, 3).map((j) => j.id));
      setPhase('settle');
      sfx.fanfare();
    },
    [roundIdx, jokers, addTotal, endRun, sfx],
  );

  // 시간 초과 — 최신 상태를 ref 로 잡아 콜백이 낡은 값을 보지 않게 한다.
  const liveRef = useRef({ roundScore, plays, lives, appraisals });
  liveRef.current = { roundScore, plays, lives, appraisals };
  timeUpRef.current = () => {
    const v = liveRef.current;
    finishRound(v.roundScore, 0, v.lives, v.appraisals, '납기를 넘겼어요');
  };

  // ── 파생값 ──
  const cardById = useMemo(() => new Map(hand.map((c) => [c.id, c])), [hand]);
  const assignedCardIds = useMemo(() => new Set(Object.values(assign)), [assign]);
  const selCards = useMemo(
    () => orders.map((o) => (assign[o.id] != null ? cardById.get(assign[o.id]) : undefined)).filter(Boolean) as Card[],
    [orders, assign, cardById],
  );
  const livesFull = lives === spec.lives;
  const preview = useMemo(
    () => scorePlay({
      cards: selCards,
      comboBefore: combo.combo,
      jokers,
      livesFull,
      burnedCount: burnedThisRound,
      fillsAll: selCards.length > 0 && selCards.length === orders.length,
    }),
    [selCards, combo.combo, jokers, livesFull, burnedThisRound, orders.length],
  );
  const remain = Math.max(0, spec.target - roundScore);
  const needPerPlay = plays > 0 ? Math.ceil(remain / plays) : remain;
  const flip = useFlipGrid(useMemo(() => hand.map((c) => String(c.id)), [hand]));

  // ── 조작 ──
  const clearResult = useCallback(() => setResult((r) => (r ? null : r)), []);

  const tapSlot = useCallback((oid: number) => {
    clearResult();
    setArm(null);
    if (assign[oid] != null) {
      setAssign((a) => { const n = { ...a }; delete n[oid]; return n; });
      setActiveSlot(oid);
      sfx.click();
      return;
    }
    setActiveSlot(oid);
    sfx.click();
  }, [assign, clearResult, sfx]);

  const appraise = useCallback((card: Card) => {
    if (card.appraised) { say('이미 감정한 카드예요'); return; }
    if (appraisals <= 0) { say('감정을 다 썼어요'); return; }
    setAppraisals((n) => n - 1);
    setHand((h) => h.map((c) => (c.id === card.id ? { ...c, appraised: true } : c)));
    setArm(null);
    sfx.click();
    say(`감정 — ${card.en} · ${card.ko}. 칩은 절반이 되고 복습 기록에는 남지 않아요.`);
  }, [appraisals, say, sfx]);

  const discardCard = useCallback((card: Card) => {
    if (discards <= 0) { say('버릴 수 있는 횟수를 다 썼어요'); return; }
    setDiscards((n) => n - 1);
    setArm(null);
    sfx.click();
    // 버림은 전략이지 오답이 아니다 — FSRS 에 아무것도 남기지 않는다.
    const nextHand = hand.filter((c) => c.id !== card.id);
    const nextAssign: Record<number, number> = {};
    for (const [k, v] of Object.entries(assign)) if (v !== card.id) nextAssign[Number(k)] = v;
    const keptOrders = orders.filter((o) => normKo(o.ko) !== normKo(card.ko));
    const board = settleBoard(nextHand, keptOrders, spec);
    setHand(board.hand);
    setOrders(board.orders);
    const alive = new Set(board.orders.map((o) => o.id));
    const pruned: Record<number, number> = {};
    for (const [k, v] of Object.entries(nextAssign)) if (alive.has(Number(k))) pruned[Number(k)] = v;
    setAssign(pruned);
    setActiveSlot(board.orders.find((o) => pruned[o.id] == null)?.id ?? null);
    say(`${card.en} 을(를) 반품했어요. 새 카드가 들어옵니다.`);
  }, [discards, hand, assign, orders, spec, settleBoard, say, sfx]);

  const tapCard = useCallback((card: Card) => {
    clearResult();
    if (arm === 'appraise') { appraise(card); return; }
    if (arm === 'discard') { discardCard(card); return; }
    // 이미 어딘가에 올라가 있으면 회수
    const placedAt = Object.entries(assign).find(([, v]) => v === card.id);
    if (placedAt) {
      const oid = Number(placedAt[0]);
      setAssign((a) => { const n = { ...a }; delete n[oid]; return n; });
      setActiveSlot(oid);
      sfx.click();
      return;
    }
    const target = activeSlot != null && assign[activeSlot] == null
      ? activeSlot
      : orders.find((o) => assign[o.id] == null)?.id ?? null;
    if (target == null) { say('주문판이 가득 찼어요 — 납품하거나 카드를 내려놓으세요'); return; }
    const next = { ...assign, [target]: card.id };
    setAssign(next);
    setActiveSlot(orders.find((o) => next[o.id] == null)?.id ?? null);
    sfx.click();
  }, [arm, appraise, discardCard, assign, activeSlot, orders, clearResult, say, sfx]);

  // ── 납품 ──
  const deliver = useCallback(() => {
    if (phase !== 'play') return;
    const pairs = orders
      .filter((o) => assign[o.id] != null)
      .map((o) => ({ order: o, card: cardById.get(assign[o.id]) }))
      .filter((p): p is { order: Order; card: Card } => !!p.card);
    if (pairs.length === 0) { say('주문 위에 카드를 올려야 납품할 수 있어요'); sfx.wrong(); return; }

    const graded = pairs.map((p) => ({ ...p, ok: normKo(p.card.ko) === normKo(p.order.ko) }));
    const rows: GradedRow[] = graded.map((g) => ({
      en: g.card.en, guessKo: g.order.ko, trueKo: g.card.ko, ok: g.ok,
    }));
    const allOk = graded.every((g) => g.ok);
    const fillsAll = pairs.length === orders.length;

    if (allOk) {
      const cards = graded.map((g) => g.card);
      const out = scorePlay({
        cards, comboBefore: combo.combo, jokers, livesFull,
        burnedCount: burnedThisRound, fillsAll,
      });
      let last = combo.combo;
      for (const c of cards) {
        last = combo.hit();
        if (!c.appraised) emitCorrect({ en: c.en, ko: c.ko });
      }
      setBestCombo((b) => Math.max(b, last));
      setBestHand((b) => Math.max(b, out.score));
      setDelivered((d) => d + cards.length);
      const ns = roundScore + out.score;
      const pl = plays - 1;
      setRoundScore(ns);
      addTotal(out.score);
      setPlays(pl);
      setBurstKey((k) => k + 1);
      if (spec.timeMs > 0) timer.extend(DELIVER_EXTEND_MS * cards.length);
      sfx.correct(last, out.bundle >= 3.5);
      setResult({
        ok: true, rows, score: out.score, chips: out.chips, bundle: out.bundle,
        comboMult: out.comboMult, label: out.label, consolation: 0,
        headline: fillsAll && cards.length >= 2 ? `${out.label} · 주문판을 비웠어요` : `${out.label} 성공`,
      });

      const keptHand = hand.filter((c) => !cards.some((d) => d.id === c.id));
      const keptOrders = orders.filter((o) => !graded.some((g) => g.order.id === o.id));
      const board = settleBoard(keptHand, keptOrders, spec);
      setHand(board.hand);
      setOrders(board.orders);
      setAssign({});
      setActiveSlot(board.orders[0]?.id ?? null);

      if (ns >= spec.target) { finishRound(ns, pl, lives, appraisals, ''); return; }
      if (pl <= 0) { finishRound(ns, 0, lives, appraisals, '납품 기회를 다 썼어요'); return; }
      return;
    }

    // ── 반려 — 부분 정답 개수를 미리 알려주지 않았고, 지금 전부 공개한다. ──
    const wrongs = graded.filter((g) => !g.ok);
    const rights = graded.filter((g) => g.ok);
    const lv = lives - 1;
    setLives(lv);
    combo.miss();
    if (spec.timeMs > 0) timer.drain(REJECT_DRAIN_MS);

    let consolation = 0;
    if (jokers.includes('inspector') && rights.length > 0) {
      consolation = rights.reduce(
        (s, g) => s + (g.card.appraised ? Math.round(g.card.chips * APPRAISED_CHIP_RATIO) : g.card.chips),
        0,
      );
      setRoundScore((v) => v + consolation);
      addTotal(consolation);
    }

    for (const g of wrongs) {
      if (!g.card.appraised) emitWrong({ en: g.card.en, ko: g.card.ko });
      setMissed((prev) => (prev.some((x) => x.en === g.card.en) ? prev : [...prev, { en: g.card.en, ko: g.card.ko }]));
    }
    setBurnedThisRound((n) => n + wrongs.length);
    sfx.nearMiss();
    setResult({
      ok: false, rows, score: 0, chips: 0, bundle: 0, comboMult: 0, label: '',
      consolation,
      headline: rights.length > 0
        ? `반려 — ${wrongs.length}장이 어긋나 묶음 전체가 되돌아왔어요`
        : '반려 — 이번 묶음은 통째로 되돌아왔어요',
    });

    // 어긋난 카드는 소각(뜻을 공개했으니 다시 낼 이유가 없다). 맞았던 카드는 손에 남는다.
    const burnedIds = new Set(wrongs.map((g) => g.card.id));
    const keptHand = hand.filter((c) => !burnedIds.has(c.id));
    const burnedKo = new Set(wrongs.map((g) => normKo(g.card.ko)));
    const keptOrders = orders.filter((o) => !burnedKo.has(normKo(o.ko)));
    const board = settleBoard(keptHand, keptOrders, spec);
    setHand(board.hand);
    setOrders(board.orders);
    setAssign({});
    setActiveSlot(board.orders[0]?.id ?? null);

    const ns = roundScore + consolation;
    if (ns >= spec.target) { finishRound(ns, plays, lv, appraisals, ''); return; }
    if (lv <= 0) { finishRound(ns, plays, 0, appraisals, '검수를 모두 잃었어요'); return; }
  }, [
    phase, orders, assign, cardById, combo, jokers, livesFull, burnedThisRound, hand, spec,
    roundScore, plays, lives, appraisals, settleBoard, addTotal, emitCorrect, emitWrong,
    finishRound, say, sfx, timer,
  ]);

  const takeJoker = useCallback((id: JokerId) => {
    setJokers((j) => (j.includes(id) ? j : [...j, id]));
    sfx.coin();
    const nr = roundIdx + 1;
    setRoundIdx(nr);
    startRound(nr);
  }, [roundIdx, startRound, sfx]);

  const skipJoker = useCallback(() => {
    const nr = roundIdx + 1;
    setRoundIdx(nr);
    startRound(nr);
  }, [roundIdx, startRound]);

  const restart = useCallback(() => {
    setRoundIdx(0);
    totalRef.current = 0;
    setTotal(0);
    setBestHand(0);
    setBestCombo(0);
    setDelivered(0);
    setJokers([]);
    setMissed([]);
    setWon(false);
    setEndReason('');
    setBestInfo(null);
    setShowIntro(false); // 두 번째 런에서까지 규칙판을 다시 펴지 않는다
    seenRef.current = new Map();
    startRound(0);
  }, [startRound]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  // 첫 계약 배분 — 진입 즉시 보드가 깔려 있어야 한다.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    startRound(0);
    // 최초 1회만 — startRound 는 pool 이 바뀌면 신원이 바뀌는데, 그때 판을 다시 돌리면
    // 진행 중인 계약이 통째로 초기화된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 키보드 — 납품/취소를 손에서 뗄 필요 없이.
  // 타이머가 도는 라운드에서는 매 프레임 리렌더가 일어나므로 핸들러를 ref 로 고정해
  // 리스너가 초당 60회 재구독되지 않게 한다.
  const keyRef = useRef({ deliver, selCount: selCards.length, firstSlot: orders[0]?.id ?? null });
  keyRef.current = { deliver, selCount: selCards.length, firstSlot: orders[0]?.id ?? null };
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const k = keyRef.current;
      if (e.key === 'Enter' && k.selCount > 0) { e.preventDefault(); k.deliver(); }
      else if (e.key === 'Escape') { setArm(null); setAssign({}); setActiveSlot(k.firstSlot); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const atmos = (
    <AmbientBackground
      center="#F2ECE2" mid="#C9B49B" edge="#2A1B14"
      glow="rgba(120,225,190,.22)" glowAt="50% 44%" watermark="lexicon-hands"
    />
  );

  // ─── 완료 ───
  if (phase === 'done') {
    const revealWords = missed.slice(-8);
    return (
      <div className="gk-root lh-root">
        <GameMusic gameId="lexicon-hands" />
        <GameKitStyles />
        {atmos}
        <style dangerouslySetInnerHTML={{ __html: LH_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="lexicon-hands"
          celebrate={won}
          lead={won ? '세 계약을 모두 납품했어요' : endReason || `${roundIdx + 1}번째 계약에서 멈췄어요`}
          badge={
            won ? <>전 계약 완납 · 조커 {jokers.length}장</>
              : bestCombo >= 6 ? <>최장 연쇄 {bestCombo}장</> : null
          }
          stats={[
            { num: total.toLocaleString(), label: '총 칩', accent: true },
            { num: delivered, label: '납품한 단어' },
            { num: bestHand.toLocaleString(), label: '최고 한 판' },
          ]}
          best={{ prev: bestInfo?.prev ?? null, now: total, label: '총 칩', improved: bestInfo?.improved }}
          reveal={
            revealWords.length > 0 ? (
              <div className="lh-reveal">
                <p className="lh-reveal-h">되돌아온 단어 — 다음 판에는 이 뜻으로 납품하면 돼요</p>
                <ul className="lh-reveal-list">
                  {revealWords.map((w) => (
                    <li key={w.en}><b>{w.en}</b><span>{w.ko}</span></li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          restartHint={
            won
              ? '다음 런은 조커를 다르게 골라 보세요 — 같은 단어라도 점수식이 달라져요.'
              : `한 번에 한 장 더 묶으면 배수가 ${fmtMult(BUNDLE[2])} → ${fmtMult(BUNDLE[3])} 로 뜁니다.`
          }
          footer={
            jokers.length > 0 ? (
              <>
                {jokers.map((id) => {
                  const j = JOKER_BY_ID.get(id);
                  if (!j) return null;
                  return (
                    <span key={id} className="lh-foot-joker">
                      <JokerGlyph glyph={j.glyph} />{j.name}
                    </span>
                  );
                })}
              </>
            ) : undefined
          }
          restartLabel="새 계약"
          onRestart={restart}
          onExit={handleExit}
        />
      </div>
    );
  }

  // ─── 정산 + 조커 영입 ───
  if (phase === 'settle') {
    return (
      <div className="gk-root lh-root">
        <GameMusic gameId="lexicon-hands" />
        <GameKitStyles />
        {atmos}
        <style dangerouslySetInnerHTML={{ __html: LH_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <main className="gk-stage lh-stage lh-stage--brief">
          <div className="lh-brief">
            <p className="lh-brief-kicker">{roundIdx + 1}번째 계약 완료</p>
            <h1 className="lh-brief-title">정산</h1>
            <ul className="lh-cash">
              <li><span>남은 납품 기회 {cashOut?.plays ?? 0}</span><b>+{((cashOut?.plays ?? 0) * CASH_PLAY).toLocaleString()}</b></li>
              <li><span>남은 검수 {cashOut?.lives ?? 0}</span><b>+{((cashOut?.lives ?? 0) * CASH_LIFE).toLocaleString()}</b></li>
              <li><span>쓰지 않은 감정 {cashOut?.appraisals ?? 0}</span><b>+{((cashOut?.appraisals ?? 0) * CASH_APPRAISE).toLocaleString()}</b></li>
              <li className="lh-cash-sum">
                <span>정산 +{(cashOut?.sum ?? 0).toLocaleString()} · 총 칩</span>
                <b>{total.toLocaleString()}</b>
              </li>
            </ul>
            <p className="lh-brief-kicker lh-draft-h">조커 한 장을 영입하세요 — 다음 계약의 점수식이 바뀝니다</p>
            <div className="lh-draft">
              {draft.map((id) => {
                const j = JOKER_BY_ID.get(id);
                if (!j) return null;
                return (
                  <button key={id} type="button" className="lh-draft-card" onClick={() => takeJoker(id)}>
                    <span className="lh-draft-ic"><JokerGlyph glyph={j.glyph} /></span>
                    <b>{j.name}</b>
                    <span className="lh-draft-desc">{j.desc}</span>
                  </button>
                );
              })}
            </div>
            <p className="lh-brief-note">{ROUNDS[roundIdx + 1]?.note}</p>
            <button type="button" className="gk-btn lh-skip" onClick={skipJoker}>
              영입 없이 진행
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── 플레이 ───
  const timed = spec.timeMs > 0;
  return (
    <div className="gk-root lh-root">
      <GameMusic gameId="lexicon-hands" />
      <GameKitStyles />
      {atmos}
      <style dangerouslySetInnerHTML={{ __html: LH_CSS }} />
      <div className="gk-sr" aria-live="polite">
        {result ? `${result.headline}. ${result.rows.map((r) => `${r.en} ${r.ok ? '납품' : `어긋남, 뜻은 ${r.trueKo}`}`).join('. ')}` : note}
      </div>
      <Hud
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        combo={combo.combo}
        comboMult={combo.mult}
        lives={{ total: spec.lives, left: lives, label: '남은 검수' }}
        extra={
          <div className="lh-hud">
            <span className="gk-stat-label">계약 {roundIdx + 1}/3</span>
            <span className="lh-hud-v">납품 {plays} · 버림 {discards} · 감정 {appraisals}</span>
          </div>
        }
      />

      <main className="gk-stage lh-stage">
        {/* 첫 진입 안내 — 보드를 막지 않고 위에 얹힌다. 접으면 다시 열지 않는다. */}
        {showIntro && roundIdx === 0 && (
          <section className="lh-intro">
            <p className="lh-brief-kicker">어휘 납품 계약</p>
            <h1 className="lh-brief-title">주문서에는 뜻만, 손패에는 단어만 적혀 있다</h1>
            <ol className="lh-brief-steps">
              <li><span className="lh-step-n">1</span>주문판의 <b>한국어 뜻</b> 위에 손패의 <b>영단어</b>를 올린다.</li>
              <li><span className="lh-step-n">2</span>한 번에 여러 주문을 묶을수록 배수가 커진다 — {fmtMult(BUNDLE[1])} · {fmtMult(BUNDLE[2])} · {fmtMult(BUNDLE[3])} · {fmtMult(BUNDLE[4])} · {fmtMult(BUNDLE[5])}.</li>
              <li><span className="lh-step-n">3</span>한 장이라도 어긋나면 <b>묶음 전체가 반려</b>되고 검수를 하나 잃는다. 어디가 틀렸는지는 낸 뒤에 전부 알려준다.</li>
              <li><span className="lh-step-n">4</span>모르는 단어는 <b>감정</b>으로 뜻을 열 수 있다. 대신 칩은 절반이고 복습 기록에는 남지 않는다.</li>
            </ol>
            <p className="lh-brief-note">{ROUNDS[0].note}</p>
            {demoMode && (
              <p className="lh-brief-demo">
                지금은 맛보기 단어로 돌아갑니다. 내 단어장에 서로 다른 뜻의 단어가 {ROUTE_MIN_WORDS}개
                쌓이면 계약이 내 단어로 짜이고, 그때부터 결과가 복습 일정에 반영돼요.
              </p>
            )}
            <button type="button" className="gk-btn lh-intro-go" onClick={() => setShowIntro(false)}>
              알겠어요 — 계약 시작
            </button>
          </section>
        )}

        {/* 조커 — 보유한 것만. 클릭/포커스로 설명(title 단독은 키보드·터치 접근 불가) */}
        {jokers.length > 0 && (
          <div className="lh-jokers" aria-label="보유 조커">
            {jokers.map((id) => {
              const j = JOKER_BY_ID.get(id);
              if (!j) return null;
              const open = openJoker === id;
              return (
                <div key={id} className="lh-joker-wrap">
                  <button
                    type="button"
                    className="lh-joker"
                    aria-expanded={open}
                    onClick={() => setOpenJoker((v) => (v === id ? null : id))}
                  >
                    <JokerGlyph glyph={j.glyph} />
                    <span>{j.name}</span>
                  </button>
                  {open && <span className="lh-joker-pop" role="note">{j.desc}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* 목표 게이지 */}
        <div className="lh-goal">
          {timed && (
            <div className="lh-timer">
              <TimerBar frac={timer.frac} warning={timer.warning} seconds={timer.remainSec} label="납기" />
            </div>
          )}
          <div className="lh-goal-row">
            <span className="lh-goal-label">목표</span>
            <span className="lh-goal-target">{spec.target.toLocaleString()}</span>
          </div>
          <div className="lh-bar">
            <div className="lh-bar-fill" style={{ width: `${clamp(roundScore / spec.target, 0, 1) * 100}%` }} />
          </div>
          <div className="lh-score-row">
            <span className="lh-score">{shownRound.toLocaleString()}</span>
            {burstKey > 0 && <span key={burstKey} className="lh-burst"><ParticleBurst intensity={3} colors={['var(--success)', 'var(--combo)', 'var(--streak)']} /></span>}
          </div>
          <p className="lh-need">
            {remain > 0
              ? <>목표까지 <b>{remain.toLocaleString()}</b> · 남은 {plays}번이면 판당 <b>{needPerPlay.toLocaleString()}</b></>
              : <>목표 달성 — 정산으로 넘어갑니다</>}
          </p>
        </div>

        {/* 주문판 */}
        <div className="lh-orders" aria-label="주문판">
          {orders.map((o) => {
            const cid = assign[o.id];
            const card = cid != null ? cardById.get(cid) : undefined;
            const active = activeSlot === o.id && !card;
            return (
              <button
                key={o.id}
                type="button"
                className={`lh-slot ${card ? 'lh-slot--filled' : ''} ${active ? 'lh-slot--active' : ''}`}
                onClick={() => tapSlot(o.id)}
                aria-pressed={!!card}
                aria-label={card ? `주문 ${o.ko}, 올린 카드 ${card.en}. 누르면 내려놓아요` : `주문 ${o.ko}, 비어 있음`}
              >
                <span className="lh-slot-ic" aria-hidden="true"><IconOrder /></span>
                <span className="lh-slot-ko">{o.ko}</span>
                <span className="lh-slot-card">
                  {card ? <b>{card.en}</b> : <i>{active ? '이 주문에 올립니다' : '비어 있음'}</i>}
                </span>
              </button>
            );
          })}
        </div>

        {/* 족보표 — 항상 노출. 지금 성립하는 행은 색 + 좌측 바 + 체크 아이콘 3중 인코딩. */}
        <div className="lh-rail" aria-label="묶음 배수표">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = selCards.length === n;
            return (
              <span key={n} className={`lh-rail-item ${on ? 'lh-rail-item--on' : ''}`}>
                {on && <FeedbackIcon kind="correct" size={11} />}
                <b>{n}장</b>
                <i>×{fmtMult(BUNDLE[n])}</i>
              </span>
            );
          })}
        </div>

        {/* 프리뷰 / 결과 — 항상 살아 있다(이전 판에서는 첫 플레이 뒤 영구히 죽었다) */}
        <div className="lh-panel">
          {result ? (
            <div className={`lh-result ${result.ok ? 'lh-result--ok' : 'lh-result--no'}`}>
              <p className="lh-result-h">
                <FeedbackIcon kind={result.ok ? 'correct' : 'near'} size={15} />
                {result.headline}
                {result.ok && <span className="lh-result-eq">{result.chips} × {fmtMult(result.bundle)} × {fmtMult(result.comboMult)} = <b>{result.score.toLocaleString()}</b></span>}
                {!result.ok && result.consolation > 0 && <span className="lh-result-eq">검수관 보전 <b>+{result.consolation.toLocaleString()}</b></span>}
              </p>
              <ul className="lh-result-rows">
                {result.rows.map((r) => (
                  <li key={r.en} className={r.ok ? 'ok' : 'no'}>
                    <FeedbackIcon kind={r.ok ? 'correct' : 'wrong'} size={12} />
                    <b>{r.en}</b>
                    {r.ok ? <span>{r.trueKo}</span> : <span>올린 주문 「{r.guessKo}」 · 실제 뜻 <em>{r.trueKo}</em></span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : selCards.length > 0 ? (
            <p className="lh-prev">
              <b>{preview.label}</b>
              <span className="lh-chips">{preview.chips}</span> ×
              <span className="lh-mult">{fmtMult(preview.bundle)}</span>
              {preview.comboMult > 1 && <> × <span className="lh-cmult">{fmtMult(preview.comboMult)}</span></>}
              = <span className="lh-eq">{preview.score.toLocaleString()}</span>
            </p>
          ) : (
            <p className="lh-prev lh-prev--dim">{note || (arm === 'appraise' ? '감정할 카드를 고르세요' : arm === 'discard' ? '반품할 카드를 고르세요' : '주문을 고르고 손패에서 그 뜻의 단어를 올리세요')}</p>
          )}
        </div>

        {/* 손패 */}
        <div className="lh-hand" aria-label="손패">
          {hand.map((c) => {
            const placed = assignedCardIds.has(c.id);
            return (
              <button
                key={c.id}
                ref={flip.ref(String(c.id))}
                type="button"
                className={`lh-card ${placed ? 'lh-card--on' : ''} ${c.appraised ? 'lh-card--seen' : ''} ${arm ? `lh-card--arm-${arm}` : ''}`}
                onClick={() => tapCard(c)}
                aria-pressed={placed}
                aria-label={
                  arm === 'appraise' ? `${c.en} 감정하기`
                    : arm === 'discard' ? `${c.en} 반품하기`
                      : c.appraised ? `${c.en}, 뜻 ${c.ko}, 칩 ${Math.round(c.chips * APPRAISED_CHIP_RATIO)}${placed ? ', 주문에 올림' : ''}`
                        : `${c.en}, 칩 ${c.chips}${placed ? ', 주문에 올림' : ''}`
                }
              >
                <span className="lh-card-en">{c.en}</span>
                {c.appraised && <span className="lh-card-ko">{c.ko}</span>}
                <span className="lh-card-chip">{c.appraised ? Math.round(c.chips * APPRAISED_CHIP_RATIO) : c.chips}</span>
                {c.appraised && <span className="lh-card-seal" aria-hidden="true"><IconLens /></span>}
              </button>
            );
          })}
        </div>

        {/* 액션 */}
        <div className="lh-actions">
          <button
            type="button"
            className={`gk-btn lh-tool ${arm === 'appraise' ? 'lh-tool--on' : ''}`}
            onClick={() => { clearResult(); setArm((a) => (a === 'appraise' ? null : 'appraise')); }}
            aria-pressed={arm === 'appraise'}
            disabled={appraisals <= 0}
          >
            <IconLens />감정 {appraisals}
          </button>
          <button
            type="button"
            className={`gk-btn lh-tool ${arm === 'discard' ? 'lh-tool--on' : ''}`}
            onClick={() => { clearResult(); setArm((a) => (a === 'discard' ? null : 'discard')); }}
            aria-pressed={arm === 'discard'}
            disabled={discards <= 0}
          >
            <IconBurn />반품 {discards}
          </button>
          <button
            type="button"
            className="gk-btn gk-btn--primary lh-deliver"
            onClick={deliver}
            disabled={selCards.length === 0}
          >
            납품 {selCards.length > 0 ? `${selCards.length}장 · ×${fmtMult(preview.bundle)}` : ''}
          </button>
        </div>

        <button type="button" className="lh-rules-btn" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}>
          {showRules ? '규칙 접기' : '규칙 보기'}
        </button>
        {showRules && (
          <div className="lh-rules" role="note">
            <p>{spec.title} — {spec.note}</p>
            <p>한 장이라도 어긋나면 묶음 전체가 반려되고 검수 1을 잃습니다(납품 기회는 소모하지 않아요). 어긋난 카드는 뜻을 공개하고 손패에서 빠집니다.</p>
            <p>감정한 카드는 칩이 절반이고 복습 기록에 남지 않아요. 반품은 오답이 아니므로 아무것도 기록하지 않습니다.</p>
            {timed && <p>납품 1장당 +{DELIVER_EXTEND_MS / 1000}초, 반려 1회당 −{REJECT_DRAIN_MS / 1000}초.</p>}
          </div>
        )}
      </main>
    </div>
  );
}

const LH_CSS = `
  .lh-root .gk-stat-label { color: color-mix(in srgb, var(--t2) 82%, #fff); }
  /* 킷의 .gk-btn 에는 focus-visible 규칙이 없다 — 4상태(hover/active/focus/disabled) 충족용.
     GameKitStyles 는 문서 뒤에 주입되므로 .lh-root 를 붙여 명시도를 올린다. */
  .lh-root .gk-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  /* 킷 HUD 는 6열 그리드인데 이 게임은 extra + 검수 pip + 콤보 + 음소거 + 나가기 = 7칸을
     쓴다. 그리드로 두면 '나가기'가 두 번째 줄로 떨어진다 — 개수에 무관한 flex 로 바꾼다. */
  .lh-root .gk-hud { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px 12px; }
  .lh-root .gk-hud > .gk-progress-spacer { flex: 1 1 auto; min-width: 8px; }
  .lh-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1; }
  .lh-hud-v { font-family: var(--font-display, system-ui); font-size: 12.5px; font-weight: 800; color: var(--t1); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .lh-root .lh-stage { gap: clamp(8px, 1.5vh, 14px); justify-content: flex-start; align-items: center; padding: clamp(10px, 2vh, 18px) 12px calc(18px + env(safe-area-inset-bottom, 0px)); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
  .lh-root .lh-stage--brief { justify-content: center; }

  /* ── 첫 진입 안내 · 정산 ── */
  .lh-brief, .lh-intro { width: min(560px, 94vw); display: flex; flex-direction: column; gap: 14px; padding: clamp(18px, 3vh, 26px); border-radius: var(--r-lg, 16px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(8px); box-shadow: 0 22px 50px -26px rgba(20,10,6,.6); }
  .lh-intro { flex: none; gap: 11px; padding: clamp(14px, 2.4vh, 20px); }
  .lh-intro-go { align-self: flex-start; min-height: 44px; }
  .lh-brief-kicker { margin: 0; font-family: var(--font-english, monospace); font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--t3); }
  .lh-brief-title { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(19px, 4.4vw, 25px); font-weight: 900; letter-spacing: -.02em; color: var(--t1); line-height: 1.25; }
  .lh-brief-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 9px; }
  .lh-brief-steps li { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.55; color: var(--t2); }
  .lh-brief-steps b { color: var(--t1); }
  .lh-step-n { flex: none; width: 21px; height: 21px; margin-top: 1px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--combo) 16%, transparent); border: 1px solid color-mix(in srgb, var(--combo) 44%, transparent); color: var(--combo); font-size: 11px; font-weight: 900; }
  .lh-brief-note { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; line-height: 1.6; color: var(--t3); }
  .lh-brief-demo { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--t3); padding: 9px 12px; border-radius: 10px; border: 1px dashed var(--bd); }

  .lh-cash { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .lh-cash li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13.5px; color: var(--t2); padding: 5px 0; border-bottom: 1px dashed color-mix(in srgb, var(--t1) 12%, transparent); }
  .lh-cash b { font-variant-numeric: tabular-nums; font-weight: 800; color: var(--t1); }
  .lh-cash-sum { border-bottom: none; padding-top: 8px; }
  .lh-cash-sum b { color: var(--combo); font-size: 20px; }
  .lh-draft-h { margin-top: 4px; }
  .lh-draft { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 9px; }
  .lh-draft-card { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-height: 96px; padding: 12px; border-radius: var(--r-md, 12px); border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 90%, #fff); color: var(--t1); text-align: left; cursor: pointer; transition: transform .16s var(--ease-spring, ease-out), border-color .15s, box-shadow .15s; }
  .lh-draft-card:hover { border-color: var(--combo); transform: translateY(-3px); box-shadow: 0 12px 26px -12px color-mix(in srgb, var(--combo) 55%, transparent); }
  .lh-draft-card:active { transform: translateY(0) scale(.98); }
  .lh-draft-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .lh-draft-card b { font-size: 14px; font-weight: 900; }
  .lh-draft-ic { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border-radius: 9px; background: color-mix(in srgb, var(--combo) 14%, transparent); color: var(--combo); }
  .lh-draft-desc { font-size: 11.5px; line-height: 1.45; color: var(--t3); }
  .lh-skip { align-self: flex-start; }

  /* ── 조커 rail ── */
  .lh-jokers { display: flex; gap: 7px; flex-wrap: wrap; justify-content: center; width: min(700px, 96vw); }
  .lh-joker-wrap { position: relative; }
  .lh-joker { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 6px 14px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--combo) 40%, var(--bd)); background: color-mix(in srgb, var(--bg) 72%, transparent); color: var(--t1); font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; cursor: pointer; backdrop-filter: blur(4px); transition: border-color .15s, transform .12s, color .15s; }
  .lh-joker:hover { border-color: var(--combo); color: var(--combo); }
  .lh-joker:active { transform: scale(.96); }
  .lh-joker:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .lh-joker-pop { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 5; width: max-content; max-width: 220px; padding: 7px 11px; border-radius: 9px; border: 1px solid var(--bd); background: var(--bg); color: var(--t2); font-size: 11.5px; line-height: 1.45; box-shadow: 0 12px 26px -12px rgba(0,0,0,.5); }

  /* ── 목표 ── */
  .lh-goal { display: flex; flex-direction: column; align-items: center; gap: 4px; width: min(430px, 94vw); }
  .lh-timer { width: 100%; margin-bottom: 2px; }
  .lh-goal-row { display: flex; align-items: baseline; gap: 8px; }
  .lh-goal-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); }
  .lh-goal-target { font-family: var(--font-display, system-ui); font-size: 15px; font-weight: 800; color: var(--t1); font-variant-numeric: tabular-nums; }
  .lh-bar { width: 100%; height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 12%, transparent); overflow: hidden; }
  .lh-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--combo), var(--success)); transition: width .5s var(--ease, cubic-bezier(.3,.7,.3,1)); }
  .lh-score-row { position: relative; display: grid; place-items: center; }
  .lh-score { font-family: var(--font-display, system-ui); font-size: clamp(26px, 5.6vw, 38px); font-weight: 900; color: var(--t1); font-variant-numeric: tabular-nums; line-height: 1.05; }
  .lh-burst { position: absolute; inset: 0; pointer-events: none; }
  .lh-need { margin: 0; font-size: 11.5px; color: var(--t3); font-variant-numeric: tabular-nums; text-align: center; }
  .lh-need b { color: var(--t2); font-weight: 800; }

  /* ── 주문판 ── */
  .lh-orders { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 7px; width: min(700px, 96vw); }
  .lh-slot { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; min-height: 52px; padding: 9px 12px; border-radius: var(--r-md, 11px); border: 1.5px dashed color-mix(in srgb, var(--t1) 26%, transparent); background: color-mix(in srgb, var(--bg) 74%, transparent); color: var(--t1); text-align: left; cursor: pointer; backdrop-filter: blur(3px); transition: border-color .15s, background .15s, transform .12s var(--ease-spring, ease-out), box-shadow .15s; }
  .lh-slot:hover { border-color: var(--combo); }
  .lh-slot:active { transform: scale(.985); }
  .lh-slot:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .lh-slot-ic { display: inline-flex; color: var(--t3); }
  .lh-slot-ko { font-size: 14px; font-weight: 700; line-height: 1.25; }
  .lh-slot-card { justify-self: end; font-family: var(--font-english, system-ui); font-size: 13px; text-align: right; }
  .lh-slot-card i { font-family: var(--font-body, Georgia, serif); font-size: 11.5px; color: var(--t4, var(--t3)); opacity: .8; }
  .lh-slot--active { border-style: solid; border-color: var(--combo); background: color-mix(in srgb, var(--combo) 9%, color-mix(in srgb, var(--bg) 74%, transparent)); }
  .lh-slot--active .lh-slot-ic { color: var(--combo); }
  .lh-slot--filled { border-style: solid; border-color: color-mix(in srgb, var(--streak, var(--combo)) 60%, var(--bd)); background: color-mix(in srgb, var(--bg) 92%, #fff); }
  .lh-slot--filled .lh-slot-card b { color: var(--streak, var(--combo)); font-weight: 900; }

  /* ── 묶음 배수표 ── */
  .lh-rail { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; width: min(700px, 96vw); }
  .lh-rail-item { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px 4px 7px; border-radius: 999px; border: 1px solid var(--bd); border-left: 3px solid transparent; background: color-mix(in srgb, var(--bg) 60%, transparent); color: var(--t3); font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .lh-rail-item b { color: var(--t2); font-weight: 800; }
  .lh-rail-item i { font-style: normal; }
  .lh-rail-item--on { border-color: var(--combo); border-left-color: var(--combo); background: color-mix(in srgb, var(--combo) 14%, transparent); color: var(--combo); }
  .lh-rail-item--on b, .lh-rail-item--on i { color: var(--combo); }

  /* ── 프리뷰 / 결과 ── */
  .lh-panel { width: min(700px, 96vw); min-height: 46px; display: grid; place-items: center; }
  .lh-prev { margin: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; font-size: 14px; font-weight: 700; color: var(--t2); font-variant-numeric: tabular-nums; }
  .lh-prev b { color: var(--t1); }
  .lh-prev--dim { color: var(--t3); font-style: italic; font-weight: 500; text-align: center; }
  .lh-chips { color: var(--combo); font-weight: 900; }
  .lh-mult { color: var(--streak, var(--combo)); font-weight: 900; }
  .lh-cmult { color: var(--active, var(--combo)); font-weight: 900; }
  .lh-eq { color: var(--success); font-weight: 900; font-size: 17px; }

  .lh-result { width: 100%; padding: 10px 13px; border-radius: var(--r-md, 12px); border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 88%, transparent); animation: gk-pop .32s var(--ease, ease-out); }
  .lh-result--ok { border-color: color-mix(in srgb, var(--success) 60%, var(--bd)); }
  .lh-result--no { border-color: color-mix(in srgb, var(--streak, var(--combo)) 55%, var(--bd)); }
  .lh-result-h { margin: 0 0 7px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 13px; font-weight: 800; color: var(--t1); }
  .lh-result--ok .lh-result-h { color: var(--success); }
  .lh-result--no .lh-result-h { color: var(--streak, var(--combo)); }
  .lh-result-eq { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--t2); font-weight: 700; }
  .lh-result-eq b { color: var(--t1); font-size: 15px; }
  .lh-result-rows { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .lh-result-rows li { display: flex; align-items: baseline; gap: 7px; font-size: 12.5px; line-height: 1.5; color: var(--t2); }
  .lh-result-rows li.ok { color: var(--t2); }
  .lh-result-rows li.no { color: var(--t2); }
  .lh-result-rows li.ok > .gk-fbicon { color: var(--success); }
  .lh-result-rows li.no > .gk-fbicon { color: var(--streak, var(--combo)); }
  .lh-result-rows b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }
  .lh-result-rows em { font-style: normal; font-weight: 800; color: var(--t1); }

  /* ── 손패 ── */
  .lh-hand { display: flex; gap: clamp(5px, 1.1vw, 9px); justify-content: center; flex-wrap: wrap; width: min(760px, 98vw); }
  .lh-card { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: clamp(76px, 21.5vw, 100px); min-height: 62px; padding: 10px 6px; border-radius: 11px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 90%, #fff); color: var(--t1); cursor: pointer; transition: transform .14s var(--ease-spring, ease-out), box-shadow .15s, border-color .15s, opacity .15s; }
  .lh-card:hover { transform: translateY(-4px); border-color: var(--combo); box-shadow: 0 10px 22px -10px rgba(30,16,10,.55); }
  .lh-card:active { transform: translateY(-2px) scale(.97); }
  .lh-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .lh-card--on { transform: translateY(-8px); border-color: var(--streak, var(--combo)); box-shadow: 0 0 0 2px var(--streak, var(--combo)), 0 14px 26px -10px color-mix(in srgb, var(--streak, var(--combo)) 45%, transparent); }
  .lh-card--on:hover { border-color: var(--streak, var(--combo)); }
  .lh-card--seen { border-style: dashed; background: color-mix(in srgb, var(--bg) 70%, transparent); }
  .lh-card--arm-appraise { border-color: color-mix(in srgb, var(--active, var(--combo)) 55%, var(--bd)); }
  .lh-card--arm-discard { border-color: color-mix(in srgb, var(--streak, var(--combo)) 55%, var(--bd)); }
  .lh-card-en { font-family: var(--font-english, system-ui); font-size: clamp(12px, 2.3vw, 14px); font-weight: 800; line-height: 1.1; text-align: center; overflow-wrap: anywhere; }
  .lh-card-ko { font-size: 10px; color: var(--t3); text-align: center; line-height: 1.15; }
  .lh-card-chip { font-family: var(--font-english, monospace); font-size: 9.5px; font-weight: 800; color: var(--combo); letter-spacing: .04em; }
  .lh-card-seal { position: absolute; top: 4px; right: 4px; color: var(--t4, var(--t3)); opacity: .7; display: inline-flex; }

  /* ── 액션 ── */
  .lh-actions { position: sticky; bottom: 0; z-index: 3; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; padding: 8px 0 calc(4px + env(safe-area-inset-bottom, 0px)); width: min(700px, 96vw); background: linear-gradient(to top, color-mix(in srgb, var(--bg2) 88%, transparent) 55%, transparent); }
  .lh-tool { min-height: 46px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(5px); }
  .lh-tool--on { border-color: var(--combo); color: var(--combo); box-shadow: 0 0 0 2px color-mix(in srgb, var(--combo) 26%, transparent); }
  .lh-deliver { min-height: 46px; min-width: 168px; font-variant-numeric: tabular-nums; }

  .lh-rules-btn { min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--bd); background: transparent; color: var(--t3); font-family: var(--font-display, system-ui); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: color .15s, border-color .15s; }
  .lh-rules-btn:hover { color: var(--t1); border-color: var(--t3); }
  .lh-rules-btn:active { transform: scale(.97); }
  .lh-rules-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .lh-rules { width: min(560px, 94vw); padding: 11px 14px; border-radius: var(--r-md, 12px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 84%, transparent); }
  .lh-rules p { margin: 0 0 6px; font-size: 12px; line-height: 1.6; color: var(--t2); }
  .lh-rules p:last-child { margin-bottom: 0; }

  /* ── 끝화면 보조 ── */
  .lh-reveal-h { margin: 0 0 8px; font-size: 12.5px; font-weight: 800; color: var(--t1); }
  .lh-reveal-list { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px 14px; }
  .lh-reveal-list li { display: flex; gap: 8px; align-items: baseline; font-size: 13px; }
  .lh-reveal-list b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }
  .lh-reveal-list span { color: var(--t3); }
  .lh-foot-joker { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--bd); color: var(--t2); font-size: 12px; font-weight: 700; }

  @media (max-width: 420px) {
    .lh-slot { grid-template-columns: auto 1fr; grid-template-areas: 'ic ko' 'ic card'; row-gap: 2px; }
    .lh-slot-ic { grid-area: ic; }
    .lh-slot-ko { grid-area: ko; }
    .lh-slot-card { grid-area: card; justify-self: start; text-align: left; }
    /* 좌하단 고정 배경음 버튼(44px)이 액션 바를 덮지 않도록 왼쪽을 비운다. */
    .lh-actions { flex-wrap: nowrap; gap: 6px; padding-left: 50px; }
    .lh-tool { padding: 0 9px; font-size: 12px; }
    .lh-deliver { flex: 1 1 auto; min-width: 0; padding: 0 10px; font-size: 13px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lh-card, .lh-slot, .lh-bar-fill, .lh-draft-card { transition: none; }
    .lh-result { animation: none; }
  }
`;
