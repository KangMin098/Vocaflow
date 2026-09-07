// apps/web/src/components/game/letter-forge/LetterForgeGame.tsx
// Letter Forge — 철자 벼림(L4b 시각 생성). ko 뜻 → en 철자를 **인출해서** 조립한다.
//
// v07.10 — 적대적 반증(34/50) 6건 봉합. 2라운드에서 올린 긴장·판돈·콤보는 그대로 둔다.
//
//  ① FSRS 무결성(반증 #1, 최우선)
//     힌트로 완성한 단어는 **onWrong 으로 정직하게 보고**한다(assisted 아님).
//     구버전은 onCorrect 도 onWrong 도 호출하지 않아, 합리적 플레이어일수록 자기가
//     모르는 단어를 스케줄러에서 통째로 지웠다(체계적 결측). 시뮬 기준 미숙 단어
//     보고율 60~64% → 104~109%.
//     반대로 **이미 정답을 본 단어**(재벼림 라운드)와 **자리 비움 자동 실패**는
//     `{ assisted: true }` 로 올려 카드가 갱신되지 않게 한다(반증 #6).
//
//  ② 힌트가 콤보 보험이 아니다(반증 #2)
//     힌트를 사는 순간 콤보가 끊긴다. 실패와 같은 결과이므로 "40점으로 배수를 산다"가
//     성립하지 않는다. 시뮬: 콤보 6+ 보험 전략 +10~17% → −0.5~−3.0%.
//
//  ③ 열 이월이 램프를 뒤집지 못한다(반증 #3)
//     이월 상한 3300ms → 800ms, 그리고 이월을 **clamp 안**에서만 적용. 진행 감산은
//     문항마다 240ms(총 2640ms) — 이월 총량보다 3.3배 크다.
//
//  ④ 힌트는 오라클이 아니라 순수 보조(반증 #4)
//     "가장 왼쪽 빈칸 한 글자"만 채운다. 기존 배치는 건드리지 않고, 접두사 검증도
//     "어긋난 N개 되돌림" 문구도 없다. 빈칸이 없으면 힌트 자체가 비활성 —
//     "다 채우고 검증받기"가 원천 차단된다.
//
//  ⑤ 과열은 지배 전략이 아니고, 배수를 실제 값으로 표기(반증 #5)
//     화면이 곱셈 결과(예: 콤보 9 → ×5.32)를 그대로 보여준다. 시간 계수는 길이 연동,
//     실패하면 다음 문항 −0.8초 냉각. 시뮬: 무조건 과열 +4~5%(전문가 −3%),
//     "확실히 아는 것만 과열" +11~13% — 무조건 전략이 아니라 자기 판단이 이긴다.
//
//  ⑥ 진행률 기준 난이도 · 리빌 체류 · 슬롯 고정(반증 개선안 #5·#6)

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  ParticleBurst,
  FeedbackIcon,
  TimerBar,
  useSfx,
  useCountUp,
  useCountdown,
  useCombo,
  usePersonalBest,
  shuffle,
  clamp,
  pickDistinct,
  Kbd,
  NotEnoughWords,
  GameMusic,
  type Word,
  type ComboTier,
} from '@/components/game/_shared/gamekit';

/** 스캐폴드 계약 — 정답을 이미 보여준 뒤의 입력은 assisted 로 올려 FSRS 카드를 건드리지 않는다. */
interface ResultOpts {
  assisted?: boolean;
}

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// 내장 뱅크는 wordPool 이 undefined 일 때만 쓰는 폴백이다(데모 진입).
const DEFAULT_POOL: Word[] = [
  { en: 'ability', ko: '능력', example: 'She has the ability to stay calm.' },
  { en: 'balance', ko: '균형', example: 'He lost his balance on the ice.' },
  { en: 'courage', ko: '용기', example: 'It takes courage to admit a mistake.' },
  { en: 'mistake', ko: '실수', example: 'Everyone makes a mistake now and then.' },
  { en: 'develop', ko: '발전시키다', example: 'They develop new tools every year.' },
  { en: 'reserved', ko: '내성적인', example: 'He is reserved around strangers.' },
  { en: 'inclined', ko: '~하는 경향이 있는', example: 'I am inclined to agree with you.' },
  { en: 'judgment', ko: '판단, 평가', example: 'Trust your own judgment here.' },
  { en: 'advantage', ko: '이점, 유리함', example: 'Speed was their only advantage.' },
  { en: 'consequence', ko: '결과, 영향', example: 'Every choice has a consequence.' },
];

type Phase = 'ready' | 'playing' | 'reveal' | 'done';
type Verdict = 'correct' | 'near' | 'wrong';
type MissReason = 'wrong' | 'near' | 'timeout' | 'hint';

interface Tile {
  id: number;
  ch: string;
}
interface Q {
  key: number;
  index: number;
  target: Word;
  word: string;
  tray: Tile[];
  decoys: number;
}
interface MissEntry {
  word: Word;
  reason: MissReason;
}

const ROUND = 12;
// 스캐폴드 minWords=6 · NotEnoughWords need=6 과 일치시킨다(구버전 4 는 불일치였다).
const MIN_PLAY = 6;
const READY_MS = 2400;
const READY_MS_LATE = 1600; // 후반부는 결정 시간도 줄어든다
const REVEAL_OK_MS = 1500;
/** 오답 리빌은 학습이 일어나는 유일한 순간 — 철자 길이에 비례해 붙잡아 둔다(구버전 2.6초 고정). */
const revealNoMs = (len: number) => Math.max(3200, 320 * len);
const HINT_TIME_COST = 1500;
/** 정답을 본 뒤 이 시간 안에 같은 단어가 다시 나오면 독립 인출이 아니다 —
 *  recordGameResult 의 중앙 재채점 방지 창(10분)과 같은 값으로 맞춘다. */
const REPLAY_WINDOW_MS = 10 * 60 * 1000;

// ── 시간 곡선 ─────────────────────────────────────────────────────────────
// 반증 #3: 구버전은 진행 감산 총량 1200ms 인데 이월 상한이 3300ms 라 램프가 통째로
// 뒤집혔다(균일 6글자 풀에서 i=0 1.60s/자 → i=11 1.95s/자). 아래 값은
// **이월 총량(800) < 램프 총량(240×11=2640)** 이 되도록 잡았고, 이월을 clamp 안에서만
// 적용해 국소 완화폭도 최대 +130ms/자로 제한된다(구버전 +825ms/자).
const BASE_FIXED = 4300; // 뜻을 읽고 철자를 떠올리는 고정 비용
const PER_CHAR = 880; // 글자당 조립 비용
const RAMP_PER_Q = 240; // 문항마다 조여든다 — 총 2640ms
const BASE_MIN = 4600; // 짧은 단어가 후반에 와도 최소한의 공정 시간
// 세션 형태(2~4분) 보호 상한. 11글자 초반(4300+9680=13980)에서 실제로 걸린다 —
// 구버전 15000 처럼 도달 불가한 죽은 상수가 되지 않게 잡았고, 11글자 균일 풀에서도
// 램프가 −14% 남도록(1200 → 1031ms/자) 12500 이 아니라 13200 을 쓴다.
const BASE_MAX = 13200;
const CARRY_CAP = 800; // 열 이월 상한(구 2500+800)
const CARRY_FRAC = 0.1; // 이월은 그 문항 기본 시간의 10% 를 넘지 못한다
const COOL_MS = -800; // 과열 실패 시 다음 문항 냉각 벌
const HARD_MIN_MS = 3600;
const HOT_FLOOR_MS = 3200;
/** 과열 배수 — 콤보 배수에 곱해진다. 1.9 는 시뮬로 고른 값: 무조건 과열이 +4~5%(전문가 −3%)로
 *  지배 전략이 되지 않으면서, "확실히 아는 단어만 과열"이 +11~13% 로 확실히 이긴다. */
