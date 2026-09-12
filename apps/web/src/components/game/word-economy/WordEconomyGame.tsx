// apps/web/src/components/game/word-economy/WordEconomyGame.tsx
// Word Economy — "단어 거래소". blitz 계열 중 **유일하게 시계가 없는** 모드(v07.9 → v07.10 반증 대응).
//
// 계열 안에서의 차별 축(유지):
//   · daily-blitz 는 **시계**가 화폐다. word-economy 는 **자본**이 화폐다.
//     세션 길이를 초가 아니라 **틱(20 거래)** 으로 센다. 벽시계가 아예 없다.
//   · 긴장 곡선 = 운영비 상승 × 호가창 수축(7.0s → 3.6s) 두 곡선의 수렴.
//   · 이 모드에만 있는 결정 두 가지 — **관망**(모르면 넘긴다) · **지분**(자기 확신에 값을 매긴다).
//
// v07.10 — 적대적 반증 6건 대응. 무엇이 왜 바뀌었는지:
//   [1] 지분 '상시 매입' 지배 전략 붕괴(4000판×7밴드 시뮬 자산비 1.94~2.89배 → 0.79~1.29배)
//       ① 매입가가 잔고 연동(max(40, 잔고×50%)) — 후반에도 기회비용이 살아 있다.
//       ② **만기** 도입 — 배당 2회를 받으면 지분은 원금과 함께 자동 청산된다.
//          상방이 무한 반복이 아니라 2회로 닫히므로 '사두면 계속 불어난다'가 사라졌다.
//       ③ **장 마감 정산** — 미청산 지분은 마지막 인출 1회를 요구한다. 맞히면 원금+배당,
//          틀리면 원금 소멸(관망하면 60% 조기 청산). 매입이 자산 중립이 아니라 진짜 베팅이 됐다.
//       ④ 증거금 규칙 — 매입 후 잔고가 매입가만큼은 남아야 제안된다(저잔고 함정 제거).
//   [2] 무입력 AFK 로 FSRS 오염 — 만료(무입력)는 **인출 시도가 아니다**.
//       onWrong 을 assisted 로 올려 카드 갱신에서 제외하고, 연속 2회면 호가창을 늘리고,
//       연속 3회면 장을 멈춘다(사용자가 '장 다시 열기'를 눌러야 재개). 시뮬: FSRS 이벤트 14회 → 0회.
//   [3] 학습 표면 축소(20문항이 8단어에) — 최근 3틱 출제 잠금 · 예약 소비 확률 0.55 ·
//       distinct 14 미만이면 보유 종목 재선택 확률 0.42→0.12. 30단어 풀 distinct 6.8 → 11.6.
//   [4] 대상 학습자 파산 밴드 — 고정 운영비를 **최근 8틱 배당 연동**으로 교체(수익이 없으면
//       운영비도 안 오른다). 시작 자본 60 → 88, 파산 게이트 8틱 → 12틱, 오답 가산 1.5 → 1.25.
//       p=0.6 파산률 82% → 17%, p=0.9 → 0%.
//   [5] 키보드로 지분 매입 불가 — H 키 + 제안 시 자동 포커스 + 리빌 중 타일 탭 순서 제거.
//   [6] 마진콜이 가장 비싼 지분을 헐값에 청산 — 원금이 **가장 작은** 지분을 팔고 회수액을 알린다.
//   [+] 시뮬이 새로 찾은 구멍: 관망은 콤보를 끊지 않으므로 '모르는 건 전부 관망'이 콤보 세탁이 됐다
//       (p=0.4 에서 최고 콤보 9.8). 관망 3회마다 연속을 한 번 정리한다 → 5.0. 또한 관망한 종목의
//       재상장에는 ×1.5 프리미엄을 주지 않는다(프리미엄은 '틀린 뒤 만회'에만).
//
// 인출 규칙(비타협) 준수:
//   · 제출 전 화면에는 한국어 뜻과 선택지뿐 — 정답을 특정할 정보 없음.
//   · 부분 정답 오라클 없음. 힌트 구매(50:50) 는 삭제된 상태 유지.
//   · 지분 보유 목록은 단어를 인쇄하지 않는다(슬롯 수·배수만).
//   · FSRS 상신 규칙 — **이 세션에서 정답이 공개된 적 없는 첫 인출만** 정직하게 올린다.
//     재상장·지분·정산 문항과 무입력 만료는 `{ assisted: true }` 로 올려 카드 갱신에서 제외한다.
//     (호출을 생략하지는 않는다 — 모르는 단어가 오답으로 올라가야 복습이 잡힌다.)

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, FeedbackIcon, Kbd,
  useSfx, useCountUp, useCombo, usePersonalBest, shuffle, pickDistinct, clamp,
  GameMusic, type Word, type ComboTier,
} from '@/components/game/_shared/gamekit';

interface ResultOpts { assisted?: boolean }
interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

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
// 수치는 전부 4000판×7밴드 몬테카를로로 맞춘 값이다. 근거는 각 줄 주석에.
const TICKS = 20;              // 오늘의 장 = 20 거래. 세션 길이는 초가 아니라 틱으로 센다.
const START_CAPITAL = 88;      // 60 → 88. 1막 7틱을 전액 관망해도(≈14) 2막 진입 여력이 남는 최소치.
const BASE_PAYOUT = 12;
const WIN_START = 7000;        // 1틱 호가창
const WIN_END = 3600;          // 20틱 호가창 — 세션이 갈수록 조인다
const SETTLE_WIN = 5200;       // 정산 문항 — 운영비가 없는 대신 판돈이 원금 전체다. 조금 더 준다.

