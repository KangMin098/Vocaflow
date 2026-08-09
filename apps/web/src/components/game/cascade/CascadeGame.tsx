// apps/web/src/components/game/cascade/CascadeGame.tsx
// Cascade — 뜻을 보고 단어를 인출해 물길을 터뜨리는 낙하 보드(L4a 재인 → L4b 인출).
//
// v07.9 전면 재설계 → v07.10 반증 대응. 보드에는 **영단어만** 있고 뜻은 위 카드에
// 하나만 뜬다. 제출(탭) 전에 정답을 특정할 정보가 화면에 없고, 한 뜻에 한 번만
// 답할 수 있어 찍어서 좁혀가는 브루트포스가 성립하지 않는다.
//
// v07.10 에서 고친 것(반증 감사 42건 중 이 게임 몫 4건 + 공정성):
//  1) [높음] '가장 낮은 장을 0.2초 안에 탭'이 지배 전략이던 문제 — 낙차·뭉치·돌이
//     전부 **점수**라 최선-최저 격차가 8점(=숙고 0.2초 값)이었다. 세 갈래를 서로
//     다른 통화로 갈랐다: 돌→다음 뜻의 시간, 뭉치→예약 낙석 취소·만조, 낙차→점수.
//     그리고 2막부터 **깊은 낙차는 보드를 흔들어 낙석을 부른다**(탐욕 플레이에 비용).
//     속도 보너스도 140→70 으로 낮춰 숙고 1초의 값을 54점/초 → 27점/초로 내렸다.
//  2) [보통] pickTarget 의 `asked<2` 필터가 후보를 7→2 로 좁혀, 출제 횟수만 세면
//     기대정답률이 13%→34.6% 로 뛰던 누수 — 필터를 **완전히 제거**했다. 반복 방지는
//     출제 쪽이 아니라 **보드 회전**(RETIRE_ASKED)으로 만든다. 출제는 균등 무작위.
//  3) [낮음] 리빌로 본 답을 두 턴 뒤 되팔아 onCorrect 를 얻던 경로 — 리빌된 단어는
//     세션 내내 `assisted: true` 로만 올라간다(FSRS 미갱신).
//  4) [낮음] 콤보 10 티어를 반복해 목숨을 3→7 로 불리던 구멍 — 콤보 티어는 이제
//     점수만 준다. 목숨 회복은 **물방울 1개 이하**에서만 차는 만조 게이지 하나로
//     일원화하고 한 판 상한을 걸었다(긴 판 2회 · 짧은 판 1회 · HUD 에 게이지로 명시).
//  + 동의어 충돌(줄이다/줄어들다)이 같은 보드에 오르지 않게 막았다 — '맞는 뜻을
//    짚었는데 오답' 이 사라진다.
//  + 낙석 예보(보드 위 열 표시) — '뭉친 장 = 낙석 취소'가 보이지 않는 화폐라
//    결정이 다시 죽던 문제. 예약된 돌이 어느 열에 걸려 있는지 보여야 "지금 시간이
//    급한가 · 보드가 굳고 있는가 · 점수를 살까"가 매 턴 다른 답을 낸다.
//  + 스케일 다운 — 목표 인출 수·장수 상한·만조 환급을 풀 크기의 함수로 바꿨다.
//    도서 챕터 653개 중 24단어 이상은 57% 뿐이라, 큰 판을 고정하면 나머지가 이
//    게임을 아예 못 여는 대가를 치른다. 단어가 적으면 판이 짧아질 뿐이다.
//
// FSRS 적재: 학습자가 실제로 인출한 그 단어에만. 게임 쪽 횟수 상한은 두지 않는다 —
// 중앙(recordGameResult)이 assisted 와 10분 재채점 쿨다운으로 이미 거른다. 게임이
// 또 상한을 걸면 session accuracy·totalQuestions 가 실제보다 낮게 적재된다(감사 지적).
// 연쇄로 지워진 타일은 학습자가 인출한 것이 아니므로 아무것도 올리지 않는다 — 점수만.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  ParticleBurst,
  NotEnoughWords,
  FeedbackIcon,
  TimerBar,
  GameMusic,
  useSfx,
  useCountUp,
  useCountdown,
  useCombo,
  useFlipGrid,
  usePersonalBest,
  DEFAULT_COMBO_TIERS,
  shuffle,
  clamp,
  type Word,
} from '@/components/game/_shared/gamekit';
import {
  COLS,
  ROWS,
  SIZE,
  LIVES,
  MAX_ROCKS,
  DISTINCT_MAX,
  DISTINCT_ACTIVE,
  DISTINCT_MIN,
  RETIRE_ASKED,
  SPEED_PT,
  FALL_PT,
  ROCK_TIME_MS,
  ROCK_TIME_CAP_MS,
  DEEP_FELL,
  TIDE_NEED,
  actOf,
  adjacentRocks,
  buildClashMap,
  clusterAt,
  colOf,
  compact,
  copyMaxFor,
  distinctEns,
  fillEmpty,
  findAnswerIndexes,
  findChains,
  goalFor,
  isWordCell,
  removeIds,
  rockCadence,
  rockCount,
  tideRefundFor,
  touchesRock,
  windowMsFor,
  windowWithRocks,
  wordCounts,
  wouldChain,
  type Board,
  type Cell,
  type WordCell,
} from './logic';

interface ResultOpts {
  assisted?: boolean;
}

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// wordPool 이 없을 때만 쓰는 폴백. 실제 플레이는 학습자의 도서·스크립트·단어장에서 온다.
const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점' },
  { en: 'reserved', ko: '내성적인' },
  { en: 'inclined', ko: '~하는 경향이 있는' },
  { en: 'consequence', ko: '결과' },
  { en: 'judgment', ko: '판단' },
  { en: 'mistake', ko: '실수' },
  { en: 'ability', ko: '능력' },
  { en: 'balance', ko: '균형' },
  { en: 'courage', ko: '용기' },
  { en: 'develop', ko: '발전시키다' },
  { en: 'reduce', ko: '줄이다' },
  { en: 'sudden', ko: '갑작스러운' },
  { en: 'measure', ko: '측정하다' },
  { en: 'relieve', ko: '덜어 주다' },
];

type Stage = 'playing' | 'resolving' | 'reveal' | 'done';
type Result = 'correct' | 'wrong' | 'timeout';
type TileState = 'idle' | 'clear' | 'chain' | 'bad' | 'answer';
type TileMark = 'none' | 'rock' | 'group' | 'both';
interface FxItem {
  key: number;
  index: number;
  burst?: number;
  colors?: string[];
  gain?: number;
  tag?: string;
  cost?: string;
}

const CLEAR_MS = 230;
const FALL_MS = 240;
const CHAIN_MS = 210;
const DROP_MS = 250;
const REVEAL_MS = 1450;
const FX_MS = 840;
/** 첫 뜻에만 얹어주는 준비 시간 — 보드를 한 번 훑을 여유. */
const FIRST_GRACE_MS = 2200;
/** 연쇄가 터진 다음 뜻에 얹는 여유. */
const CHAIN_GRACE_MS = 700;
/** 보드를 한 번도 건드리지 않은 시간초과가 이만큼 연속되면 세션을 접는다(방치 가드). */
const IDLE_LIMIT = 3;

const EMPTY_IDS: ReadonlySet<number> = new Set<number>();
const CLEAR_COLORS = ['var(--success)', 'var(--combo)', 'var(--streak)'];
const CHAIN_COLORS = ['var(--streak)', 'var(--active)', 'var(--combo)'];

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}

