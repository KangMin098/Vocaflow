// apps/web/src/components/game/word-economy/WordEconomyGame.tsx
// Word Economy — "단어 거래소". blitz 계열 중 **유일하게 시계가 없는** 모드로 재설계(v07.9).
//
// 왜 바꿨나 (감사 25/50):
//   구판은 상점이 자기 효용을 0으로 광고하고(desc(lvl)) 콤보 보너스가 Lv.0 에서 수학적으로
//   무효라, 경제 레이어가 끝까지 켜지지 않은 채 75초짜리 평탄한 4지선다로 끝났다.
//   게다가 다른 blitz 3종(wordblitz·daily-blitz·ghost-race)과 루프가 똑같았다.
//
// 무엇이 달라졌나 — 계열 안에서의 차별 축:
//   · daily-blitz 는 **시계**가 화폐다. word-economy 는 **자본**이 화폐다.
//     세션 길이를 초가 아니라 **틱(20 거래)** 으로 센다. 벽시계가 아예 없다.
//     조이는 것은 시간이 아니라 **틱마다 오르는 운영비**(5 → 12 → 36)다.
//   · 긴장 곡선 = 운영비 상승 × 호가창 수축(7.0s → 3.6s) 두 곡선의 수렴.
//     후반에는 기본 배당만으로 적자다 — 콤보와 지분 없이는 자산이 줄어든다.
//   · 이 모드에만 있는 결정 두 가지:
//       (1) **관망** — 모르면 넘긴다. 운영비 절반, 콤보 동결, 손실 0, 정답은 공개.
//           콤보 15를 지키려고 적자를 감수할 것인가, 지를 것인가.
//       (2) **지분** — 방금 맞힌 단어에 자본을 싣는다. 그 단어가 다시 나오면 배당 ×2.2(→×3.6),
//           대신 그때 틀리면 지분이 소멸한다. 자기 확신(메타인지)에 값을 매기는 결정.
//   · **재상장 ×1.5** — 관망하거나 틀린 단어는 몇 틱 뒤 반드시 다시 상장되고,
//     그때 맞히면 프리미엄을 얹어준다. 경제가 "세션 안에서 배운 것"에 직접 돈을 지불한다.
//     (구판은 놓친 단어가 영영 다시 안 나와 학습 루프가 열린 채였다.)
//
// 인출 규칙(비타협) 준수:
//   · 제출 전 화면에는 한국어 뜻과 선택지뿐 — 정답을 특정할 정보 없음.
//   · 부분 정답 오라클 없음. 힌트 구매(50:50) 는 **삭제**했다 — 힌트로 산 정답이
//     onCorrect·콤보·FSRS 로 위조되던 경로를 없앤 것이다.
//   · 지분 보유 목록은 단어를 인쇄하지 않는다(슬롯 수·배수만). 정답 공개는 제출 후에만,
//     대신 그때는 철자·뜻·발음·예문을 전부 보여준다.
//   · wordPool 이 오면 반드시 그 단어로 돈다. 내장 뱅크는 undefined 일 때만 폴백.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, FeedbackIcon, Kbd,
  useSfx, useCountUp, useCombo, usePersonalBest, shuffle, pickDistinct, clamp,
  GameMusic, type Word, type ComboTier,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점', example: 'Speed gives us a real advantage here.' },
  { en: 'reserved', ko: '내성적인', example: 'He is reserved, but warm once you know him.' },
  { en: 'inclined', ko: '경향이 있는', example: 'She is inclined to agree with you.' },
  { en: 'consequence', ko: '결과, 영향', example: 'Every choice has a consequence.' },
  { en: 'judgment', ko: '판단', example: 'Trust your own judgment this time.' },
  { en: 'mistake', ko: '실수', example: 'It was an honest mistake.' },
  { en: 'ability', ko: '능력', example: 'She has the ability to lead.' },
  { en: 'balance', ko: '균형', example: 'Keep your balance on the narrow path.' },
  { en: 'courage', ko: '용기', example: 'It took courage to speak up.' },
  { en: 'develop', ko: '발전시키다', example: 'They develop new tools every year.' },
  { en: 'reduce', ko: '줄이다', example: 'We must reduce the cost.' },
  { en: 'sudden', ko: '갑작스러운', example: 'A sudden noise woke the house.' },
];

// ─── 시장 상수 ────────────────────────────────────────────────────────────
const TICKS = 20;              // 오늘의 장 = 20 거래. 세션 길이는 초가 아니라 틱으로 센다.
const START_CAPITAL = 60;
const BASE_PAYOUT = 12;
const WIN_START = 7000;        // 1틱 호가창
const WIN_END = 3600;          // 20틱 호가창 — 세션이 갈수록 조인다
const HOLD_SLOTS = 3;
const HOLD_COST_1 = 40;
const HOLD_COST_2 = 60;        // 추가 매입 — 원금 누계 100
const HOLD_MULT_1 = 2.2;
const HOLD_MULT_2 = 3.6;
const RELIST_MULT = 1.5;
const WRONG_UPKEEP_RATIO = 1.5;  // 오답이면 운영비가 1.5배 청구된다
const PASS_UPKEEP_RATIO = 0.5;   // 관망은 절반 — "모르면 넘겨도 된다"를 규칙으로