const HOLD_SLOTS = 3;
const HOLD_COST_1 = 40;        // 매입가 하한(1차)
const HOLD_COST_2 = 60;        // 매입가 하한(추가) — 원금 누계 100
const HOLD_RATE_1 = 0.50;      // 잔고 연동 매입가. 후반 대자본에서도 기회비용이 남게 하는 유일한 장치.
const HOLD_RATE_2 = 0.60;
const BUY_HEADROOM = 2;        // 증거금 — 매입 후 잔고가 매입가만큼은 남아야 제안한다(저잔고 함정 차단).
const HOLD_MULT_1 = 2.0;       // 2.2 → 2.0 · 만기(2회)와 합쳐 상방 총량을 시뮬 목표선까지 낮춘 값.
const HOLD_MULT_2 = 3.0;       // 3.6 → 3.0
const HOLD_PAYOUTS = 2;        // 배당 2회 = 만기. 지분 상방이 무한 반복이 되지 않게 닫는 상한.
const HOLD_LOSS_RECOVER = 0.6; // 지분을 놓쳤을 때 손절 회수율. 1.0 손실은 저정확도 밴드를 함정으로 만든다.

const RELIST_MULT = 1.5;       // '틀린 뒤 만회'에만 붙는 프리미엄(관망 복귀에는 없음 — 콤보 세탁 차단)
const WRONG_UPKEEP_RATIO = 1.25; // 1.5 → 1.25. 오답 이중 처벌이 0.5~0.7 밴드 파산의 주 원인이었다.
const PASS_UPKEEP_RATIO = 0.5;   // 관망은 절반 — "모르면 넘겨도 된다"를 규칙으로
const EXPIRY_UPKEEP_RATIO = 0.25; // 무입력 만료는 결정이 아니다 — 관망의 절반만 청구
const PASS_BREAK_EVERY = 3;    // 관망 3회마다 연속 1회 정리 — '모르는 건 전부 관망'으로 ×3.4 를 세탁하던 경로

// 운영비 = 막별 기본 + 막별 계수 × 최근 8틱 평균 배당.
// 고정 5/12/36 은 '못 버는 사람에게만 치명적'이었다. 수익에 연동하면 잘 버는 사람만 조인다.
const UPKEEP_BASE = [0, 4, 9, 14] as const;
const UPKEEP_RATE = [0, 0.15, 0.42, 0.66] as const;
const EARN_WINDOW = 8;
const BUST_TICK_GATE = 12;     // 8 → 12. 조기 파산(≈50초)은 세션 형태를 함께 무너뜨린다.

// 출제 다양성 — 20문항이 8단어에 몰리던 경로를 세 겹으로 막는다.
const RECENT_LOCK = 3;         // 최근 3틱에 나온 종목은 다시 뽑지 않는다(구판은 직전 1개만)
const QUEUE_CONSUME_P = 0.55;  // 예약 상장을 항상 소비하지 않는다 — 나머지는 일반 상장으로 흐른다
const HOLD_PICK_P = 0.42;
const HOLD_PICK_P_LOW = 0.12;  // 세션 커버리지 미달 구간에서는 보유 종목 재선택을 눌러 둔다
const COVERAGE_TARGET = 14;

// 방치 대응 — 무입력이 무한히 자동 진행되지 않게. 완화 두 계단을 먼저 주고 그래도 무입력이면 멈춘다.
const GRACE_1 = 1200;          // 연속 2회 만료 → 다음 호가창 +1.2s (느린 학습자 자동 관망 루프 완화)
const GRACE_2 = 2400;          // 연속 3회 만료 → +2.4s (상한은 winOf(1) = 7000ms)
const AFK_STOP = 4;            // 연속 4회 → 장을 멈추고 사용자 입력을 기다린다

const COMBO_TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 3, mult: 1.4, label: '순항' },
  { at: 6, mult: 1.9, label: '강세' },
  { at: 10, mult: 2.6, label: '급등' },
  { at: 15, mult: 3.4, label: '폭등' },
];

const ACT_NAME = ['', '개장', '활황', '마감장'] as const;

function actOf(tick: number) { return tick <= 7 ? 1 : tick <= 14 ? 2 : 3; }
function isClosing(tick: number) { return actOf(tick) === 3; }
function upkeepOf(tick: number, recentEarn: number) {
  const a = actOf(tick);
  return Math.max(1, Math.round(UPKEEP_BASE[a] + UPKEEP_RATE[a] * recentEarn));
}
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
function holdPriceAt(lvl: number, bal: number) {
  return lvl > 0
    ? Math.max(HOLD_COST_2, Math.round(bal * HOLD_RATE_2))
    : Math.max(HOLD_COST_1, Math.round(bal * HOLD_RATE_1));
}
function speedFactor(frac: number) { return 0.6 + 0.8 * clamp(frac, 0, 1); }

/** 철자 근접도 — 판돈 큰 문항(지분·재상장·정산)의 오답을 형태 혼동으로 올려 난이도를 판돈에 묶는다. */
function similarity(a: string, b: string) {
  const x = a.toLowerCase(); const y = b.toLowerCase();
  let p = 0; while (p < x.length && p < y.length && x[p] === y[p]) p += 1;
  let s = 0; while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s += 1;
  return p * 2.2 + s * 1.6 - Math.abs(x.length - y.length) * 0.5;
}