// ─── 타일 ────────────────────────────────────────────────────────────────
// useCountdown 이 매 프레임 setState 하므로 부모는 매 프레임 다시 그려진다.
// 타일은 memo 로 끊는다 — props(cell 참조·state 문자열·안정 콜백)가 그대로면 건너뛴다.
const Tile = memo(function Tile({
  cell,
  index,
  state,
  mark,
  groupLabel,
  fresh,
  revealKo,
  flipRef,
  onTap,
}: {
  cell: Cell;
  index: number;
  state: TileState;
  mark: TileMark;
  /** '뭉친 장'이 지금 사는 것 — 낙석 취소인지 만조인지가 국면에 따라 달라진다. */
  groupLabel: string;
  fresh: boolean;
  revealKo?: string;
  flipRef: (key: string) => (el: HTMLElement | null) => void;
  onTap: (index: number) => void;
}) {
  if (cell.kind === 'rock') {
    return (
      <div
        ref={flipRef(String(cell.id))}
        className={`cs-cell cs-tile cs-tile--rock ${fresh ? 'cs-tile--fresh' : ''} ${state === 'clear' || state === 'chain' ? 'cs-tile--clear' : ''}`}
        role="gridcell"
        aria-label="막힌 칸 · 옆 칸이 무너지면 함께 부서져요"
        data-i={index}
      >
        <span className="cs-tile-body" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M5 15.5 9 7l5 3 3-2.5 2 8z" />
            <path d="M4 18.5h16" opacity=".55" />
          </svg>
        </span>
      </div>
    );
  }

  const locked = state !== 'idle';
  // 어포던스 라벨 — '이 칸을 고르면 무엇을 얻는가'. 정답과 무관한 보드 기하 정보라
  // 정답을 좁히는 데는 아무 도움이 되지 않는다(정보 누출 아님). 대신 눈으로 찾는
  // 스캔 비용이 사라져 "숙고가 항상 손해"이던 계산이 뒤집힌다.
  const rockLabel = '돌 옆(고르면 다음 뜻 시간 +)';
  const markLabel =
    mark === 'both'
      ? ` · ${rockLabel} · ${groupLabel}`
      : mark === 'rock'
        ? ` · ${rockLabel}`
        : mark === 'group'
          ? ` · ${groupLabel}`
          : '';
  return (
    <button
      ref={flipRef(String(cell.id))}
      type="button"
      role="gridcell"
      data-i={index}
      className={`cs-cell cs-tile cs-tile--word cs-tile--${state} cs-mark--${mark} ${fresh ? 'cs-tile--fresh' : ''}`}
      aria-disabled={locked ? 'true' : 'false'}
      aria-label={revealKo ? `${cell.word.en} · 정답 · 뜻 ${revealKo}` : `${cell.word.en}${markLabel}`}
      title={cell.word.en}
      onClick={() => onTap(index)}
    >
      <span className="cs-tile-body">
        <span className="cs-tile-en">{cell.word.en}</span>
        {revealKo && <span className="cs-tile-ko">{revealKo}</span>}
      </span>
      {(mark === 'rock' || mark === 'both') && (
        <span className="cs-afford cs-afford--rock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 3v5M12 16v5M4.5 7.5 8 11M16 13l3.5 3.5" />
          </svg>
        </span>
      )}
      {(mark === 'group' || mark === 'both') && (
        <span className="cs-afford cs-afford--group" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
            <rect x="3.5" y="3.5" width="8" height="8" rx="1.5" />
            <rect x="12.5" y="12.5" width="8" height="8" rx="1.5" />
          </svg>
        </span>
      )}
      {state === 'clear' && (
        <span className="cs-tile-icon cs-tile-icon--ok" aria-hidden="true">
          <FeedbackIcon kind="correct" size={15} />
        </span>
      )}
      {state === 'bad' && (
        <span className="cs-tile-icon cs-tile-icon--bad" aria-hidden="true">
          <FeedbackIcon kind="wrong" size={15} />
        </span>
      )}
      {state === 'answer' && (
        <span className="cs-tile-icon cs-tile-icon--ans" aria-hidden="true">
          <FeedbackIcon kind="near" size={15} />
        </span>
      )}
    </button>
  );
});

