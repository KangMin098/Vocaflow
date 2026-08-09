// apps/web/src/components/game/connections/ConnectionsGame.tsx
// Connections — 숨은 규칙 격자. 보드에는 **한국어 뜻만** 깔리고, 그룹을 잇는 규칙은
// 숨겨진 **영단어의 형태**에 있다. 뜻 → 영단어를 인출하지 못하면 규칙 자체가 보이지 않는다.
//
// v07.9 전면 재설계. 이전 판의 결함을 구조적으로 제거했다.
//   1) 인출 없음 — 타일마다 en+ko 를 함께 인쇄해 한글만 읽고 20초에 풀렸다.
//   2) 학습자 단어장과 무관 — 고정 퍼즐 5개를 돌리며 내장 뱅크 단어를 FSRS 에 적재했다.
//   3) 난이도 단조 감소 · 마지막 그룹 자동 정답 — 침입자를 넣어 자동 정답을 없앴다.
//   4) 판돈 없는 콤보 · 점수 없음 — 규칙 tier × 콤보 배수 × 선점 배수로 점수를 매긴다.
//   5) 패배 시 정답을 계산만 하고 버림 — GameDone reveal 에 못 찾은 규칙을 전부 공개한다.
//
// v07.10 적대적 반증 대응 — "싸게 이기는 절차" 네 가지를 막았다.
//   A) [치명] 라운드 1을 정찰로 쓰고 2·3은 기억으로 푼다
//      확정 막대가 12단어의 en 을 인쇄하고 roundClear 가 침입자 4개의 en 을 펼치는데
//      다음 격자가 같은 풀에서 다시 뽑혀, 실측상 2라운드 보드의 40.6% / 3라운드의
//      62.9%(단어 40개 기준), 단어 16개면 89.9% / 98.2% 가 "이미 철자를 본 타일"이었다.
//      → ① roundClear 에서 en 을 더 이상 펼치지 않는다(끝화면에 모아서 공개).
//        ② en 을 인쇄한 타일 id 를 세션 내내 누적해 generateGrid 에 넘기고,
//           그룹 단어는 거기서 뽑지 않는다.
//        ③ 세 격자(16×3=48)를 한 단어도 겹치지 않고 채우도록 풀을 POOL_TARGET 까지
//           맛보기 단어로 보강한다. 실측 결과 그룹 재사용 0.0% · 보드 재사용 0.0%.
//   B) [높음] '품사' 칩은 한국어 뜻의 어미만 읽고 공짜로 확정된다 → 규칙 자체를 제거(puzzle.ts).
//   C) [보통] 힌트 3장이 사실상 무료라 항상 다 쓰는 것이 우세 → 격자당 1회 상한 +
//      누진 시간 비용 + 콤보 소멸 + 다음 확정 배수 몰수. 아래 판돈 상수 주석 참조.
//   D) [보통] 단어장이 작으면 보드가 9~15칸으로 쪼그라들어 5택4 브루트포스가 됐다
//      → 풀 보강으로 보드를 항상 16칸으로 보장(실측 최소 16칸 · 16칸 미만 0.0%).
//
// 인출 규칙 준수
//   · 제출 전 공개: 한국어 뜻 · 규칙의 "종류" · 규칙의 tier(종류마다 고정이라 정보 누수 아님).
//   · 부분 정답 오라클 없음 — 3/4 근접 안내는 기회 1 + 시간 8초를 실제로 소모한 뒤에만 뜬다.
//   · "뜻 펼치기"로 산 단어는 그 세션 내내 onCorrect 대상에서 빠진다(assisted 로만 올라간다).

'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  GameMusic,
  NotEnoughWords,
  ParticleBurst,
  FeedbackIcon,
  TimerBar,
  LifePips,
  useSfx,
  useCountdown,
  useCombo,
  useFlipGrid,
  usePersonalBest,
  useCountUp,
  shuffle,
  clamp,
  type ComboTier,
  type Word,
} from '@/components/game/_shared/gamekit';

import {
  buildTiles,
  generateGrid,
  ROUND_SPECS,
  POOL_TARGET,
  DEMO_POOL,
  type Grid,
  type PuzzleGroup,
  type Rule,
  type TileWord,
} from './puzzle';

/** 정답을 이미 보여준 뒤의 입력 — 게임 점수에는 반영하되 FSRS 카드는 갱신하지 않는다. */
interface ResultOpts {
  assisted?: boolean;
}

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// ─── 판돈 상수 ────────────────────────────────────────────────────────────
const TOTAL_MS = 180_000;      // 3분에서 출발. 확정마다 늘어나고 실수마다 줄어든다.
const WARN_MS = 20_000;
const GROUP_EXTEND_MS = 10_000;
const ROUND_EXTEND_MS = 12_000;
const WRONG_DRAIN_MS = 8_000;
const MAX_LIVES = 4;
const MAX_HINTS = 3;

/**
 * 힌트 재가격 (v07.10).
 *
 * 이전: 정액 120점 + 6초. 그룹 하나의 기대 점수가 300~1,320점인데 비용이 12% 라
 * "라운드 1 시작 즉시 서로 다른 3칸을 펼쳐 철자 3개를 확보하고 규칙을 역산한다"가
 * 지배 전략이었다. 게다가 점수가 0인 시작 시점에는 Math.max(0, …) 때문에 **공짜**였다.
 *
 * 지금은 세 가지를 동시에 지불한다 — 어느 하나도 점수 0 상태에서 회피되지 않는다.
 *   ① 격자당 1회 상한(HINT_PER_GRID). 3장을 한 격자에 몰아 규칙을 역산하는 절차
 *      자체가 불가능해진다. 세션 총량은 그대로 3장이라 "막힐 때마다 한 번"은 남는다.
 *   ② 누진 시간 8/14/20초(합 42초 = 시작 시계의 23%). 가산 상한이 총량의 75% 라
 *      뒤에서 벌충되지 않는다.
 *   ③ 콤보 소멸 + **다음 확정 1회는 배수 없이 기본 점수만**. 잘 굴러갈수록 비싸고
 *      (콤보 5·선점 ×2.0 구간에서 다음 확정이 1,320 → 400점), 이미 막혀서 콤보가
 *      끊긴 학습자에게는 싸다. 상황 의존적이라 지배 전략이 되지 않는다.
 */
