// apps/web/src/components/game/connections/ConnectionsGame.tsx
// Connections — 숨은 규칙 격자. 보드에는 **한국어 뜻만** 깔리고, 그룹을 잇는 규칙은
// 숨겨진 **영단어의 형태**에 있다. 뜻 → 영단어를 인출하지 못하면 규칙 자체가 보이지 않는다.
//
// v07.9 전면 재설계. 이전 판의 결함을 구조적으로 제거했다.
//   1) 인출 없음 — 타일마다 en+ko 를 함께 인쇄해 한글만 읽고 20초에 풀렸다.
//      지금은 제출 전 화면 어디에도 (en, ko) 쌍이 함께 인쇄되지 않는다.
//      규칙의 **종류**만 공개하고(예: "끝 글자") **값**은 확정 후에 공개한다.
//   2) 학습자 단어장과 무관 — 고정 퍼즐 5개를 돌리며 내장 뱅크 단어를 FSRS 에 적재했다.
//      지금은 격자 전체를 wordPool 에서 절차적으로 생성하고, own=false 인 맛보기
//      단어는 onCorrect/onWrong 을 아예 호출하지 않는다.
//   3) 난이도 단조 감소 · 마지막 그룹 자동 정답 — 침입자(어느 규칙에도 없는 단어)를
//      넣어 남은 타일이 자동 정답이 되지 않게 했다. 격자가 넘어갈수록 침입자가
//      4 → 8 로 늘고 규칙이 미묘해지며, 시계와 실수 예산은 라운드를 넘어 이어진다.
//   4) 판돈 없는 콤보 · 점수 없음 — 규칙 tier × 콤보 배수 × 선점 배수로 점수를 매긴다.
//      까다로운 규칙을 먼저 치면 배수가 붙고, 틀리면 배수·시간·기회를 한꺼번에 잃는다.
//   5) 패배 시 정답을 계산만 하고 버림 — GameDone reveal 슬롯에 못 찾은 규칙과
//      그 단어들을 en+ko 로 전부 공개한다.
//
// 인출 규칙 준수
//   · 제출 전 공개: 한국어 뜻 · 규칙의 "종류" · 남은 규칙 개수. 정답을 특정할 수 없다.
//   · 부분 정답 오라클 없음 — 3/4 근접 안내는 기회 1 + 시간 8초를 실제로 소모한 뒤에만 뜬다.
//   · "뜻 펼치기"로 산 영단어는 onCorrect 대상에서 제외하고 onWrong 으로 기록한다.

'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  DEMO_POOL,
  type Grid,
  type PuzzleGroup,
  type TileWord,
} from './puzzle';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

// ─── 판돈 상수 ────────────────────────────────────────────────────────────
const TOTAL_MS = 180_000;      // 3분에서 출발. 확정마다 늘어나고 실수마다 줄어든다.
const WARN_MS = 20_000;
const GROUP_EXTEND_MS = 10_000;
const ROUND_EXTEND_MS = 12_000;
const WRONG_DRAIN_MS = 8_000;
const HINT_DRAIN_MS = 6_000;
const HINT_COST = 120;
const MAX_LIVES = 4;
const MAX_HINTS = 3;
/** 격자 하나를 조립하려면 최소 이만큼의 단어가 필요하다(그룹 2×4 + 침입자 여유). */
const MIN_POOL = 16;

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

type Phase = 'playing' | 'roundClear' | 'done';
type EndReason = 'won' | 'lost' | 'timeout';

interface SolvedEntry {
  group: PuzzleGroup;
  color: string;
}