const COMBO_TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 3, mult: 1.4, label: '순항' },
  { at: 6, mult: 1.9, label: '강세' },
  { at: 10, mult: 2.6, label: '급등' },
  { at: 15, mult: 3.4, label: '폭등' },
];

const ACT_NAME = ['', '개장', '활황', '마감장'] as const;

function actOf(tick: number) { return tick <= 7 ? 1 : tick <= 14 ? 2 : 3; }
function upkeepOf(tick: number) {
  const a = actOf(tick);
  return a === 1 ? 5 : a === 2 ? 12 : 36; // 3막은 운영비도 배당도 두 배 국면
}
function isClosing(tick: number) { return actOf(tick) === 3; }
function winOf(tick: number) {
  return Math.round(WIN_START + ((WIN_END - WIN_START) * (tick - 1)) / (TICKS - 1));
}
function multFor(combo: number) {
  let m = 1;
  for (const t of COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}
function holdMultFor(lvl: number) { return lvl >= 2 ? HOLD_MULT_2 : lvl === 1 ? HOLD_MULT_1 : 1; }
function holdPrincipal(lvl: number) { return lvl >= 2 ? HOLD_COST_1 + HOLD_COST_2 : lvl === 1 ? HOLD_COST_1 : 0; }
function speedFactor(frac: number) { return 0.6 + 0.8 * clamp(frac, 0, 1); }

/** 철자 근접도 — 판돈 큰 문항(지분·재상장)의 오답을 형태 혼동으로 올려 난이도를 판돈에 묶는다. */
function similarity(a: string, b: string) {
  const x = a.toLowerCase(); const y = b.toLowerCase();
  let p = 0; while (p < x.length && p < y.length && x[p] === y[p]) p += 1;
  let s = 0; while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s += 1;
  return p * 2.2 + s * 1.6 - Math.abs(x.length - y.length) * 0.5;
}

interface Holding { en: string; lvl: number }
/** 재상장 큐 — 놓친 종목(relist)과 지분을 실은 종목(hold)은 반드시 다시 상장된다. */
interface Listing { en: string; at: number; kind: 'relist' | 'hold' }
interface Quote {
  key: number; tick: number; target: Word; options: Word[];
  relist: boolean; holdLvl: number; win: number; upkeep: number; closing: boolean;
}
type Outcome = 'correct' | 'wrong' | 'pass';

// ─── 호가 게이지 ──────────────────────────────────────────────────────────
// 구판은 speed 보너스를 계산만 하고 화면 어디에도 표시하지 않아 "빨리 답하면 돈이 된다"를
// 학습자가 알 방법이 없었다. 바는 CSS 애니메이션 1회(리렌더 0), 숫자만 160ms 로 갱신하며
// **이 컴포넌트 안에서만** 다시 그려진다 — 부모(게임 트리)는 문항 중 한 번도 리렌더되지 않는다.
const QuoteGauge = memo(function QuoteGauge({ win, mult }: { win: number; mult: number }) {
  const [gain, setGain] = useState(() => Math.round(BASE_PAYOUT * speedFactor(1) * mult));
  useEffect(() => {
    const t0 = Date.now();
    const compute = () => setGain(Math.round(BASE_PAYOUT * speedFactor(1 - (Date.now() - t0) / win) * mult));
    compute();
    const id = window.setInterval(compute, 160);
    return () => window.clearInterval(id);
  }, [win, mult]);
  return (
    <div className="we-quote">
      <div className="we-quote-track" aria-hidden="true">
        <span className="we-quote-fill" style={{ animationDuration: `${win}ms` }} />
      </div>
      <span className="we-quote-val">배당 🪙 {gain}</span>
    </div>
  );
});

export function WordEconomyGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const pool = useMemo(() => {
    const p = wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL;
    const seen = new Set<string>();
    return p.filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);
  const tileCount = Math.min(4, Math.max(2, pool.length));
  const sfx = useSfx();

  const [balance, setBalance] = useState(START_CAPITAL);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [tick, setTick] = useState(1);
  const [q, setQ] = useState<Quote | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [delta, setDelta] = useState(0);
  const [bought, setBought] = useState(false);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [bust, setBust] = useState(false);
  const [flash, setFlash] = useState('');
  const [say, setSay] = useState('');
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [trades, setTrades] = useState(0);
  const [wins, setWins] = useState(0);
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; now: number; improved: boolean } | null>(null);

  const balanceRef = useRef(START_CAPITAL);
  const holdingsRef = useRef<Holding[]>([]);
  const listingRef = useRef<Listing[]>([]);
  const openRef = useRef<Map<string, boolean>>(new Map()); // 단어별 마지막 인출 결과(끝화면 복습용)
  const lastEnRef = useRef('');
  const keyRef = useRef(0);
  const qStartRef = useRef(0);
  const lockRef = useRef(false);
  const revealT = useRef(0);
  const expiryT = useRef(0);
  const flashT = useRef(0);
  const mounted = useRef(true);
  const submitted = useRef(false);
  const tierUp = useRef<ComboTier | null>(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(revealT.current);
    window.clearTimeout(expiryT.current);
  }, []);

  // 인라인 알림 — 모달로 학습을 끊지 않는다. 비난조 없이 "무엇을 잃었는지"만.
  const note = useCallback((msg: string) => {
    setFlash(msg);
    window.clearTimeout(flashT.current);
    flashT.current = window.setTimeout(() => { if (mounted.current) setFlash(''); }, 1100);
  }, []);

  const combo = useCombo({
    tiers: COMBO_TIERS,
    onTierUp: (t) => { tierUp.current = t; },
    onBreak: (lost) => { note(`🔥 ${lost} 유실 — 배당 배수가 초기화됐어요`); },
  });

  const personal = usePersonalBest('word-economy');
  const shownBalance = useCountUp(balance);

  // ─── 상장 종목 결정 ─────────────────────────────────────────────────────
  const buildQuote = useCallback((t: number): Quote => {
    const holds = holdingsRef.current;
    const last = lastEnRef.current;
    let target: Word | undefined;
    let relist = false;

    // 1) 예약 상장 우선 — 관망·오답한 종목(relist)과 지분을 실은 종목(hold)은 반드시 돌아온다.
    //    relist 만 ×1.5 프리미엄 — "세션 안에서 배운 것"에 경제가 직접 값을 치른다.
    const dueIdx = listingRef.current.findIndex((r) => r.at <= t && r.en !== last);
    if (dueIdx >= 0) {
      const [due] = listingRef.current.splice(dueIdx, 1);
      target = pool.find((w) => w.en === due.en);
      relist = !!target && due.kind === 'relist';
    }
    // 2) 보유 지분 — 자본을 실은 종목이 돌아와야 지분이 판돈이 된다.
    if (!target && holds.length > 0 && Math.random() < 0.42) {
      const cands = holds.filter((h) => h.en !== last);
      if (cands.length > 0) target = pool.find((w) => w.en === cands[Math.floor(Math.random() * cands.length)].en);
    }
    // 3) 일반 상장
    if (!target) {
      const cands = pool.filter((w) => w.en !== last);
      const src = cands.length > 0 ? cands : pool;
      target = src[Math.floor(Math.random() * src.length)];
    }

    const tgt: Word = target;
    const holdLvl = holds.find((h) => h.en === tgt.en)?.lvl ?? 0;
    // 같은 뜻(ko)의 동의어를 오답으로 쓰면 정답인데 오답 처리된다 — 반드시 제외.
    const others = pool.filter((w) => w.en !== tgt.en && w.ko !== tgt.ko);
    const need = Math.max(1, tileCount - 1);
    let distract: Word[];
    if (relist || holdLvl > 0) {
      // 판돈이 큰 문항일수록 오답이 철자로 닮는다 — 난이도를 판돈에 묶는 desirable difficulty.
      const near = [...others].sort((a, b) => similarity(b.en, tgt.en) - similarity(a.en, tgt.en));
      distract = shuffle(near.slice(0, Math.min(near.length, need + 2))).slice(0, need);
    } else {
      distract = pickDistinct(pool, need, (w) => w.en === tgt.en || w.ko === tgt.ko);
    }

    keyRef.current += 1;
    lastEnRef.current = tgt.en;
    return {
      key: keyRef.current, tick: t, target: tgt, options: shuffle([tgt, ...distract]),
      relist, holdLvl, win: winOf(t), upkeep: upkeepOf(t), closing: isClosing(t),
    };
  }, [pool, tileCount]);

  const settleRef = useRef<(kind: Outcome, idx: number | null) => void>(() => {});

  const openQuote = useCallback((t: number) => {
    const nq = buildQuote(t);
    setQ(nq); setPicked(null); setOutcome(null); setDelta(0); setBought(false);
    lockRef.current = false;
    qStartRef.current = Date.now();
    window.clearTimeout(expiryT.current);
    // 호가창이 닫히면 자동 관망 — 문항이 영원히 열려 있지 않게 하되, 벌이 아니라 "기회 종료".
    expiryT.current = window.setTimeout(() => { if (mounted.current) settleRef.current('pass', null); }, nq.win);
  }, [buildQuote]);

  const finish = useCallback((busted: boolean) => {
    clearTimers();
    const asset = balanceRef.current + holdingsRef.current.reduce((s, h) => s + holdPrincipal(h.lvl), 0);
    if (!submitted.current) {
      submitted.current = true;
      const r = personal.submit(asset);
      setBestInfo({ prev: r.prev, now: asset, improved: r.improved });
    }
    setBust(busted);
    setPhase('done');
    // 파산으로 닫힌 장에는 팡파르를 울리지 않는다(Empathetic Feedback).
    if (!busted) sfx.fanfare();
  }, [clearTimers, personal, sfx]);

  const start = useCallback(() => {
    clearTimers();
    submitted.current = false;
    balanceRef.current = START_CAPITAL; setBalance(START_CAPITAL);
    holdingsRef.current = []; setHoldings([]);
    listingRef.current = []; openRef.current = new Map(); lastEnRef.current = '';
    setTick(1);
    combo.reset();
    setPayoutTotal(0); setTrades(0); setWins(0);
    setBust(false); setBestInfo(null); setFlash(''); setSay('');
    setPhase('playing');
    openQuote(1);
  }, [clearTimers, combo, openQuote]);

  useEffect(() => {
    mounted.current = true;
    start();
    return () => {
      mounted.current = false;
      clearTimers();
      window.clearTimeout(flashT.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 정산 ───────────────────────────────────────────────────────────────
  const settle = useCallback((kind: Outcome, idx: number | null) => {
    if (phase !== 'playing' || !q || lockRef.current) return;
    lockRef.current = true;
    window.clearTimeout(expiryT.current);

    const t = q.tick;
    let holds = holdingsRef.current;
    let gain = 0;
    let cost = 0;
    let line = '';

    if (kind === 'correct') {
      const frac = clamp(1 - (Date.now() - qStartRef.current) / q.win, 0, 1);
      const nc = combo.hit();
      gain = Math.round(
        BASE_PAYOUT * speedFactor(frac) * multFor(nc) * holdMultFor(q.holdLvl)
        * (q.relist ? RELIST_MULT : 1) * (q.closing ? 2 : 1),
      );
      cost = q.upkeep;
      setPayoutTotal((v) => v + gain);
      setWins((v) => v + 1);
      openRef.current.set(q.target.en, true);
      sfx.coin();
      sfx.correct(nc, !!tierUp.current);
      if (tierUp.current) {
        const lbl = tierUp.current.label;
        if (lbl) note(`${lbl} · 배당 ×${tierUp.current.mult}`);
        tierUp.current = null;
      }
      line = `정답 ${q.target.en} · 배당 ${gain}코인, 운영비 ${cost}코인`;
      onCorrect?.(q.target);
    } else if (kind === 'wrong') {
      combo.miss();
      cost = Math.round(q.upkeep * WRONG_UPKEEP_RATIO);
      openRef.current.set(q.target.en, false);
      listingRef.current.push({ en: q.target.en, at: t + 3, kind: 'relist' });
      if (q.holdLvl > 0) {
        holds = holds.filter((h) => h.en !== q.target.en);
        note('지분 소멸 — 보유 종목을 놓쳤어요');
      }
      sfx.wrong();
      line = `오답 · 정답은 ${q.target.en}, ${q.target.ko}. 운영비 ${cost}코인`;
      onWrong?.(q.target);
    } else {
      // 관망 — 콤보는 동결(끊기지 않는다), 비용은 절반, 정답은 공개한다.
      cost = Math.round(q.upkeep * PASS_UPKEEP_RATIO);
      openRef.current.set(q.target.en, false);
      listingRef.current.push({ en: q.target.en, at: t + 2, kind: 'relist' });
      sfx.nearMiss();
      line = `관망 · 정답은 ${q.target.en}, ${q.target.ko}. 운영비 ${cost}코인`;
      onWrong?.(q.target);
    }

    let next = balanceRef.current + gain - cost;
    let busted = false;
    if (next < 0) {
      // 마진콜 — 즉사가 아니라 강제 청산 한 번. 청산할 지분도 없으면 그때 장이 닫힌다.
      if (holds.length > 0) {
        const sold = holds[0];
        holds = holds.slice(1);
        next = Math.max(0, next + Math.round(holdPrincipal(sold.lvl) * 0.5));
        note('마진콜 · 지분 1개가 강제 청산됐어요');
      } else if (t >= 8) {
        next = 0;
        busted = true;
      } else {
        // 초반 파산은 막는다 — 5틱 만에 끝나는 세션은 벌이지 배움이 아니다.
        // 자본은 0 에서 멎고 장은 계속된다(관망은 늘 살아 있는 선택지다).
        next = 0;
        note('자본이 바닥났어요 — 관망으로 비용을 줄이며 회복해 보세요');
      }
    }

    holdingsRef.current = holds; setHoldings(holds);
    balanceRef.current = next; setBalance(next);
    setDelta(gain - cost);
    setPicked(idx); setOutcome(kind);
    setTrades((v) => v + 1);
    setSay(line);

    const canOffer = kind === 'correct'
      && q.holdLvl < 2
      && (q.holdLvl > 0 || holds.length < HOLD_SLOTS)
      && next >= (q.holdLvl > 0 ? HOLD_COST_2 : HOLD_COST_1);
    const dwell = kind === 'correct' ? (canOffer ? 2200 : 1400) : 2600;

    revealT.current = window.setTimeout(() => {
      if (!mounted.current) return;
      if (busted || t >= TICKS) { finish(busted); return; }
      const nt = t + 1;
      setTick(nt);
      openQuote(nt);
    }, dwell);
  }, [phase, q, combo, sfx, note, onCorrect, onWrong, finish, openQuote]);
  settleRef.current = settle;

  const pick = useCallback((i: number) => {
    if (!q || lockRef.current) return;
    settle(q.options[i].en === q.target.en ? 'correct' : 'wrong', i);
  }, [q, settle]);

  const buyHold = useCallback(() => {
    if (!q || outcome !== 'correct' || bought) return;
    const lvl = q.holdLvl;
    if (lvl >= 2) return;
    const price = lvl > 0 ? HOLD_COST_2 : HOLD_COST_1;
    if (balanceRef.current < price) { note('자본이 부족해요'); return; }
    if (lvl === 0 && holdingsRef.current.length >= HOLD_SLOTS) { note('지분 슬롯이 가득 찼어요'); return; }
    const next = balanceRef.current - price;
    balanceRef.current = next; setBalance(next);
    const holds = lvl > 0
      ? holdingsRef.current.map((h) => (h.en === q.target.en ? { ...h, lvl: 2 } : h))
      : [...holdingsRef.current, { en: q.target.en, lvl: 1 }];
    holdingsRef.current = holds; setHoldings(holds);
    // 지분을 실은 종목은 곧 되돌아온다 — 판돈이 실제로 굴러가야 결정이 의미를 갖는다.
    listingRef.current.push({ en: q.target.en, at: q.tick + 2, kind: 'hold' });
    setBought(true);
    sfx.click();
    note(lvl > 0 ? `지분 추가 매입 · 배당 ×${HOLD_MULT_2}` : `지분 매입 · 배당 ×${HOLD_MULT_1}`);
  }, [q, outcome, bought, note, sfx]);

  // ─── 키보드 (1~4 매수 · 0/P 관망) ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!q || lockRef.current) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= q.options.length) { e.preventDefault(); pick(n - 1); return; }
      if (e.key === '0' || e.key.toLowerCase() === 'p') { e.preventDefault(); settle('pass', null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, pick, settle]);

  const handleExit = useCallback(() => { clearTimers(); onExit?.(); }, [clearTimers, onExit]);

  const reveal = outcome !== null;
  const projMult = q
    ? multFor(combo.combo + 1) * holdMultFor(q.holdLvl) * (q.relist ? RELIST_MULT : 1) * (q.closing ? 2 : 1)
    : 1;
  const holdPrice = q && q.holdLvl > 0 ? HOLD_COST_2 : HOLD_COST_1;
  // 매입 후에도 버튼을 자리에 남긴다 — 슬롯이 차서 조건이 무너져도 리빌 중 레이아웃이 흔들리지 않게.
  const holdOffer = !!q && outcome === 'correct' && q.holdLvl < 2
    && (bought || ((q.holdLvl > 0 || holdings.length < HOLD_SLOTS) && balance >= holdPrice));
  const missedWords = useMemo(() => {
    if (phase !== 'done') return [];
    const out: Word[] = [];
    openRef.current.forEach((ok, en) => {
      if (!ok) { const w = pool.find((x) => x.en === en); if (w) out.push(w); }
    });
    return out.slice(0, 6);
  }, [phase, pool]);
  const finalAsset = balance + holdings.reduce((s, h) => s + holdPrincipal(h.lvl), 0);

  return (
    <div className="gk-root we-root" data-act={q ? actOf(q.tick) : 1}>
      <GameMusic gameId="word-economy" />
      <GameKitStyles />
      <AmbientBackground center="#FBF2DE" mid="#EAD39F" edge="#6C481D" glow="rgba(255,206,112,.34)" glowAt="50% 24%" watermark="word-economy" />
      <style dangerouslySetInnerHTML={{ __html: WE_CSS }} />
      <Hud
        progress={phase === 'playing' ? (tick - 1) / TICKS : 1}
        combo={combo.combo}
        comboMult={multFor(combo.combo)}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="we-hud-extra">
            <div className="we-coins">
              <span className="gk-stat-label">자본</span>
              <span key={balance} className="we-coin-val gk-bump">🪙 {shownBalance.toLocaleString()}</span>
            </div>
            <div className="we-slots" role="img" aria-label={`지분 ${holdings.length}/${HOLD_SLOTS}`}>
              {Array.from({ length: HOLD_SLOTS }, (_, i) => {
                const h = holdings[i];
                return <span key={i} className="we-slot" data-lvl={h ? h.lvl : 0} aria-hidden="true">{h ? (h.lvl >= 2 ? '◆' : '◇') : '·'}</span>;
              })}
            </div>
          </div>
        }
      />
      <div className="gk-sr" aria-live="polite">{say}</div>
      <div className="gk-sr" aria-live="polite">{flash}</div>

      {phase === 'done' ? (
        <GameDone
          mark="word-economy"
          lead={bust ? '오늘 장은 여기까지였어요' : '장 마감했어요'}
          celebrate={!bust && !!bestInfo?.improved}
          badge={
            bestInfo?.improved ? '개인 최고 자산 갱신'
              : !bust && combo.best >= 10 ? `연속 ${combo.best} 거래 성사`
                : undefined
          }
          reveal={
            missedWords.length > 0 ? (
              <div className="we-review">
                <p className="we-review-h">다시 볼 종목</p>
                <ul className="we-review-list">
                  {missedWords.map((w) => (
                    <li key={w.en}><b>{w.en}</b><span>{w.ko}</span></li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          stats={[
            { num: `🪙 ${finalAsset.toLocaleString()}`, label: '최종 자산', accent: true },
            { num: payoutTotal.toLocaleString(), label: '배당 수익' },
            { num: `${wins}/${trades}`, label: '체결/거래' },
            { num: `🔥 ${combo.best}`, label: '최고 연속' },
          ]}
          best={bestInfo ? { prev: bestInfo.prev, now: bestInfo.now, label: '자산', improved: bestInfo.improved } : undefined}
          restartHint={
            bust
              ? '모르는 종목은 관망하면 운영비가 절반이에요. 아는 종목에만 지분을 실어 보세요.'
              : holdings.length === 0
                ? '지분을 한 번도 사지 않았어요. 확신이 드는 종목에 실으면 배당이 ×2.2 부터 시작해요.'
                : '마감장(15틱~)은 배당도 운영비도 두 배예요. 그때 연속을 살려 두면 자산이 크게 붙어요.'
          }
          onRestart={start}
          onExit={handleExit}
        />
      ) : q ? (
        <main className="gk-stage we-stage">
          {flash && <div className="we-flash" aria-hidden="true">{flash}</div>}

          <div className="we-ticker" aria-label={`${ACT_NAME[actOf(q.tick)]} · ${q.tick}번째 거래 · 운영비 ${q.upkeep}코인`}>
            <span className="we-ticker-act" data-act={actOf(q.tick)}>{ACT_NAME[actOf(q.tick)]}</span>
            <span className="we-ticker-sep" aria-hidden="true">·</span>
            <span>틱 {q.tick}/{TICKS}</span>
            <span className="we-ticker-sep" aria-hidden="true">·</span>
            <span className="we-ticker-cost">운영비 🪙{q.upkeep}</span>
          </div>

          <div className="we-prompt">
            <div className="we-badges">
              {q.relist && <span className="we-badge we-badge--relist">↻ 재상장 ×{RELIST_MULT}</span>}
              {q.holdLvl > 0 && <span className="we-badge we-badge--hold">◆ 보유 지분 ×{holdMultFor(q.holdLvl)}</span>}
              {q.closing && <span className="we-badge we-badge--close">▲ 마감장 배당 ×2</span>}
            </div>
            <span className="we-label">이 뜻의 종목을 체결하세요</span>
            <h1 className="we-meaning" key={q.key}>{q.target.ko}</h1>
            {reveal
              ? <div className="we-quote we-quote--done"><span className={`we-delta ${delta >= 0 ? 'we-delta--up' : 'we-delta--down'}`}>{delta >= 0 ? '▲ +' : '▼ '}{Math.abs(delta)}🪙</span></div>
              : <QuoteGauge key={q.key} win={q.win} mult={projMult} />}
          </div>

          <div className={`we-tiles ${q.options.length <= 2 ? 'we-tiles--two' : ''}`}>
            {q.options.map((o, i) => {
              const isAns = o.en === q.target.en;
              const isPick = picked === i;
              let tone = '';
              if (reveal) {
                if (isAns) tone = 'gk-tile--correct';
                else if (isPick) tone = 'gk-tile--wrong';
                else tone = 'gk-tile--dim';
              }
              return (
                <button
                  key={`${q.key}-${o.en}`}
                  type="button"
                  className={`gk-tile we-tile ${tone}`}
                  aria-disabled={reveal}
                  onClick={() => { if (!reveal) pick(i); }}
                >
                  <Kbd>{i + 1}</Kbd>
                  <span className="we-tile-en">{o.en}</span>
                  {/* 정답 타일은 언제나 ✓ — 내가 맞혔는지는 내가 고른 타일의 ✗ 와 정산 줄이 말한다.
                      색+아이콘+모션 3중 피드백(색각 이중 인코딩). */}
                  {reveal && isAns && <FeedbackIcon kind="correct" size={18} />}
                  {reveal && isPick && !isAns && <FeedbackIcon kind="wrong" size={18} />}
                  {reveal && isAns && outcome === 'correct' && (
                    <span className="we-burst" aria-hidden="true"><ParticleBurst intensity={1 + clamp(Math.floor(combo.combo / 5), 0, 3)} colors={['#F0C24B', '#FFE9AE', 'var(--success)']} /></span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="we-settle-slot">
            {reveal ? (
              <div className="we-settle" role="status">
                <div className="we-settle-row">
                  <FeedbackIcon kind={outcome === 'correct' ? 'correct' : outcome === 'pass' ? 'near' : 'wrong'} size={16} />
                  <b className="we-settle-en">{q.target.en}</b>
                  {q.target.pron && <span className="we-settle-pron">{q.target.pron}</span>}
                  <span className="we-settle-ko">{q.target.ko}</span>
                </div>
                {q.target.example && <p className="we-settle-ex">{q.target.example}</p>}
              </div>
            ) : (
              q.tick <= 2 && <p className="we-hint">빠르게 체결할수록 배당이 큽니다 · 모르면 <b>관망</b> — 운영비 절반, 연속은 유지돼요</p>
            )}
          </div>

          <div className="we-action">
            {holdOffer ? (
              <button
                type="button"
                className="we-hold"
                onClick={buyHold}
                aria-disabled={bought}
                data-bought={bought ? '1' : '0'}
              >
                <span className="we-hold-main">
                  {bought
                    ? `지분 확보 · 다음 상장에 배당 ×${holdMultFor(q.holdLvl > 0 ? 2 : 1)}`
                    : `${q.holdLvl > 0 ? '지분 추가 매입' : '이 종목 지분 매입'} 🪙${holdPrice} → 배당 ×${holdMultFor(q.holdLvl > 0 ? 2 : 1)}`}
                </span>
                <span className="we-hold-sub">{bought ? '장 마감에 원금은 회수돼요' : '틀리면 소멸 · 마감 시 원금 회수'}</span>
                {!bought && <span className="we-hold-bar" style={{ animationDuration: '2200ms' }} aria-hidden="true" />}
              </button>
            ) : (
              <button
                type="button"
                className="we-pass"
                onClick={() => { if (!reveal) settle('pass', null); }}
                aria-disabled={reveal}
              >
                <span>관망 <span className="we-pass-sub">운영비 절반 · 연속 유지</span></span>
                <Kbd>0</Kbd>
              </button>
            )}
          </div>
        </main>
      ) : null}
    </div>
  );
}

const WE_CSS = `
  /* 3막(마감장)에 들어서면 조명이 한 단계 뜨거워진다 — 판돈이 커진 것을 몸으로 알리는 유일한 연출.
     GK_CSS 의 다크 분기(.gk-atmos-glow 0,1,0 / [data-theme] 0,2,0)를 덮되, 다크에서는 다시 낮춘다. */
  .we-root[data-act="3"] .gk-atmos-glow { opacity: .92; }
  [data-theme="dark"] .we-root[data-act="3"] .gk-atmos-glow { opacity: .58; }

  .we-hud-extra { display: flex; align-items: center; gap: 14px; }
  .we-coins { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1; }
  .we-coin-val { font-size: 19px; font-weight: 800; color: var(--active); font-variant-numeric: tabular-nums; }
  .we-slots { display: inline-flex; align-items: center; gap: 3px; }
  .we-slot { width: 16px; height: 22px; display: grid; place-items: center; font-size: 14px; line-height: 1; color: var(--t4); }
  .we-slot[data-lvl="1"] { color: var(--active); }
  .we-slot[data-lvl="2"] { color: var(--streak, var(--active)); text-shadow: 0 0 8px color-mix(in srgb, var(--active) 55%, transparent); }

  .we-stage { gap: clamp(10px, 2.2vh, 20px); justify-content: center; position: relative; overflow-y: auto; overscroll-behavior: contain; }
  .we-flash { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); background: var(--t1); color: var(--bg); font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 999px; animation: gk-pop .3s ease-out; z-index: 5; max-width: 86vw; text-align: center; }

  .we-ticker { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 700; letter-spacing: .02em; color: var(--t3); font-variant-numeric: tabular-nums; }
  .we-ticker-sep { opacity: .45; }
  .we-ticker-act { padding: 2px 9px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--t2); font-weight: 800; }
  .we-ticker-act[data-act="2"] { border-color: color-mix(in srgb, var(--active) 45%, var(--bd)); color: var(--t1); }
  .we-ticker-act[data-act="3"] { border-color: color-mix(in srgb, var(--error) 50%, var(--bd)); color: var(--error); }
  .we-ticker-cost { color: var(--t2); }

  .we-prompt { text-align: center; display: flex; flex-direction: column; gap: 8px; align-items: center; }
  .we-badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 20px; }
  .we-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 78%, transparent); color: var(--t2); }
  .we-badge--relist { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); color: var(--success); }
  .we-badge--hold { border-color: color-mix(in srgb, var(--active) 60%, var(--bd)); color: var(--active); }
  .we-badge--close { border-color: color-mix(in srgb, var(--error) 55%, var(--bd)); color: var(--error); }
  .we-label { font-size: 11px; font-weight: 700; letter-spacing: .1em; color: var(--t3); text-transform: uppercase; }
  .we-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(26px, 5.4vw, 42px); font-weight: 800; word-break: keep-all; animation: gk-pop .3s ease-out; }

  .we-quote { display: flex; align-items: center; gap: 10px; min-height: 22px; }
  .we-quote-track { width: min(220px, 52vw); height: 5px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 13%, transparent); overflow: hidden; }
  .we-quote-fill { display: block; width: 100%; height: 100%; border-radius: 999px; transform-origin: left center; background: linear-gradient(90deg, var(--success), var(--active) 62%, var(--error)); animation: we-quote-drain linear forwards; }
  @keyframes we-quote-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  .we-quote-val { font-size: 13px; font-weight: 800; color: var(--t2); font-variant-numeric: tabular-nums; min-width: 84px; text-align: left; }
  .we-quote--done { justify-content: center; }
  .we-delta { font-size: 16px; font-weight: 900; font-variant-numeric: tabular-nums; animation: gk-pop .3s ease-out; }
  .we-delta--up { color: var(--success); }
  .we-delta--down { color: var(--error); }

  .we-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: min(560px, 92vw); }
  .we-tiles--two { grid-template-columns: 1fr; max-width: 400px; }
  .we-tile { justify-content: flex-start; gap: 10px; min-height: 64px; font-size: clamp(15px, 3.2vw, 21px); }
  .we-tile-en { flex: 1; }
  .we-tile .gk-kbd { flex: none; opacity: .55; }
  .we-burst { position: absolute; inset: 0; pointer-events: none; }

  .we-settle-slot { width: min(560px, 92vw); min-height: 78px; display: flex; align-items: center; justify-content: center; }
  .we-settle { width: 100%; padding: 10px 14px; border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, transparent); animation: gk-pop .26s ease-out; }
  .we-settle-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .we-settle-row .gk-fbicon { align-self: center; }
  .we-settle-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 17px; font-weight: 800; color: var(--t1); }
  .we-settle-pron { font-size: 12px; color: var(--t4); }
  .we-settle-ko { font-size: 13.5px; font-weight: 700; color: var(--t2); }
  .we-settle-ex { margin: 6px 0 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; line-height: 1.6; color: var(--t3); }
  .we-hint { margin: 0; font-size: 12.5px; line-height: 1.6; color: var(--t3); text-align: center; max-width: 40ch; }
  .we-hint b { color: var(--t2); }

  .we-action { width: min(560px, 92vw); }
  .we-pass, .we-hold { position: relative; overflow: hidden; width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; border-radius: var(--r-md, 10px); border: 1.5px dashed var(--bd); background: color-mix(in srgb, var(--bg) 66%, transparent); color: var(--t2); font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; cursor: pointer; text-align: left; transition: transform .12s var(--ease-spring, ease), border-color .15s, color .15s, background .15s; }
  .we-pass:hover, .we-hold:hover { border-color: var(--t3); color: var(--t1); background: color-mix(in srgb, var(--bg) 86%, transparent); }
  .we-pass:active, .we-hold:active { transform: scale(.985); }
  .we-pass:focus-visible, .we-hold:focus-visible { outline: none; border-color: var(--active); box-shadow: 0 0 0 3px color-mix(in srgb, var(--active) 32%, transparent); }
  .we-pass[aria-disabled="true"], .we-hold[aria-disabled="true"] { opacity: .5; pointer-events: none; }
  .we-pass-sub { margin-left: 8px; font-size: 11.5px; font-weight: 700; color: var(--t4); }
  .we-hold { flex-direction: column; align-items: flex-start; gap: 2px; border-style: solid; border-color: color-mix(in srgb, var(--active) 58%, var(--bd)); color: var(--t1); }
  .we-hold[data-bought="1"] { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); opacity: 1; }
  .we-hold-main { font-size: 14px; font-weight: 800; }
  .we-hold-sub { font-size: 11.5px; font-weight: 700; color: var(--t4); }
  .we-hold-bar { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; transform-origin: left center; background: var(--active); animation: we-quote-drain linear forwards; }

  .we-review { text-align: left; }
  .we-review-h { margin: 0 0 8px; font-size: 12px; font-weight: 800; letter-spacing: .06em; color: var(--t3); text-transform: uppercase; }
  .we-review-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; }
  .we-review-list li { display: flex; align-items: baseline; gap: 10px; }
  .we-review-list b { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 14.5px; color: var(--t1); min-width: 9ch; }
  .we-review-list span { font-size: 13px; color: var(--t3); }

  @media (max-width: 420px) {
    .we-hud-extra { gap: 9px; }
    .we-coin-val { font-size: 16px; }
    .we-quote-val { min-width: 74px; font-size: 12px; }
    .we-tile { min-height: 58px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .we-meaning, .we-flash, .we-settle, .we-delta { animation: none; }
    .we-pass, .we-hold { transition: none; }
  }
`;