const HOT_MULT = 1.9;
/** 과열 시간 계수 — 긴 단어일수록 더 조인다(구버전은 길이 무관 0.62 라 장문에서 사실상 무위험). */
const hotCoef = (len: number) => (len <= 5 ? 0.78 : len <= 8 ? 0.72 : 0.66);

const forgeBase = (len: number, index: number) =>
  clamp(BASE_FIXED + len * PER_CHAR - index * RAMP_PER_Q, BASE_MIN, BASE_MAX);

/** 이월(양수)·냉각(음수)까지 반영한 이 문항의 기본 제한시간. */
function forgeMs(len: number, index: number, carry: number): number {
  const b = forgeBase(len, index);
  const eff = clamp(carry, COOL_MS, Math.min(CARRY_CAP, Math.round(b * CARRY_FRAC)));
  return Math.max(HARD_MIN_MS, b + eff);
}
const hotMs = (len: number, index: number, carry: number) =>
  Math.max(HOT_FLOOR_MS, Math.round(forgeMs(len, index, carry) * hotCoef(len)));

const COMBO_TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 2, mult: 1.25, label: '달아오름' },
  { at: 4, mult: 1.6, label: '벌겋게' },
  { at: 6, mult: 2.1, label: '백열' },
  { at: 9, mult: 2.8, label: '용광로' },
];

const REASON_LABEL: Record<MissReason, string> = {
  wrong: '틀림',
  near: '한 끗',
  timeout: '시간',
  hint: '도움',
};

const cleanWord = (en: string) => en.toLowerCase().replace(/[^a-z]/g, '');
const fmtMult = (m: number) => (m % 1 === 0 ? String(m) : m.toFixed(2).replace(/0$/, ''));

/** 한 글자 차이(삽입·삭제·교체)인지 — "아까웠다"를 "틀렸다"와 구분하기 위한 최소 편집거리. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/**
 * 예문에서 타깃(및 굴절형·어간 파생형)을 지운다.
 * 제출 전에 정답 철자가 화면에 인쇄되면 인출이 아니게 되므로, 어간이 한 글자라도
 * 남으면 예문 자체를 버린다(문맥보다 인출 무결성이 먼저다).
 */
function maskExample(ex: string | undefined, word: string, inflected?: string[]): string | null {
  if (!ex) return null;
  const trimmed = ex.trim();
  if (!trimmed || trimmed.length > 160) return null;
  const stem = word.slice(0, Math.max(3, Math.ceil(word.length * 0.66)));
  const inf = new Set((inflected ?? []).map((w) => cleanWord(w)).filter(Boolean));
  const out = trimmed.replace(/[A-Za-z][A-Za-z'’-]*/g, (tok) => {
    const core = cleanWord(tok);
    if (!core) return tok;
    if (core === word || inf.has(core) || core.includes(stem)) return '____';
    if (core.length >= stem.length && word.includes(core)) return '____';
    return tok;
  });
  if (out.toLowerCase().includes(stem)) return null;
  return out;
}

/**
 * 트레이 = 타깃 글자 + 슬래그(불순물). 슬래그 절반은 타깃 글자의 중복이라
 * "몇 개가 가짜인가"를 세어도 어느 것이 가짜인지는 드러나지 않는다.
 */
function buildTray(word: string, decoys: number, pool: Word[], targetEn: string): Tile[] {
  const chars = word.split('');
  const others = pool
    .filter((w) => w.en !== targetEn)
    .flatMap((w) => cleanWord(w.en).split(''));
  const bank = others.length >= 8 ? others : 'aeiourstnlmcdghp'.split('');
  const extra: string[] = [];
  for (let i = 0; i < decoys; i++) {
    // 0.5 — 절반은 타깃 글자의 중복(가장 알아채기 어려운 위장), 절반은 외래 글자.
    const dup = Math.random() < 0.5;
    extra.push(
      dup ? chars[Math.floor(Math.random() * chars.length)] : bank[Math.floor(Math.random() * bank.length)],
    );
  }
  const all = [...chars, ...extra].map((ch, i) => ({ id: i, ch }));
  let tiles = shuffle(all);
  // 앞에서부터 그대로 읽으면 정답이 되는 사고 방지
  if (tiles.slice(0, chars.length).map((t) => t.ch).join('') === word) tiles = shuffle(tiles);
  return tiles;
}

function makePlan(src: Word[], n: number): Word[] {
  return pickDistinct(src, n, () => false).sort(
    (a, b) => cleanWord(a.en).length - cleanWord(b.en).length,
  );
}

// ─── 슬롯 줄 (메모) ───────────────────────────────────────────────────────
// useCountdown 은 매 프레임 setState 한다. 보드는 props 가 바뀔 때만 그린다.
// 슬롯은 **자리 고정(sparse)** 이다 — 가운데를 빼도 뒤가 앞으로 당겨지지 않는다.
// 그래야 힌트로 고정한 칸이 다른 조작 때문에 밀리지 않는다.
const SlotRow = memo(function SlotRow({
  q,
  filled,
  hinted,
  phase,
  verdict,
  attempt,
  onRemove,
}: {
  q: Q;
  filled: (number | undefined)[];
  hinted: boolean[];
  phase: Phase;
  verdict: Verdict | null;
  attempt: string[];
  onRemove: (i: number) => void;
}) {
  const chOf = (id: number) => q.tray.find((t) => t.id === id)?.ch ?? '';
  const revealing = phase === 'reveal';
  return (
    <div
      className={`lf-slots ${revealing && verdict === 'correct' ? 'lf-slots--ok' : ''} ${
        revealing && verdict !== 'correct' ? 'lf-slots--no' : ''
      }`}
    >
      {Array.from({ length: q.word.length }).map((_, i) => {
        const id = filled[i];
        const placed = id !== undefined ? chOf(id) : '';
        const shown = revealing ? q.word[i] : placed;
        const mismatched = revealing && (attempt[i] ?? '') !== q.word[i];
        const locked = hinted[i] === true;
        const removable = phase === 'playing' && id !== undefined && !locked;
        return (
          <button
            key={i}
            type="button"
            className={`lf-slot ${shown ? 'lf-slot--filled' : ''} ${locked ? 'lf-slot--hint' : ''} ${
              revealing ? (mismatched ? 'lf-slot--bad' : 'lf-slot--good') : ''
            }`}
            onClick={() => removable && onRemove(i)}
            aria-disabled={!removable}
            tabIndex={removable ? 0 : -1}
            aria-label={
              revealing
                ? `${i + 1}번째 정답 글자 ${q.word[i]}${mismatched ? ' — 내가 놓은 글자와 다름' : ''}`
                : placed
                  ? `${i + 1}번째 글자 ${placed}${locked ? ' 도움으로 고정됨' : ' — 눌러서 빼기'}`
                  : `${i + 1}번째 빈칸`
            }
          >
            {(shown ?? '').toUpperCase()}
          </button>
        );
      })}
    </div>
  );
});

