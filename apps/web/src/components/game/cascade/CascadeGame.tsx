// apps/web/src/components/game/cascade/CascadeGame.tsx
// Cascade — 뜻을 보고 단어를 인출해 물길을 터뜨리는 낙하 보드(L4a 재인 → L4b 인출).
//
// v07.9 전면 재설계. 이전 판은 en 타일과 ko 타일을 보드에 **동시에** 깔아두고
// 문자열 짝맞추기를 시켰다 — 영어를 몰라도 100% 클리어됐고(인출 0), 90초 내내
// 난이도가 고정이라 30초면 다 본 게임이었다. 세 축을 갈아엎었다.
//
//  1) 인출: 보드에는 **영단어만** 있고 뜻은 위 카드에 하나만 뜬다. 제출(탭) 전에
//     정답을 특정할 정보가 화면에 없고, 한 뜻에 한 번만 답할 수 있어 찍어서
//     좁혀가는 브루트포스가 성립하지 않는다. 정답 공개는 오직 제출 뒤에, 충분히.
//  2) 긴장: 뜻 하나의 제한 시간이 6.4초 → 2.6초로 계속 좁아지고 2막부터 낙석이
//     보드를 갉는다. 세션은 타이머가 아니라 **물방울 3개(목숨)** 로 끝난다 —
//     끝나는 이유가 "시계가 0이 돼서"가 아니라 "내가 한계에 닿아서"가 되게.
//  3) 선택: 같은 단어가 보드에 여러 장 있다. 낮은 장(낙차) · 뭉친 장(뭉치) ·
//     돌 옆의 장(돌 파괴) 중 무엇을 짚느냐로 점수가 갈린다. 그리고 낙하로 같은
//     단어 3칸이 이어지면 저절로 무너진다(연쇄) — 이름값을 코드가 이행한다.
//
// FSRS 적재는 학습자가 실제로 인출한 그 단어에만, 세션당 정답 2·오답 2 상한으로
// 건다(이전 판은 한 단어에 수십 건을 도배했다). 연쇄로 지워진 타일은 학습자가
// 인출한 것이 아니므로 onCorrect 를 호출하지 않는다 — 점수만 준다.

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
  GOAL,
  LIVES,
  MAX_ROCKS,
  DISTINCT_MAX,
  DISTINCT_MIN,
  actOf,
  adjacentRocks,
  clusterAt,
  colOf,
  compact,
  distinctEns,
  fillEmpty,
  findAnswerIndexes,
  findChains,
  isWordCell,
  removeIds,
  rockCadence,
  rockCount,
  windowMsFor,
  wordCounts,
  wouldChain,
  type Board,
  type Cell,
  type WordCell,
} from './logic';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
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
interface FxItem {
  key: number;
  index: number;
  burst?: number;
  colors?: string[];
  gain?: number;
  tag?: string;
}