export function CascadeGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  // ─── 단어 풀 ───
  // wordPool 이 오면 무조건 그것으로 논다. 같은 한국어 뜻이 둘이면 정답이 두 개가 돼
  // 불공정해지므로 en·ko 양쪽으로 중복을 걷어낸다.
  const pool = useMemo(() => {
    const src = wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL;
    const seenEn = new Set<string>();
    const seenKo = new Set<string>();
    const out: Word[] = [];
    for (const w of src) {
      const en = (w.en ?? '').trim();
      const ko = (w.ko ?? '').trim();
      if (!en || !ko) continue;
      const ken = en.toLowerCase();
      const kko = ko.replace(/\s+/g, '');
      if (seenEn.has(ken) || seenKo.has(kko)) continue;
      seenEn.add(ken);
      seenKo.add(kko);
      out.push({ ...w, en, ko });
    }
    return out;
  }, [wordPool]);

  const wordByEn = useMemo(() => {
    const m = new Map<string, Word>();
    for (const w of pool) m.set(w.en, w);
    return m;
  }, [pool]);

  // 동의어 충돌표 — '줄이다/줄어들다' 를 같은 보드에 올리지 않기 위한 제약.
  // 풀에서 지우지 않는다(지우면 그 단어를 세션 내내 못 만난다).
  const clashMap = useMemo(() => buildClashMap(pool), [pool]);

  /** 아직 덜 나온 단어의 정원. 이 수를 넘겨 새 단어를 밀어 넣지는 않는다. */
  const activeTarget = clamp(pool.length, DISTINCT_MIN, DISTINCT_ACTIVE);
  /** 보드에 동시에 오를 수 있는 서로 다른 단어의 하드 캡. */
  const hardMax = clamp(pool.length, DISTINCT_MIN, DISTINCT_MAX);
  const playable = pool.length >= DISTINCT_MIN;

  // ─── 풀 크기로 판을 접는다(스케일 다운) ───
  // 도서 챕터 653개 중 24단어 이상은 57% 뿐이다. 판 크기를 고정값으로 잡으면
  // 나머지가 이 게임을 **아예 못 여는** 대가로 큰 판을 지키는 셈이 된다.
  // 단어가 적으면 목표·장수 상한·환급 상한이 함께 줄어 판이 짧아질 뿐이다.
  const goal = goalFor(pool.length);
  const copyMax = copyMaxFor(pool.length);
  const refundCap = tideRefundFor(goal);

  const sfx = useSfx();

  // ─── 상태 ───
  const [board, setBoard] = useState<Board>([]);
  const [stage, setStage] = useState<Stage>('playing');
  const [target, setTarget] = useState<Word | null>(null);
  const [score, setScore] = useState(0);
  const [clears, setClears] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [tide, setTide] = useState(0);
  /** 예약된 낙석이 떨어질 열 — 보드 위 '낙석 예보'로 보여준다(아래 sync 참조). */
  const [pendingCols, setPendingCols] = useState<number[]>([]);
  const [bestChain, setBestChain] = useState(0);
  const [won, setWon] = useState(false);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [clearingIds, setClearingIds] = useState<ReadonlySet<number>>(EMPTY_IDS);
  const [chainingIds, setChainingIds] = useState<ReadonlySet<number>>(EMPTY_IDS);
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(EMPTY_IDS);
  const [badId, setBadId] = useState<number | null>(null);
  const [revealId, setRevealId] = useState<number | null>(null);
  const [fx, setFx] = useState<FxItem[]>([]);
  const [banner, setBanner] = useState<{ text: string; tone: 'chain' | 'act' | 'gift' | 'cost'; key: number } | null>(null);
  const [bestInfo, setBestInfo] = useState<{ improved: boolean; prev: number | null } | null>(null);
  const [missedList, setMissedList] = useState<Word[]>([]);
  const [announce, setAnnounce] = useState('');

  const shownScore = useCountUp(score);

  // ─── ref ───
  const mountedRef = useRef(true);
  const runRef = useRef(0);
  const idRef = useRef(0);
  const fxSeqRef = useRef(0);
  const stageRef = useRef<Stage>('playing');
  const scoreRef = useRef(0);
  const livesRef = useRef(LIVES);
  const tideRef = useRef(0);
  const refundRef = useRef(0);
  const tideSeenRef = useRef(false);
  const bonusMsRef = useRef(0);
  const firstPromptRef = useRef(true);
  const boardElRef = useRef<HTMLDivElement | null>(null);
  const focusBackRef = useRef<number | null>(null);
  const rotRef = useRef<{ order: Word[]; cursor: number }>({ order: [], cursor: 0 });
  const askedRef = useRef(new Map<string, number>());
  const revealedRef = useRef(new Set<string>());
  const missedRef = useRef(new Map<string, Word>());
  const pendingRocksRef = useRef<number[]>([]);
  const sinceRockRef = useRef(0);
  const touchedRef = useRef(false);
  const idleRef = useRef(0);

  stageRef.current = stage;
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const alive = useCallback((my: number) => mountedRef.current && runRef.current === my, []);

  /**
   * 예약 낙석을 화면에 반영한다.
   * 예보가 없으면 '뭉친 장 = 낙석 취소' 라는 통화가 **보이지 않는 화폐**가 돼
   * 결정이 다시 죽는다(감사: decisions 2/5). 큐를 바꾼 직후마다 부른다.
   */
  const syncPending = useCallback(() => {
    setPendingCols((prev) => {
      const next = pendingRocksRef.current;
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return [...next];
    });
  }, []);

  // ─── 이펙트 레이어 ───
  // 파티클·득점 표시는 타일이 아니라 보드 위 좌표에 띄운다. 타일에 붙이면 격파와
  // 동시에 DOM 이 사라져 파티클이 한 프레임 만에 증발한다(웨이브1 공통 함정).
  const addFx = useCallback((items: Omit<FxItem, 'key'>[]) => {
    if (items.length === 0) return;
    const keyed = items.map((it) => ({ ...it, key: ++fxSeqRef.current }));
    const keys = new Set(keyed.map((k) => k.key));
    setFx((prev) => [...prev, ...keyed]);
    window.setTimeout(() => {
      if (!mountedRef.current) return;
      setFx((prev) => prev.filter((x) => !keys.has(x.key)));
    }, FX_MS);
  }, []);

  // ─── 콤보 ───
  // 티어는 **점수만** 준다. 구판은 10 연속마다 물방울을 돌려줬는데 useCombo.miss()
  // 가 티어를 0 으로 되돌리므로 '10연속 → 1실수'를 반복해 목숨을 무한 환급할 수
  // 있었다(감사: 실질 목숨 3 → 7). 목숨 회복은 만조 게이지 하나로 일원화했다.
  const combo = useCombo({
    onTierUp: (tier) => {
      if (tier.at < 10) return;
      setScore((s) => s + 300);
      setBanner({ text: `${tier.label ?? '연속'} · 만조 보너스 +300`, tone: 'gift', key: Date.now() });
      setAnnounce('연속 보상 · 점수 300');
    },
  });
  const comboRef = useRef(combo);
  comboRef.current = combo;

  // ─── 뜻 하나의 제한 시간 ───
  const clock = useCountdown({
    totalMs: windowMsFor(0) + FIRST_GRACE_MS,
    running: stage === 'playing',
    warnAtMs: 1400,
    onEnd: () => {
      if (stageRef.current !== 'playing') return;
      sfx.nearMiss();
      void missRef.current('timeout');
    },
  });
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const pb = usePersonalBest('cascade');
  const pbRef = useRef(pb);
  pbRef.current = pb;

  const flipKeys = useMemo(() => board.map((c, i) => (c ? String(c.id) : `hole-${i}`)), [board]);
  const flip = useFlipGrid(flipKeys, 260);

  // ─── 칸 생성 ───
  const mkWordCell = useCallback((w: Word): WordCell => {
    idRef.current += 1;
    return { id: idRef.current, kind: 'word', word: w };
  }, []);
  const mkRockCell = useCallback((): Cell => {
    idRef.current += 1;
    return { id: idRef.current, kind: 'rock' };
  }, []);

  /**
   * 아직 보드에 없고 **보드 위 단어와 뜻이 충돌하지 않는** 단어를 회전 순서에서 고른다.
   * 커서는 **실제로 그 단어를 쓸 때만** 민다 — 구판은 chooseCell 이 nextFresh 를 두 번
   * 불러(쓰지도 않을 두 번째 호출 포함) 커서를 한 칸씩 더 밀었고, 그래서 '놓친 단어부터
   * 다시'가 6개 중 홀수 번째 3개만 첫 보드에 올렸다(감사 지적).
   */
  const peekFresh = useCallback(
    (b: Board): { w: Word; idx: number } | null => {
      const on = distinctEns(b);
      const onSet = new Set(on);
      const { order } = rotRef.current;
      if (order.length === 0) return null;
      for (let k = 0; k < order.length; k++) {
        const idx = (rotRef.current.cursor + k) % order.length;
        const w = order[idx];
        if (onSet.has(w.en)) continue;
        const clash = clashMap.get(w.en);
        if (clash && on.some((e) => clash.has(e))) continue;
        return { w, idx };
      }
      return null;
    },
    [clashMap],
  );

  /**
   * 빈 칸 하나를 무엇으로 채울지.
   *  · 정원(activeTarget)은 **아직 덜 나온 단어**만 센다 → 두 번 나온 단어가 자리를
   *    비우면 새 단어가 들어온다. 출제(pickTarget)를 건드리지 않고 보드 회전을
   *    만드는 유일한 방법이다(출제 쪽에 손대면 그게 곧 정보 누출이었다).
   *  · 복제는 **장수가 적은 단어부터** — 장수 1짜리 타깃(선택 자체가 없는 턴)이
   *    63% 였던 것을 20% 수준으로 낮춘다(시뮬 측정).
   *  · 어떤 경우에도 3칸 뭉치는 만들지 않는다 — 연쇄는 오직 낙하의 결과여야 한다.
   */
  const chooseCell = useCallback(
    (b: Board, i: number): Cell => {
      const col = colOf(i);
      const pend = pendingRocksRef.current;
      const k = pend.indexOf(col);
      if (k >= 0) {
        pend.splice(k, 1);
        if (rockCount(b) < MAX_ROCKS) return mkRockCell();
      }
      const onEns = distinctEns(b);
      const counts = wordCounts(b);
      const cands: { w: Word; freshIdx?: number }[] = [];

      const activeCount = onEns.filter((en) => (askedRef.current.get(en) ?? 0) < RETIRE_ASKED).length;
      if (activeCount < activeTarget && onEns.length < hardMax) {
        const f = peekFresh(b);
        if (f) cands.push({ w: f.w, freshIdx: f.idx });
      }

      let dup = shuffle(onEns).filter((en) => (counts.get(en) ?? 0) < copyMax);
      const young = dup.filter((en) => (askedRef.current.get(en) ?? 0) < RETIRE_ASKED);
      if (young.length > 0) dup = young;
      dup.sort((x, y) => (counts.get(x) ?? 0) - (counts.get(y) ?? 0));
      for (const en of dup) {
        const w = wordByEn.get(en);
        if (w) cands.push({ w });
      }

      if (cands.length === 0) {
        const f = peekFresh(b);
        if (f) cands.push({ w: f.w, freshIdx: f.idx });
      }
      if (cands.length === 0) for (const w of shuffle(pool).slice(0, 4)) cands.push({ w });

      const take = (c: { w: Word; freshIdx?: number }) => {
        if (c.freshIdx !== undefined && rotRef.current.order.length > 0) {
          rotRef.current.cursor = (c.freshIdx + 1) % rotRef.current.order.length;
        }
        return mkWordCell(c.w);
      };
      for (const c of cands) if (!wouldChain(b, i, c.w.en)) return take(c);
      return take(cands[0] ?? { w: pool[0] });
    },
    [activeTarget, copyMax, hardMax, mkRockCell, mkWordCell, peekFresh, pool, wordByEn],
  );

  /**
   * 다음에 물어볼 뜻. **보드에 이미 있는 단어 중 균등 무작위**. 같은 뜻 연속만 막는다.
   * 구판의 `asked<2` 필터는 "출제 횟수를 세면 후보가 7 → 2 로 좁혀진다"는 정보
   * 누출이었다(추적 기대정답률 13% → 34.6%, 후보 1개로 확정되는 턴 13%).
   * 반복 억제는 여기가 아니라 chooseCell 의 보드 회전이 맡는다.
   */
  const pickTarget = useCallback(
    (b: Board, last: string | null): Word | null => {
      const ens = distinctEns(b);
      if (ens.length === 0) return null;
      let cands = ens.filter((e) => e !== last);
      if (cands.length === 0) cands = ens;
      const en = cands[Math.floor(Math.random() * cands.length)];
      askedRef.current.set(en, (askedRef.current.get(en) ?? 0) + 1);
      return wordByEn.get(en) ?? null;
    },
    [wordByEn],
  );

  /**
   * FSRS 적재. 게임 쪽 횟수 상한은 두지 않는다 — 중앙이 assisted 와 10분 재채점
   * 쿨다운으로 이미 거르고, 게임이 또 상한을 걸면 세션 accuracy 가 실제보다
   * 낮게 적재된다(구판: 실제 92.5% → 84%, totalQuestions 43 → 16).
   * 리빌로 답을 본 단어의 정답은 인출이 아니므로 assisted 로 올린다.
   */
  const record = useCallback(
    (w: Word, ok: boolean, assisted = false) => {
      const opts = assisted ? { assisted: true } : undefined;
      if (ok) onCorrect?.(w, opts);
      else onWrong?.(w, opts);
    },
    [onCorrect, onWrong],
  );

  const restoreFocus = useCallback(() => {
    const want = focusBackRef.current;
    focusBackRef.current = null;
    if (want == null) return;
    const root = boardElRef.current;
    if (!root) return;
    window.requestAnimationFrame(() => {
      const el = root.querySelector<HTMLElement>(`[data-i="${want}"]`);
      if (el && typeof el.focus === 'function') el.focus();
    });
  }, []);

  const startPrompt = useCallback(
    (clearsNow: number, extraMs: number, rocksNow: number) => {
      const grace = firstPromptRef.current ? FIRST_GRACE_MS : 0;
      firstPromptRef.current = false;
      touchedRef.current = false;
      stageRef.current = 'playing';
      setStage('playing');
      // reset 은 stage 갱신과 같은 동기 블록에서 — 그래야 일시정지분이 정확히 복원된다.
      clockRef.current.reset(windowWithRocks(clearsNow, goal, rocksNow) + extraMs + grace);
    },
    [goal],
  );

  const finish = useCallback(
    (didWin: boolean) => {
      runRef.current += 1;
      stageRef.current = 'done';
      setStage('done');
      setWon(didWin);
      setMissedList([...missedRef.current.values()]);
      setBestInfo(pbRef.current.submit(scoreRef.current));
      if (didWin) sfx.fanfare();
      setAnnounce(didWin ? '완주했어요' : '오늘 세션이 끝났어요');
    },
    [sfx],
  );

  // ─── 새 판 ───
  const newGame = useCallback(
    (focus?: Word[]) => {
      if (!playable) return;
      runRef.current += 1;
      idRef.current = 0;
      const shuffled = shuffle(pool);
      const head = (focus ?? []).filter((f) => wordByEn.has(f.en));
      const order = head.length ? [...head, ...shuffled.filter((w) => !head.some((h) => h.en === w.en))] : shuffled;
      rotRef.current = { order, cursor: 0 };
      askedRef.current = new Map();
      revealedRef.current = new Set();
      missedRef.current = new Map();
      pendingRocksRef.current = [];
      sinceRockRef.current = 0;
      livesRef.current = LIVES;
      tideRef.current = 0;
      refundRef.current = 0;
      tideSeenRef.current = false;
      bonusMsRef.current = 0;
      idleRef.current = 0;
      touchedRef.current = false;
      firstPromptRef.current = true;
      scoreRef.current = 0;

      const first = fillEmpty(new Array<Cell | null>(SIZE).fill(null), chooseCell).board;
      const t = pickTarget(first, null);

      comboRef.current.reset();
      setBoard(first);
      setTarget(t);
      setScore(0);
      setClears(0);
      setLives(LIVES);
      setTide(0);
      setPendingCols([]);
      setBestChain(0);
      setWon(false);
      setBestInfo(null);
      setMissedList([]);
      setLastResult(null);
      setClearingIds(EMPTY_IDS);
      setChainingIds(EMPTY_IDS);
      setFreshIds(EMPTY_IDS);
      setBadId(null);
      setRevealId(null);
      setFx([]);
      setBanner(null);
      setAnnounce(t ? `뜻 ${t.ko} · 맞는 단어를 짚으세요` : '');
      startPrompt(0, 0, 0);
    },
    [chooseCell, pickTarget, playable, pool, startPrompt, wordByEn],
  );

  useEffect(() => {
    mountedRef.current = true;
    newGame();
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 정착 → 연쇄 → 리필 → 다음 뜻 ───
  const settleAndContinue = useCallback(
    async (my: number, start: Board, clearsNow: number, lastEn: string | null) => {
      let cur = start;
      let link = 0;

      for (let guard = 0; guard < 8; guard++) {
        const chains = findChains(cur, 3);
        if (chains.length === 0) break;
        link += 1;
        const flat = chains.flat();
        const rocks = adjacentRocks(cur, flat);
        const ids = new Set<number>();
        for (const i of flat) ids.add(cur[i]!.id);
        for (const i of rocks) ids.add(cur[i]!.id);
        const gain = Math.round(70 * flat.length * Math.min(link + 1, 4));
        setScore((s) => s + gain);
        setBestChain((v) => Math.max(v, link + 1));
        setChainingIds(ids);
        addFx([
          ...flat.map((i) => ({ index: i, burst: 3, colors: CHAIN_COLORS })),
          { index: flat[0], gain, tag: `연쇄 ${link + 1}단` },
        ]);
        setBanner({ text: `연쇄 ${link + 1}단 · +${gain}`, tone: 'chain', key: Date.now() + link });
        sfx.correct(8 + link * 3, true);
        setAnnounce(`연쇄 ${link + 1}단`);
        await sleep(CHAIN_MS);
        if (!alive(my)) return;
        setChainingIds(EMPTY_IDS);
        cur = compact(removeIds(cur, ids)).board;
        setBoard(cur);
        await sleep(CHAIN_MS);
        if (!alive(my)) return;
      }

      // 주기 낙석 — 2막부터 보드가 조금씩 굳는다.
      const cad = rockCadence(actOf(clearsNow, goal));
      if (cad > 0) {
        sinceRockRef.current += 1;
        if (sinceRockRef.current >= cad) {
          sinceRockRef.current = 0;
          if (rockCount(cur) < MAX_ROCKS) pendingRocksRef.current.push(Math.floor(Math.random() * COLS));
        }
      }

      // 다음 뜻은 **리필까지 끝난 보드**에서 뽑는다. 리필 전 보드에서 뽑으면
      // "방금 떨어진 타일은 절대 정답이 아니다"가 규칙이 돼 후보가 조용히 좁혀진다.
      const rocksBefore = rockCount(cur);
      const filled = fillEmpty(cur, chooseCell);
      syncPending();
      const rocksNow = rockCount(filled.board);
      const t = pickTarget(filled.board, lastEn);
      if (!t) {
        finish(false);
        return;
      }
      // 돌이 새로 앉으면 그 사실을 말해 준다 — 돌세(물살이 좁아짐)는 숨은 벌이면 안 된다.
      if (rocksNow > rocksBefore) {
        setBanner({ text: '돌이 앉았어요 · 물살이 조금 좁아져요', tone: 'cost', key: Date.now() });
      }

      // 뜻과 낙하를 같은 프레임에 — 떨어지는 동안 뜻을 읽을 수 있고, 시계는 낙하가
      // 끝난 뒤에야 돈다(읽는 시간을 벌금으로 물리지 않는다).
      setTarget(t);
      setLastResult(null);
      setBoard(filled.board);
      setFreshIds(new Set(filled.newIds));
      setAnnounce(`뜻 ${t.ko}`);
      await sleep(DROP_MS);
      if (!alive(my)) return;
      setFreshIds(EMPTY_IDS);
      const extra = (link > 0 ? CHAIN_GRACE_MS : 0) + bonusMsRef.current;
      bonusMsRef.current = 0;
      startPrompt(clearsNow, extra, rocksNow);
      restoreFocus();
    },
    [addFx, alive, chooseCell, finish, goal, pickTarget, restoreFocus, sfx, startPrompt, syncPending],
  );

  // ─── 정답 ───
  const handleHit = useCallback(
    async (index: number, b0: Board, cell: WordCell) => {
      const my = ++runRef.current;
      stageRef.current = 'resolving';
      setStage('resolving');
      const frac = clamp(clockRef.current.frac, 0, 1);

      const cluster = clusterAt(b0, index);
      const rocks = adjacentRocks(b0, cluster);
      const ids = new Set<number>();
      for (const i of cluster) ids.add(b0[i]!.id);
      for (const i of rocks) ids.add(b0[i]!.id);
      const settled = compact(removeIds(b0, ids));
      const nextClears = clears + 1;

      const nc = comboRef.current.hit();
      const mult = multFor(nc);
      // 점수 통화 — 속도와 낙차만. 뭉치·돌은 점수가 아니라 아래의 자원으로 간다.
      const gain = Math.round((100 + Math.round(SPEED_PT * frac) + FALL_PT * settled.fell) * mult);

      // ── 통화 ① 돌 → 다음 뜻의 시간 ──
      const timeGain = Math.min(ROCK_TIME_CAP_MS, rocks.length * ROCK_TIME_MS);
      bonusMsRef.current = timeGain;

      // ── 통화 ② 뭉치 → 예약된 낙석 취소 ──
      let canceled = 0;
      for (let k = 0; k < cluster.length - 1 && pendingRocksRef.current.length > 0; k++) {
        pendingRocksRef.current.pop();
        canceled += 1;
      }

      // ── 통화 ③ 만조 → 물방울. 물방울이 1개 이하일 때만 찬다 ──
      // (가득일 때도 차면 '10연속 → 1실수' 순환으로 목숨을 무한 환급할 수 있었다.)
      let refunded = false;
      if (livesRef.current <= 1) {
        tideRef.current += 1 + Math.max(0, cluster.length - 1);
        while (tideRef.current >= TIDE_NEED && livesRef.current < LIVES && refundRef.current < refundCap) {
          tideRef.current -= TIDE_NEED;
          livesRef.current += 1;
          refundRef.current += 1;
          refunded = true;
        }
        setTide(tideRef.current);
        if (refunded) setLives(livesRef.current);
      }

      // ── 비용 — 깊은 낙차는 위를 크게 흔든다(2막부터 낙석 1개 예약) ──
      // 이게 없으면 '가장 낮은 장'이 점수·자원 양쪽에서 무조건 최선이라 결정이 죽는다.
      let shook = false;
      if (settled.fell >= DEEP_FELL && actOf(nextClears, goal) >= 2 && rockCount(settled.board) < MAX_ROCKS) {
        pendingRocksRef.current.push(colOf(index));
        shook = true;
      }
      if (canceled > 0 || shook) syncPending();

      const tag =
        rocks.length > 0
          ? `+${(timeGain / 1000).toFixed(1)}초`
          : canceled > 0
            ? `낙석 ${canceled} 취소`
            : refunded
              ? '물방울 회복'
              : mult > 1
                ? `×${mult}`
                : undefined;

      const assisted = revealedRef.current.has(cell.word.en);
      record(cell.word, true, assisted);
      setScore((s) => s + gain);
      setClears(nextClears);
      setLastResult('correct');
      setClearingIds(ids);
      addFx([
        ...cluster.map((i) => ({ index: i, burst: 1 + clamp(Math.floor(nc / 4), 0, 3), colors: CLEAR_COLORS })),
        ...rocks.map((i) => ({ index: i, burst: 2, colors: CHAIN_COLORS })),
        { index, gain, tag, cost: shook ? '흔들림 · 낙석' : undefined },
      ]);
      sfx.correct(nc, rocks.length > 0 || refunded);
      if (refunded) {
        setBanner({ text: '만조 · 물방울 하나 회복', tone: 'gift', key: Date.now() });
      } else if (shook) {
        setBanner({ text: '깊게 무너져 위가 흔들려요', tone: 'cost', key: Date.now() });
      } else if (rocks.length > 0) {
        setBanner({ text: `돌 ${rocks.length} 파괴 · 다음 뜻 +${(timeGain / 1000).toFixed(1)}초`, tone: 'gift', key: Date.now() });
      }
      setAnnounce(`정답 ${cell.word.en} · +${gain}${tag ? ` · ${tag}` : ''}`);

      await sleep(CLEAR_MS);
      if (!alive(my)) return;
      setClearingIds(EMPTY_IDS);
      setBoard(settled.board);
      await sleep(FALL_MS);
      if (!alive(my)) return;

      if (nextClears >= goal) {
        finish(true);
        return;
      }
      const nextAct = actOf(nextClears, goal);
      if (nextAct !== actOf(nextClears - 1, goal)) {
        setBanner({
          text: nextAct === 2 ? '2막 — 물살이 빨라지고 낙석이 시작돼요' : '3막 — 낙석이 잦아져요',
          tone: 'act',
          key: Date.now(),
        });
      }
      await settleAndContinue(my, settled.board, nextClears, cell.word.en);
    },
    [addFx, alive, clears, finish, goal, record, refundCap, settleAndContinue, sfx, syncPending],
  );

  // ─── 오답 · 시간초과 ───
  // 한 뜻에 한 번만 답한다. 재시도가 없으니 찍어서 좁혀가는 전략이 성립하지 않고,
  // 대신 정답을 충분히 보여준 뒤(영어+뜻+예문) 그 칸이 무너지며 돌 하나가 남는다.
  const handleMiss = useCallback(
    async (kind: 'wrong' | 'timeout') => {
      if (stageRef.current !== 'playing') return;
      const t = target;
      const b0 = board;
      if (!t) return;
      const my = ++runRef.current;
      stageRef.current = 'reveal';
      setStage('reveal');

      // 방치 가드 — 보드를 한 번도 건드리지 않은 시간초과가 연속되면 세션을 접는다.
      // **첫 번째**는 정직하게 오답으로 올린다: 뜻을 읽고도 단어를 못 찾아 손이
      // 멈춘 것이야말로 인출 실패이고, 모르는 단어일수록 오답으로 올라가야 복습이
      // 잡힌다. 연속 2회째부터는 자리를 비운 쪽으로 보고 assisted 로 돌려 FSRS 를
      // 건드리지 않는다 — 방치 한 판이 만드는 가짜 lapse 는 최대 1회다.
      const idle = kind === 'timeout' && !touchedRef.current;
      idleRef.current = idle ? idleRef.current + 1 : 0;
      const bail = idleRef.current >= IDLE_LIMIT;

      record(t, false, idleRef.current >= 2);
      missedRef.current.set(t.en, t);
      revealedRef.current.add(t.en);
      comboRef.current.miss();
      bonusMsRef.current = 0;
      livesRef.current = Math.max(0, livesRef.current - 1);
      const left = livesRef.current;
      setLives(left);
      setLastResult(kind);
      if (left <= 1 && !tideSeenRef.current) {
        tideSeenRef.current = true;
        setBanner({ text: '물살이 차오르기 시작해요 · 정답 2개면 물방울 하나', tone: 'gift', key: Date.now() });
      }

      const answers = findAnswerIndexes(b0, t.en);
      const ansIdx = answers.length > 0 ? answers[0] : -1;
      const ansCell = ansIdx >= 0 ? (b0[ansIdx] as WordCell) : null;
      setRevealId(ansCell ? ansCell.id : null);
      setAnnounce(`${t.ko} — 정답은 ${t.en} 이에요`);

      await sleep(REVEAL_MS);
      if (!alive(my)) return;
      setBadId(null);
      setRevealId(null);

      if (bail) {
        setAnnounce('잠시 멈춘 것 같아 여기까지 저장했어요');
        finish(false);
        return;
      }
      if (left <= 0) {
        finish(false);
        return;
      }

      let next = b0;
      if (ansCell) {
        pendingRocksRef.current.push(colOf(ansIdx));
        syncPending();
        next = compact(removeIds(b0, new Set([ansCell.id]))).board;
        setBoard(next);
        await sleep(FALL_MS);
        if (!alive(my)) return;
      }
      await settleAndContinue(my, next, clears, t.en);
    },
    [alive, board, clears, finish, record, settleAndContinue, syncPending, target],
  );
  const missRef = useRef(handleMiss);
  missRef.current = handleMiss;

  // ─── 탭 ───
  const handleTap = useCallback(
    (index: number) => {
      if (stageRef.current !== 'playing' || !target) return;
      touchedRef.current = true;
      const cell = board[index];
      if (!isWordCell(cell)) {
        sfx.click();
        return;
      }
      const root = boardElRef.current;
      focusBackRef.current =
        root && typeof document !== 'undefined' && root.contains(document.activeElement) ? index : null;
      if (cell.word.en === target.en) {
        void handleHit(index, board, cell);
      } else {
        setBadId(cell.id);
        sfx.wrong();
        void missRef.current('wrong');
      }
    },
    [board, handleHit, sfx, target],
  );
  const tapRef = useRef(handleTap);
  tapRef.current = handleTap;
  const onTap = useCallback((index: number) => tapRef.current(index), []);

  // ─── 키보드 격자 이동 ───
  const onBoardKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === 'ArrowLeft'
        ? [0, -1]
        : e.key === 'ArrowRight'
          ? [0, 1]
          : e.key === 'ArrowUp'
            ? [-1, 0]
            : e.key === 'ArrowDown'
              ? [1, 0]
              : null;
    if (!dir) return;
    const root = boardElRef.current;
    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    if (!root || !activeEl) return;
    const raw = activeEl.getAttribute('data-i');
    if (raw == null) return;
    const cur = Number(raw);
    const r = clamp(Math.floor(cur / COLS) + dir[0], 0, ROWS - 1);
    const c = clamp((cur % COLS) + dir[1], 0, COLS - 1);
    const el = root.querySelector<HTMLElement>(`[data-i="${r * COLS + c}"]`);
    if (el && typeof el.focus === 'function') {
      e.preventDefault();
      el.focus();
    }
  }, []);

  const handleExit = useCallback(() => {
    runRef.current += 1;
    onExit?.();
  }, [onExit]);

  // ─── 파생 ───
  const act = actOf(clears, goal);
  const glow = act === 1 ? 'rgba(120,224,235,.32)' : act === 2 ? 'rgba(120,224,235,.46)' : 'rgba(150,236,244,.60)';
  const busy = stage !== 'playing';
  const tideOpen = lives <= 1 && refundRef.current < refundCap;
  /** 뭉친 장이 지금 실제로 무언가를 사는가 — 취소할 낙석이 있거나 만조가 열렸을 때만. */
  const groupPays = pendingCols.length > 0 || tideOpen;
  const groupLabel = pendingCols.length > 0 ? '뭉친 장(고르면 낙석 취소)' : '뭉친 장(고르면 만조 +)';

  // 어포던스 표식 — '돌 옆의 장'과 '뭉친 장'을 눈으로 찾지 않아도 되게 미리 칠한다.
  // 이 정보는 타깃과 무관하므로 정답을 좁히지 않는다. 스캔 비용이 사라져야
  // "숙고 0.2초 = 순손실" 이던 계산이 뒤집힌다(감사 지적 1번의 핵심).
  // 값을 못 사는 표식은 아예 칠하지 않는다 — 1막에는 낙석 예약이 없으므로
  // '뭉친 장' 표식이 뜨면 살 수 없는 것을 광고하는 셈이 된다(인지부하 4항목).
  const marks = useMemo(() => {
    const rock = new Set<number>();
    const group = new Set<number>();
    for (let i = 0; i < board.length; i++) {
      const c = board[i];
      if (!isWordCell(c)) continue;
      if (touchesRock(board, i)) rock.add(c.id);
      if (groupPays && clusterAt(board, i).length >= 2) group.add(c.id);
    }
    return { rock, group };
  }, [board, groupPays]);

  const tileState = useCallback(
    (cell: Cell): TileState => {
      if (chainingIds.has(cell.id)) return 'chain';
      if (clearingIds.has(cell.id)) return 'clear';
      if (badId === cell.id) return 'bad';
      if (revealId === cell.id) return 'answer';
      return 'idle';
    },
    [badId, chainingIds, clearingIds, revealId],
  );

  const tileMark = useCallback(
    (cell: Cell): TileMark => {
      const r = marks.rock.has(cell.id);
      const g = marks.group.has(cell.id);
      return r && g ? 'both' : r ? 'rock' : g ? 'group' : 'none';
    },
    [marks],
  );

  if (!playable) return <NotEnoughWords need={DISTINCT_MIN} onExit={onExit} />;

  return (
    <div className="gk-root cs-root">
      <GameMusic gameId="cascade" />
      <div className="gk-sr" aria-live="polite">
        {announce}
      </div>
      <GameKitStyles />
      <AmbientBackground center="#ECF7F7" mid="#C2E5E9" edge="#153E54" glow={glow} glowAt="50% 30%" watermark="cascade" />
      <style dangerouslySetInnerHTML={{ __html: CS_CSS }} />
      <Hud
        score={shownScore}
        progress={clears / goal}
        combo={combo.combo}
        comboMult={combo.mult}
        lives={{ total: LIVES, left: lives, label: '남은 물방울' }}
        extra={
          <div className="cs-extra">
            <div className="cs-count">
              <span className="gk-stat-label">인출</span>
              <span className="cs-count-val">
                {clears}/{goal}
              </span>
            </div>
            {tideOpen && (
              <div className="cs-tide" aria-label={`만조 ${tide}/${TIDE_NEED} · 채우면 물방울 하나`}>
                <span className="gk-stat-label">만조</span>
                <span className="cs-tide-pips" aria-hidden="true">
                  {Array.from({ length: TIDE_NEED }, (_, i) => (
                    <i key={i} className={`cs-tide-pip ${i < tide ? 'cs-tide-pip--on' : ''}`} />
                  ))}
                </span>
              </div>
            )}
          </div>
        }
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
      />

      {stage === 'done' ? (
        <GameDone
          mark="cascade"
          lead={won ? '오늘 잘 마쳤어요' : '여기까지 잘 왔어요'}
          celebrate={won}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${clears}/${goal}`, label: '인출한 뜻' },
            { num: combo.best, label: '최고 연속' },
            { num: bestChain > 0 ? `${bestChain}단` : '—', label: '최고 연쇄' },
          ]}
          best={{ prev: bestInfo?.prev ?? null, now: score, label: '점수', improved: bestInfo?.improved }}
          badge={
            won ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 완주 · 뜻 {goal}개
              </>
            ) : bestInfo?.improved ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 개인 최고 갱신
              </>
            ) : undefined
          }
          restartHint={
            missedList.length > 0
              ? `놓친 뜻 ${missedList.length}개 · 다음 판에서 먼저 만날 수 있어요`
              : `물방울이 하나 남으면 만조가 차오릅니다 · 한 판에 ${refundCap}번까지 돌려받아요`
          }
          reveal={
            missedList.length > 0 ? (
              <div className="cs-miss">
                <p className="cs-miss-title">다시 만난 뜻</p>
                <ul className="cs-miss-list">
                  {missedList.slice(0, 6).map((w) => (
                    <li key={w.en} className="cs-miss-row">
                      <span className="cs-miss-en">{w.en}</span>
                      <span className="cs-miss-ko">{w.ko}</span>
                      {w.pos && <span className="cs-miss-pos">{w.pos}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          footer={
            missedList.length > 0 ? (
              <button type="button" className="gk-btn cs-again" onClick={() => newGame(missedList)}>
                놓친 단어부터 다시
              </button>
            ) : undefined
          }
          onRestart={() => newGame()}
          onExit={handleExit}
        />
      ) : (
        <main className="gk-stage cs-stage">
          <section className={`cs-prompt cs-prompt--${lastResult ?? 'ask'}`} aria-label="이번 뜻">
            {banner && (
              <p key={banner.key} className={`cs-banner cs-banner--${banner.tone}`} aria-hidden="true">
                {banner.text}
              </p>
            )}
            {stage === 'reveal' && target ? (
              <>
                <p className="cs-prompt-label">
                  <span className={`cs-prompt-icon cs-prompt-icon--${lastResult === 'timeout' ? 'near' : 'bad'}`}>
                    <FeedbackIcon kind={lastResult === 'timeout' ? 'near' : 'wrong'} size={14} />
                  </span>
                  {lastResult === 'timeout' ? '시간이 지났어요 · 이 단어였어요' : '이 단어였어요'}
                </p>
                <p className="cs-answer">
                  <span className="cs-answer-en">{target.en}</span>
                  <span className="cs-answer-ko">{target.ko}</span>
                </p>
                {target.example && <p className="cs-answer-ex">{target.example}</p>}
              </>
            ) : (
              <>
                {lastResult === 'correct' ? (
                  <p className="cs-prompt-label">
                    <span className="cs-prompt-icon cs-prompt-icon--ok">
                      <FeedbackIcon kind="correct" size={14} />
                    </span>
                    맞았어요
                  </p>
                ) : (
                  <p className="cs-prompt-label">이 뜻의 단어를 짚으세요</p>
                )}
                <p className="cs-prompt-ko">
                  {target ? target.ko : '…'}
                  {/* 품사를 뜻 옆에 늘 붙인다 — '측정 / 측정하다' 류에서 학습자가
                      맞는 뜻을 짚고도 오답 처리되는 일을 최소 비용으로 줄인다. */}
                  {target?.pos && <span className="cs-prompt-pos">{target.pos}</span>}
                </p>
                <TimerBar
                  frac={clock.frac}
                  warning={clock.warning}
                  seconds={Math.ceil(clock.remainMs / 1000)}
                  label="이 뜻에 남은 시간"
                />
              </>
            )}
          </section>

          {/* 예보 줄과 보드는 열이 정확히 맞아야 하므로 한 상자에 담는다. */}
          <div className="cs-boardwrap">
            {/* 낙석 예보 — 예약된 돌이 어느 열로 떨어지는지. 이게 없으면 '뭉친 장 =
                낙석 취소'가 보이지 않는 화폐가 돼 매 턴의 트레이드오프가 성립하지 않는다.
                예약이 없는 1막에는 아예 나타나지 않는다(Progressive Disclosure). */}
            {pendingCols.length > 0 && (
              <div
                className="cs-forecast"
                role="img"
                aria-label={`낙석 예보 ${pendingCols.length}개 · 뭉친 장을 짚으면 하나씩 취소돼요`}
              >
                {Array.from({ length: COLS }, (_, c) => {
                  const n = pendingCols.reduce((a, x) => a + (x === c ? 1 : 0), 0);
                  return (
                    <span key={c} className={`cs-fc ${n > 0 ? 'cs-fc--on' : ''}`} aria-hidden="true">
                      {n > 0 && (
                        <>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 4v10" />
                            <path d="M7.5 10.5 12 15l4.5-4.5" />
                            <path d="M5 20h14" opacity=".6" />
                          </svg>
                          {n > 1 && <em className="cs-fc-n">{n}</em>}
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            <div
              className={`cs-board ${busy ? 'cs-board--locked' : ''}`}
              role="grid"
              aria-label="단어 보드"
              ref={boardElRef}
              onKeyDown={onBoardKeyDown}
            >
              {Array.from({ length: ROWS }, (_, r) => (
                <div key={r} className="cs-row" role="row">
                  {Array.from({ length: COLS }, (_, c) => {
                    const i = r * COLS + c;
                    const cell = board[i];
                    if (!cell) {
                      return <div key={`hole-${i}`} className="cs-cell cs-cell--empty" role="gridcell" aria-label="빈 칸" />;
                    }
                    const st = tileState(cell);
                    return (
                      <Tile
                        key={cell.id}
                        cell={cell}
                        index={i}
                        state={st}
                        mark={tileMark(cell)}
                        groupLabel={groupLabel}
                        fresh={freshIds.has(cell.id)}
                        revealKo={st === 'answer' && isWordCell(cell) ? cell.word.ko : undefined}
                        flipRef={flip.ref}
                        onTap={onTap}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="cs-fx" aria-hidden="true">
                {fx.map((f) => (
                  <span
                    key={f.key}
                    className="cs-fx-at"
                    style={{
                      left: `${(((f.index % COLS) + 0.5) / COLS) * 100}%`,
                      top: `${((Math.floor(f.index / COLS) + 0.5) / ROWS) * 100}%`,
                    }}
                  >
                    {f.burst !== undefined && <ParticleBurst intensity={f.burst} colors={f.colors} />}
                    {f.gain !== undefined && (
                      <span className="cs-gain">
                        +{f.gain}
                        {f.tag && <em className="cs-gain-tag">{f.tag}</em>}
                        {f.cost && <em className="cs-gain-cost">{f.cost}</em>}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 규칙은 한 번에 다 쏟지 않는다 — 돌이 등장하는 2막에 가서야 돌 이야기를 한다. */}
          <p className="cs-help">
            {act === 1 ? (
              <>
                같은 단어가 여러 장이면 <b>낮은 장</b>이 점수를 더 줘요 · 낙하로 같은 단어 3칸이 이어지면 연쇄
              </>
            ) : (
              <>
                쌓인 <b>돌</b>은 물살을 좁혀요 · <b>돌 옆</b>을 짚으면 부수고 시간을 벌고 · <b>뭉친 장</b>은 낙석 취소 ·{' '}
                <b>낮은 장</b>은 점수
              </>
            )}
          </p>
        </main>
      )}
    </div>
  );
}

const CS_CSS = `
  /* 보드 폭은 한 곳에서만 정한다 — 예보 줄이 열과 정확히 맞아야 '어느 열에 떨어지는지'가 읽힌다. */
  .cs-root { --cs-w: max(240px, min(470px, 92vw, calc(100dvh - 368px))); --cs-gap: clamp(7px, 1.5vw, 11px); }
  .cs-root .gk-stage { gap: clamp(10px, 2vh, 18px); justify-content: flex-start; padding-top: clamp(10px, 2.4vh, 22px); }

  /* HUD 는 7칸이라 gamekit 의 6열 그리드를 넘긴다 — 데스크톱에서 '나가기'가 2행으로
     떨어지던 문제. 이 게임에서만 flex-wrap 으로 바꾼다(공용 킷은 건드리지 않는다). */
  .cs-root .gk-hud { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
  .cs-root .gk-hud > .gk-progress { flex: 1 1 90px; }
  .cs-extra { display: flex; align-items: center; gap: 10px; }
  .cs-count { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .cs-count-val { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t1); }
  .cs-tide { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; line-height: 1.05; }
  .cs-tide-pips { display: inline-flex; gap: 3px; }
  .cs-tide-pip { width: 11px; height: 11px; border-radius: 999px; border: 1.5px solid color-mix(in srgb, var(--success) 55%, var(--bd)); background: transparent; }
  .cs-tide-pip--on { background: var(--success); box-shadow: 0 0 0 2px color-mix(in srgb, var(--success) 22%, transparent); }

  /* ── 뜻 카드 ── */
  /* 높이를 고정해 둔다 — 물음↔공개로 내용이 바뀔 때 보드가 위아래로 튀지 않게. */
  .cs-prompt { position: relative; width: min(470px, 92vw); min-height: clamp(106px, 15vh, 130px);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 18px 13px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd);
    background: color-mix(in srgb, var(--bg) 84%, transparent); backdrop-filter: blur(7px);
    box-shadow: 0 12px 30px -18px rgba(0,0,0,.5); transition: border-color .2s var(--ease, ease-out), background .2s; }
  .cs-prompt--wrong, .cs-prompt--timeout { border-color: color-mix(in srgb, var(--error) 55%, var(--bd)); }
  .cs-prompt--correct { border-color: color-mix(in srgb, var(--success) 50%, var(--bd)); }
  .cs-prompt-label { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: .04em; color: var(--t3); text-align: center; }
  .cs-prompt-icon { display: inline-flex; }
  .cs-prompt-icon--bad { color: var(--error); }
  .cs-prompt-icon--near { color: var(--warning); }
  .cs-prompt-icon--ok { color: var(--success); }
  .cs-prompt-ko { margin: 0; font-family: var(--font-display, system-ui, sans-serif); font-size: clamp(20px, 5.6vw, 28px); font-weight: 800;
    letter-spacing: -.02em; color: var(--t1); text-align: center; line-height: 1.25; word-break: keep-all;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .cs-prompt-pos { display: inline-block; margin-left: 7px; padding: 1px 7px; border-radius: 999px; vertical-align: middle;
    border: 1px solid var(--bd); font-size: 11px; font-weight: 700; letter-spacing: 0; color: var(--t3); background: var(--bg2); }
  .cs-root .cs-prompt .gk-timer { width: min(300px, 76%); }
  .cs-answer { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 4px 12px; margin: 0; text-align: center; }
  .cs-answer-en { font-family: var(--font-english, system-ui); font-size: clamp(21px, 5.8vw, 29px); font-weight: 800; color: var(--combo); letter-spacing: -.01em; }
  .cs-answer-ko { font-family: var(--font-display, system-ui); font-size: clamp(14px, 3.4vw, 17px); font-weight: 700; color: var(--t2); }
  .cs-answer-ex { margin: 0; max-width: 42ch; font-family: var(--font-english, system-ui); font-size: 12.5px; line-height: 1.5; color: var(--t3); text-align: center;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* ── 배너(연쇄·막 전환·보상·비용) — 모달 아님, 카드 위에 얹히는 한 줄 ── */
  .cs-banner { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); margin: 0; padding: 3px 12px; border-radius: 999px;
    font-size: 11.5px; font-weight: 900; letter-spacing: -.01em; white-space: nowrap; border: 1px solid var(--bd); background: var(--bg); color: var(--t1);
    animation: cs-banner 1.6s ease-out forwards; }
  .cs-banner--chain { color: var(--streak); border-color: color-mix(in srgb, var(--streak) 55%, var(--bd)); }
  .cs-banner--act { color: var(--combo); border-color: color-mix(in srgb, var(--combo) 55%, var(--bd)); }
  .cs-banner--gift { color: var(--success); border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); }
  .cs-banner--cost { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 55%, var(--bd)); }
  @keyframes cs-banner { 0% { opacity: 0; transform: translate(-50%, 6px); } 12% { opacity: 1; transform: translate(-50%, 0); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -6px); } }

  .cs-boardwrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }

  /* ── 낙석 예보 ── */
  /* 열 하나당 칸 하나. 보드와 같은 그리드라 '이 열 위에 돌이 걸려 있다'가 즉시 보인다. */
  .cs-forecast { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--cs-gap); width: var(--cs-w);
    margin-bottom: -4px; animation: cs-fc-in .24s ease-out; }
  .cs-fc { display: flex; align-items: center; justify-content: center; gap: 2px; height: 17px; border-radius: 6px;
    border: 1px dashed color-mix(in srgb, var(--t1) 12%, transparent); color: transparent; }
  .cs-fc--on { border-style: solid; border-color: color-mix(in srgb, var(--warning) 45%, transparent);
    background: color-mix(in srgb, var(--warning) 12%, transparent); color: var(--warning); }
  .cs-fc-n { font-style: normal; font-size: 10px; font-weight: 900; font-variant-numeric: tabular-nums; }
  @keyframes cs-fc-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

  /* ── 보드 ── */
  /* 100vh 는 iOS 주소창 때문에 실제보다 크고, 844×390 가로모드에서 계산값이 50px 까지
     내려가 타일이 7px 이 됐다(44px 터치 타깃 위반). dvh + 하한으로 막는다. */
  .cs-board { position: relative; display: grid; grid-template-rows: repeat(4, 1fr); gap: var(--cs-gap);
    width: var(--cs-w); }
  .cs-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--cs-gap); }
  .cs-cell { position: relative; aspect-ratio: 1 / 1; border-radius: var(--r-md, 10px); min-height: 44px; }
  .cs-cell--empty { background: color-mix(in srgb, var(--t1) 5%, transparent); border: 1px dashed color-mix(in srgb, var(--t1) 10%, transparent); }
  .cs-fx { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
  .cs-fx-at { position: absolute; width: 0; height: 0; }
  .cs-fx-at .cs-gain { position: absolute; left: 50%; top: -10px; transform: translateX(-50%); }

  .cs-tile { overflow: visible; display: grid; place-items: center; padding: 5px; border: 1.5px solid var(--bd);
    background: var(--bg); color: var(--t1); cursor: pointer; text-align: center;
    transition: transform .14s var(--ease-spring, ease-out), border-color .15s, background .15s, box-shadow .15s, opacity .2s; }
  .cs-tile-body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 100%; }
  .cs-tile-en { font-family: var(--font-english, system-ui); font-size: clamp(11px, 2.7vw, 15px); font-weight: 800; line-height: 1.12;
    letter-spacing: -.01em; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .cs-tile-ko { font-family: var(--font-display, system-ui); font-size: clamp(9.5px, 2.1vw, 12px); font-weight: 700; color: var(--t2); line-height: 1.15; word-break: keep-all; }
  .cs-tile-icon { position: absolute; top: 4px; left: 4px; display: inline-flex; }
  .cs-tile-icon--ok { color: var(--success); }
  .cs-tile-icon--bad { color: var(--error); }
  .cs-tile-icon--ans { color: var(--combo); }

  /* 어포던스 — 색 + 아이콘 + 모서리 형태 3중 인코딩(색맹 대응). 정답과 무관한
     보드 기하 정보라 정답을 좁히지 않고, 대신 눈으로 훑는 비용을 없앤다. */
  .cs-afford { position: absolute; display: inline-flex; padding: 1.5px; border-radius: 4px; background: var(--bg); line-height: 0; }
  .cs-afford--rock { top: 3px; right: 3px; color: var(--warning); }
  .cs-afford--group { bottom: 3px; right: 3px; color: var(--streak); }
  .cs-mark--rock { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--warning) 42%, transparent); border-top-right-radius: 3px; }
  .cs-mark--group { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--streak) 38%, transparent); border-bottom-right-radius: 3px; }
  .cs-mark--both { box-shadow: inset 0 2px 0 0 color-mix(in srgb, var(--warning) 55%, transparent), inset 0 -2px 0 0 color-mix(in srgb, var(--streak) 50%, transparent);
    border-top-right-radius: 3px; border-bottom-right-radius: 3px; }

  .cs-tile--word:hover[aria-disabled="false"] { transform: translateY(-2px); border-color: var(--combo); box-shadow: 0 7px 18px color-mix(in srgb, var(--combo) 20%, transparent); }
  .cs-tile--word:active[aria-disabled="false"] { transform: scale(.95); }
  .cs-tile--word:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .cs-tile[aria-disabled="true"] { cursor: default; pointer-events: none; }

  .cs-tile--clear { border-color: var(--success); background: var(--success-light); z-index: 3; animation: cs-pop .23s ease-out forwards; }
  .cs-tile--chain { border-color: var(--streak); background: color-mix(in srgb, var(--streak) 16%, var(--bg)); z-index: 3; animation: cs-pop .21s ease-out forwards; }
  .cs-tile--bad { border-color: var(--error); background: var(--error-light); animation: gk-shake .34s ease-in-out; }
  .cs-tile--answer { border-color: var(--combo); border-width: 2.5px; background: color-mix(in srgb, var(--combo) 14%, var(--bg));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 26%, transparent); z-index: 2; }
  .cs-tile--answer .cs-tile-en { color: var(--combo); }
  .cs-board--locked .cs-tile--word { opacity: .58; pointer-events: none; }
  .cs-board--locked .cs-tile--answer, .cs-board--locked .cs-tile--clear, .cs-board--locked .cs-tile--chain, .cs-board--locked .cs-tile--bad { opacity: 1; }

  /* 돌 — 색이 아니라 형태(모난 모서리·해칭·아이콘)로 구분한다. */
  .cs-tile--rock { border-style: solid; border-color: color-mix(in srgb, var(--t1) 26%, transparent); color: var(--t3); cursor: default;
    border-radius: 4px 12px 5px 11px;
    background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--t1) 9%, var(--bg)) 0 5px, color-mix(in srgb, var(--t1) 15%, var(--bg)) 5px 10px); }

  .cs-gain { display: flex; flex-direction: column; align-items: center; line-height: 1.05; white-space: nowrap;
    font-family: var(--font-display, system-ui); font-size: 15px; font-weight: 900; color: var(--success); animation: gk-gain .84s ease-out forwards; }
  .cs-gain-tag { font-style: normal; font-size: 10px; font-weight: 800; color: var(--streak); }
  .cs-gain-cost { font-style: normal; font-size: 10px; font-weight: 800; color: var(--warning); }

  .cs-help { max-width: 48ch; margin: 0; font-size: 12px; line-height: 1.5; color: var(--t3); text-align: center; }
  .cs-help b { color: var(--t2); font-weight: 800; }

  /* ── 끝화면 ── */
  .cs-miss { display: flex; flex-direction: column; gap: 8px; }
  .cs-miss-title { margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: .04em; color: var(--t3); }
  .cs-miss-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
  .cs-miss-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .cs-miss-en { font-family: var(--font-english, system-ui); font-size: 15px; font-weight: 800; color: var(--combo); }
  .cs-miss-ko { font-size: 13.5px; font-weight: 700; color: var(--t1); }
  .cs-miss-pos { font-size: 11px; font-weight: 700; color: var(--t3); }
  .cs-again { min-height: 44px; }

  @keyframes cs-pop { 0% { transform: scale(1); opacity: 1; } 45% { transform: scale(1.09); opacity: 1; } 100% { transform: scale(.22); opacity: 0; } }
  /* 새 타일은 위에서 실제로 떨어진다. 남아 있던 타일의 이동은 useFlipGrid 가 맡는다. */
  .cs-tile--fresh { animation: cs-drop .32s cubic-bezier(.3,.9,.35,1); }
  @keyframes cs-drop { 0% { transform: translateY(-165%); opacity: .15; } 72% { opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }

  /* 가로모드·낮은 뷰포트 — 카드를 보드 왼쪽에 세우고 도움말을 접어 세로 예약분을 회수한다.
     예보 줄은 .cs-boardwrap 안에 있어 가로 배치에서도 보드 바로 위에 붙는다. */
  @media (orientation: landscape) and (max-height: 560px) {
    .cs-root .gk-stage { flex-direction: row; align-items: center; justify-content: center; gap: 16px; padding-top: 8px; }
    .cs-root { --cs-w: max(240px, min(430px, 46vw, calc(100dvh - 112px))); }
    .cs-prompt { width: min(360px, 42vw); min-height: 0; }
    .cs-forecast { margin-bottom: 0; }
    .cs-help { display: none; }
  }

  @media (max-width: 430px) {
    /* 좁은 화면에서는 진행도를 HUD 게이지와 끝화면이 대신 말해 준다. */
    .cs-count { display: none; }
  }
  @media (max-width: 400px) {
    .cs-help { font-size: 11px; }
    .cs-prompt { padding: 12px 14px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .cs-tile, .cs-prompt { transition: none; }
    .cs-tile--bad, .cs-tile--fresh { animation: none; }
    .cs-banner { animation: none; opacity: 1; }
    .cs-gain { animation: none; opacity: 1; }
    .cs-tile--clear, .cs-tile--chain { animation: none; opacity: .4; }
  }
`;