// ─── 트레이 (메모) ────────────────────────────────────────────────────────
const TrayRow = memo(function TrayRow({
  q,
  filled,
  phase,
  onFill,
}: {
  q: Q;
  filled: (number | undefined)[];
  phase: Phase;
  onFill: (id: number) => void;
}) {
  const used = new Set(filled.filter((v): v is number => v !== undefined));
  const cold = phase === 'ready';
  const live = phase === 'playing';
  return (
    <div className="lf-tray" data-dense={q.tray.length > 12 ? '1' : '0'}>
      {q.tray.map((t) => {
        const isUsed = used.has(t.id);
        const active = live && !isUsed;
        return (
          <button
            key={t.id}
            type="button"
            className={`lf-key ${isUsed ? 'lf-key--used' : ''} ${cold ? 'lf-key--cold' : ''}`}
            onClick={() => active && onFill(t.id)}
            aria-disabled={!active}
            tabIndex={active ? 0 : -1}
            aria-label={cold ? '아직 달궈지지 않은 광석' : `글자 ${t.ch}${isUsed ? ' 사용됨' : ''}`}
          >
            {cold ? '·' : t.ch.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
});

export function LetterForgeGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const pool = useMemo(() => {
    const src = wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL;
    const seen = new Set<string>();
    return src.filter((w) => {
      const c = cleanWord(w.en);
      if (c.length < 3 || c.length > 11) return false;
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });
  }, [wordPool]);

  const sfx = useSfx();
  const pb = usePersonalBest('letter-forge');

  const [plan, setPlan] = useState<Word[]>([]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [q, setQ] = useState<Q | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [filled, setFilled] = useState<(number | undefined)[]>([]);
  const [hinted, setHinted] = useState<boolean[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintTotal, setHintTotal] = useState(0);
  const [overheat, setOverheat] = useState(false);
  const [earnMult, setEarnMult] = useState(1);
  const [score, setScore] = useState(0);
  const [gained, setGained] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [attempt, setAttempt] = useState<string[]>([]);
  const [okCount, setOkCount] = useState(0);
  const [cleanCount, setCleanCount] = useState(0);
  const [carryGain, setCarryGain] = useState(0);
  const [tierMsg, setTierMsg] = useState('');
  const [pinned, setPinned] = useState(false);
  const [away, setAway] = useState(false);
  const [missed, setMissed] = useState<MissEntry[]>([]);
  const [bestResult, setBestResult] = useState<{ improved: boolean; prev: number | null } | null>(null);
  const [msg, setMsg] = useState('');

  const shownScore = useCountUp(score);

  // ── refs (안정된 콜백에서 최신 값을 읽기 위한 거울) ──
  const mountedRef = useRef(true);
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const planRef = useRef<Word[]>([]);
  const phaseRef = useRef<Phase>('ready');
  const qRef = useRef<Q | null>(null);
  const filledRef = useRef<(number | undefined)[]>([]);
  filledRef.current = filled;
  const hintedRef = useRef<boolean[]>([]);
  hintedRef.current = hinted;
  const hintsUsedRef = useRef(0);
  hintsUsedRef.current = hintsUsed;
  const overheatRef = useRef(false);
  overheatRef.current = overheat;
  const earnMultRef = useRef(1);
  const indexRef = useRef(0);
  const keyRef = useRef(0);
  const answeredRef = useRef(false);
  const carryRef = useRef(0);
  const perMsRef = useRef(10000);
  const remainRef = useRef(0);
  const multRef = useRef(1);
  const missedRef = useRef<MissEntry[]>([]);
  const doneRef = useRef(false);
  /**
   * 정답 철자를 화면에 보여준 시각(en → ms). 재벼림 라운드의 재출제를 가려낸다.
   * 창을 10분으로 잡은 것은 recordGameResult 의 중앙 재채점 방지 창과 같은 값이라서다 —
   * 게임과 스케줄러가 "같은 카드의 반복"을 같은 기준으로 본다.
   */
  const revealedRef = useRef(new Map<string, number>());
  /** 이번 문항에서 사용자가 무엇이든 했는가(선택·배치·제거·도움). */
  const touchedRef = useRef(false);
  /** 손도 대지 않은 채 시간만 흘려보낸 연속 횟수 — 자리 비움 감지. */
  const idleStreakRef = useRef(0);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 리빌이 시작된 시각 — 조립 중 눌린 키가 곧바로 '체류'로 오인되지 않게 하는 유예. */
  const revealAtRef = useRef(0);

  const submitRef = useRef<(reason: 'manual' | 'timeout') => void>(() => {});
  const beginRef = useRef<(hot: boolean, manual: boolean) => void>(() => {});
  const nextRef = useRef<(i: number) => void>(() => {});
  const advanceRef = useRef<() => void>(() => {});

  const combo = useCombo({
    tiers: COMBO_TIERS,
    onTierUp: (t) => {
      if (t.label) {
        setTierMsg(t.label);
        sfx.coin();
      }
    },
    onBreak: (lost) => setTierMsg(`콤보 ${lost} 소실`),
  });
  multRef.current = combo.mult;
  const comboApi = useRef(combo);
  comboApi.current = combo;

  const cd = useCountdown({
    totalMs: 10000,
    running: phase === 'playing',
    warnAtMs: 2500,
    onEnd: () => submitRef.current('timeout'),
  });
  remainRef.current = cd.remainMs;
  const cdRef = useRef(cd);
  cdRef.current = cd;

  const roundLen = plan.length;

  // ── 문항 시작 ──
  const startQ = useCallback((index: number) => {
    if (!mountedRef.current) return;
    const p = planRef.current;
    if (index >= p.length || p.length === 0) {
      setPhase('done');
      phaseRef.current = 'done';
      setQ(null);
      qRef.current = null;
      setQIndex(p.length);
      return;
    }
    const target = p[index];
    const word = cleanWord(target.en);
    // 반증 개선안 #6 — 절대 index 가 아니라 **진행률** 기준. 6단어 재벼림 라운드에서도
    // 난이도 램프가 라운드 전체에 균등하게 걸린다(구버전은 3에서 멈췄다).
    const prog = index / Math.max(1, p.length);
    const decoys = clamp(2 + Math.floor(prog * 4), 2, 5);
    keyRef.current += 1;
    const nq: Q = {
      key: keyRef.current,
      index,
      target,
      word,
      tray: buildTray(word, decoys, poolRef.current, target.en),
      decoys,
    };
    qRef.current = nq;
    setQ(nq);
    setQIndex(index);
    indexRef.current = index;
    const empty = new Array<number | undefined>(word.length).fill(undefined);
    setFilled(empty);
    filledRef.current = empty;
    const noHints = new Array<boolean>(word.length).fill(false);
    setHinted(noHints);
    hintedRef.current = noHints;
    setHintsUsed(0);
    hintsUsedRef.current = 0;
    setOverheat(false);
    overheatRef.current = false;
    setEarnMult(multRef.current);
    earnMultRef.current = multRef.current;
    setVerdict(null);
    setGained(0);
    setAttempt([]);
    setTierMsg('');
    setPinned(false);
    setAway(false);
    answeredRef.current = false;
    touchedRef.current = false;
    setPhase('ready');
    phaseRef.current = 'ready';
    setMsg(`${index + 1}번째 · 뜻 ${target.ko} · ${word.length}글자 · 벼림 방식을 고르세요`);
    if (readyTimer.current) clearTimeout(readyTimer.current);
    const late = index >= Math.ceil(p.length * 0.5);
    readyTimer.current = setTimeout(
      () => beginRef.current(false, false),
      late ? READY_MS_LATE : READY_MS,
    );
  }, []);
  nextRef.current = startQ;

  // ── 벼림 시작(기본 / 과열) ──
  const beginForge = useCallback((hot: boolean, manual: boolean) => {
    if (phaseRef.current !== 'ready') return;
    const nq = qRef.current;
    if (!nq) return;
    if (readyTimer.current) {
      clearTimeout(readyTimer.current);
      readyTimer.current = null;
    }
    if (manual) touchedRef.current = true;
    const ms = hot
      ? hotMs(nq.word.length, nq.index, carryRef.current)
      : forgeMs(nq.word.length, nq.index, carryRef.current);
    carryRef.current = 0;
    perMsRef.current = ms;
    setOverheat(hot);
    overheatRef.current = hot;
    // 배수를 문항 시작 시점에 확정한다 — 화면에 보인 값과 정산되는 값이 항상 같다.
    const em = multRef.current * (hot ? HOT_MULT : 1);
    earnMultRef.current = em;
    setEarnMult(em);
    setCarryGain(0);
    // reset 은 phase 가 playing 으로 바뀌기 직전에 — 훅이 재개 시점을 정확히 다시 잡는다.
    cdRef.current.reset(ms);
    setPhase('playing');
    phaseRef.current = 'playing';
    setMsg(
      `${hot ? '과열' : '기본'} 벼림 · ${(ms / 1000).toFixed(1)}초 · 배수 ×${fmtMult(em)}`,
    );
  }, []);
  beginRef.current = beginForge;

  const pushMissed = useCallback((w: Word, reason: MissReason) => {
    const next = [...missedRef.current.filter((m) => m.word.en !== w.en), { word: w, reason }];
    missedRef.current = next;
    setMissed(next);
  }, []);

  // ── 제출(수동 / 시간초과) ──
  const submit = useCallback(
    (reason: 'manual' | 'timeout') => {
      if (answeredRef.current) return;
      const nq = qRef.current;
      if (!nq) return;
      answeredRef.current = true;

      const perSlot = filledRef.current.map((id) =>
        id === undefined ? '' : (nq.tray.find((t) => t.id === id)?.ch ?? ''),
      );
      const chars = perSlot.join('');
      setAttempt(perSlot);
      const ok = chars === nq.word;
      const remainFrac =
        perMsRef.current > 0 ? clamp(remainRef.current / perMsRef.current, 0, 1) : 0;
      const usedHint = hintsUsedRef.current > 0;
      const raw = 60 + nq.word.length * 14 + nq.decoys * 6 + Math.round(remainFrac * 70);

      // ── FSRS 로 올릴 신호의 성격을 먼저 정한다 ──
      // ① 이 단어의 정답 철자를 이 마운트에서 이미 보여줬다면(재벼림 라운드) 독립 인출이
      //    아니다 → assisted. ② 두 문항 연속 손도 안 댄 자동 실패는 자리 비움이다 → assisted.
      const untouched = !touchedRef.current && chars.length === 0;
      idleStreakRef.current = untouched ? idleStreakRef.current + 1 : 0;
      const isAway = idleStreakRef.current >= 2;
      if (isAway) setAway(true);
      const seenAt = revealedRef.current.get(nq.target.en);
      const replayed = seenAt !== undefined && Date.now() - seenAt < REPLAY_WINDOW_MS;
      const opts: ResultOpts | undefined = replayed || isAway ? { assisted: true } : undefined;

      if (ok) {
        const g = usedHint
          ? Math.round(raw * 0.5)
          : Math.round(raw * earnMultRef.current);
        setGained(g);
        setScore((s) => s + g);
        setVerdict('correct');
        setOkCount((c) => c + 1);
        if (usedHint) {
          // 도움을 받아 완성한 단어 = 스스로 인출하지 못한 단어다.
          // onCorrect 를 부르지 않는 것으로 끝내면(구버전) 이 단어는 FSRS 에서 영원히
          // 사라진다 — 그래서 **오답으로 정직하게** 올린다. 점수·완성 판정은 살려 두어
          // 학습자에게는 비난이 되지 않게 한다.
          sfx.click();
          pushMissed(nq.target, 'hint');
          carryRef.current = 0;
          setCarryGain(0);
          onWrong?.(nq.target, opts);
          setMsg(`완성 ${nq.target.en} · 도움을 받았으니 복습 목록에 남겨둘게요 · +${g}점`);
        } else {
          const nc = comboApi.current.hit();
          sfx.correct(nc, nc % 3 === 0);
          setCleanCount((c) => c + 1);
          onCorrect?.(nq.target, opts);
          // 이월은 상한 800ms — 램프 총량(2640ms)보다 작아 후반이 헐렁해지지 않는다.
          const carry = Math.min(
            CARRY_CAP,
            Math.round(remainRef.current * 0.5) + (overheatRef.current ? 250 : 0),
          );
          carryRef.current = carry;
          setCarryGain(carry);
          setMsg(
            `정답 ${nq.target.en} · +${g}점${overheatRef.current ? ' · 과열 성공' : ''}${
              carry > 0 ? ` · ${(carry / 1000).toFixed(1)}초 이월` : ''
            }`,
          );
        }
      } else {
        const near = chars.length > 0 && editDistance(chars, nq.word) <= 1;
        const g = near ? Math.round(raw * 0.3) : 0;
        if (g > 0) {
          setGained(g);
          setScore((s) => s + g);
        } else {
          setGained(0);
        }
        setVerdict(near ? 'near' : 'wrong');
        comboApi.current.miss();
        // 과열 실패는 시간으로도 물린다 — 다음 문항 −0.8초(반증 #5: 실패 비용이 없었다).
        carryRef.current = overheatRef.current ? COOL_MS : 0;
        setCarryGain(0);
        if (near) sfx.nearMiss();
        else sfx.wrong();
        onWrong?.(nq.target, opts);
        pushMissed(nq.target, reason === 'timeout' && chars.length === 0 ? 'timeout' : near ? 'near' : 'wrong');
        setMsg(
          near
            ? `한 글자 차이였어요 · 정답은 ${nq.target.en}`
            : reason === 'timeout'
              ? `시간이 다 됐어요 · 정답은 ${nq.target.en}`
              : `정답은 ${nq.target.en}`,
        );
      }
      if (usedHint) setHintTotal((h) => h + 1);
      revealedRef.current.set(nq.target.en, Date.now());

      setPhase('reveal');
      phaseRef.current = 'reveal';
      revealAtRef.current = Date.now();
      setPinned(isAway);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      // 자리를 비운 것으로 보이면 자동 진행을 멈춘다 — 방치로 오답이 무한 적재되지 않게.
      if (!isAway) {
        revealTimer.current = setTimeout(
          () => nextRef.current(indexRef.current + 1),
          ok ? REVEAL_OK_MS : revealNoMs(nq.word.length),
        );
      }
    },
    [sfx, onCorrect, onWrong, pushMissed],
  );
  submitRef.current = submit;

  const advance = useCallback(() => {
    if (phaseRef.current !== 'reveal') return;
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    idleStreakRef.current = 0; // 사람이 눌렀다 — 자리 비움 카운터 해제
    nextRef.current(indexRef.current + 1);
  }, []);
  advanceRef.current = advance;

  /**
   * 리빌 중 아무 입력이나 들어오면 자동 진행을 멈춘다 — 정답을 읽을 시간을 뺏지 않는다.
   * 다만 리빌 직후 450ms 는 무시한다: 조립 중 눌린 키가 흘러 들어와 흐름이 끊기는 것을 막는다.
   */
  const pinReveal = useCallback(() => {
    if (phaseRef.current !== 'reveal') return;
    if (Date.now() - revealAtRef.current < 450) return;
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    idleStreakRef.current = 0;
    setPinned(true);
  }, []);

  // ── 조작 ──
  const fill = useCallback((tileId: number) => {
    if (phaseRef.current !== 'playing') return;
    const nq = qRef.current;
    if (!nq) return;
    const cur = filledRef.current;
    if (cur.includes(tileId)) return;
    const slot = cur.findIndex((v) => v === undefined);
    if (slot < 0) return;
    const next = cur.slice();
    next[slot] = tileId;
    filledRef.current = next;
    touchedRef.current = true;
    setFilled(next);
  }, []);

  const removeAt = useCallback((i: number) => {
    if (phaseRef.current !== 'playing') return;
    if (hintedRef.current[i]) return; // 도움으로 고정된 칸은 빼지 않는다
    const cur = filledRef.current;
    if (cur[i] === undefined) return;
    const next = cur.slice();
    next[i] = undefined;
    filledRef.current = next;
    touchedRef.current = true;
    setFilled(next);
  }, []);

  const removeLast = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const cur = filledRef.current;
    for (let i = cur.length - 1; i >= 0; i--) {
      if (cur[i] !== undefined && !hintedRef.current[i]) {
        const next = cur.slice();
        next[i] = undefined;
        filledRef.current = next;
        touchedRef.current = true;
        setFilled(next);
        return;
      }
    }
  }, []);

  const hintCost = 40 + 60 * hintsUsed;

  /**
   * 도움 — **가장 왼쪽 빈칸 한 글자**만 채운다.
   * 반증 #4: 구버전은 배치와 정답의 최장 공통 접두사를 계산해 "네 앞 p글자는 맞다"를
   * 40점에 파는 오라클이었다. 이제 기존 배치는 읽지도 건드리지도 않으므로
   * 어떤 검증 신호도 새지 않는다. 빈칸이 없으면 버튼 자체가 비활성이다.
   * 그리고 도움은 **콤보를 끊는다** — 40점짜리 스트릭 보험이 되지 않게(반증 #2).
   */
  const useHint = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const nq = qRef.current;
    if (!nq) return;
    const cur = filledRef.current;
    const slot = cur.findIndex((v) => v === undefined);
    if (slot < 0) return; // 빈칸이 없으면 도울 것이 없다(= 검증 창구가 열리지 않는다)
    const want = nq.word[slot];
    const used = new Set(cur.filter((v): v is number => v !== undefined));
    let tile = nq.tray.find((t) => t.ch === want && !used.has(t.id));
    const next = cur.slice();
    if (!tile) {
      // 같은 글자를 이미 다른 칸에 다 써버린 경우 — 고정되지 않은 칸에서 한 장 회수한다.
      const from = next.findIndex(
        (v, i) => v !== undefined && !hintedRef.current[i] && nq.tray.find((t) => t.id === v)?.ch === want,
      );
      if (from < 0) return;
      tile = nq.tray.find((t) => t.id === next[from]);
      next[from] = undefined;
    }
    if (!tile) return;
    next[slot] = tile.id;
    filledRef.current = next;
    setFilled(next);
    const nh = hintedRef.current.slice();
    nh[slot] = true;
    hintedRef.current = nh;
    setHinted(nh);
    const n = hintsUsedRef.current;
    hintsUsedRef.current = n + 1;
    setHintsUsed(n + 1);
    touchedRef.current = true;
    const cost = 40 + 60 * n;
    setScore((s) => Math.max(0, s - cost));
    cdRef.current.drain(HINT_TIME_COST);
    // 도움 = 스스로 인출하지 못했다는 뜻이므로 실패와 같은 결과를 진다.
    // (구버전은 콤보를 '동결'해서 40점짜리 스트릭 보험이 됐다 — 반증 #2)
    if (n === 0) comboApi.current.miss();
    setTierMsg(''); // onBreak 가 띄운 '콤보 소실' 토스트 대신 아래 상태 칩이 맥락을 설명한다
    sfx.click();
    setMsg(`${slot + 1}번째 글자를 채웠어요 · ${cost}점 · 1.5초 · 콤보는 여기서 다시 쌓아요`);
  }, [sfx]);

  // ── 키보드 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ph = phaseRef.current;
      // 버튼에 포커스가 있을 때의 Enter/Space 는 브라우저의 기본 활성화에 맡긴다 —
      // 여기서 가로채면 "과열"에 포커스한 채 Enter 를 눌러도 기본 벼림이 시작돼 버린다.
      const onButton =
        e.target instanceof HTMLElement && e.target.closest('button') !== null;
      const activation = e.key === 'Enter' || e.key === ' ';
      if (ph === 'ready') {
        if (e.key === '1' || (e.key === 'Enter' && !onButton)) {
          e.preventDefault();
          beginRef.current(false, true);
        } else if (e.key === '2') {
          e.preventDefault();
          beginRef.current(true, true);
        }
        return;
      }
      if (ph === 'reveal') {
        if (activation && !onButton) {
          e.preventDefault();
          advanceRef.current();
        } else if (!activation && !e.metaKey && !e.ctrlKey && !e.altKey) {
          // Tab·화살표 같은 탐색 키도 "사람이 보고 있다"는 신호다 — 자동 진행을 멈춘다.
          pinReveal();
        }
        return;
      }
      if (ph !== 'playing') return;
      const nq = qRef.current;
      if (!nq) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        removeLast();
        return;
      }
      if (e.key === 'Enter') {
        if (onButton) return;
        e.preventDefault();
        if (filledRef.current.every((v) => v !== undefined)) submitRef.current('manual');
        return;
      }
      const ch = e.key.toLowerCase();
      if (!/^[a-z]$/.test(ch)) return;
      const used = new Set(filledRef.current.filter((v): v is number => v !== undefined));
      const tile = nq.tray.find((t) => t.ch === ch && !used.has(t.id));
      if (tile) {
        e.preventDefault();
        fill(tile.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fill, removeLast, pinReveal]);

  // ── 마운트 / 정리 ──
  useEffect(() => {
    mountedRef.current = true;
    if (pool.length >= MIN_PLAY) {
      const p = makePlan(pool, Math.min(ROUND, pool.length));
      planRef.current = p;
      setPlan(p);
      startQ(0);
    }
    return () => {
      mountedRef.current = false;
      if (readyTimer.current) clearTimeout(readyTimer.current);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 마무리 ──
  useEffect(() => {
    if (phase !== 'done' || doneRef.current) return;
    doneRef.current = true;
    setBestResult(pb.submit(score));
    sfx.fanfare();
  }, [phase, score, pb, sfx]);

  const restart = useCallback(
    (only?: Word[]) => {
      const useOnly = !!only && only.length >= 2;
      const src = useOnly ? (only as Word[]) : poolRef.current;
      const p = makePlan(src, Math.min(useOnly ? src.length : ROUND, src.length));
      planRef.current = p;
      setPlan(p);
      comboApi.current.reset();
      setScore(0);
      setOkCount(0);
      setCleanCount(0);
      setHintTotal(0);
      setMissed([]);
      missedRef.current = [];
      carryRef.current = 0;
      setCarryGain(0);
      setBestResult(null);
      idleStreakRef.current = 0;
      doneRef.current = false;
      // revealedRef 는 일부러 비우지 않는다 — 이미 정답을 본 단어의 재출제는
      // 다음 라운드에서도 assisted 로 올라가야 FSRS 가 오염되지 않는다(반증 #6).
      startQ(0);
    },
    [startQ],
  );

  const handleExit = useCallback(() => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    onExit?.();
  }, [onExit]);

  // ── 파생 표시값 ──
  const finalStretch = roundLen >= 6 && qIndex >= roundLen - 3;
  const heat = combo.combo;
  const edge = finalStretch ? '#7A2E12' : heat >= 6 ? '#6B2A18' : '#583120';
  const glow = heat >= 9 ? 'rgba(255,124,48,.66)' : heat >= 6 ? 'rgba(255,150,66,.52)' : 'rgba(255,178,92,.34)';
  const atmos = useMemo(
    () => (
      <AmbientBackground
        center="#FBF1E3"
        mid="#EED2AC"
        edge={edge}
        glow={glow}
        glowAt="50% 26%"
        watermark="letter-forge"
      />
    ),
    [edge, glow],
  );

  const maskedExample = useMemo(
    () => (q ? maskExample(q.target.example, q.word, q.target.inflected) : null),
    [q],
  );

  const cleanMissed = useMemo(() => missed.map((m) => m.word), [missed]);

  if (pool.length < MIN_PLAY) return <NotEnoughWords need={MIN_PLAY} onExit={onExit} />;

  const len = q ? q.word.length : 0;
  const placedCount = filled.reduce<number>((n, v) => (v === undefined ? n : n + 1), 0);
  const full = q ? placedCount === len : false;
  const hasEmpty = q ? placedCount < len : false;
  // 결정 단계에 보여줄 실제 값 — 이월(또는 냉각)까지 포함한다.
  const readyMs = q ? forgeMs(len, q.index, carryRef.current) : 0;
  const readyHotMs = q ? hotMs(len, q.index, carryRef.current) : 0;
  const baseMult = combo.mult;
  const hotMultShown = baseMult * HOT_MULT;
  const lateReady = roundLen > 0 && qIndex >= Math.ceil(roundLen * 0.5);
  const speedTag =
    verdict === 'correct'
      ? perMsRef.current > 0 && remainRef.current / perMsRef.current > 0.5
        ? '⚡ 신속'
        : remainRef.current / perMsRef.current > 0.2
          ? '견실'
          : '아슬아슬'
      : '';

  return (
    <div className={`gk-root lf-root ${finalStretch ? 'lf-root--final' : ''}`}>
      <GameMusic gameId="letter-forge" />
      <GameKitStyles />
      {atmos}
      <style dangerouslySetInnerHTML={{ __html: LF_CSS }} />
      <div
        className="gk-energy"
        aria-hidden="true"
        style={{ opacity: Math.min(0.5, heat * 0.04), transform: `scale(${1 + clamp(Math.floor(heat / 4), 0, 3) * 0.15})` }}
      />

      <Hud
        score={shownScore}
        progress={roundLen > 0 ? qIndex / roundLen : 0}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
      />
      <div className="gk-sr" aria-live="polite">{msg}</div>

      {phase === 'done' ? (
        <GameDone
          mark="letter-forge"
          lead={cleanCount === roundLen && roundLen > 0 ? '전부 스스로 벼렸어요' : '오늘 잘 마쳤어요'}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${okCount}/${roundLen}`, label: '완성한 단어' },
            { num: `${cleanCount}`, label: '도움 없이' },
            { num: `🔥 ${combo.best}`, label: '최고 콤보' },
          ]}
          best={
            bestResult
              ? { prev: bestResult.prev, now: score, label: '점수', improved: bestResult.improved }
              : undefined
          }
          badge={
            roundLen > 0 && cleanCount === roundLen && hintTotal === 0 ? (
              <>
                <FeedbackIcon kind="correct" /> 무결 벼림
              </>
            ) : undefined
          }
          reveal={
            missed.length > 0 ? (
              <div className="lf-missed">
                <p className="lf-missed-title">다시 벼릴 것</p>
                <ul className="lf-missed-list">
                  {missed.slice(0, 6).map((m) => (
                    <li key={m.word.en} className="lf-missed-chip" data-reason={m.reason}>
                      <span className="lf-missed-en">{m.word.en}</span>
                      <span className="lf-missed-ko">{m.word.ko}</span>
                      <span className="lf-missed-tag">{REASON_LABEL[m.reason]}</span>
                    </li>
                  ))}
                </ul>
                {missed.length > 6 && <p className="lf-missed-more">외 {missed.length - 6}개</p>}
              </div>
            ) : undefined
          }
          restartHint={
            bestResult == null
              ? undefined
              : bestResult.prev == null
                ? '확실히 아는 단어에만 과열을 걸면 배수가 크게 붙어요.'
                : bestResult.improved
                  ? '감각이 남아 있을 때 한 판 더.'
                  : `${(bestResult.prev - score).toLocaleString()}점만 더 벼리면 최고 기록이에요.`
          }
          footer={
            cleanMissed.length >= 2 ? (
              <button type="button" className="gk-btn lf-again" onClick={() => restart(cleanMissed)}>
                이 {cleanMissed.length}개만 다시 벼리기
              </button>
            ) : undefined
          }
          onRestart={() => restart()}
          onExit={handleExit}
        />
      ) : q ? (
        <main
          className={`gk-stage lf-stage ${finalStretch ? 'lf-stage--final' : ''}`}
          onPointerDownCapture={pinReveal}
        >
          <div className="lf-prompt">
            <span className="lf-label">
              {finalStretch ? '마지막 세 자루' : `${qIndex + 1} / ${roundLen} 자루`}
              <span className="lf-label-sep">·</span>
              {len}글자
              {overheat && phase !== 'ready' && (
                <span className="lf-hot-tag">🔥 과열 ×{fmtMult(earnMult)}</span>
              )}
            </span>
            <h1 className="lf-meaning" key={q.key}>{q.target.ko}</h1>
            {phase === 'reveal' && q.target.example ? (
              <p className="lf-context">{q.target.example}</p>
            ) : maskedExample ? (
              <p className="lf-context">{maskedExample}</p>
            ) : q.target.pos ? (
              <p className="lf-context lf-context--pos">{q.target.pos}</p>
            ) : null}
            <div className="lf-timer-wrap">
              <TimerBar
                frac={phase === 'ready' ? 1 : cd.frac}
                warning={phase === 'playing' && cd.warning}
                seconds={phase === 'ready' ? Math.round(readyMs / 1000) : cd.remainSec}
                label="이 단어의 남은 시간"
              />
            </div>
          </div>

          {/* 결정 · 상태 스트립 — 높이 고정이라 단계가 바뀌어도 레이아웃이 튀지 않는다 */}
          <div className="lf-strip">
            {phase === 'ready' ? (
              <div className="lf-choice" key={q.key}>
                <button type="button" className="lf-pick" onClick={() => beginForge(false, true)}>
                  <span className="lf-pick-top">⚒ 기본 벼림</span>
                  <span className="lf-pick-sub">
                    <Kbd>1</Kbd> {(readyMs / 1000).toFixed(1)}초 · 배수 ×{fmtMult(baseMult)}
                  </span>
                </button>
                <button type="button" className="lf-pick lf-pick--hot" onClick={() => beginForge(true, true)}>
                  <span className="lf-pick-top">🔥 과열 벼림</span>
                  {/* 반증 #5 — 곱셈 결과를 그대로 인쇄한다. 구버전은 '×2.2' 만 적어
                      콤보 배수와 배타적 선택처럼 보였다(실제로는 곱해진다). */}
                  <span className="lf-pick-sub">
                    <Kbd>2</Kbd> {(readyHotMs / 1000).toFixed(1)}초 · 배수 ×{fmtMult(hotMultShown)}
                  </span>
                </button>
                <div className="lf-choice-bar" aria-hidden="true">
                  <span style={{ animationDuration: `${lateReady ? READY_MS_LATE : READY_MS}ms` }} />
                </div>
              </div>
            ) : phase === 'reveal' ? (
              <div className={`lf-verdict lf-verdict--${verdict ?? 'wrong'}`}>
                <FeedbackIcon kind={verdict === 'correct' ? 'correct' : verdict === 'near' ? 'near' : 'wrong'} size={16} />
                <span className="lf-verdict-txt">
                  {verdict === 'correct'
                    ? hintsUsed > 0
                      ? '완성 · 도움 받음'
                      : `벼림 성공 ${speedTag}`
                    : verdict === 'near'
                      ? '한 글자 차이 — 아까웠어요'
                      : attempt.every((c) => !c)
                        ? '시간이 다 됐어요'
                        : '이번엔 어긋났어요'}
                </span>
                {gained > 0 && <span className="lf-gain">+{gained}</span>}
                {carryGain > 0 && <span className="lf-carry">+{(carryGain / 1000).toFixed(1)}초 이월</span>}
                {verdict !== 'correct' && overheat && <span className="lf-cool">냉각 −0.8초</span>}
                {tierMsg && <span className="lf-tier-chip">{tierMsg}</span>}
                {verdict === 'correct' && hintsUsed === 0 && (
                  <span className="lf-burst-anchor" aria-hidden="true">
                    <ParticleBurst
                      intensity={(overheat ? 2 : 1) + clamp(Math.floor(heat / 4), 0, 2)}
                      colors={overheat ? ['#FF7A2F', '#FFC24A', 'var(--streak)'] : undefined}
                    />
                  </span>
                )}
              </div>
            ) : (
              <div className="lf-status">
                {full ? (
                  <span className="lf-ready-chip">완성됐어요 — 담금질하면 확정됩니다</span>
                ) : hintsUsed > 0 ? (
                  <span className="lf-frozen">도움 {hintsUsed} · 콤보 초기화 — 복습에 남겨요</span>
                ) : tierMsg ? (
                  <span className="lf-tier">{tierMsg}</span>
                ) : (
                  <span className="lf-status-dim">
                    {placedCount} / {len} 글자 · 배수 ×{fmtMult(earnMult)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="lf-board">
            {/* 슬롯 줄은 스크롤 위쪽에 고정 — 390×640 에서 트레이를 스크롤해도 내 조립이 보인다 */}
            <SlotRow
              q={q}
              filled={filled}
              hinted={hinted}
              phase={phase}
              verdict={verdict}
              attempt={attempt}
              onRemove={removeAt}
            />
            {phase === 'reveal' && verdict !== 'correct' && attempt.some((c) => c) && (
              <p className="lf-attempt">
                내가 놓은 것 <span>{attempt.map((c) => c || '_').join('').toUpperCase()}</span>
              </p>
            )}
            <TrayRow q={q} filled={filled} phase={phase} onFill={fill} />
          </div>

          <div className="lf-controls">
            {phase === 'reveal' ? (
              <button type="button" className="gk-btn gk-btn--primary lf-ctrl" onClick={advance}>
                다음 ▸
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="gk-btn lf-ctrl"
                  onClick={removeLast}
                  disabled={phase !== 'playing' || placedCount <= hintsUsed}
                >
                  ← 지우기
                </button>
                <button
                  type="button"
                  className="gk-btn lf-ctrl lf-ctrl--hint"
                  onClick={useHint}
                  disabled={phase !== 'playing' || !hasEmpty}
                  title={
                    hasEmpty
                      ? '가장 왼쪽 빈칸을 한 글자 채워요 — 콤보는 끊깁니다'
                      : '빈칸이 있어야 도움을 줄 수 있어요'
                  }
                  aria-label={
                    hasEmpty
                      ? `도움 — 가장 왼쪽 빈칸 한 글자 채우기. ${hintCost}점과 1.5초를 쓰고 콤보가 끊깁니다`
                      : '도움 — 빈칸이 있어야 사용할 수 있어요'
                  }
                >
                  💡 −{hintCost} · 1.5초 · 콤보 끊김
                </button>
                <button
                  type="button"
                  className="gk-btn gk-btn--primary lf-ctrl lf-ctrl--go"
                  onClick={() => submitRef.current('manual')}
                  disabled={phase !== 'playing' || !full}
                >
                  ⚒ 담금질
                </button>
              </>
            )}
          </div>

          <p className="lf-help">
            {phase === 'reveal' ? (
              away ? (
                '잠깐 자리를 비우셨나요 — 준비되면 다음을 눌러 이어가요'
              ) : pinned ? (
                '천천히 봐도 괜찮아요 — 다음을 누르면 이어집니다'
              ) : (
                '정답을 더 보고 싶으면 아무 키나 눌러 멈출 수 있어요'
              )
            ) : (
              <>
                글자를 탭하거나 <Kbd>키보드</Kbd> 로 입력 · <Kbd>⌫</Kbd> 지우기 · <Kbd>Enter</Kbd> 담금질 ·
                제출은 한 번뿐이에요
              </>
            )}
          </p>
        </main>
      ) : null}
    </div>
  );
}

const LF_CSS = `
  .lf-stage { gap: clamp(12px, 2.2vh, 24px); justify-content: flex-start; padding-top: clamp(10px, 2.4vh, 26px); }
  .lf-prompt { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: min(560px, 92vw); }
  .lf-label { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; color: var(--t3); text-transform: uppercase; }
  .lf-label-sep { opacity: .5; }
  .lf-hot-tag { padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--streak) 55%, var(--bd)); background: color-mix(in srgb, var(--streak) 14%, transparent); color: var(--streak); letter-spacing: 0; }
  .lf-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(24px, 5.2vw, 38px); font-weight: 800; color: var(--t1); word-break: keep-all; line-height: 1.25; animation: gk-pop .34s var(--ease-settle, ease-out); }
  .lf-context { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; line-height: 1.55; color: var(--t3); max-width: 46ch; }
  .lf-context--pos { font-style: normal; font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 700; letter-spacing: .04em; }
  .lf-timer-wrap { width: min(320px, 78vw); }

  /* 결정 · 상태 스트립 — 높이 고정(레이아웃 점프 없음) */
  .lf-strip { position: relative; min-height: 62px; display: flex; align-items: center; justify-content: center; width: min(560px, 92vw); }
  .lf-choice { position: relative; display: flex; gap: 10px; width: 100%; justify-content: center; padding-bottom: 8px; }
  .lf-pick { flex: 1 1 0; max-width: 240px; min-height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 6px 12px; border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 84%, transparent); color: var(--t1); font-family: var(--font-display, system-ui); cursor: pointer; transition: transform .16s var(--ease-spring, ease), border-color .15s, background .15s, box-shadow .15s; }
  .lf-pick-top { font-size: 14px; font-weight: 800; }
  .lf-pick-sub { font-size: 11px; font-weight: 700; color: var(--t3); display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; }
  .lf-pick:hover:not(:disabled) { border-color: var(--combo); transform: translateY(-2px); box-shadow: 0 8px 22px color-mix(in srgb, var(--combo) 18%, transparent); }
  .lf-pick:active:not(:disabled) { transform: translateY(0) scale(.97); }
  .lf-pick:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .lf-pick:disabled { opacity: .5; cursor: default; }
  .lf-pick--hot { border-color: color-mix(in srgb, var(--streak) 46%, var(--bd)); background: color-mix(in srgb, var(--streak) 10%, var(--bg)); }
  .lf-pick--hot:hover:not(:disabled) { border-color: var(--streak); box-shadow: 0 8px 22px color-mix(in srgb, var(--streak) 26%, transparent); }
  .lf-pick--hot:focus-visible { border-color: var(--streak); box-shadow: 0 0 0 3px color-mix(in srgb, var(--streak) 34%, transparent); }
  .lf-choice-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .lf-choice-bar span { display: block; height: 100%; width: 100%; transform-origin: left; background: var(--t4, var(--t3)); animation: lf-ready-drain linear forwards; }
  @keyframes lf-ready-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  .lf-status { font-size: 12.5px; font-weight: 700; color: var(--t3); font-variant-numeric: tabular-nums; }
  .lf-status-dim { opacity: .85; }
  .lf-tier { padding: 5px 13px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--streak) 45%, var(--bd)); background: color-mix(in srgb, var(--streak) 12%, transparent); color: var(--streak); font-weight: 800; animation: gk-pop .34s var(--ease-spring, ease-out); }
  .lf-frozen { padding: 5px 13px; border-radius: 999px; border: 1px dashed var(--bd); color: var(--t3); }
  .lf-ready-chip { padding: 5px 13px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--combo) 50%, var(--bd)); background: color-mix(in srgb, var(--combo) 10%, transparent); color: var(--combo); font-weight: 800; }

  .lf-verdict { position: relative; display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: 999px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 78%, transparent); font-size: 13.5px; font-weight: 800; animation: gk-pop .34s var(--ease-spring, ease-out); }
  .lf-verdict--correct { border-color: var(--success); color: var(--success); background: var(--success-light); }
  .lf-verdict--near { border-color: var(--warning); color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); }
  .lf-verdict--wrong { border-color: var(--error); color: var(--error); background: var(--error-light); }
  .lf-verdict-txt { letter-spacing: -.01em; }
  .lf-gain { font-family: var(--font-display, system-ui); font-variant-numeric: tabular-nums; }
  .lf-carry { font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--combo) 16%, transparent); color: var(--combo); }
  .lf-cool { font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; border: 1px dashed currentColor; opacity: .85; }
  .lf-tier-chip { font-size: 11px; font-weight: 900; letter-spacing: .06em; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; opacity: .9; }
  .lf-burst-anchor { position: absolute; inset: 0; pointer-events: none; }

  /* 보드 — 390×640 에서 11글자 + 슬래그 5개여도 컨트롤이 잘리지 않게 */
  .lf-board { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(660px, 96vw); max-height: 46vh; overflow-y: auto; overscroll-behavior: contain; padding: 0 2px 2px; }

  /* 내 조립은 항상 보인다 — 트레이만 스크롤된다(반증 개선안 #6b) */
  .lf-slots { position: sticky; top: 0; z-index: 2; width: 100%; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 6px 0 10px; background: linear-gradient(to bottom, color-mix(in srgb, var(--bg) 90%, transparent) 0%, color-mix(in srgb, var(--bg) 78%, transparent) 70%, transparent 100%); backdrop-filter: blur(6px); }
  .lf-slot { position: relative; overflow: visible; width: clamp(44px, 8.2vw, 54px); height: clamp(48px, 10vw, 60px); border-radius: var(--r-md, 10px); border: 2px dashed var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, system-ui); font-size: clamp(20px, 4.4vw, 27px); font-weight: 800; display: grid; place-items: center; cursor: pointer; transition: border-color .15s, background .15s, transform .12s var(--ease-spring, ease), color .15s; }
  .lf-slot--filled { border-style: solid; border-color: var(--combo); background: color-mix(in srgb, var(--combo) 9%, var(--bg)); }
  .lf-slot:hover:not([aria-disabled="true"]) { border-color: var(--streak); transform: translateY(-2px); }
  .lf-slot:active:not([aria-disabled="true"]) { transform: translateY(0) scale(.94); }
  .lf-slot:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .lf-slot[aria-disabled="true"] { cursor: default; }
  .lf-slot--hint { border-style: solid; border-color: var(--active); background: color-mix(in srgb, var(--active) 13%, var(--bg)); color: var(--active); }
  .lf-slot--hint::after { content: '💡'; position: absolute; top: -7px; right: -5px; font-size: 10px; }
  .lf-slots--ok .lf-slot { border-color: var(--success); border-style: solid; background: var(--success-light); color: var(--success); animation: gk-correct .4s ease-out; }
  .lf-slots--no .lf-slot--good { border-color: var(--success); border-style: solid; background: var(--success-light); color: var(--success); }
  .lf-slots--no .lf-slot--bad { border-color: var(--error); border-style: solid; background: var(--error-light); color: var(--error); animation: gk-shake .36s ease-in-out; }
  /* 색만으로 구분하지 않는다 — 어긋난 자리에는 밑줄 표식 */
  .lf-slots--no .lf-slot--bad::after { content: ''; position: absolute; left: 22%; right: 22%; bottom: 6px; height: 2.5px; border-radius: 2px; background: currentColor; }

  .lf-attempt { margin: 0; font-size: 12px; font-weight: 700; color: var(--t3); letter-spacing: .02em; }
  .lf-attempt span { font-family: var(--font-english, system-ui); color: var(--t2); letter-spacing: .12em; }

  .lf-tray { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .lf-key { width: clamp(44px, 9vw, 54px); height: clamp(46px, 9.6vw, 58px); border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, system-ui); font-size: clamp(18px, 4vw, 23px); font-weight: 800; cursor: pointer; transition: transform .12s var(--ease-spring, ease), border-color .15s, box-shadow .15s, opacity .18s, background .15s; }
  .lf-tray[data-dense="1"] .lf-key { width: clamp(44px, 8vw, 50px); height: clamp(44px, 8.6vw, 54px); font-size: clamp(17px, 3.6vw, 21px); }
  .lf-key:hover:not([aria-disabled="true"]) { border-color: var(--combo); transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--combo) 18%, transparent); }
  .lf-key:active:not([aria-disabled="true"]) { transform: translateY(0) scale(.92); }
  .lf-key:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .lf-key[aria-disabled="true"] { cursor: default; pointer-events: none; }
  .lf-key--used { opacity: .22; }
  .lf-key--cold { color: var(--t4, var(--t3)); border-style: dashed; background: color-mix(in srgb, var(--bg) 55%, transparent); opacity: .7; }

  .lf-controls { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .lf-ctrl { min-height: 46px; padding: 0 15px; font-size: 13px; }
  .lf-ctrl--hint { font-variant-numeric: tabular-nums; font-size: 12px; white-space: nowrap; }
  .lf-ctrl--go { padding: 0 22px; }
  .lf-ctrl:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .lf-help { font-size: 11.5px; color: var(--t3); margin: 0; text-align: center; max-width: 44ch; line-height: 1.6; min-height: 2.2em; }

  /* 마지막 세 자루 — 모루가 달아오른다 */
  .lf-root .gk-atmos-grad, .lf-root .gk-atmos-glow { transition: background .8s ease; }
  .lf-root--final .gk-atmos-mark { filter: brightness(1.3) saturate(1.35); transition: filter .8s ease; }
  .lf-stage--final .lf-label { color: var(--streak); }
  .lf-stage--final .lf-timer-wrap { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--streak) 40%, transparent)); }

  /* 끝화면 — 다시 벼릴 것 */
  .lf-missed { display: flex; flex-direction: column; gap: 9px; align-items: center; }
  .lf-missed-title { margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .lf-missed-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; }
  .lf-missed-chip { display: inline-flex; align-items: baseline; gap: 7px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); font-size: 12.5px; }
  .lf-missed-chip[data-reason="near"] { border-color: color-mix(in srgb, var(--warning) 45%, var(--bd)); }
  .lf-missed-chip[data-reason="hint"] { border-style: dashed; }
  .lf-missed-en { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }
  .lf-missed-ko { color: var(--t3); }
  .lf-missed-tag { font-size: 10.5px; font-weight: 800; color: var(--t4, var(--t3)); letter-spacing: .04em; }
  .lf-missed-more { margin: 0; font-size: 11.5px; color: var(--t3); }
  .lf-again { min-height: 46px; font-size: 13.5px; }

  @media (max-width: 420px) {
    .lf-board { max-height: 44vh; }
    .lf-help { font-size: 11px; }
    .lf-pick-top { font-size: 13px; }
    .lf-ctrl { padding: 0 12px; font-size: 12.5px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lf-slots--ok .lf-slot, .lf-slots--no .lf-slot--bad, .lf-verdict, .lf-tier, .lf-meaning { animation: none; }
    .lf-key, .lf-slot, .lf-pick { transition: border-color .15s, background .15s, opacity .18s; }
    .lf-root .gk-atmos-grad, .lf-root .gk-atmos-glow, .lf-root--final .gk-atmos-mark { transition: none; }
  }
`;