const CLEAR_MS = 230;
const FALL_MS = 240;
const CHAIN_MS = 210;
const DROP_MS = 250;
const REVEAL_MS = 1450;
const FX_MS = 840;
/** 첫 뜻에만 얹어주는 준비 시간 — 보드를 한 번 훑을 여유. */
const FIRST_GRACE_MS = 2200;

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
  fresh,
  revealKo,
  flipRef,
  onTap,
}: {
  cell: Cell;
  index: number;
  state: TileState;
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
  return (
    <button
      ref={flipRef(String(cell.id))}
      type="button"
      role="gridcell"
      data-i={index}
      className={`cs-cell cs-tile cs-tile--word cs-tile--${state} ${fresh ? 'cs-tile--fresh' : ''}`}
      aria-disabled={locked ? 'true' : 'false'}
      aria-label={revealKo ? `${cell.word.en} · 정답 · 뜻 ${revealKo}` : cell.word.en}
      title={cell.word.en}
      onClick={() => onTap(index)}
    >
      <span className="cs-tile-body">
        <span className="cs-tile-en">{cell.word.en}</span>
        {revealKo && <span className="cs-tile-ko">{revealKo}</span>}
      </span>
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

  const distinctTarget = clamp(pool.length, DISTINCT_MIN, DISTINCT_MAX);
  const playable = pool.length >= DISTINCT_MIN;

  const sfx = useSfx();

  // ─── 상태 ───
  const [board, setBoard] = useState<Board>([]);
  const [stage, setStage] = useState<Stage>('playing');
  const [target, setTarget] = useState<Word | null>(null);
  const [score, setScore] = useState(0);
  const [clears, setClears] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [bestChain, setBestChain] = useState(0);
  const [won, setWon] = useState(false);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [clearingIds, setClearingIds] = useState<ReadonlySet<number>>(EMPTY_IDS);
  const [chainingIds, setChainingIds] = useState<ReadonlySet<number>>(EMPTY_IDS);
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(EMPTY_IDS);
  const [badId, setBadId] = useState<number | null>(null);
  const [revealId, setRevealId] = useState<number | null>(null);
  const [fx, setFx] = useState<FxItem[]>([]);
  const [banner, setBanner] = useState<{ text: string; tone: 'chain' | 'act' | 'gift'; key: number } | null>(null);
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
  const firstPromptRef = useRef(true);
  const boardElRef = useRef<HTMLDivElement | null>(null);
  const focusBackRef = useRef<number | null>(null);
  const rotRef = useRef<{ order: Word[]; cursor: number }>({ order: [], cursor: 0 });
  const askedRef = useRef(new Map<string, number>());
  const recRef = useRef(new Map<string, { c: number; w: number }>());
  const missedRef = useRef(new Map<string, Word>());
  const pendingRocksRef = useRef<number[]>([]);
  const sinceRockRef = useRef(0);
  const tierUpRef = useRef(false);

  stageRef.current = stage;
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const alive = useCallback((my: number) => mountedRef.current && runRef.current === my, []);

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
  // 10 연속·16 연속에서 물방울이 하나 돌아온다 — 끊기면 그 사다리를 통째로 잃는다.
  const combo = useCombo({
    onTierUp: (tier) => {
      tierUpRef.current = true;
      if (tier.at < 10) return;
      if (livesRef.current < LIVES) {
        livesRef.current += 1;
        setLives(livesRef.current);
        setBanner({ text: '물방울 하나 회복', tone: 'gift', key: Date.now() });
        setAnnounce('연속 보상 · 물방울 하나 회복');
      } else {
        setScore((s) => s + 300);
        setBanner({ text: '만조 보너스 +300', tone: 'gift', key: Date.now() });
      }
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

  /** 아직 보드에 없는 단어를 회전 순서대로 하나 꺼낸다. 전부 올라가 있으면 null. */
  const nextFresh = useCallback((b: Board): Word | null => {
    const on = new Set(distinctEns(b));
    const { order } = rotRef.current;
    if (order.length === 0) return null;
    for (let k = 0; k < order.length; k++) {
      const idx = (rotRef.current.cursor + k) % order.length;
      const w = order[idx];
      if (!on.has(w.en)) {
        rotRef.current.cursor = (idx + 1) % order.length;
        return w;
      }
    }
    return null;
  }, []);

  /**
   * 빈 칸 하나를 무엇으로 채울지. 서로 다른 단어 수가 목표보다 적으면 학습자 풀에서
   * 새 단어를, 아니면 이미 올라와 있는 단어를 복제해 "같은 단어 여러 장" 구조를
   * 유지한다(어느 장을 짚을지가 이 게임의 결정이다). 어떤 경우에도 3칸 뭉치는
   * 만들지 않는다 — 연쇄는 오직 낙하의 결과여야 한다.
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
      const cands: Word[] = [];
      if (onEns.length < distinctTarget) {
        const f = nextFresh(b);
        if (f) cands.push(f);
      }
      // 복제 후보 — 한 단어가 보드를 삼키지 않게 4장에서 끊고, 열에 한 번은 이미
      // 여러 장인 단어를 우선한다(낙하로 3칸이 이어질 여지 = 연쇄의 씨앗).
      const counts = wordCounts(b);
      const dup = shuffle(onEns).filter((en) => (counts.get(en) ?? 0) < 4);
      if (Math.random() < 0.4) dup.sort((x, y) => (counts.get(y) ?? 0) - (counts.get(x) ?? 0));
      for (const en of dup) {
        const w = wordByEn.get(en);
        if (w) cands.push(w);
      }
      const f2 = nextFresh(b);
      if (f2) cands.push(f2);
      if (cands.length === 0) cands.push(...shuffle(pool).slice(0, 4));
      for (const w of cands) if (!wouldChain(b, i, w.en)) return mkWordCell(w);
      return mkWordCell(cands[0] ?? pool[0]);
    },
    [distinctTarget, mkRockCell, mkWordCell, nextFresh, pool, wordByEn],
  );

  /**
   * 다음에 물어볼 뜻. **보드에 이미 있는 단어 중 균등 무작위**로 뽑는다.
   * "가장 오래 안 나온 단어" 식 가중치를 주면 방금 떨어진 새 타일이 곧 정답이 돼
   * 뜻을 몰라도 눈으로 풀 수 있게 된다(정보 누출). 같은 뜻 연속만 막는다.
   */
  const pickTarget = useCallback(
    (b: Board, last: string | null): Word | null => {
      const ens = distinctEns(b);
      if (ens.length === 0) return null;
      let cands = ens.filter((e) => e !== last);
      if (cands.length === 0) cands = ens;
      const light = cands.filter((e) => (askedRef.current.get(e) ?? 0) < 2);
      const use = light.length > 0 ? light : cands;
      const en = use[Math.floor(Math.random() * use.length)];
      askedRef.current.set(en, (askedRef.current.get(en) ?? 0) + 1);
      return wordByEn.get(en) ?? null;
    },
    [wordByEn],
  );

  /** FSRS 적재 — 인출한 단어에만, 세션당 단어별 정답 2·오답 2 상한. */
  const record = useCallback(
    (w: Word, ok: boolean) => {
      const e = recRef.current.get(w.en) ?? { c: 0, w: 0 };
      if (ok) {
        if (e.c < 2) {
          e.c += 1;
          onCorrect?.(w);
        }
      } else if (e.w < 2) {
        e.w += 1;
        onWrong?.(w);
      }
      recRef.current.set(w.en, e);
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

  const startPrompt = useCallback((clearsNow: number, bonusMs: number) => {
    const grace = firstPromptRef.current ? FIRST_GRACE_MS : 0;
    firstPromptRef.current = false;
    stageRef.current = 'playing';
    setStage('playing');
    // reset 은 stage 갱신과 같은 동기 블록에서 — 그래야 일시정지분이 정확히 복원된다.
    clockRef.current.reset(windowMsFor(clearsNow) + bonusMs + grace);
  }, []);

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
      recRef.current = new Map();
      missedRef.current = new Map();
      pendingRocksRef.current = [];
      sinceRockRef.current = 0;
      tierUpRef.current = false;
      livesRef.current = LIVES;
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
      startPrompt(0, 0);
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
      const cad = rockCadence(actOf(clearsNow));
      if (cad > 0) {
        sinceRockRef.current += 1;
        if (sinceRockRef.current >= cad) {
          sinceRockRef.current = 0;
          if (rockCount(cur) < MAX_ROCKS) pendingRocksRef.current.push(Math.floor(Math.random() * COLS));
        }
      }

      // 다음 뜻은 **리필까지 끝난 보드**에서 뽑는다. 리필 전 보드에서 뽑으면
      // "방금 떨어진 타일은 절대 정답이 아니다"가 규칙이 돼 후보가 조용히 좁혀진다.
      const filled = fillEmpty(cur, chooseCell);
      const t = pickTarget(filled.board, lastEn);
      if (!t) {
        finish(false);
        return;
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
      startPrompt(clearsNow, link > 0 ? 700 : 0);
      restoreFocus();
    },
    [addFx, alive, chooseCell, finish, pickTarget, restoreFocus, sfx, startPrompt],
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

      tierUpRef.current = false;
      const nc = comboRef.current.hit();
      const mult = multFor(nc);
      const speed = Math.round(140 * frac);
      const clusterBonus = (cluster.length - 1) * 45;
      const rockBonus = rocks.length * 70;
      const dropBonus = settled.fell * 12;
      const gain = Math.round((100 + speed + clusterBonus + rockBonus + dropBonus) * mult);
      const tag =
        rocks.length > 0
          ? `돌 ${rocks.length}`
          : cluster.length > 1
            ? `뭉치 ${cluster.length}`
            : settled.fell >= 4
              ? `낙차 ${settled.fell}`
              : mult > 1
                ? `×${mult}`
                : undefined;

      record(cell.word, true);
      const nextClears = clears + 1;
      setScore((s) => s + gain);
      setClears(nextClears);
      setLastResult('correct');
      setClearingIds(ids);
      addFx([
        ...cluster.map((i) => ({ index: i, burst: 1 + clamp(Math.floor(nc / 4), 0, 3), colors: CLEAR_COLORS })),
        ...rocks.map((i) => ({ index: i, burst: 2, colors: CHAIN_COLORS })),
        { index, gain, tag },
      ]);
      sfx.correct(nc, tierUpRef.current);
      setAnnounce(`정답 ${cell.word.en} · +${gain}`);

      await sleep(CLEAR_MS);
      if (!alive(my)) return;
      setClearingIds(EMPTY_IDS);
      setBoard(settled.board);
      await sleep(FALL_MS);
      if (!alive(my)) return;

      if (nextClears >= GOAL) {
        finish(true);
        return;
      }
      if (nextClears === 14 || nextClears === 28) {
        setBanner({
          text: nextClears === 14 ? '2막 — 물살이 빨라져요' : '3막 — 낙석이 잦아져요',
          tone: 'act',
          key: Date.now(),
        });
      }
      await settleAndContinue(my, settled.board, nextClears, cell.word.en);
    },
    [addFx, alive, clears, finish, record, settleAndContinue, sfx],
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

      record(t, false);
      missedRef.current.set(t.en, t);
      comboRef.current.miss();
      livesRef.current = Math.max(0, livesRef.current - 1);
      const left = livesRef.current;
      setLives(left);
      setLastResult(kind);

      const answers = findAnswerIndexes(b0, t.en);
      const ansIdx = answers.length > 0 ? answers[0] : -1;
      const ansCell = ansIdx >= 0 ? (b0[ansIdx] as WordCell) : null;
      setRevealId(ansCell ? ansCell.id : null);
      setAnnounce(`${t.ko} — 정답은 ${t.en} 이에요`);

      await sleep(REVEAL_MS);
      if (!alive(my)) return;
      setBadId(null);
      setRevealId(null);

      if (left <= 0) {
        finish(false);
        return;
      }

      let next = b0;
      if (ansCell) {
        pendingRocksRef.current.push(colOf(ansIdx));
        next = compact(removeIds(b0, new Set([ansCell.id]))).board;
        setBoard(next);
        await sleep(FALL_MS);
        if (!alive(my)) return;
      }
      await settleAndContinue(my, next, clears, t.en);
    },
    [alive, board, clears, finish, record, settleAndContinue, target],
  );
  const missRef = useRef(handleMiss);
  missRef.current = handleMiss;

  // ─── 탭 ───
  const handleTap = useCallback(
    (index: number) => {
      if (stageRef.current !== 'playing' || !target) return;
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
  const act = actOf(clears);
  const glow = act === 1 ? 'rgba(120,224,235,.32)' : act === 2 ? 'rgba(120,224,235,.46)' : 'rgba(150,236,244,.60)';
  const busy = stage !== 'playing';

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

  if (!playable) return <NotEnoughWords need={8} onExit={onExit} />;

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
        progress={clears / GOAL}
        combo={combo.combo}
        comboMult={combo.mult}
        lives={{ total: LIVES, left: lives, label: '남은 물방울' }}
        extra={
          <div className="cs-count">
            <span className="gk-stat-label">인출</span>
            <span className="cs-count-val">
              {clears}/{GOAL}
            </span>
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
            { num: `${clears}/${GOAL}`, label: '인출한 뜻' },
            { num: combo.best, label: '최고 연속' },
            { num: bestChain > 0 ? `${bestChain}단` : '—', label: '최고 연쇄' },
          ]}
          best={{ prev: bestInfo?.prev ?? null, now: score, label: '점수', improved: bestInfo?.improved }}
          badge={
            won ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 완주 · 뜻 {GOAL}개
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
              : '10 연속을 넘기면 물방울이 하나 돌아와요'
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
                <p className="cs-prompt-ko">{target ? target.ko : '…'}</p>
                <TimerBar
                  frac={clock.frac}
                  warning={clock.warning}
                  seconds={Math.ceil(clock.remainMs / 1000)}
                  label="이 뜻에 남은 시간"
                />
              </>
            )}
          </section>

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
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* 규칙은 한 번에 다 쏟지 않는다 — 돌이 등장하는 2막에 가서야 돌 이야기를 한다. */}
          <p className="cs-help">
            {act === 1 ? (
              <>
                같은 단어가 여러 장이면 <b>낮은 장</b>을 짚을수록 더 많이 무너져요 · 낙하로 같은 단어 3칸이 이어지면 연쇄
              </>
            ) : (
              <>
                <b>낮은 장 · 뭉친 장 · 돌 옆의 장</b> — 어느 장을 짚느냐가 점수를 가릅니다
              </>
            )}
          </p>
        </main>
      )}
    </div>
  );
}