// ─── 타일 ─────────────────────────────────────────────────────────────────
// useCountdown 이 매 프레임 setState 하므로 부모는 60fps 로 다시 그려진다.
// 타일은 memo 로 끊어 실제 변화(선택·오답·펼침)에만 반응하게 한다.
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
      style={{ background: entry.color }}
    >
      <span className="cn-bar-head">
        <FeedbackIcon kind="correct" size={13} />
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

  // ── 단어 풀 — wordPool 이 오면 무조건 그걸로 논다. 내장 풀은 폴백 전용. ──
  const basePool = useMemo(() => {
    const own = buildTiles(wordPool ?? [], true);
    if (own.length >= MIN_POOL) return own;
    if (own.length === 0) return buildTiles(DEMO_POOL, false);
    // 학습자 단어가 격자 한 판에 모자랄 때만 맛보기 단어로 자리를 메운다.
    const seen = new Set(own.map((t) => t.id));
    const filler = buildTiles(DEMO_POOL, false).filter((t) => !seen.has(t.id));
    return [...own, ...filler];
  }, [wordPool]);

  const ownCount = useMemo(() => basePool.filter((t) => t.own).length, [basePool]);

  const usedRuleIds = useRef<Set<string>>(new Set());
  const makeGrid = useCallback(
    (round: number) => {
      // 중복 금지는 generateGrid 안에서 "선호"로 처리된다(규칙이 모자라면 스스로 푼다).
      const g = generateGrid(basePool, round, usedRuleIds.current);
      g?.groups.forEach((x) => usedRuleIds.current.add(x.rule.id));
      return g;
    },
    [basePool],
  );

  const [grid, setGrid] = useState<Grid | null>(() => generateGrid(basePool, 0, new Set<string>()));
  const [roundIdx, setRoundIdx] = useState(0);
  /** "섞기"로 학습자가 직접 바꾼 배치. null 이면 격자가 준 순서 그대로. */
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<SolvedEntry[]>([]);
  const [solvedTotal, setSolvedTotal] = useState(0);
  /** 세션 전체에서 스스로 짚어낸 단어 — 끝화면 복습용(라운드가 넘어가도 남는다). */
  const [learned, setLearned] = useState<TileWord[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [oneAway, setOneAway] = useState(false);
  const [justSolvedId, setJustSolvedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
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
  const firedWrong = useRef<Set<string>>(new Set());

  const onCorrectRef = useRef(onCorrect);
  onCorrectRef.current = onCorrect;
  const onWrongRef = useRef(onWrong);
  onWrongRef.current = onWrong;

  // FSRS 적재 — 학습자 단어(own)만. 힌트로 산 단어는 정답으로 올리지 않는다.
  const reportCorrect = useCallback((t: TileWord) => {
    if (!t.own) return;
    if (revealedRef.current.has(t.id)) return;
    onCorrectRef.current?.(t);
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
      sfx.coin();
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

  // 종료는 한 번만 — 시간 만료와 기회 소진이 같은 프레임에 겹쳐도 점수가 두 번 확정되지 않는다.
  const endedRef = useRef(false);
  const finish = useCallback(
    (reason: EndReason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      const timeBonus = reason === 'won' ? Math.round(clockRef.current.remainMs / 1000) * 5 : 0;
      const total = scoreRef.current + timeBonus;
      scoreRef.current = total;
      setScore(total);
      setEndReason(reason);
      setBestInfo(pbRef.current.submit(total));
      setPhase('done');
      if (reason === 'won') sfx.fanfare();
    },
    [sfx],
  );
  finishRef.current = finish;

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

  // 배치는 격자에서 파생한다 — 격자가 바뀌면 낡은 배치가 남아 빈 보드가 되는 일이 없다.
  const order = useMemo(() => {
    if (!grid) return [];
    const natural = grid.tiles.map((t) => t.id);
    if (!orderOverride) return natural;
    const ids = new Set(natural);
    const kept = orderOverride.filter((id) => ids.has(id));
    return kept.length === ids.size ? kept : natural;
  }, [grid, orderOverride]);

  const solvedRuleIds = useMemo(() => new Set(solved.map((s) => s.group.rule.id)), [solved]);
  const solvedTileIds = useMemo(
    () => new Set(solved.flatMap((s) => s.group.tiles.map((t) => t.id))),
    [solved],
  );

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
  const remainingKindLabels = useMemo(
    () => shuffle(remainingRules.map((g) => g.rule.kindLabel)),
    [remainingRules],
  );

  // ── 조작 ──
  const toggle = useCallback(
    (id: string) => {
      if (phase !== 'playing') return;
      const has = selected.includes(id);
      if (!has && selected.length >= 4) return;
      setOneAway(false);
      setWrongIds([]);
      sfx.click();
      setSelected(has ? selected.filter((x) => x !== id) : [...selected, id]);
    },
    [phase, selected, sfx],
  );

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
      // 선점 배수 — 더 쉬운 규칙을 남겨둔 채 어려운 규칙을 먼저 치면 배수가 붙는다.
      // "안전하게 쉬운 것부터" 와 "위험하게 어려운 것부터"가 둘 다 합리적인 순간을 만든다.
      const lowerLeft = grid.groups.filter(
        (x) => x.rule.id !== g.rule.id && !solvedRuleIds.has(x.rule.id) && x.rule.tier < g.rule.tier,
      ).length;
      const preempt = Math.min(2.5, 1 + 0.5 * lowerLeft);
      const c = comboRef.current.hit();
      const gain = Math.round(100 * g.rule.tier * multFor(c) * preempt);

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
      setMsg(`규칙 확정 — ${g.rule.valueLabel}. ${gain}점`);
      clockRef.current.extend(GROUP_EXTEND_MS);
      sfx.correct(c, true);
      g.tiles.forEach(reportCorrect);

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
      sfx.nearMiss();
      setOneAway(true);
      setMsg('세 개는 같은 규칙이에요 — 하나만 바꿔보세요');
    } else {
      sfx.wrong();
      setOneAway(false);
      setMsg('이 조합은 아니에요');
    }
    if (lost >= 2) setToast(`${lost}연속이 끊겼어요 — 배수는 다시 쌓으면 돼요`);
    // 어긋난 타일만 기록한다 — 맞게 고른 3개까지 오답으로 적재하지 않는다.
    const offs = top >= 2 ? sel.filter((t) => ruleIdByTile.get(t.id) !== topRule) : sel;
    offs.forEach(reportWrong);

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
    sfx,
    reportCorrect,
    reportWrong,
  ]);

  const spendHint = useCallback(() => {
    if (phase !== 'playing' || hintsLeft <= 0) return;
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
    setHintsLeft((h) => h - 1);
    scoreRef.current = Math.max(0, scoreRef.current - HINT_COST);
    setScore(scoreRef.current);
    clockRef.current.drain(HINT_DRAIN_MS);
    sfx.click();
    setToast(`펼침 — ${t.en} · 점수 −${HINT_COST} · 시간 −${HINT_DRAIN_MS / 1000}초`);
    setMsg(`${t.ko} 의 영단어는 ${t.en} 입니다`);
    // 스스로 인출하지 못한 단어다 — 복습 스케줄에 정직하게 반영한다.
    reportWrong(t);
  }, [phase, hintsLeft, selected, tileById, revealed, sfx, reportWrong]);

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
        finishRef.current('won');
        return;
      }
      setGrid(g);
      setOrderOverride(null);
      setRoundIdx(next);
      setSolved([]);
      setSelected([]);
      setRevealed(new Set());
      setOneAway(false);
      setWrongIds([]);
      setMsg(`${ROUND_SPECS[next].name} — ${ROUND_SPECS[next].note}`);
      setPhase('playing');
    }, 2200);
    return () => window.clearTimeout(id);
  }, [phase, roundIdx, makeGrid]);

  const restart = useCallback(() => {
    usedRuleIds.current = new Set();
    firedWrong.current = new Set();
    endedRef.current = false;
    const g = generateGrid(basePool, 0, new Set<string>());
    g?.groups.forEach((x) => usedRuleIds.current.add(x.rule.id));
    scoreRef.current = 0;
    setGrid(g);
    setOrderOverride(null);
    setRoundIdx(0);
    setSelected([]);
    setSolved([]);
    setSolvedTotal(0);
    setLearned([]);
    setWrongIds([]);
    setRevealed(new Set());
    setOneAway(false);
    setJustSolvedId(null);
    setScore(0);
    setLives(MAX_LIVES);
    setHintsLeft(MAX_HINTS);
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

  const revealNode: ReactNode = useMemo(() => {
    if (!grid) return undefined;
    if (missedGroups.length === 0 && grid.intruders.length === 0) return undefined;
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
        {grid.intruders.length > 0 && (
          <p className="cn-reveal-out">
            <span className="cn-reveal-h">어느 규칙에도 없던 단어</span>
            {grid.intruders.map((t) => (
              <span key={t.id} className="cn-reveal-word">
                <b>{t.en}</b> {t.ko}
              </span>
            ))}
          </p>
        )}
      </div>
    );
  }, [grid, missedGroups]);

  const doneLead =
    endReason === 'won'
      ? '세 격자를 모두 열었어요'
      : endReason === 'timeout'
        ? '시간이 여기까지였어요'
        : '오늘도 한 걸음';

  const nextTarget = pb.best ?? 0;
  const restartHint =
    bestInfo?.improved
      ? '개인 최고를 갱신했어요 — 다음 판은 어려운 규칙을 먼저 노려보세요'
      : score >= nextTarget
        ? '규칙 하나를 먼저 치면 뒤따르는 규칙에 배수가 붙어요'
        : `개인 최고까지 ${(nextTarget - score).toLocaleString()}점 — 어려운 규칙을 먼저 치면 배수가 붙어요`;

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

          {remainingKindLabels.length > 0 && phase === 'playing' && (
            <div className="cn-rules" aria-label={`남은 규칙 ${remainingKindLabels.length}개`}>
              {remainingKindLabels.map((k, i) => (
                <span key={`${k}-${i}`} className="cn-chip">
                  {k} <span className="cn-chip-q" aria-hidden="true">?</span>
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
                <span className="cn-clear-sub">아래 남은 단어는 어느 규칙에도 속하지 않았어요</span>
              )}
            </div>
          )}

          <div className="cn-grid">
            {boardTiles.map((t) => (
              <Tile
                key={t.id}
                id={t.id}
                ko={t.ko}
                en={phase === 'roundClear' || revealed.has(t.id) ? t.en : null}
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
              disabled={phase !== 'playing' || hintsLeft <= 0}
              title={`타일 하나만 고른 뒤 누르면 그 단어의 영어를 펼쳐요 · 점수 −${HINT_COST} · 시간 −${HINT_DRAIN_MS / 1000}초`}
            >
              뜻 펼치기 ({hintsLeft})
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
            {ownCount >= MIN_POOL
              ? `내 단어 ${ownCount}개로 매번 새로 짜는 격자예요`
              : ownCount > 0
                ? `내 단어 ${ownCount}개 + 맛보기 단어 — 단어장이 ${MIN_POOL}개를 넘으면 전부 내 단어로 바뀌어요`
                : '맛보기 단어로 도는 중 — 단어장을 채우면 내 단어로 바뀌어요'}
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
  .cn-bar { position: relative; overflow: visible; display: flex; flex-direction: column; gap: 3px; padding: 9px 14px; border-radius: var(--r-md, 10px); color: #fff; text-align: center; }
  .cn-bar-head { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; letter-spacing: .01em; }
  .cn-bar-rule { word-break: keep-all; }
  .cn-bar-tier { font-size: 9px; letter-spacing: .08em; opacity: .8; }
  .cn-bar-words { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: center; font-size: 11.5px; font-weight: 600; opacity: .95; word-break: keep-all; }
  .cn-bar-word b { font-family: var(--font-english, system-ui); font-weight: 800; }
  .cn-bar--pop { animation: gk-pop .5s var(--ease-spring, ease-out); }

  .cn-rules { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; width: min(560px, 94vw); }
  .cn-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px; border: 1px dashed color-mix(in srgb, var(--t1) 26%, transparent); background: color-mix(in srgb, var(--bg) 62%, transparent); color: var(--t2); font-size: 11.5px; font-weight: 700; }
  .cn-chip-q { font-weight: 900; color: var(--combo); }
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

  .cn-status { min-height: 22px; display: flex; align-items: center; justify-content: center; }
  .cn-note { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--t2); }
  .cn-note--near { color: var(--warning); animation: gk-pop .4s ease-out; }

  .cn-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .cn-ctrl { min-height: 44px; padding: 0 14px; font-size: 12.5px; }
  .cn-submit { min-height: 48px; min-width: 128px; }

  .cn-source { margin: 0; font-size: 11px; font-weight: 700; color: var(--t3); text-align: center; }

  .cn-gain { position: absolute; top: 18%; left: 50%; transform: translateX(-50%); font-family: var(--font-display, system-ui); font-size: 26px; font-weight: 900; color: var(--success); text-shadow: 0 2px 14px color-mix(in srgb, var(--success) 45%, transparent); pointer-events: none; animation: gk-gain .9s ease-out forwards; }

  .cn-reveal { display: flex; flex-direction: column; gap: 9px; text-align: left; }
  .cn-reveal-h { display: block; margin: 0 0 2px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .cn-reveal-row { display: flex; flex-direction: column; gap: 3px; }
  .cn-reveal-rule { font-size: 13px; font-weight: 800; color: var(--t1); }
  .cn-reveal-words, .cn-reveal-out { display: flex; flex-wrap: wrap; gap: 3px 12px; margin: 0; font-size: 12.5px; color: var(--t2); }
  .cn-reveal-out { flex-direction: column; gap: 4px; }
  .cn-reveal-out .cn-reveal-word { display: inline; }
  .cn-reveal-word b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }

  @media (max-width: 400px) {
    .cn-hud-extra { gap: 8px; }
    .cn-ctrl { padding: 0 11px; font-size: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cn-tile--wrong, .cn-bar--pop, .cn-note--near, .cn-clear { animation: none; }
    .cn-gain { animation: gk-rm-fade .5s ease forwards; }
  }
`;