const HINT_DRAIN_MS = [8_000, 14_000, 20_000];
const HINT_PER_GRID = 1;

/** 격자 한 판이 16칸이라 세 격자를 겹치지 않고 채우려면 POOL_TARGET(=48) 타일이 필요하다.
 *  학습자 단어가 이보다 적으면 맛보기 단어로 보강하되, 게임 진입 자체는 이 수를 요구한다.
 *  (반증 실측: buildTiles 통과 타일 24개 미만에서는 보드가 평균 14.1칸으로 무너졌다.) */
const MIN_POOL = 24;

const GROUP_COLORS = ['var(--success)', 'var(--combo)', 'var(--active)', 'var(--streak)'];

// 한 세션의 확정 횟수가 8회라 기본 티어(3/6/10/16)는 절반도 못 밟는다. 촘촘하게 다시 잡는다.
const CN_TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 2, mult: 1.3, label: '연결' },
  { at: 3, mult: 1.6, label: '흐름' },
  { at: 5, mult: 2.2, label: '통찰' },
  { at: 7, mult: 3, label: '완전' },
];

function multFor(combo: number): number {
  let m = 1;
  for (const t of CN_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}

/**
 * 선점 배수 — 더 쉬운 규칙을 남겨둔 채 어려운 규칙을 먼저 치면 배수가 붙는다.
 * 상한이 2.5 였는데 한 격자의 그룹이 최대 3개라 lowerLeft ≤ 2, 실제 도달 가능한
 * 최대는 2.0 이었다(반증 지적). 도달 못 하는 숫자를 UI 에 적어두면 거짓 약속이다.
 */
const PREEMPT_MAX = 2.0;
function preemptFor(lowerLeft: number): number {
  return Math.min(PREEMPT_MAX, 1 + 0.5 * lowerLeft);
}

type Phase = 'playing' | 'roundClear' | 'done';
type EndReason = 'won' | 'lost' | 'timeout' | 'ended';

interface SolvedEntry {
  group: PuzzleGroup;
  color: string;
}

// ─── 타일 ─────────────────────────────────────────────────────────────────
// useCountdown 이 매 프레임 setState 하므로 부모는 60fps 로 다시 그려진다.
// 타일은 memo 로 끊어 실제 변화(선택·오답·펼침)에만 반응하게 한다.
// ⚠️ v07.10: memo 가 실제로는 무효였다 — onToggle 의 useCallback deps 에 sfx 가
// 들어 있는데 useSfx 는 매 렌더 새 객체를 돌려주므로 매 프레임 새 함수가 생겼다.
// 아래 toggle 은 deps [] 로 고정하고 변하는 값은 ref 로 읽는다.
const Tile = memo(function Tile({
  id,
  ko,
  en,
  state,
  onToggle,
  refFactory,
}: {
  id: string;
  ko: string;
  en: string | null;
  state: 'idle' | 'sel' | 'wrong' | 'out';
  onToggle: (id: string) => void;
  refFactory: (key: string) => (el: HTMLElement | null) => void;
}) {
  const setRef = useMemo(() => refFactory(id), [refFactory, id]);
  const locked = state === 'out';
  return (
    <button
      ref={setRef as (el: HTMLButtonElement | null) => void}
      type="button"
      className={`cn-tile cn-tile--${state}`}
      onClick={() => onToggle(id)}
      aria-pressed={state === 'sel'}
      aria-disabled={locked ? 'true' : undefined}
    >
      {state === 'wrong' && (
        <span className="cn-tile-icon">
          <FeedbackIcon kind="wrong" size={12} />
        </span>
      )}
      <span className="cn-ko">{ko}</span>
      {en && <span className="cn-en">{en}</span>}
    </button>
  );
});

// ─── 확정된 규칙 막대 ─────────────────────────────────────────────────────
// 이 막대가 이 게임의 **학습 산출물**이 인쇄되는 유일한 자리다(규칙 + 4단어 en/ko).
// v07.10 대비 수정: 이전에는 그룹 색을 배경으로 깔고 흰 글씨를 얹어 --active(#B0843A)
// 3.39:1 · --streak 3.53:1, 다크에서는 2.00:1 까지 떨어져 AA 미달이었다. 배경을
// 색조로만 남기고 글자는 --t1 로 바꾸면 4색 전부 라이트·다크에서 AA 를 넘는다.
// 색 구분은 왼쪽 색 띠 + 아이콘 + ◆tier + 규칙 텍스트로 여전히 이중 인코딩된다.
const SolvedBar = memo(function SolvedBar({
  entry,
  popping,
}: {
  entry: SolvedEntry;
  popping: boolean;
}) {
  return (
    <div
      className={`cn-bar ${popping ? 'cn-bar--pop' : ''}`}
      style={{ ['--cn-group' as string]: entry.color } as CSSProperties}
    >
      <span className="cn-bar-head">
        <span className="cn-bar-ico">
          <FeedbackIcon kind="correct" size={13} />
        </span>
        <span className="cn-bar-rule">{entry.group.rule.valueLabel}</span>
        <span className="cn-bar-tier" aria-label={`난이도 ${entry.group.rule.tier}`}>
          {'◆'.repeat(entry.group.rule.tier)}
        </span>
      </span>
      <span className="cn-bar-words">
        {entry.group.tiles.map((t) => (
          <span key={t.id} className="cn-bar-word">
            <b>{t.en}</b> {t.ko}
          </span>
        ))}
      </span>
      {popping && <ParticleBurst intensity={3} colors={[entry.color]} />}
    </div>
  );
});

export function ConnectionsGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;

  // ── 단어 풀 ──
  // 세 격자가 한 단어도 겹치지 않으려면 16×3 = POOL_TARGET 타일이 필요하다.
  // 학습자 단어가 모자란 만큼만 맛보기 단어로 채운다(own=false → FSRS 미적재).
  // 실측(단어장 40개): 보드 타일의 16.5% 만 맛보기 단어, 그룹 단어 재사용 0.0%.
  const basePool = useMemo(() => {
    const own = buildTiles(wordPool ?? [], true);
    if (own.length >= POOL_TARGET) return own;
    const seen = new Set(own.map((t) => t.id));
    const filler = shuffle(buildTiles(DEMO_POOL, false).filter((t) => !seen.has(t.id)));
    return [...own, ...filler.slice(0, POOL_TARGET - own.length)];
  }, [wordPool]);

  const ownCount = useMemo(() => basePool.filter((t) => t.own).length, [basePool]);

  const usedRuleIds = useRef<Set<string>>(new Set());
  /** en 을 화면에 인쇄한 적 있는 타일 — 다음 격자의 **그룹 단어**에서 제외한다. */
  const exposedIds = useRef<Set<string>>(new Set());

  const makeGrid = useCallback(
    (round: number) => {
      // 규칙 중복 금지는 generateGrid 안에서 "선호"로 처리된다(규칙이 모자라면 스스로 푼다).
      // exposed 는 반대로 강한 제약이다 — 여기가 뚫리면 게임의 전제가 무너진다.
      const g = generateGrid(basePool, round, usedRuleIds.current, exposedIds.current);
      g?.groups.forEach((x) => usedRuleIds.current.add(x.rule.id));
      return g;
    },
    [basePool],
  );

  const [grid, setGrid] = useState<Grid | null>(() =>
    generateGrid(basePool, 0, new Set<string>(), new Set<string>()),
  );
  const [roundIdx, setRoundIdx] = useState(0);
  /** "섞기"로 학습자가 직접 바꾼 배치. null 이면 격자가 준 순서 그대로. */
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<SolvedEntry[]>([]);
  const [solvedTotal, setSolvedTotal] = useState(0);
  /** 세션 전체에서 스스로 짚어낸 단어 — 끝화면 복습용(라운드가 넘어가도 남는다). */
  const [learned, setLearned] = useState<TileWord[]>([]);
  /** 지나간 격자의 침입자 — 끝화면에서 한꺼번에 en+ko 로 공개한다. */
  const [pastIntruders, setPastIntruders] = useState<TileWord[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  /** "뜻 펼치기"로 산 타일 — 라운드가 넘어가도 **초기화하지 않는다**(세션 유지). */
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [oneAway, setOneAway] = useState(false);
  const [justSolvedId, setJustSolvedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintsInGrid, setHintsInGrid] = useState(0);
  /** 힌트로 몰수된 배수 — 다음 확정 N회는 기본 점수만 준다. */
  const [plainCharges, setPlainCharges] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
  const [endReason, setEndReason] = useState<EndReason>('won');
  const [msg, setMsg] = useState('');
  const [toast, setToast] = useState('');
  const [gainFx, setGainFx] = useState<{ key: number; amount: number } | null>(null);
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; improved: boolean } | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 첫 격자의 규칙을 "이미 쓴 규칙"에 등록 — 다음 격자가 같은 규칙을 다시 내지 않게.
  useEffect(() => {
    grid?.groups.forEach((x) => usedRuleIds.current.add(x.rule.id));
    // 마운트 시 1회 — 이후 등록은 makeGrid / restart 가 담당한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoreRef = useRef(0);
  const revealedRef = useRef<Set<string>>(new Set());
  revealedRef.current = revealed;
  const plainRef = useRef(0);
  plainRef.current = plainCharges;
  const firedWrong = useRef<Set<string>>(new Set());
  const firedCorrect = useRef<Set<string>>(new Set());

  const onCorrectRef = useRef(onCorrect);
  onCorrectRef.current = onCorrect;
  const onWrongRef = useRef(onWrong);
  onWrongRef.current = onWrong;

  // ── FSRS 적재 정책 ────────────────────────────────────────────────────
  // 학습자 단어(own)만 올린다. 그리고 **같은 단어는 세션당 한 번만** 올린다 —
  // 반증 실측에서 완주 세션의 onCorrect 32.0회 중 7.9회가 같은 단어 중복이었고,
  // 수십 초 간격의 반복은 독립 인출이 아니라 게임상 반복일 뿐이다.
  // (라운드 간 단어 재사용을 없애 구조적으로도 중복이 0이 됐지만, 가드는 남긴다.)
  const reportCorrect = useCallback((t: TileWord) => {
    if (!t.own) return;
    if (firedCorrect.current.has(t.id)) return;
    firedCorrect.current.add(t.id);
    // 뜻을 펼쳐서 철자를 이미 본 단어는 인출이 아니라 재인이다 —
    // 점수·콤보에는 그대로 반영하되 카드는 갱신하지 않게 assisted 로 올린다.
    const assisted = revealedRef.current.has(t.id);
    onCorrectRef.current?.(t, assisted ? { assisted: true } : undefined);
  }, []);

  // 같은 단어로 onWrong 을 도배하지 않는다 — 세션당 1회.
  const reportWrong = useCallback((t: TileWord) => {
    if (!t.own) return;
    if (firedWrong.current.has(t.id)) return;
    firedWrong.current.add(t.id);
    onWrongRef.current?.(t);
  }, []);

  const pb = usePersonalBest('connections');
  const pbRef = useRef(pb);
  pbRef.current = pb;

  const finishRef = useRef<(r: EndReason) => void>(() => {});
  const clock = useCountdown({
    totalMs: TOTAL_MS,
    running: phase === 'playing',
    warnAtMs: WARN_MS,
    onEnd: () => finishRef.current('timeout'),
    onWarn: () => setToast('시간이 얼마 남지 않았어요'),
  });
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const combo = useCombo({
    tiers: CN_TIERS,
    onTierUp: (t, c) => {
      sfxRef.current.coin();
      setToast(`${c}연속 · 점수 ×${t.mult}`);
    },
    onBreak: (lost) => setToast(`${lost}연속이 끊겼어요 — 배수는 다시 쌓으면 돼요`),
  });
  const comboRef = useRef(combo);
  comboRef.current = combo;

  // 토스트는 잠깐만 — Calm UI. 모달로 학습을 끊지 않는다.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => mounted.current && setToast(''), 1700);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!gainFx) return;
    const id = window.setTimeout(() => mounted.current && setGainFx(null), 900);
    return () => window.clearTimeout(id);
  }, [gainFx]);

  useEffect(() => {
    if (!justSolvedId) return;
    const id = window.setTimeout(() => mounted.current && setJustSolvedId(null), 800);
    return () => window.clearTimeout(id);
  }, [justSolvedId]);

  // ── 파생 ──
  const tileById = useMemo(() => {
    const m = new Map<string, TileWord>();
    grid?.tiles.forEach((t) => m.set(t.id, t));
    return m;
  }, [grid]);

  const ruleIdByTile = useMemo(() => {
    const m = new Map<string, string>();
    grid?.groups.forEach((g) => g.tiles.forEach((t) => m.set(t.id, g.rule.id)));
    return m;
  }, [grid]);

  const solvedRuleIds = useMemo(() => new Set(solved.map((s) => s.group.rule.id)), [solved]);
  const solvedTileIds = useMemo(
    () => new Set(solved.flatMap((s) => s.group.tiles.map((t) => t.id))),
    [solved],
  );

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const solvedRuleIdsRef = useRef(solvedRuleIds);
  solvedRuleIdsRef.current = solvedRuleIds;

  // 종료는 한 번만 — 시간 만료와 기회 소진이 같은 프레임에 겹쳐도 점수가 두 번 확정되지 않는다.
  const endedRef = useRef(false);
  const finish = useCallback(
    (reason: EndReason) => {
      if (endedRef.current) return;
      endedRef.current = true;

      // 끝내 찾지 못한 규칙의 단어들은 곧바로 끝화면에 en+ko 로 공개된다.
      // 공개하기 **전에** 오답으로 정직하게 올려 복습 스케줄에 잡히게 한다 —
      // 모르는 단어를 아무것도 올리지 않으면 "잘 고른 것만 올라가는" 편향이 생긴다.
      // 완주('won')에는 못 찾은 규칙이 없으므로 이 경로는 실패로 끝난 세션에만 돈다
      // (현재 격자의 미확정 그룹 ≤ 2개 = 최대 8단어, 세션당 1회 중복 차단).
      if (reason !== 'won') {
        const g = gridRef.current;
        const done = solvedRuleIdsRef.current;
        g?.groups
          .filter((x) => !done.has(x.rule.id))
          .forEach((x) => x.tiles.forEach(reportWrong));
      }

      const timeBonus = reason === 'won' ? Math.round(clockRef.current.remainMs / 1000) * 5 : 0;
      const total = scoreRef.current + timeBonus;
      scoreRef.current = total;
      setScore(total);
      setEndReason(reason);
      setBestInfo(pbRef.current.submit(total));
      setPhase('done');
      if (reason === 'won') sfxRef.current.fanfare();
    },
    [reportWrong],
  );
  finishRef.current = finish;

  // 배치는 격자에서 파생한다 — 격자가 바뀌면 낡은 배치가 남아 빈 보드가 되는 일이 없다.
  const order = useMemo(() => {
    if (!grid) return [];
    const natural = grid.tiles.map((t) => t.id);
    if (!orderOverride) return natural;
    const ids = new Set(natural);
    const kept = orderOverride.filter((id) => ids.has(id));
    return kept.length === ids.size ? kept : natural;
  }, [grid, orderOverride]);

  const boardTiles = useMemo(
    () =>
      order
        .map((id) => tileById.get(id))
        .filter((t): t is TileWord => !!t && !solvedTileIds.has(t.id)),
    [order, tileById, solvedTileIds],
  );
  const boardIds = useMemo(() => boardTiles.map((t) => t.id), [boardTiles]);
  const flip = useFlipGrid(boardIds);

  const remainingRules = useMemo(
    () => (grid ? grid.groups.filter((g) => !solvedRuleIds.has(g.rule.id)) : []),
    [grid, solvedRuleIds],
  );
  // 남은 규칙의 "종류"만 섞어 보여준다 — 어느 종류가 어느 그룹인지는 알려주지 않는다.
  // tier 는 규칙 종류마다 고정이라(시작 글자=1 · 끝 글자/뒤 조각=2 · 앞 조각/글자 수/
  // 들어 있는 글자=3 · 철자 생김새=4) 함께 적어도 정답 정보가 새지 않는다. 오히려
  // 적지 않으면 "선점 배수"가 무엇을 걸고 하는 선택인지 모른 채 순서를 고르게 된다.
  const chipRules = useMemo(
    () => shuffle(remainingRules.map((g) => g.rule)),
    [remainingRules],
  );

  const chipValue = useCallback(
    (rule: Rule) => {
      const lowerLeft = remainingRules.filter(
        (x) => x.rule.id !== rule.id && x.rule.tier < rule.tier,
      ).length;
      const plain = plainCharges > 0;
      const mult = plain ? 1 : multFor(combo.combo + 1);
      const preempt = plain ? 1 : preemptFor(lowerLeft);
      return Math.round(100 * rule.tier * mult * preempt);
    },
    [remainingRules, plainCharges, combo.combo],
  );

  // ── 조작 ──
  // deps [] — 부모가 매 프레임 리렌더돼도 Tile 의 memo 가 살아 있어야 한다.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const toggle = useCallback((id: string) => {
    if (phaseRef.current !== 'playing') return;
    const sel = selectedRef.current;
    const has = sel.includes(id);
    if (!has && sel.length >= 4) return;
    setOneAway(false);
    setWrongIds([]);
    sfxRef.current.click();
    setSelected(has ? sel.filter((x) => x !== id) : [...sel, id]);
  }, []);

  const submit = useCallback(() => {
    if (phase !== 'playing' || !grid || selected.length !== 4) return;
    const sel = selected.map((id) => tileById.get(id)).filter((t): t is TileWord => !!t);
    if (sel.length !== 4) return;

    const counts = new Map<string, number>();
    sel.forEach((t) => {
      const r = ruleIdByTile.get(t.id);
      if (r && !solvedRuleIds.has(r)) counts.set(r, (counts.get(r) ?? 0) + 1);
    });
    let topRule: string | null = null;
    let top = 0;
    for (const [k, v] of Array.from(counts.entries())) {
      if (v > top) {
        top = v;
        topRule = k;
      }
    }

    if (top === 4 && topRule) {
      const g = grid.groups.find((x) => x.rule.id === topRule);
      if (!g) return;
      const idx = grid.groups.indexOf(g);
      const color = GROUP_COLORS[idx % GROUP_COLORS.length];
      const lowerLeft = grid.groups.filter(
        (x) => x.rule.id !== g.rule.id && !solvedRuleIds.has(x.rule.id) && x.rule.tier < g.rule.tier,
      ).length;
      const plain = plainRef.current > 0;
      const c = comboRef.current.hit();
      // 힌트를 산 직후의 확정은 배수 없이 기본 점수만 — 산 정보로 딴 점수는 싸다.
      const mult = plain ? 1 : multFor(c);
      const preempt = plain ? 1 : preemptFor(lowerLeft);
      const gain = Math.round(100 * g.rule.tier * mult * preempt);
      if (plain) setPlainCharges((n) => Math.max(0, n - 1));

      scoreRef.current += gain;
      setScore(scoreRef.current);
      setGainFx({ key: Date.now(), amount: gain });
      setSolved((prev) => [...prev, { group: g, color }]);
      setSolvedTotal((n) => n + 1);
      setLearned((prev) => [...prev, ...g.tiles]);
      setSelected([]);
      setOneAway(false);
      setWrongIds([]);
      setJustSolvedId(g.rule.id);
      setMsg(
        plain
          ? `규칙 확정 — ${g.rule.valueLabel}. ${gain}점 (펼친 뒤라 배수 없음)`
          : `규칙 확정 — ${g.rule.valueLabel}. ${gain}점`,
      );
      clockRef.current.extend(GROUP_EXTEND_MS);
      sfxRef.current.correct(c, true);
      // 확정 막대가 이 4단어의 en 을 인쇄한다 — 다음 격자의 그룹 단어에서 제외한다.
      g.tiles.forEach((t) => {
        exposedIds.current.add(t.id);
        reportCorrect(t);
      });

      if (solved.length + 1 >= grid.groups.length) {
        clockRef.current.extend(ROUND_EXTEND_MS);
        scoreRef.current += 300 * (roundIdx + 1);
        setScore(scoreRef.current);
        setPhase('roundClear');
      }
      return;
    }

    // 오답 — 배수·시간·기회를 동시에 잃는다.
    const lost = comboRef.current.miss();
    const nextLives = lives - 1;
    setLives(nextLives);
    setWrongIds(selected);
    clockRef.current.drain(WRONG_DRAIN_MS);
    if (top === 3) {
      sfxRef.current.nearMiss();
      setOneAway(true);
      setMsg('세 개는 같은 규칙이에요 — 하나만 바꿔보세요');
    } else {
      sfxRef.current.wrong();
      setOneAway(false);
      setMsg('이 조합은 아니에요');
    }
    if (lost >= 2) setToast(`${lost}연속이 끊겼어요 — 배수는 다시 쌓으면 돼요`);

    // FSRS 에 오답으로 올리는 것은 **top === 3 일 때의 어긋난 한 칸뿐**이다.
    // 이유: 세 칸이 같은 규칙으로 모였는데 남은 하나를 그 규칙이라고 단정한 것은
    // "이 단어의 철자가 이렇다"는 구체적 오인출이다 — 복습이 필요한 신호가 맞다.
    // 반대로 top ≤ 2 는 규칙을 아직 탐색 중인 상태라 어떤 단어를 모른다는 증거가
    // 아니다(이전 판은 여기서 4칸을 통째로 오답 적재해 노이즈를 만들었다).
    if (top === 3) {
      sel.filter((t) => ruleIdByTile.get(t.id) !== topRule).forEach(reportWrong);
    }

    window.setTimeout(() => {
      if (!mounted.current) return;
      setWrongIds([]);
      if (nextLives <= 0) finishRef.current('lost');
    }, 520);
  }, [
    phase,
    grid,
    selected,
    tileById,
    ruleIdByTile,
    solvedRuleIds,
    solved.length,
    roundIdx,
    lives,
    reportCorrect,
    reportWrong,
  ]);

  const hintBlocked = hintsLeft <= 0 || hintsInGrid >= HINT_PER_GRID;
  const hintDrainMs = HINT_DRAIN_MS[Math.min(MAX_HINTS - hintsLeft, HINT_DRAIN_MS.length - 1)];

  const spendHint = useCallback(() => {
    if (phase !== 'playing' || hintsLeft <= 0 || hintsInGrid >= HINT_PER_GRID) return;
    // 조건 미충족을 "왜 눌리지 않는지 모를 비활성 버튼"으로 두지 않고 말로 알려준다.
    if (selected.length !== 1) {
      setToast('펼칠 타일을 하나만 골라 주세요');
      return;
    }
    const t = tileById.get(selected[0]);
    if (!t || revealed.has(t.id)) return;
    setRevealed((prev) => {
      const n = new Set(prev);
      n.add(t.id);
      return n;
    });
    exposedIds.current.add(t.id);
    setHintsLeft((h) => h - 1);
    setHintsInGrid((h) => h + 1);
    // 콤보 소멸 + 다음 확정 배수 몰수 — 잘 굴러갈수록 비싸고, 막힌 사람에게는 싸다.
    comboRef.current.miss();
    setPlainCharges((n) => n + 1);
    clockRef.current.drain(hintDrainMs);
    sfxRef.current.click();
    setToast(`펼침 — ${t.en} · 시간 −${hintDrainMs / 1000}초 · 다음 확정은 배수 없이`);
    setMsg(`${t.ko} 의 영단어는 ${t.en} 입니다`);
    // 스스로 인출하지 못한 단어다 — 복습 스케줄에 정직하게 반영한다(assisted 아님:
    // "못 떠올렸다"는 판단은 철자를 보기 **전에** 학습자가 스스로 내린 것이다).
    reportWrong(t);
  }, [phase, hintsLeft, hintsInGrid, hintDrainMs, selected, tileById, revealed, reportWrong]);

  // 라운드 전환 — 모달 없이 인라인 배너로 잠깐 숨을 고르고 다음 격자로.
  useEffect(() => {
    if (phase !== 'roundClear') return;
    const id = window.setTimeout(() => {
      if (!mounted.current) return;
      const next = roundIdx + 1;
      if (next >= ROUND_SPECS.length) {
        finishRef.current('won');
        return;
      }
      const g = makeGrid(next);
      if (!g) {
        // 격자를 더 만들 수 없는 것은 완주가 아니다 — 팡파르를 울리지 않는다.
        finishRef.current('ended');
        return;
      }
      setPastIntruders((prev) => [...prev, ...(gridRef.current?.intruders ?? [])]);
      setGrid(g);
      setOrderOverride(null);
      setRoundIdx(next);
      setSolved([]);
      setSelected([]);
      setHintsInGrid(0);
      setOneAway(false);
      setWrongIds([]);
      setMsg(`${ROUND_SPECS[next].name} — ${ROUND_SPECS[next].note}`);
      setPhase('playing');
    }, 2200);
    return () => window.clearTimeout(id);
  }, [phase, roundIdx, makeGrid]);

  const restart = useCallback(() => {
    usedRuleIds.current = new Set();
    exposedIds.current = new Set();
    firedWrong.current = new Set();
    firedCorrect.current = new Set();
    endedRef.current = false;
    const g = generateGrid(basePool, 0, new Set<string>(), new Set<string>());
    g?.groups.forEach((x) => usedRuleIds.current.add(x.rule.id));
    scoreRef.current = 0;
    setGrid(g);
    setOrderOverride(null);
    setRoundIdx(0);
    setSelected([]);
    setSolved([]);
    setSolvedTotal(0);
    setLearned([]);
    setPastIntruders([]);
    setWrongIds([]);
    setRevealed(new Set());
    setOneAway(false);
    setJustSolvedId(null);
    setScore(0);
    setLives(MAX_LIVES);
    setHintsLeft(MAX_HINTS);
    setHintsInGrid(0);
    setPlainCharges(0);
    setBestInfo(null);
    setMsg('');
    setToast('');
    setGainFx(null);
    combo.reset();
    clockRef.current.reset(TOTAL_MS);
    setPhase('playing');
  }, [basePool, combo]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  const shownScore = useCountUp(score, 380);
  const spec = ROUND_SPECS[Math.min(roundIdx, ROUND_SPECS.length - 1)];
  const plannedGroups = grid ? Math.max(1, grid.groups.length) : 1;
  const progress = clamp(
    (roundIdx + solved.length / plannedGroups) / ROUND_SPECS.length,
    0,
    1,
  );

  // ── 결과 화면 재료 ──
  const missedGroups = useMemo(
    () => (grid ? grid.groups.filter((g) => !solvedRuleIds.has(g.rule.id)) : []),
    [grid, solvedRuleIds],
  );

  // 침입자의 en 은 라운드 중간에 펼치지 않는다(정찰 익스플로짓). 대신 세션이 끝난
  // 자리에서 지나온 격자의 침입자를 전부 모아 한 번에 공개한다 — 학습 payoff 는 남기고
  // 다음 격자에 정보를 흘리지는 않는다.
  // 침입자는 노출되지 않으므로 다음 격자에서 그룹 단어가 될 수 있다. 그렇게 나중에
  // 확정된 단어를 "어느 규칙에도 없던 단어"로 또 적으면 거짓말이 되므로 걸러낸다.
  const allIntruders = useMemo(() => {
    const solvedEver = new Set(learned.map((t) => t.id));
    const seen = new Set<string>();
    return [...pastIntruders, ...(grid?.intruders ?? [])].filter((t) => {
      if (solvedEver.has(t.id) || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [pastIntruders, grid, learned]);

  const revealNode: ReactNode = useMemo(() => {
    if (!grid) return undefined;
    if (missedGroups.length === 0 && allIntruders.length === 0) return undefined;
    return (
      <div className="cn-reveal">
        {missedGroups.length > 0 && (
          <>
            <p className="cn-reveal-h">못 찾은 규칙</p>
            {missedGroups.map((g) => (
              <div key={g.rule.id} className="cn-reveal-row">
                <span className="cn-reveal-rule">{g.rule.valueLabel}</span>
                <span className="cn-reveal-words">
                  {g.tiles.map((t) => (
                    <span key={t.id} className="cn-reveal-word">
                      <b>{t.en}</b> {t.ko}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </>
        )}
        {allIntruders.length > 0 && (
          <p className="cn-reveal-out">
            <span className="cn-reveal-h">어느 규칙에도 없던 단어</span>
            {allIntruders.map((t) => (
              <span key={t.id} className="cn-reveal-word">
                <b>{t.en}</b> {t.ko}
              </span>
            ))}
          </p>
        )}
      </div>
    );
  }, [grid, missedGroups, allIntruders]);

  const doneLead =
    endReason === 'won'
      ? '세 격자를 모두 열었어요'
      : endReason === 'timeout'
        ? '시간이 여기까지였어요'
        : endReason === 'ended'
          ? '단어가 여기까지였어요'
          : '오늘도 한 걸음';

  const nextTarget = pb.best ?? 0;
  const restartHint =
    bestInfo?.improved
      ? '개인 최고를 갱신했어요 — 다음 판은 어려운 규칙을 먼저 노려보세요'
      : score >= nextTarget
        ? '◆ 가 많은 규칙을 먼저 치면 뒤따르는 규칙에 선점 배수가 붙어요'
        : `개인 최고까지 ${(nextTarget - score).toLocaleString()}점 — ◆ 가 많은 규칙을 먼저 치면 배수가 붙어요`;

  const recap = useMemo(
    () =>
      learned.slice(0, 12).map((t) => (
        <span key={t.id} className="cn-chip cn-chip--recap">
          <b>{t.en}</b> {t.ko}
        </span>
      )),
    [learned],
  );

  if (!grid) {
    return <NotEnoughWords need={MIN_POOL} onExit={handleExit} />;
  }

  return (
    <div className="gk-root cn-root">
      <GameMusic gameId="connections" />
      <GameKitStyles />
      <AmbientBackground
        center="#F2ECFA"
        mid="#DACAEF"
        edge="#2C2156"
        glow="rgba(192,162,255,.30)"
        glowAt="50% 22%"
        watermark="connections"
      />
      <style dangerouslySetInnerHTML={{ __html: CN_CSS }} />

      <Hud
        score={score}
        progress={progress}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="cn-hud-extra">
            <TimerBar
              frac={clock.frac}
              warning={clock.warning}
              seconds={clock.remainSec}
              label="남은 시간"
            />
            <LifePips total={MAX_LIVES} left={lives} label="남은 기회" />
          </div>
        }
      />

      <div className="gk-sr" aria-live="polite">
        {msg}
      </div>

      {phase === 'done' ? (
        <GameDone
          mark="connections"
          lead={doneLead}
          celebrate={endReason === 'won'}
          badge={
            bestInfo?.improved ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 개인 최고 갱신
              </>
            ) : endReason === 'won' ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 세 격자 완주
              </>
            ) : undefined
          }
          reveal={revealNode}
          stats={[
            { num: shownScore.toLocaleString(), label: '점수', accent: true },
            { num: `${solvedTotal}`, label: '찾은 규칙' },
            { num: `${combo.best}`, label: '최고 연속' },
            { num: `${lives}/${MAX_LIVES}`, label: '남은 기회' },
          ]}
          best={{ prev: bestInfo?.prev ?? null, now: score, label: '점수', improved: bestInfo?.improved }}
          restartLabel="새 격자"
          restartHint={restartHint}
          footer={recap.length > 0 ? <>{recap}</> : undefined}
          onRestart={restart}
          onExit={handleExit}
        />
      ) : (
        <main className="gk-stage cn-stage">
          <div className="cn-head">
            <p className="cn-round">
              {spec.name}
              <span className="cn-round-note">{spec.note}</span>
            </p>
            <p className="cn-help">
              보이는 건 <b>뜻</b>뿐이에요. 같은 <b>숨은 규칙</b>을 따르는 영단어의 뜻 4개를 고르세요
            </p>
          </div>

          {solved.length > 0 && (
            <div className="cn-solved">
              {solved.map((s) => (
                <SolvedBar
                  key={s.group.rule.id}
                  entry={s}
                  popping={justSolvedId === s.group.rule.id}
                />
              ))}
            </div>
          )}

          {chipRules.length > 0 && phase === 'playing' && (
            <div className="cn-rules" aria-label={`남은 규칙 ${chipRules.length}개`}>
              {chipRules.map((r) => (
                <span key={r.id} className="cn-chip">
                  {r.kindLabel} <span className="cn-chip-q" aria-hidden="true">?</span>
                  <span className="cn-chip-tier" aria-label={`난이도 ${r.tier}`}>
                    {'◆'.repeat(r.tier)}
                  </span>
                  <span className="cn-chip-pts">+{chipValue(r).toLocaleString()}</span>
                </span>
              ))}
            </div>
          )}

          {phase === 'roundClear' && (
            <div className="cn-clear" role="status">
              <FeedbackIcon kind="correct" size={15} />
              <span>
                {spec.name} 완료 · +{ROUND_EXTEND_MS / 1000}초 · 보너스 {(300 * (roundIdx + 1)).toLocaleString()}점
              </span>
              {boardTiles.length > 0 && (
                <span className="cn-clear-sub">
                  아래 남은 단어는 어느 규칙에도 속하지 않았어요 — 영어는 끝나고 모아서 보여드릴게요
                </span>
              )}
            </div>
          )}

          <div className="cn-grid">
            {boardTiles.map((t) => (
              <Tile
                key={t.id}
                id={t.id}
                ko={t.ko}
                en={revealed.has(t.id) ? t.en : null}
                state={
                  phase === 'roundClear'
                    ? 'out'
                    : wrongIds.includes(t.id)
                      ? 'wrong'
                      : selected.includes(t.id)
                        ? 'sel'
                        : 'idle'
                }
                onToggle={toggle}
                refFactory={flip.ref}
              />
            ))}
          </div>

          <div className="cn-status" role="status">
            {oneAway && (
              <span className="cn-note cn-note--near">
                <FeedbackIcon kind="near" size={13} />
                세 개는 같은 규칙이에요 — 하나만 바꿔보세요
              </span>
            )}
            {!oneAway && toast && <span className="cn-note">{toast}</span>}
            {!oneAway && !toast && plainCharges > 0 && (
              <span className="cn-note">다음 확정 {plainCharges}회는 배수 없이 기본 점수예요</span>
            )}
          </div>

          <div className="cn-actions">
            <button
              type="button"
              className="gk-btn cn-ctrl"
              onClick={() => setSelected([])}
              disabled={selected.length === 0 || phase !== 'playing'}
            >
              선택 해제
            </button>
            <button
              type="button"
              className="gk-btn cn-ctrl"
              onClick={() => setOrderOverride(shuffle(order))}
              disabled={phase !== 'playing'}
            >
              섞기
            </button>
            <button
              type="button"
              className="gk-btn cn-ctrl"
              onClick={spendHint}
              disabled={phase !== 'playing' || hintBlocked}
              title={
                hintsLeft <= 0
                  ? '이번 세션의 펼치기를 모두 썼어요'
                  : hintsInGrid >= HINT_PER_GRID
                    ? '한 격자에서 펼치기는 한 번만 — 다음 격자에서 다시 쓸 수 있어요'
                    : `타일 하나만 고른 뒤 누르면 그 단어의 영어를 펼쳐요 · 시간 −${hintDrainMs / 1000}초 · 연속 소멸 · 다음 확정은 배수 없이`
              }
            >
              {hintsLeft > 0 && hintsInGrid >= HINT_PER_GRID
                ? '뜻 펼치기 · 다음 격자에'
                : `뜻 펼치기 (${hintsLeft})`}
            </button>
            <button
              type="button"
              className="gk-btn gk-btn--primary cn-submit"
              onClick={submit}
              disabled={selected.length !== 4 || phase !== 'playing'}
            >
              확인 ({selected.length}/4)
            </button>
          </div>

          <p className="cn-source">
            {grid.reusedExposed
              ? `내 단어 ${ownCount}개 — 재료가 빠듯해 앞 격자에서 본 단어가 일부 다시 나왔어요`
              : ownCount >= POOL_TARGET
                ? `내 단어 ${ownCount}개로 매번 새로 짜는 격자예요 · 세 격자에 같은 단어는 두 번 나오지 않아요`
                : `내 단어 ${ownCount}개 + 맛보기 단어 — 세 격자(${POOL_TARGET}칸)를 겹치지 않게 채우려고 자리를 메웠어요`}
          </p>

          {gainFx && (
            <span key={gainFx.key} className="cn-gain" aria-hidden="true">
              +{gainFx.amount.toLocaleString()}
            </span>
          )}
        </main>
      )}
    </div>
  );
}

export default ConnectionsGame;

const CN_CSS = `
  .cn-stage { gap: 11px; justify-content: flex-start; padding: clamp(10px, 2.4vh, 22px) 14px 18px; overflow-y: auto; overflow-x: hidden; }
  .cn-hud-extra { display: flex; align-items: center; gap: 12px; }
  .cn-hud-extra .gk-timer { min-width: clamp(74px, 18vw, 132px); }

  .cn-head { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
  .cn-round { margin: 0; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; justify-content: center; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); letter-spacing: -.01em; }
  .cn-round-note { font-size: 11.5px; font-weight: 700; color: var(--t3); }
  .cn-help { margin: 0; font-size: 12.5px; color: var(--t3); max-width: 42ch; }
  .cn-help b { color: var(--t1); }

  .cn-solved { display: flex; flex-direction: column; gap: 7px; width: min(560px, 94vw); }
  .cn-bar { position: relative; overflow: visible; display: flex; flex-direction: column; gap: 3px; padding: 9px 14px; border-radius: var(--r-md, 10px); border: 1px solid color-mix(in srgb, var(--cn-group) 46%, var(--bd)); border-left: 4px solid var(--cn-group); background: color-mix(in srgb, var(--cn-group) 14%, var(--bg)); color: var(--t1); text-align: center; }
  .cn-bar-head { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; letter-spacing: .01em; color: var(--t1); }
  .cn-bar-ico { display: inline-flex; color: var(--cn-group); }
  .cn-bar-rule { word-break: keep-all; }
  .cn-bar-tier { font-size: 9px; letter-spacing: .08em; color: var(--t3); }
  .cn-bar-words { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: center; font-size: 11.5px; font-weight: 600; color: var(--t2); word-break: keep-all; }
  .cn-bar-word b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }
  .cn-bar--pop { animation: gk-pop .5s var(--ease-spring, ease-out); }

  .cn-rules { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; width: min(560px, 94vw); }
  .cn-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px; border: 1px dashed color-mix(in srgb, var(--t1) 26%, transparent); background: color-mix(in srgb, var(--bg) 62%, transparent); color: var(--t2); font-size: 11.5px; font-weight: 700; }
  .cn-chip-q { font-weight: 900; color: var(--combo); }
  .cn-chip-tier { font-size: 8.5px; letter-spacing: .06em; color: var(--t3); }
  .cn-chip-pts { font-family: var(--font-display, system-ui); font-size: 11px; font-weight: 900; color: var(--t1); }
  .cn-chip--recap { border-style: solid; }
  .cn-chip--recap b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }

  .cn-clear { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 16px; border-radius: var(--r-md, 10px); border: 1px solid color-mix(in srgb, var(--success) 46%, var(--bd)); background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--t1); font-size: 12.5px; font-weight: 800; text-align: center; animation: gk-pop .45s var(--ease-spring, ease-out); }
  .cn-clear-sub { font-size: 11.5px; font-weight: 600; color: var(--t3); }

  .cn-grid { --cn-gap: clamp(6px, 1.5vw, 10px); display: flex; flex-wrap: wrap; gap: var(--cn-gap); width: min(560px, 94vw); justify-content: center; }
  .cn-tile { position: relative; overflow: visible; flex: 0 0 calc((100% - var(--cn-gap) * 3) / 4); min-height: clamp(58px, 8.6vh, 74px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); cursor: pointer; transition: transform .16s var(--ease-spring, ease-out), border-color .15s, background .15s, box-shadow .15s, opacity .2s; }
  .cn-ko { font-size: clamp(11px, 2.5vw, 13.5px); font-weight: 700; line-height: 1.25; text-align: center; word-break: keep-all; }
  .cn-en { font-family: var(--font-english, system-ui); font-size: clamp(9.5px, 2vw, 11px); font-weight: 800; color: var(--t3); letter-spacing: -.01em; }
  .cn-tile:hover { border-color: var(--combo); transform: translateY(-2px); }
  .cn-tile:active { transform: scale(.95); }
  .cn-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .cn-tile--sel { border-color: var(--combo); background: var(--combo); color: var(--ti); box-shadow: 0 4px 14px color-mix(in srgb, var(--combo) 30%, transparent); }
  .cn-tile--sel .cn-en { color: rgba(255,255,255,.82); }
  .cn-tile--wrong { border-color: var(--error); background: var(--error-light); color: var(--error); animation: gk-shake .4s ease-in-out; }
  .cn-tile--wrong .cn-en { color: var(--error); }
  .cn-tile--out { opacity: .58; border-style: dashed; cursor: default; }
  .cn-tile[aria-disabled="true"] { pointer-events: none; }
  .cn-tile-icon { position: absolute; top: 4px; left: 5px; display: inline-flex; color: var(--error); }

  .cn-status { min-height: 22px; display: flex; align-items: center; justify-content: center; text-align: center; }
  .cn-note { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--t2); }
  .cn-note--near { color: var(--warning); animation: gk-pop .4s ease-out; }

  .cn-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .cn-ctrl { min-height: 44px; padding: 0 14px; font-size: 12.5px; }
  .cn-submit { min-height: 48px; min-width: 128px; }

  .cn-source { margin: 0; font-size: 11px; font-weight: 700; color: var(--t3); text-align: center; max-width: 46ch; }

  .cn-gain { position: absolute; top: 18%; left: 50%; transform: translateX(-50%); font-family: var(--font-display, system-ui); font-size: 26px; font-weight: 900; color: var(--success); text-shadow: 0 2px 14px color-mix(in srgb, var(--success) 45%, transparent); pointer-events: none; animation: gk-gain .9s ease-out forwards; }

  .cn-reveal { display: flex; flex-direction: column; gap: 9px; text-align: left; }
  .cn-reveal-h { display: block; margin: 0 0 2px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .cn-reveal-row { display: flex; flex-direction: column; gap: 3px; }
  .cn-reveal-rule { font-size: 13px; font-weight: 800; color: var(--t1); }
  .cn-reveal-words, .cn-reveal-out { display: flex; flex-wrap: wrap; gap: 3px 12px; margin: 0; font-size: 12.5px; color: var(--t2); }
  .cn-reveal-out { flex-direction: row; gap: 4px 12px; }
  .cn-reveal-out .cn-reveal-h { flex: 0 0 100%; }
  .cn-reveal-word b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }

  @media (max-width: 400px) {
    .cn-hud-extra { gap: 8px; }
    .cn-ctrl { padding: 0 11px; font-size: 12px; }
    .cn-chip { padding: 5px 9px; gap: 4px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cn-tile--wrong, .cn-bar--pop, .cn-note--near, .cn-clear { animation: none; }
    .cn-gain { animation: gk-rm-fade .5s ease forwards; }
  }
`;