const CS_CSS = `
  .cs-root .gk-stage { gap: clamp(12px, 2.2vh, 20px); justify-content: flex-start; padding-top: clamp(10px, 2.4vh, 22px); }
  .cs-count { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .cs-count-val { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t1); }

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
  .cs-root .cs-prompt .gk-timer { width: min(300px, 76%); }
  .cs-answer { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 4px 12px; margin: 0; text-align: center; }
  .cs-answer-en { font-family: var(--font-english, system-ui); font-size: clamp(21px, 5.8vw, 29px); font-weight: 800; color: var(--combo); letter-spacing: -.01em; }
  .cs-answer-ko { font-family: var(--font-display, system-ui); font-size: clamp(14px, 3.4vw, 17px); font-weight: 700; color: var(--t2); }
  .cs-answer-ex { margin: 0; max-width: 42ch; font-family: var(--font-english, system-ui); font-size: 12.5px; line-height: 1.5; color: var(--t3); text-align: center;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* ── 배너(연쇄·막 전환·보상) — 모달 아님, 카드 위에 얹히는 한 줄 ── */
  .cs-banner { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); margin: 0; padding: 3px 12px; border-radius: 999px;
    font-size: 11.5px; font-weight: 900; letter-spacing: -.01em; white-space: nowrap; border: 1px solid var(--bd); background: var(--bg); color: var(--t1);
    animation: cs-banner 1.6s ease-out forwards; }
  .cs-banner--chain { color: var(--streak); border-color: color-mix(in srgb, var(--streak) 55%, var(--bd)); }
  .cs-banner--act { color: var(--combo); border-color: color-mix(in srgb, var(--combo) 55%, var(--bd)); }
  .cs-banner--gift { color: var(--success); border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); }
  @keyframes cs-banner { 0% { opacity: 0; transform: translate(-50%, 6px); } 12% { opacity: 1; transform: translate(-50%, 0); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -6px); } }

  /* ── 보드 ── */
  .cs-board { position: relative; display: grid; grid-template-rows: repeat(4, 1fr); gap: clamp(7px, 1.5vw, 11px);
    width: min(470px, 92vw, calc(100vh - 340px)); }
  .cs-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(7px, 1.5vw, 11px); }
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

  @media (max-width: 430px) {
    /* HUD 가 7칸이 되면 390px 에서 눌린다 — 진행도는 HUD 게이지와 끝화면이 이미 말해 준다. */
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