interface Holding { en: string; lvl: number; paid: number }
/**
 * 예약 상장 큐.
 *  · relist — 틀린 종목. 되돌아올 때 ×1.5 프리미엄(만회에 값을 치른다).
 *  · recall — 관망·만료한 종목. 되돌아오되 프리미엄 없음(관망이 돈이 되면 관망이 지배 전략이 된다).
 *  · hold   — 지분을 실은 종목. 판돈이 실제로 굴러가야 결정이 의미를 갖는다.
 */
interface Listing { en: string; at: number; kind: 'relist' | 'recall' | 'hold' }
interface Quote {
  key: number; tick: number; target: Word; options: Word[];
  relist: boolean; holdLvl: number; holdPaid: number;
  win: number; upkeep: number; closing: boolean;
  /** 장 마감 정산 문항 — 운영비 없음, 판돈은 지분 원금 전체. */
  settling: boolean;
}
type Outcome = 'correct' | 'wrong' | 'pass';
type Source = 'user' | 'expiry';

// ─── 호가 게이지 ──────────────────────────────────────────────────────────
// 바는 CSS 애니메이션 1회(리렌더 0), 숫자만 160ms 로 갱신하며 이 컴포넌트 안에서만 다시 그려진다.
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
  const [idle, setIdle] = useState(false);
  const [bust, setBust] = useState(false);
  const [flash, setFlash] = useState('');
  const [say, setSay] = useState('');
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [trades, setTrades] = useState(0);
  const [wins, setWins] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; now: number; improved: boolean } | null>(null);

  const balanceRef = useRef(START_CAPITAL);
  const holdingsRef = useRef<Holding[]>([]);
  const listingRef = useRef<Listing[]>([]);
  const openRef = useRef<Map<string, boolean>>(new Map()); // 단어별 마지막 인출 결과(끝화면 복습용)
  /** 이 세션에서 정답이 이미 공개된 단어 — 이후 인출은 전부 assisted(FSRS 제외). */
  const revealedRef = useRef<Set<string>>(new Set());
  const distinctRef = useRef<Set<string>>(new Set());
  const recentRef = useRef<string[]>([]);
  const earnRef = useRef<number[]>([]);
  const settleQueueRef = useRef<Holding[]>([]);
  const expiryStreakRef = useRef(0);
  const idleRef = useRef(false);
  const passCountRef = useRef(0);
  const breakByPass = useRef(false);
  const resumeTickRef = useRef(1);
  const keyRef = useRef(0);
  const qStartRef = useRef(0);
  const lockRef = useRef(false);
  const revealT = useRef(0);
  const expiryT = useRef(0);
  const flashT = useRef(0);
  const mounted = useRef(true);
  const submitted = useRef(false);
  const tierUp = useRef<ComboTier | null>(null);
  const holdBtnRef = useRef<HTMLButtonElement | null>(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(revealT.current);
    window.clearTimeout(expiryT.current);
  }, []);

  // 인라인 알림 — 모달로 학습을 끊지 않는다. 비난조 없이 "무엇을 잃었는지"만.
  const note = useCallback((msg: string) => {
    setFlash(msg);
    window.clearTimeout(flashT.current);
    flashT.current = window.setTimeout(() => { if (mounted.current) setFlash(''); }, 1400);
  }, []);

  const combo = useCombo({
    tiers: COMBO_TIERS,
    onTierUp: (t) => { tierUp.current = t; },
    onBreak: (lost) => {
      if (breakByPass.current) { breakByPass.current = false; note(`관망 ${PASS_BREAK_EVERY}회 — 연속 ${lost}이 정리됐어요`); }
      else note(`🔥 ${lost} 유실 — 배당 배수가 초기화됐어요`);
    },
  });

  const personal = usePersonalBest('word-economy');
  const shownBalance = useCountUp(balance);

  const recentEarn = useCallback(() => {
    const e = earnRef.current;
    if (e.length === 0) return 0;
    return e.reduce((s, v) => s + v, 0) / e.length;
  }, []);

  const pushRecent = useCallback((en: string) => {
    const r = recentRef.current;
    r.push(en);
    while (r.length > RECENT_LOCK) r.shift();
  }, []);

  const distractorsFor = useCallback((tgt: Word, near: boolean) => {
    // 같은 뜻(ko)의 동의어를 오답으로 쓰면 정답인데 오답 처리된다 — 반드시 제외.
    const others = pool.filter((w) => w.en !== tgt.en && w.ko !== tgt.ko);
    const need = Math.max(1, tileCount - 1);
    if (near) {
      const sorted = [...others].sort((a, b) => similarity(b.en, tgt.en) - similarity(a.en, tgt.en));
      return shuffle(sorted.slice(0, Math.min(sorted.length, need + 2))).slice(0, need);
    }
    return pickDistinct(pool, need, (w) => w.en === tgt.en || w.ko === tgt.ko);
  }, [pool, tileCount]);

  // ─── 상장 종목 결정 ─────────────────────────────────────────────────────
  const buildQuote = useCallback((t: number): Quote => {
    const holds = holdingsRef.current;
    const recent = recentRef.current;
    let target: Word | undefined;
    let relist = false;

    // 1) 예약 상장 — 최근 3틱에 나온 종목은 건너뛰고, 항상 소비하지도 않는다(핑퐁 락인 차단).
    const dueIdx = listingRef.current.findIndex((r) => r.at <= t && !recent.includes(r.en));
    if (dueIdx >= 0 && Math.random() < QUEUE_CONSUME_P) {
      const [due] = listingRef.current.splice(dueIdx, 1);
      target = pool.find((w) => w.en === due.en);
      relist = !!target && due.kind === 'relist';
    }
    // 2) 보유 지분 — 세션 커버리지가 아직 얕으면 재선택 확률을 눌러 둔다.
    const holdP = distinctRef.current.size < Math.min(COVERAGE_TARGET, pool.length) ? HOLD_PICK_P_LOW : HOLD_PICK_P;
    if (!target && holds.length > 0 && Math.random() < holdP) {
      const cands = holds.filter((h) => !recent.includes(h.en));
      if (cands.length > 0) target = pool.find((w) => w.en === cands[Math.floor(Math.random() * cands.length)].en);
    }
    // 3) 일반 상장
    if (!target) {
      let cands = pool.filter((w) => !recent.includes(w.en));
      if (cands.length === 0) cands = pool.filter((w) => w.en !== recent[recent.length - 1]);
      if (cands.length === 0) cands = pool;
      target = cands[Math.floor(Math.random() * cands.length)];
    }

    const tgt: Word = target;
    const held = holds.find((h) => h.en === tgt.en);
    const holdLvl = held?.lvl ?? 0;
    const grace = expiryStreakRef.current >= 3 ? GRACE_2 : expiryStreakRef.current >= 2 ? GRACE_1 : 0;

    keyRef.current += 1;
    pushRecent(tgt.en);
    distinctRef.current.add(tgt.en);
    return {
      key: keyRef.current, tick: t, target: tgt,
      options: shuffle([tgt, ...distractorsFor(tgt, relist || holdLvl > 0)]),
      relist, holdLvl, holdPaid: held?.paid ?? 0,
      win: Math.min(WIN_START, winOf(t) + grace),
      upkeep: upkeepOf(t, recentEarn()),
      closing: isClosing(t), settling: false,
    };
  }, [pool, distractorsFor, pushRecent, recentEarn]);

  const buildSettleQuote = useCallback((h: Holding): Quote => {
    const tgt = pool.find((w) => w.en === h.en) ?? pool[0];
    keyRef.current += 1;
    pushRecent(tgt.en);
    return {
      key: keyRef.current, tick: TICKS, target: tgt,
      options: shuffle([tgt, ...distractorsFor(tgt, true)]),
      relist: false, holdLvl: h.lvl, holdPaid: h.paid,
      win: SETTLE_WIN, upkeep: 0, closing: false, settling: true,
    };
  }, [pool, distractorsFor, pushRecent]);

  const settleRef = useRef<(kind: Outcome, idx: number | null, src?: Source) => void>(() => {});

  const armQuote = useCallback((nq: Quote) => {
    setQ(nq); setPicked(null); setOutcome(null); setDelta(0); setBought(false);
    lockRef.current = false;
    qStartRef.current = Date.now();
    window.clearTimeout(expiryT.current);
    // 호가창이 닫히면 자동 관망 — 문항이 영원히 열려 있지 않게 하되, 벌이 아니라 "기회 종료".
    expiryT.current = window.setTimeout(() => { if (mounted.current) settleRef.current('pass', null, 'expiry'); }, nq.win);
  }, []);

  const openQuote = useCallback((t: number) => { armQuote(buildQuote(t)); }, [armQuote, buildQuote]);

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

  /** 장 마감 → 미청산 지분 정산 문항으로. 없으면 그대로 종료. */
  const advanceSettlementRef = useRef<() => void>(() => {});
  const advanceSettlement = useCallback(() => {
    const nextHold = settleQueueRef.current.shift();
    if (!nextHold) { finish(false); return; }
    const still = holdingsRef.current.find((h) => h.en === nextHold.en);
    if (!still) { advanceSettlementRef.current(); return; } // 마진콜로 이미 사라진 지분은 건너뛴다
    armQuote(buildSettleQuote(still));
  }, [armQuote, buildSettleQuote, finish]);
  advanceSettlementRef.current = advanceSettlement;

  const start = useCallback(() => {
    clearTimers();
    submitted.current = false;
    balanceRef.current = START_CAPITAL; setBalance(START_CAPITAL);
    holdingsRef.current = []; setHoldings([]);
    listingRef.current = [];
    openRef.current = new Map();
    revealedRef.current = new Set();
    distinctRef.current = new Set();
    recentRef.current = [];
    earnRef.current = [];
    settleQueueRef.current = [];
    expiryStreakRef.current = 0;
    idleRef.current = false;
    passCountRef.current = 0; setPassCount(0);
    setTick(1);
    combo.reset();
    setPayoutTotal(0); setTrades(0); setWins(0);
    setBust(false); setIdle(false); setBestInfo(null); setFlash(''); setSay('');
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
  const settle = useCallback((kind: Outcome, idx: number | null, src: Source = 'user') => {
    if (phase !== 'playing' || !q || lockRef.current) return;
    lockRef.current = true;
    window.clearTimeout(expiryT.current);

    const t = q.tick;
    const isSettling = q.settling;
    let holds = holdingsRef.current;
    let gain = 0;
    let cost = 0;
    let line = '';
    let earned = 0;

    // FSRS 상신 자격 — 정답이 이미 공개된 단어의 재출제, 정산 문항, 무입력 만료는 인출이 아니다.
    const firstLook = !revealedRef.current.has(q.target.en);
    const assisted = !firstLook || isSettling || src === 'expiry';

    if (src === 'expiry') expiryStreakRef.current += 1; else expiryStreakRef.current = 0;

    if (kind === 'correct') {
      const frac = clamp(1 - (Date.now() - qStartRef.current) / q.win, 0, 1);
      const nc = combo.hit();
      gain = Math.round(
        BASE_PAYOUT * speedFactor(frac) * multFor(nc) * holdMultFor(q.holdLvl)
        * (q.relist ? RELIST_MULT : 1) * (q.closing ? 2 : 1),
      );
      earned = gain;
      cost = isSettling ? 0 : q.upkeep;
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
      if (isSettling) {
        const back = holdPrincipal(q.holdLvl);
        gain += back;
        holds = holds.filter((h) => h.en !== q.target.en);
        line = `정산 성공 ${q.target.en} · 원금 ${back} + 배당 ${earned}코인`;
      } else if (q.holdLvl > 0) {
        // 만기 — 배당 2회를 받으면 지분은 원금과 함께 자동 청산된다(상방 상한).
        const paid = q.holdPaid + 1;
        if (paid >= HOLD_PAYOUTS) {
          const back = holdPrincipal(q.holdLvl);
          gain += back;
          holds = holds.filter((h) => h.en !== q.target.en);
          note(`지분 만기 · 원금 🪙${back} 회수`);
        } else {
          holds = holds.map((h) => (h.en === q.target.en ? { ...h, paid } : h));
        }
        line = `정답 ${q.target.en} · 배당 ${earned}코인, 운영비 ${cost}코인`;
      } else {
        line = `정답 ${q.target.en} · 배당 ${earned}코인, 운영비 ${cost}코인`;
      }
    } else if (kind === 'wrong') {
      combo.miss();
      openRef.current.set(q.target.en, false);
      sfx.wrong();
      if (isSettling) {
        holds = holds.filter((h) => h.en !== q.target.en);
        line = `정산 실패 · 정답은 ${q.target.en}, ${q.target.ko}. 지분 원금이 소멸했어요`;
      } else {
        cost = Math.round(q.upkeep * WRONG_UPKEEP_RATIO);
        listingRef.current.push({ en: q.target.en, at: t + 3, kind: 'relist' });
        if (q.holdLvl > 0) {
          const back = Math.round(holdPrincipal(q.holdLvl) * HOLD_LOSS_RECOVER);
          gain += back;
          holds = holds.filter((h) => h.en !== q.target.en);
          note(`지분 손절 · 원금 🪙${back} 회수`);
        }
        line = `오답 · 정답은 ${q.target.en}, ${q.target.ko}. 운영비 ${cost}코인`;
      }
    } else {
      // 관망 / 무입력 만료 — 콤보는 동결(3회마다 한 번만 정리), 정답은 공개한다.
      openRef.current.set(q.target.en, false);
      sfx.nearMiss();
      if (isSettling) {
        const back = Math.round(holdPrincipal(q.holdLvl) * HOLD_LOSS_RECOVER);
        gain += back;
        holds = holds.filter((h) => h.en !== q.target.en);
        line = `조기 청산 · 정답은 ${q.target.en}, ${q.target.ko}. 원금 ${back}코인 회수`;
      } else {
        cost = Math.round(q.upkeep * (src === 'expiry' ? EXPIRY_UPKEEP_RATIO : PASS_UPKEEP_RATIO));
        listingRef.current.push({ en: q.target.en, at: t + 2, kind: 'recall' });
        if (q.holdLvl > 0) {
          const back = Math.round(holdPrincipal(q.holdLvl) * HOLD_LOSS_RECOVER);
          gain += back;
          holds = holds.filter((h) => h.en !== q.target.en);
          note(`지분 청산 · 원금 🪙${back} 회수`);
        }
        if (src === 'user') {
          const pc = passCountRef.current + 1;
          passCountRef.current = pc; setPassCount(pc);
          // onBreak 는 직전 콤보가 2 이상일 때만 불린다 — 플래그를 여기서 반드시 되돌린다.
          if (pc % PASS_BREAK_EVERY === 0) { breakByPass.current = true; combo.miss(); breakByPass.current = false; }
        }
        line = src === 'expiry'
          ? `호가 만료 · 정답은 ${q.target.en}, ${q.target.ko}. 운영비 ${cost}코인`
          : `관망 · 정답은 ${q.target.en}, ${q.target.ko}. 운영비 ${cost}코인`;
      }
    }

    // 운영비 연동용 최근 배당 창 — 정산 문항은 운영비가 없으므로 포함하지 않는다.
    if (!isSettling) {
      earnRef.current.push(earned);
      while (earnRef.current.length > EARN_WINDOW) earnRef.current.shift();
    }

    let next = balanceRef.current + gain - cost;
    let busted = false;
    if (next < 0) {
      // 마진콜 — 즉사가 아니라 강제 청산 한 번. **원금이 가장 작은** 지분을 판다.
      // (구판은 holds[0] = 대개 가장 비싼 Lv.2 를 헐값에 팔아 손실이 구현 순서에서 나왔다.)
      if (holds.length > 0) {
        let sold = holds[0];
        for (const h of holds) if (holdPrincipal(h.lvl) < holdPrincipal(sold.lvl)) sold = h;
        const back = Math.round(holdPrincipal(sold.lvl) * 0.5);
        holds = holds.filter((h) => h !== sold);
        next = Math.max(0, next + back);
        note(`마진콜 · 지분 1개 청산 · 🪙${back} 회수`);
      } else if (t >= BUST_TICK_GATE && !isSettling) {
        next = 0;
        busted = true;
      } else {
        // 초반 파산은 막는다 — 5틱 만에 끝나는 세션은 벌이지 배움이 아니다.
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
    revealedRef.current.add(q.target.en);

    // FSRS — 호출을 생략하지 않는다. 모르는 단어일수록 오답으로 정직하게 올라가야 복습이 잡힌다.
    if (kind === 'correct') onCorrect?.(q.target, { assisted });
    else onWrong?.(q.target, { assisted });

    // 제안 판정은 q.holdLvl 이 아니라 **정산 직후의 실제 보유 상태**로 한다.
    // (만기·손절로 지분이 방금 사라졌는데 '추가 매입'을 제안하면 코인만 빠져나간다.)
    const offerLvl = holds.find((h) => h.en === q.target.en)?.lvl ?? 0;
    const price = holdPriceAt(offerLvl, next);
    const canOffer = kind === 'correct'
      && !isSettling
      && offerLvl < 2
      && (offerLvl > 0 || holds.length < HOLD_SLOTS)
      && next >= price * BUY_HEADROOM;
    const dwell = kind === 'correct' ? (canOffer ? 2600 : 1400) : 2600;

    revealT.current = window.setTimeout(() => {
      if (!mounted.current) return;
      if (busted) { finish(true); return; }
      if (isSettling) { advanceSettlementRef.current(); return; }
      if (t >= TICKS) {
        if (holdingsRef.current.length > 0) {
          settleQueueRef.current = [...holdingsRef.current];
          advanceSettlementRef.current();
        } else finish(false);
        return;
      }
      const nt = t + 1;
      setTick(nt);
      // 방치 차단 — 연속 만료가 임계에 닿으면 자동 진행을 멈추고 사용자를 기다린다.
      if (expiryStreakRef.current >= AFK_STOP) { resumeTickRef.current = nt; idleRef.current = true; setIdle(true); return; }
      openQuote(nt);
    }, dwell);
  }, [phase, q, combo, sfx, note, onCorrect, onWrong, finish, openQuote]);
  settleRef.current = settle;

  const pick = useCallback((i: number) => {
    if (!q || lockRef.current) return;
    settle(q.options[i].en === q.target.en ? 'correct' : 'wrong', i);
  }, [q, settle]);

  // Enter 키와 버튼 click 이 함께 들어와도 장이 두 번 열리지 않게 ref 로 잠근다.
  const resume = useCallback(() => {
    if (!idleRef.current) return;
    idleRef.current = false;
    expiryStreakRef.current = 0;
    setIdle(false);
    openQuote(resumeTickRef.current);
  }, [openQuote]);

  const buyHold = useCallback(() => {
    if (!q || q.settling || outcome !== 'correct' || bought) return;
    const lvl = holdingsRef.current.find((h) => h.en === q.target.en)?.lvl ?? 0;
    if (lvl >= 2) return;
    const price = holdPriceAt(lvl, balanceRef.current);
    if (balanceRef.current < price * BUY_HEADROOM) { note('증거금이 부족해요 — 매입 후에도 그만큼은 남아 있어야 해요'); return; }
    if (lvl === 0 && holdingsRef.current.length >= HOLD_SLOTS) { note('지분 슬롯이 가득 찼어요'); return; }
    const next = balanceRef.current - price;
    balanceRef.current = next; setBalance(next);
    const holds = lvl > 0
      ? holdingsRef.current.map((h) => (h.en === q.target.en ? { ...h, lvl: 2, paid: 0 } : h))
      : [...holdingsRef.current, { en: q.target.en, lvl: 1, paid: 0 }];
    holdingsRef.current = holds; setHoldings(holds);
    // 지분을 실은 종목은 곧 되돌아온다 — 판돈이 실제로 굴러가야 결정이 의미를 갖는다.
    listingRef.current.push({ en: q.target.en, at: q.tick + 2, kind: 'hold' });
    setBought(true);
    sfx.click();
    note(lvl > 0 ? `지분 추가 매입 🪙${price} · 배당 ×${HOLD_MULT_2}` : `지분 매입 🪙${price} · 배당 ×${HOLD_MULT_1}`);
  }, [q, outcome, bought, note, sfx]);

  // 제안 레벨은 현재 보유 상태에서 다시 읽는다(만기·손절 직후를 정확히 반영).
  const offerLvl = q ? (holdings.find((h) => h.en === q.target.en)?.lvl ?? 0) : 0;
  const holdPrice = q ? holdPriceAt(offerLvl, balance) : HOLD_COST_1;
  const offerMult = holdMultFor(offerLvl > 0 ? 2 : 1);
  // 매입 후에도 버튼을 자리에 남긴다 — 슬롯이 차서 조건이 무너져도 리빌 중 레이아웃이 흔들리지 않게.
  const holdOffer = !!q && !q.settling && outcome === 'correct' && offerLvl < 2
    && (bought || ((offerLvl > 0 || holdings.length < HOLD_SLOTS) && balance >= holdPrice * BUY_HEADROOM));

  // ─── 키보드 (1~4 매수 · 0/P 관망 · H 지분) ──────────────────────────────
  // 구판은 리빌 진입 즉시 lockRef 로 전 키를 막아, 키보드 사용자는 간판 메커닉인 지분을 살 수 없었다.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (idle) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resume(); }
        return;
      }
      if (!q) return;
      if (e.key.toLowerCase() === 'h') {
        if (holdOffer && !bought) { e.preventDefault(); buyHold(); }
        return;
      }
      if (lockRef.current) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= q.options.length) { e.preventDefault(); pick(n - 1); return; }
      if (e.key === '0' || e.key.toLowerCase() === 'p') { e.preventDefault(); settle('pass', null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, idle, holdOffer, bought, pick, settle, buyHold, resume]);

  // 지분 제안이 열리면 버튼으로 포커스를 옮긴다 — Enter 만으로도 매입이 성립하게.
  useEffect(() => {
    if (holdOffer && !bought) holdBtnRef.current?.focus();
  }, [holdOffer, bought]);

  const handleExit = useCallback(() => { clearTimers(); onExit?.(); }, [clearTimers, onExit]);

  const reveal = outcome !== null;
  const projMult = q
    ? multFor(combo.combo + 1) * holdMultFor(q.holdLvl) * (q.relist ? RELIST_MULT : 1) * (q.closing ? 2 : 1)
    : 1;
  const missedWords = useMemo(() => {
    if (phase !== 'done') return [];
    const out: Word[] = [];
    openRef.current.forEach((ok, en) => {
      if (!ok) { const w = pool.find((x) => x.en === en); if (w) out.push(w); }
    });
    return out.slice(0, 6);
  }, [phase, pool]);
  const finalAsset = balance + holdings.reduce((s, h) => s + holdPrincipal(h.lvl), 0);
  const passToBreak = PASS_BREAK_EVERY - (passCount % PASS_BREAK_EVERY);

  return (
    <div className="gk-root we-root" data-act={q ? actOf(q.tick) : 1}>
      <GameMusic gameId="word-economy" />
      <GameKitStyles />
      <AmbientBackground center="#FBF2DE" mid="#EAD39F" edge="#6C481D" glow="rgba(255,206,112,.34)" glowAt="50% 24%" watermark="word-economy" />
      <style dangerouslySetInnerHTML={{ __html: WE_CSS }} />
      <Hud
        progress={phase === 'playing' ? (q?.settling ? 1 : (tick - 1) / TICKS) : 1}
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
              ? '모르는 종목은 관망하면 운영비가 절반이에요. 운영비는 최근 배당에 연동되니, 벌지 못한 구간에서는 저절로 가벼워져요.'
              : wins > 0 && trades > 0 && wins / trades >= 0.8
                ? '지분은 배당 2회면 만기예요. 확신이 아주 큰 종목만 골라 굴리면 마감 정산까지 살아남아요.'
                : '지분은 마감에 마지막 인출 한 번을 요구해요. "2분 뒤에도 맞힐 수 있다" 싶은 종목에만 실어 보세요.'
          }
          onRestart={start}
          onExit={handleExit}
        />
      ) : q ? (
        <main className="gk-stage we-stage">
          {flash && <div className="we-flash" aria-hidden="true">{flash}</div>}

          <div
            className="we-ticker"
            aria-label={q.settling
              ? `장 마감 정산 · 남은 지분 ${holdings.length}개`
              : `${ACT_NAME[actOf(q.tick)]} · ${q.tick}번째 거래 · 운영비 ${q.upkeep}코인`}
          >
            {q.settling ? (
              <>
                <span className="we-ticker-act" data-act={3}>정산</span>
                <span className="we-ticker-sep" aria-hidden="true">·</span>
                <span>남은 지분 {holdings.length}</span>
              </>
            ) : (
              <>
                <span className="we-ticker-act" data-act={actOf(q.tick)}>
                  {ACT_NAME[actOf(q.tick)]}{q.closing ? ' ×2' : ''}
                </span>
                <span className="we-ticker-sep" aria-hidden="true">·</span>
                <span>틱 {q.tick}/{TICKS}</span>
                <span className="we-ticker-sep" aria-hidden="true">·</span>
                <span className="we-ticker-cost" title="최근 8틱 배당에 연동됩니다">운영비 🪙{q.upkeep}</span>
              </>
            )}
          </div>

          <div className="we-prompt">
            <div className="we-badges">
              {q.settling && <span className="we-badge we-badge--settle">◆ 마지막 인출 · 원금 🪙{holdPrincipal(q.holdLvl)}</span>}
              {!q.settling && q.relist && <span className="we-badge we-badge--relist">↻ 재상장 ×{RELIST_MULT}</span>}
              {!q.settling && q.holdLvl > 0 && (
                <span className="we-badge we-badge--hold">
                  ◆ 지분 ×{holdMultFor(q.holdLvl)} · 만기까지 {HOLD_PAYOUTS - q.holdPaid}회
                </span>
              )}
            </div>
            <span className="we-label">{q.settling ? '보유 지분을 정산하세요' : '이 뜻의 종목을 체결하세요'}</span>
            {/* 둘 다 문항이 바뀔 때 리마운트돼야 한다(뜻은 bump 애니메이션, 게이지는 초기화).
                다만 같은 부모의 형제이므로 key 가 겹치면 React 가 한쪽을 버린다 —
                실제로 q.key 를 그대로 둬서 "two children with the same key" 경고가 났다.
                네임스페이스를 붙여 리마운트 효과는 유지하고 충돌만 없앤다. */}
            <h1 className="we-meaning" key={`meaning-${q.key}`}>{q.target.ko}</h1>
            {reveal
              ? <div className="we-quote we-quote--done"><span className={`we-delta ${delta >= 0 ? 'we-delta--up' : 'we-delta--down'}`}>{delta >= 0 ? '▲ +' : '▼ '}{Math.abs(delta)}🪙</span></div>
              : <QuoteGauge key={`gauge-${q.key}`} win={q.win} mult={projMult} />}
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
                  // 리빌 중에는 탭 순서에서도 빠진다 — 키보드로 지분 버튼까지 4번 Tab 하던 문제.
                  tabIndex={reveal ? -1 : 0}
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
              q.tick <= 2 && !q.settling && (
                <p className="we-hint">
                  빠르게 체결할수록 배당이 큽니다 · 모르면 <b>관망</b> — 운영비 절반<br />
                  운영비는 <b>최근 배당</b>에 연동돼요. 못 버는 구간에서는 저절로 가벼워집니다.
                </p>
              )
            )}
          </div>

          <div className="we-action">
            {idle ? (
              <button type="button" className="we-resume" onClick={resume}>
                <span>
                  장을 잠시 멈췄어요
                  <span className="we-pass-sub">호가가 {AFK_STOP}번 그냥 닫혔어요 — 준비되면 이어서 열게요</span>
                </span>
                <Kbd>Enter</Kbd>
              </button>
            ) : holdOffer ? (
              <button
                type="button"
                ref={holdBtnRef}
                className="we-hold"
                onClick={buyHold}
                aria-disabled={bought}
                data-bought={bought ? '1' : '0'}
              >
                <span className="we-hold-main">
                  {bought
                    ? `지분 확보 · 다음 상장부터 배당 ×${offerMult}`
                    : `${offerLvl > 0 ? '지분 추가 매입' : '이 종목 지분 매입'} 🪙${holdPrice} → 배당 ×${offerMult}`}
                </span>
                {!bought && <Kbd>H</Kbd>}
                <span className="we-hold-sub">
                  {bought
                    ? `배당 ${HOLD_PAYOUTS}회면 만기 — 원금이 돌아와요`
                    : `배당 ${HOLD_PAYOUTS}회 만기 · 놓치면 원금 ${Math.round(HOLD_LOSS_RECOVER * 100)}% 손절 · 마감엔 마지막 인출 1회`}
                </span>
                {!bought && <span className="we-hold-bar" style={{ animationDuration: '2600ms' }} aria-hidden="true" />}
              </button>
            ) : (
              <button
                type="button"
                className="we-pass"
                onClick={() => { if (!reveal) settle('pass', null); }}
                aria-disabled={reveal}
              >
                <span>
                  관망
                  <span className="we-pass-sub">
                    운영비 절반 · 연속 유지 (앞으로 {passToBreak}회까지)
                  </span>
                </span>
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
  .we-badge--settle { border-color: color-mix(in srgb, var(--error) 55%, var(--bd)); color: var(--error); }
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
  /* 390px 에서 타일 텍스트 폭은 약 109px(15px 폰트 ≈ 13자) — 14자 이상 단어가 흘러넘치던 것을 접는다. */
  .we-tile-en { flex: 1; min-width: 0; overflow-wrap: anywhere; hyphens: auto; }
  .we-tile .gk-kbd { flex: none; opacity: .55; }
  .we-burst { position: absolute; inset: 0; pointer-events: none; }

  .we-settle-slot { width: min(560px, 92vw); min-height: 78px; display: flex; align-items: center; justify-content: center; }
  .we-settle { width: 100%; padding: 10px 14px; border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, transparent); animation: gk-pop .26s ease-out; }
  .we-settle-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .we-settle-row .gk-fbicon { align-self: center; }
  .we-settle-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 17px; font-weight: 800; color: var(--t1); overflow-wrap: anywhere; }
  .we-settle-pron { font-size: 12px; color: var(--t4); }
  .we-settle-ko { font-size: 13.5px; font-weight: 700; color: var(--t2); }
  .we-settle-ex { margin: 6px 0 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; line-height: 1.6; color: var(--t3); }
  .we-hint { margin: 0; font-size: 12.5px; line-height: 1.6; color: var(--t3); text-align: center; max-width: 42ch; }
  .we-hint b { color: var(--t2); }

  .we-action { width: min(560px, 92vw); }
  .we-pass, .we-hold, .we-resume { position: relative; overflow: hidden; width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; border-radius: var(--r-md, 10px); border: 1.5px dashed var(--bd); background: color-mix(in srgb, var(--bg) 66%, transparent); color: var(--t2); font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; cursor: pointer; text-align: left; transition: transform .12s var(--ease-spring, ease), border-color .15s, color .15s, background .15s; }
  .we-pass:hover, .we-hold:hover, .we-resume:hover { border-color: var(--t3); color: var(--t1); background: color-mix(in srgb, var(--bg) 86%, transparent); }
  .we-pass:active, .we-hold:active, .we-resume:active { transform: scale(.985); }
  .we-pass:focus-visible, .we-hold:focus-visible, .we-resume:focus-visible { outline: none; border-color: var(--active); box-shadow: 0 0 0 3px color-mix(in srgb, var(--active) 32%, transparent); }
  .we-pass[aria-disabled="true"], .we-hold[aria-disabled="true"] { opacity: .5; pointer-events: none; }
  .we-pass-sub { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 700; color: var(--t4); }
  .we-hold { flex-flow: row wrap; align-items: center; gap: 2px 10px; border-style: solid; border-color: color-mix(in srgb, var(--active) 58%, var(--bd)); color: var(--t1); }
  .we-hold[data-bought="1"] { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); opacity: 1; }
  .we-hold-main { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 800; overflow-wrap: anywhere; }
  .we-hold-sub { flex: 1 1 100%; font-size: 11.5px; font-weight: 700; color: var(--t4); }
  .we-hold .gk-kbd { flex: none; }
  .we-hold-bar { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; transform-origin: left center; background: var(--active); animation: we-quote-drain linear forwards; }
  .we-resume { border-style: solid; border-color: color-mix(in srgb, var(--active) 50%, var(--bd)); color: var(--t1); }

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
    .we-hold-main { font-size: 13px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .we-meaning, .we-flash, .we-settle, .we-delta { animation: none; }
    .we-pass, .we-hold, .we-resume { transition: none; }
  }
`;
