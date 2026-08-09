// apps/web/src/components/game/daily-blitz/DailyBlitzGame.tsx
// Daily Blitz — 데일리 의식(Wordle × 스트릭)을 "하나의 시계 위에서 판돈을 거는 릴레이"로 재설계(v07.9).
//
// 무엇이 바뀌었나 (감사 23/50 → 대응):
//  1) 보이지 않던 6초 문항 타이머를 없애고 **세션 전체를 관통하는 시계 하나**로 바꿨다.
//     맞히면 늘고(extend) 틀리면 준다(drain). 남은 시간은 항상 TimerBar 로 보인다 —
//     경고 없이 miss 를 먹는 "함정"이 구조적으로 사라진다.
//  2) 문항마다 조인다: 정답 보상 시간이 5.0s → 2.3s 로 줄고, 선택지가 4 → 5 → 6개로 늘고,
//     후반·연장에서는 오답이 **철자·품사가 닮은 단어**로 바뀐다(형태 혼동 변별 훈련).
//  3) 유일하고 진짜인 선택 — **승부 걸기**. 뜻만 보이는 상태에서 3초를 선불로 걸면
//     점수 ×3 · 시간 보상 ×2, 실패하면 시간을 더 잃는다. 시계가 화폐라서 같은 베팅도
//     남은 시간에 따라 가치가 달라진다(= 매 문항 판단이 살아있다).
//  4) 선택지는 **결정한 뒤에** 열린다. 뜻만 보고 먼저 떠올리게 하는 구조라
//     인출(Active Recall)이 강해지고, 베팅이 "정답을 본 뒤 거는" 무위험 도박이 되지 않는다.
//  5) 10문항이 끝나도 시간이 남으면 **연장전**이 이어진다 — 점수·개인기록·다음 판의 이유.
//  6) 내장 뱅크는 폴백일 뿐. wordPool 이 오면 **학습자의 도서/스크립트/단어장 단어**로 돈다.
//     그래야 recordGameResult 가 silent skip 되지 않고 FSRS 에 적재된다.
//
// 인출 규칙: 제출 전 화면에는 한국어 뜻만 있다(정답 특정 정보 없음). 부분 정답 오라클 없음.
// 정답 공개는 제출 후, 예문·발음까지 충분히.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GameKitStyles, AmbientBackground, GameMark, IconSound, ParticleBurst, useSfx, shuffle, clamp, type Word,
  GameMusic, Hud, TimerBar, FeedbackIcon, Kbd, GameDone, NotEnoughWords,
  useCountdown, useCombo, usePersonalBest, DEFAULT_COMBO_TIERS,
} from '@/components/game/_shared/gamekit';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

// 폴백 뱅크 — wordPool 이 없을 때(비로그인·단어장 미충족)만 쓰는 맛보기.
const BANK: Word[] = [
  { en: 'advantage', ko: '이점', pos: 'n' }, { en: 'reserved', ko: '내성적인', pos: 'adj' },
  { en: 'inclined', ko: '경향이 있는', pos: 'adj' }, { en: 'consequence', ko: '결과', pos: 'n' },
  { en: 'judgment', ko: '판단', pos: 'n' }, { en: 'ability', ko: '능력', pos: 'n' },
  { en: 'balance', ko: '균형', pos: 'n' }, { en: 'courage', ko: '용기', pos: 'n' },
  { en: 'develop', ko: '발전시키다', pos: 'v' }, { en: 'reduce', ko: '줄이다', pos: 'v' },
  { en: 'sudden', ko: '갑작스러운', pos: 'adj' }, { en: 'honest', ko: '정직한', pos: 'adj' },
  { en: 'generous', ko: '관대한', pos: 'adj' }, { en: 'stubborn', ko: '고집센', pos: 'adj' },
  { en: 'massive', ko: '거대한', pos: 'adj' }, { en: 'budget', ko: '예산', pos: 'n' },
  { en: 'profit', ko: '이익', pos: 'n' }, { en: 'debt', ko: '빚', pos: 'n' },
  { en: 'flood', ko: '홍수', pos: 'n' }, { en: 'ancient', ko: '고대의', pos: 'adj' },
  { en: 'fragile', ko: '연약한', pos: 'adj' }, { en: 'genuine', ko: '진짜의', pos: 'adj' },
  { en: 'hostile', ko: '적대적인', pos: 'adj' }, { en: 'obvious', ko: '분명한', pos: 'adj' },
  { en: 'reveal', ko: '드러내다', pos: 'v' }, { en: 'seek', ko: '찾다', pos: 'v' },
  { en: 'vivid', ko: '생생한', pos: 'adj' }, { en: 'wander', ko: '거닐다', pos: 'v' },
  { en: 'yield', ko: '양보하다', pos: 'v' }, { en: 'grasp', ko: '움켜쥐다', pos: 'v' },
  { en: 'deliberate', ko: '신중한', pos: 'adj' }, { en: 'reluctant', ko: '마지못한', pos: 'adj' },
  { en: 'thorough', ko: '철저한', pos: 'adj' }, { en: 'arrogant', ko: '오만한', pos: 'adj' },
  { en: 'humble', ko: '겸손한', pos: 'adj' }, { en: 'cautious', ko: '조심스러운', pos: 'adj' },
  { en: 'accomplish', ko: '성취하다', pos: 'v' }, { en: 'endure', ko: '견디다', pos: 'v' },
  { en: 'persuade', ko: '설득하다', pos: 'v' }, { en: 'hesitate', ko: '망설이다', pos: 'v' },
  { en: 'overcome', ko: '극복하다', pos: 'v' }, { en: 'dedicate', ko: '헌신하다', pos: 'v' },
  { en: 'scarce', ko: '부족한', pos: 'adj' }, { en: 'abundant', ko: '풍부한', pos: 'adj' },
  { en: 'temporary', ko: '일시적인', pos: 'adj' }, { en: 'permanent', ko: '영구적인', pos: 'adj' },
  { en: 'adequate', ko: '충분한', pos: 'adj' }, { en: 'immense', ko: '엄청난', pos: 'adj' },
];

const DAILY_MAX = 10;
const TOTAL_MS = 90_000;
/** useCountdown 내부 가산 상한과 같은 비율 — 화면에 찍는 "+N초"가 거짓이 되지 않게 미러링한다. */
const EXTEND_CAP = TOTAL_MS * 0.75;
const STAKE_COST_MS = 3000;
const WARN_MS = 10_000;
const FAST_MS = 2800;
const STORE_KEY = 'vf_dailyblitz_v2';
const LEGACY_KEY = 'vf_dailyblitz_v1';

type Stage = 'decide' | 'pick' | 'reveal';
type Phase = 'intro' | 'playing' | 'result';
type Mark = 'fast' | 'ok' | 'stake' | 'wrong' | 'skip';
type Mode = 'daily' | 'free';

interface Store {
  lastDate: string;
  streak: number;
  history: string[];
  today?: { date: string; grid: string; correct: number; score: number };
}

interface Question {
  word: Word;
  options: Word[];
  /** 통합 라운드 인덱스(0-based). dailyN 이상이면 연장전. */
  round: number;
  over: boolean;
}

const MARK_CHAR: Record<Mark, string> = { fast: '🟩', ok: '🟨', stake: '🟪', wrong: '🟥', skip: '⬛' };
const MARK_GLYPH: Record<Mark, string> = { fast: '✓✓', ok: '✓', stake: '★', wrong: '✕', skip: '·' };
const MARK_TEXT: Record<Mark, string> = { fast: '빠른 정답', ok: '정답', stake: '승부 성공', wrong: '오답', skip: '미도달' };

// ─── 날짜 시드 유틸 ───
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function dateKey(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function dayNumber(d: Date) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
function isYesterday(prev: string, today: string) {
  const p = new Date(+prev.slice(0, 4), +prev.slice(4, 6) - 1, +prev.slice(6, 8));
  const t = new Date(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6, 8));
  return Math.round((t.getTime() - p.getTime()) / 86400000) === 1;
}

// ─── 오답 선택지 난이도 ───
// 초반엔 무작위, 후반·연장엔 **철자·품사가 닮은** 단어로. 찍기가 통하지 않게 되고,
// 동시에 형태 혼동(develop/deliver, adequate/adopt)을 변별하는 실제 학습이 된다.
function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function nearness(cand: Word, target: Word) {
  const a = cand.en.toLowerCase(), b = target.en.toLowerCase();
  let s = 0;
  if (a[0] === b[0]) s += 2;
  if (Math.abs(a.length - b.length) <= 1) s += 1.2;
  if (cand.pos && target.pos && cand.pos === target.pos) s += 1.6;
  if (a.slice(-3) === b.slice(-3)) s += 1.4;
  s += Math.max(0, 3 - levenshtein(a, b) * 0.45);
  return s;
}
function isNearMiss(chosen: Word, target: Word) {
  const a = chosen.en.toLowerCase(), b = target.en.toLowerCase();
  return a.slice(0, 3) === b.slice(0, 3) || levenshtein(a, b) <= 2;
}

function optionCount(round: number, over: boolean, poolSize: number) {
  const want = over ? 6 : round < 3 ? 4 : round < 7 ? 5 : 6;
  return clamp(Math.min(want, poolSize), 2, 6);
}

function makeQuestion(pool: Word[], word: Word, round: number, over: boolean): Question {
  const n = optionCount(round, over, pool.length);
  const others = pool.filter((w) => w.en !== word.en);
  const hard = over || round >= 4;
  let picked: Word[];
  if (hard && others.length > n - 1) {
    const ranked = [...others].sort((x, y) => nearness(y, word) - nearness(x, word));
    picked = shuffle(ranked.slice(0, Math.min(others.length, (n - 1) * 3))).slice(0, n - 1);
  } else {
    picked = shuffle(others).slice(0, n - 1);
  }
  return { word, options: shuffle([word, ...picked]), round, over };
}

function multFor(combo: number) {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}
/** 정답 보상 시간 — 문항이 갈수록 짧아진다(긴장 곡선의 뼈대). */
function rewardMs(round: number, over: boolean, dailyN: number) {
  if (over) return Math.max(1500, 2600 - (round - dailyN) * 70);
  return Math.max(2300, 5000 - round * 300);
}

// ─── 보드(문항 영역) ───
// useCountdown 이 매 프레임 setState 하므로 부모는 초당 60회 렌더된다.
// 문항 영역은 memo 로 끊어 프레임마다 4~6개 타일이 재조정되지 않게 한다.
const Board = memo(function Board({
  q, stage, picked, staked, canStake, dailyN, onOpen, onPick,
}: {
  q: Question;
  stage: Stage;
  picked: number | null;
  staked: boolean;
  canStake: boolean;
  dailyN: number;
  onOpen: (stake: boolean) => void;
  onPick: (i: number) => void;
}) {
  const revealed = stage === 'reveal';
  const chosen = picked != null ? q.options[picked] : null;
  const wasRight = !!chosen && chosen.en === q.word.en;
  const near = !!chosen && !wasRight && isNearMiss(chosen, q.word);

  return (
    <div className="db-board">
      <div className="db-prompt-wrap">
        <span className="db-round">
          {q.over ? `연장 ${q.round - dailyN + 1}` : `${q.round + 1} / ${dailyN}`}
        </span>
        <h1 className="db-meaning" key={q.round}>{q.word.ko}</h1>
        {staked && (
          <span className="db-staked-chip">
            <span aria-hidden="true">★</span> 승부 중 · 점수 ×3
          </span>
        )}
      </div>

      {stage === 'decide' ? (
        <div className="db-decide">
          <p className="db-decide-lead">뜻을 보고 영어 단어를 먼저 떠올려 보세요.</p>
          <div className="db-decide-btns">
            <button
              type="button"
              className="gk-btn gk-btn--primary db-choice"
              onClick={() => onOpen(false)}
            >
              <span className="db-choice-main">선택지 보기</span>
              <span className="db-choice-sub">기본 점수 · <Kbd>1</Kbd></span>
            </button>
            <button
              type="button"
              className="gk-btn db-choice db-choice--stake"
              aria-disabled={!canStake}
              onClick={() => { if (canStake) onOpen(true); }}
            >
              <span className="db-choice-main"><span aria-hidden="true">★</span> 승부 걸기</span>
              <span className="db-choice-sub">
                {canStake ? <>3초를 걸고 점수 ×3 · <Kbd>2</Kbd></> : '시간이 3초 넘게 남아야 걸 수 있어요'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="db-tiles">
            {q.options.map((o, i) => {
              const isAns = o.en === q.word.en;
              const isPick = picked === i;
              let tone = '';
              if (revealed) tone = isAns ? 'gk-tile--correct' : isPick ? 'gk-tile--wrong' : 'gk-tile--dim';
              return (
                <button
                  key={`${q.round}-${o.en}`}
                  type="button"
                  className={`gk-tile db-tile ${tone}`}
                  aria-disabled={revealed}
                  onClick={() => { if (!revealed) onPick(i); }}
                >
                  <span className="db-tile-key" aria-hidden="true">{i + 1}</span>
                  <span className="db-tile-en">{o.en}</span>
                  {revealed && isAns && <FeedbackIcon kind="correct" size={16} />}
                  {revealed && isPick && !isAns && <FeedbackIcon kind={near ? 'near' : 'wrong'} size={16} />}
                  {revealed && isAns && <ParticleBurst intensity={1} colors={['var(--success)', 'var(--combo)']} />}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className="db-reveal" role="status">
              <div className="db-reveal-head">
                <b className="db-reveal-en">{q.word.en}</b>
                {q.word.pron && <span className="db-reveal-pron">{q.word.pron}</span>}
                {q.word.pos && <span className="db-reveal-pos">{q.word.pos}</span>}
              </div>
              <div className="db-reveal-ko">{q.word.ko}</div>
              {q.word.example && <div className="db-reveal-ex">{q.word.example}</div>}
              {!wasRight && chosen && (
                <div className="db-reveal-mine">
                  고른 것 <b>{chosen.en}</b> = {chosen.ko}
                  {near && <span className="db-reveal-near"> · 철자가 아주 비슷했어요</span>}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export function DailyBlitzGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  // ── 단어 원천: wordPool 우선(= 학습자의 도서/스크립트/단어장). 없을 때만 내장 뱅크.
  const pool = useMemo<Word[]>(() => (wordPool && wordPool.length >= 5 ? wordPool : BANK), [wordPool]);
  const usingOwn = !!(wordPool && wordPool.length >= 5);
  const dailyN = Math.min(DAILY_MAX, pool.length);

  const today = useMemo(() => (typeof window === 'undefined' ? new Date(0) : new Date()), []);
  const tKey = dateKey(today);
  const dayNo = dayNumber(today);

  const [store, setStore] = useState<Store | null>(null);
  const alreadyDone = store?.today?.date === tKey;

  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('daily');
  const [stage, setStage] = useState<Stage>('decide');
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [staked, setStaked] = useState(false);
  const [results, setResults] = useState<Mark[]>([]);
  const [score, setScore] = useState(0);
  const [overOk, setOverOk] = useState(0);
  const [overTotal, setOverTotal] = useState(0);
  const [stakeWins, setStakeWins] = useState(0);
  const [stakeTries, setStakeTries] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [gain, setGain] = useState<{ id: number; txt: string; tone: 'good' | 'bad' } | null>(null);
  const [announce, setAnnounce] = useState('');
  const [toMidnight, setToMidnight] = useState('');
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; improved: boolean }>({ prev: null, improved: false });

  const stageRef = useRef<Stage>('decide');
  stageRef.current = stage;
  const scoreRef = useRef(0);
  const storeRef = useRef<Store | null>(null);
  storeRef.current = store;
  const resultsRef = useRef<Mark[]>([]);
  const runWordsRef = useRef<Word[]>([]);
  const otQueueRef = useRef<Word[]>([]);
  const reportedRef = useRef<Set<string>>(new Set());
  const grantedRef = useRef(0);
  const qStartRef = useRef(0);
  const stakedRef = useRef(false);
  const finishedRef = useRef(false);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gainId = useRef(0);
  const mounted = useRef(true);

  const best = usePersonalBest('daily-blitz-score');
  const bestRef = useRef(best);
  bestRef.current = best;

  // 티어 승급 순간에만 마일스톤 사운드. 일반 정답음은 pick() 이 낸다(중복 방지).
  const combo = useCombo({ onTierUp: (_tier, c) => sfx.correct(c, true) });
  const comboRef = useRef(combo);
  comboRef.current = combo;

  const finishRef = useRef<(reason: 'time' | 'quit') => void>(() => {});
  const count = useCountdown({
    totalMs: TOTAL_MS,
    running: phase === 'playing' && stage !== 'reveal',
    warnAtMs: WARN_MS,
    onWarn: () => sfx.click(),
    onEnd: () => finishRef.current('time'),
  });
  const countRef = useRef(count);
  countRef.current = count;

  // ── 저장소 ──
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      let s: Store;
      if (raw) {
        const p = JSON.parse(raw) as Partial<Store>;
        s = { lastDate: p.lastDate ?? '', streak: p.streak ?? 0, history: p.history ?? [], today: p.today };
      } else {
        const legacy = window.localStorage.getItem(LEGACY_KEY);
        const lp = legacy ? (JSON.parse(legacy) as Partial<Store>) : null;
        s = { lastDate: lp?.lastDate ?? '', streak: lp?.streak ?? 0, history: lp?.lastDate ? [lp.lastDate] : [] };
      }
      if (s.lastDate && s.lastDate !== tKey && !isYesterday(s.lastDate, tKey)) s.streak = 0;
      if (s.today && s.today.date !== tKey) s.today = undefined;
      setStore(s);
    } catch {
      setStore({ lastDate: '', streak: 0, history: [] });
    }
    return () => {
      mounted.current = false;
      if (nextTimer.current) clearTimeout(nextTimer.current);
      if (gainTimer.current) clearTimeout(gainTimer.current);
    };
  }, [tKey]);

  // ── 자정까지 남은 시간(결과 화면에서만) ──
  useEffect(() => {
    if (phase !== 'result') return;
    const tick = () => {
      const now = new Date();
      const nx = new Date(now);
      nx.setHours(24, 0, 0, 0);
      const s = Math.max(0, Math.floor((nx.getTime() - now.getTime()) / 1000));
      setToMidnight(
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const showGain = useCallback((txt: string, tone: 'good' | 'bad') => {
    gainId.current += 1;
    const id = gainId.current;
    setGain({ id, txt, tone });
    // 애니메이션이 꺼진 환경(reduced-motion)에서도 부유 텍스트가 남지 않도록 직접 걷어낸다.
    if (gainTimer.current) clearTimeout(gainTimer.current);
    gainTimer.current = setTimeout(() => {
      if (mounted.current) setGain((g) => (g && g.id === id ? null : g));
    }, 1150);
  }, []);

  const addScore = useCallback((pts: number) => {
    scoreRef.current += pts;
    setScore(scoreRef.current);
  }, []);

  /** useCountdown 의 가산 상한을 그대로 미러링 — 실제로 더해진 만큼만 화면에 찍는다. */
  const grantTime = useCallback((ms: number) => {
    const allowed = Math.max(0, Math.min(ms, EXTEND_CAP - grantedRef.current));
    if (allowed <= 0) return 0;
    grantedRef.current += allowed;
    countRef.current.extend(allowed);
    return allowed;
  }, []);

  const nextOvertimeWord = useCallback(() => {
    if (otQueueRef.current.length === 0) otQueueRef.current = shuffle(pool);
    return otQueueRef.current.pop() as Word;
  }, [pool]);

  const startQuestion = useCallback((idx: number) => {
    const over = idx >= dailyN;
    const w = over ? nextOvertimeWord() : runWordsRef.current[idx];
    setQuestion(makeQuestion(pool, w, idx, over));
    setPicked(null);
    setStaked(false);
    stakedRef.current = false;
    setStage('decide');
    stageRef.current = 'decide';
    qStartRef.current = performance.now();
  }, [dailyN, nextOvertimeWord, pool]);

  const startRun = useCallback((m: Mode) => {
    if (nextTimer.current) { clearTimeout(nextTimer.current); nextTimer.current = null; }
    const words = m === 'daily'
      ? seededShuffle(pool, mulberry32(dayNo)).slice(0, dailyN)
      : shuffle(pool).slice(0, dailyN);
    runWordsRef.current = words;
    otQueueRef.current = shuffle(pool.filter((w) => !words.some((x) => x.en === w.en)));
    reportedRef.current = new Set();
    resultsRef.current = [];
    grantedRef.current = 0;
    finishedRef.current = false;
    combo.reset();
    scoreRef.current = 0;
    setMode(m);
    setResults([]);
    setScore(0);
    setBestInfo({ prev: null, improved: false });
    setOverOk(0);
    setOverTotal(0);
    setStakeWins(0);
    setStakeTries(0);
    setMissed([]);
    setGain(null);
    setAnnounce('');
    countRef.current.reset();
    setPhase('playing');
    startQuestion(0);
  }, [combo, dailyN, dayNo, pool, startQuestion]);

  const finish = useCallback((reason: 'time' | 'quit') => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (nextTimer.current) { clearTimeout(nextTimer.current); nextTimer.current = null; }

    const padded = [...resultsRef.current];
    while (padded.length < dailyN) padded.push('skip');
    resultsRef.current = padded;
    setResults(padded);
    setPhase('result');

    const correct = padded.filter((r) => r === 'fast' || r === 'ok' || r === 'stake').length;
    const perfect = correct === dailyN;
    // 보상은 판돈에 비례한다 — 2/10 이든 10/10 이든 같은 팡파르가 울리던 문제(감사 지적) 수정.
    if (perfect) sfx.fanfare();
    else if (correct >= Math.ceil(dailyN * 0.7)) sfx.correct(0, false);
    else sfx.click();

    const finalScore = scoreRef.current;
    setBestInfo(bestRef.current.submit(finalScore));

    if (mode === 'daily' && !alreadyDone) {
      const cur: Store = storeRef.current ?? { lastDate: '', streak: 0, history: [] };
      const newStreak = !cur.lastDate
        ? 1
        : cur.lastDate === tKey
          ? cur.streak
          : isYesterday(cur.lastDate, tKey)
            ? cur.streak + 1
            : 1;
      const ns: Store = {
        lastDate: tKey,
        streak: newStreak,
        history: Array.from(new Set([...cur.history, tKey])).slice(-14),
        today: { date: tKey, grid: padded.map((r) => MARK_CHAR[r]).join(''), correct, score: finalScore },
      };
      storeRef.current = ns;
      setStore(ns);
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(ns)); } catch { /* private mode */ }
    }
    setAnnounce(reason === 'time' ? '시간 종료' : '세션 종료');
  }, [alreadyDone, dailyN, mode, sfx, tKey]);
  finishRef.current = finish;

  const advance = useCallback((from: number) => {
    if (finishedRef.current || !mounted.current) return;
    if (countRef.current.remainMs <= 0) { finishRef.current('time'); return; }
    startQuestion(from + 1);
  }, [startQuestion]);

  const openOptions = useCallback((stake: boolean) => {
    if (stageRef.current !== 'decide' || !mounted.current) return;
    if (stake) {
      if (countRef.current.remainMs <= STAKE_COST_MS + 500) return;
      countRef.current.drain(STAKE_COST_MS);
      setStaked(true);
      stakedRef.current = true;
      setStakeTries((n) => n + 1);
      sfx.coin();
      showGain('−3초 · 승부', 'bad');
    } else {
      sfx.click();
    }
    setStage('pick');
    stageRef.current = 'pick';
  }, [sfx, showGain]);

  const pick = useCallback((i: number) => {
    if (stageRef.current !== 'pick' || !mounted.current) return;
    const q = question;
    if (!q || i < 0 || i >= q.options.length) return;
    stageRef.current = 'reveal';

    const chosen = q.options[i];
    const ok = chosen.en === q.word.en;
    const elapsed = performance.now() - qStartRef.current;
    const wasStaked = stakedRef.current;
    const near = !ok && isNearMiss(chosen, q.word);

    setPicked(i);
    setStage('reveal');

    let mark: Mark;
    if (ok) {
      const c = comboRef.current.hit();
      const mult = multFor(c);
      const tierUp = mult !== multFor(c - 1);
      const speed = clamp(1.7 - elapsed / 6000, 0.6, 1.7);
      const pts = Math.round(100 * mult * (wasStaked ? 3 : 1) * speed);
      addScore(pts);
      const added = grantTime(rewardMs(q.round, q.over, dailyN) * (wasStaked ? 2 : 1));
      const secTxt = added > 0 ? ` · +${(added / 1000).toFixed(1)}초` : ' · 시간 가산 한도';
      showGain(`+${pts}${secTxt}`, 'good');
      // 티어 승급 사운드는 useCombo 의 onTierUp 이 이미 냈다 — 겹쳐 울리지 않게.
      if (!tierUp) sfx.correct(c, false);
      mark = wasStaked ? 'stake' : elapsed < FAST_MS ? 'fast' : 'ok';
      if (wasStaked) setStakeWins((n) => n + 1);
      setAnnounce(
        `정답 ${q.word.en} · ${q.word.ko}${tierUp ? ` · ${c}연속 배수 ×${mult}` : ''}`,
      );
    } else {
      const lost = comboRef.current.miss();
      let penalty = near ? 2500 : 4000;
      if (wasStaked) penalty += 2000;
      if (lost >= 3) penalty += 1500;
      countRef.current.drain(penalty);
      if (near) sfx.nearMiss(); else sfx.wrong();
      showGain(`−${(penalty / 1000).toFixed(1)}초${lost >= 3 ? ` · ${lost}연속 끊김` : ''}`, 'bad');
      mark = 'wrong';
      setMissed((m) => (m.some((w) => w.en === q.word.en) ? m : [...m, q.word]));
      setAnnounce(`아쉬워요. 정답은 ${q.word.en} · ${q.word.ko}`);
    }

    if (!q.over) {
      resultsRef.current = [...resultsRef.current, mark];
      setResults(resultsRef.current);
    } else {
      setOverTotal((n) => n + 1);
      if (ok) setOverOk((n) => n + 1);
    }

    // FSRS 는 세션 내 첫 조우만 적재한다 — 연장전 재출현으로 같은 단어를 도배하지 않게.
    if (!reportedRef.current.has(q.word.en)) {
      reportedRef.current.add(q.word.en);
      if (ok) onCorrect?.(q.word); else onWrong?.(q.word);
    }

    const hold = ok ? 950 : 1600;
    if (nextTimer.current) clearTimeout(nextTimer.current);
    nextTimer.current = setTimeout(() => advance(q.round), hold);
  }, [addScore, advance, dailyN, grantTime, onCorrect, onWrong, question, sfx, showGain]);

  // ── 키보드: 결정 단계 1/2, 선택 단계 1~6 ──
  const openRef = useRef(openOptions);
  openRef.current = openOptions;
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const optionLen = question?.options.length ?? 0;

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n)) return;
      if (stageRef.current === 'decide') {
        if (n === 1) { e.preventDefault(); openRef.current(false); }
        else if (n === 2) { e.preventDefault(); openRef.current(true); }
      } else if (stageRef.current === 'pick') {
        if (n >= 1 && n <= optionLen) { e.preventDefault(); pickRef.current(n - 1); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, optionLen]);

  const stableOpen = useCallback((stake: boolean) => openRef.current(stake), []);
  const stablePick = useCallback((i: number) => pickRef.current(i), []);

  const handleExit = useCallback(() => {
    if (nextTimer.current) { clearTimeout(nextTimer.current); nextTimer.current = null; }
    onExit?.();
  }, [onExit]);

  // ── 파생값 ──
  const correctCount = results.filter((r) => r === 'fast' || r === 'ok' || r === 'stake').length;
  const grid = results.map((r) => MARK_CHAR[r]).join('');
  const streak = store?.streak ?? 0;
  const progress = question ? clamp((question.over ? dailyN : question.round) / dailyN, 0, 1) : 0;
  const canStake = count.remainMs > STAKE_COST_MS + 500;
  const glowAlpha = 0.3 + progress * 0.26 + (combo.combo >= 6 ? 0.14 : 0);

  const week = useMemo(() => {
    const base = typeof window === 'undefined' ? new Date(0) : new Date(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() - (6 - i));
      return dateKey(d);
    });
  }, [today]);
  const doneSet = useMemo(() => new Set(store?.history ?? []), [store]);

  const hudExtra = useMemo(
    () => (
      <span className="db-hud-streak" title="연속 기록">
        <span aria-hidden="true">🔥</span> {streak}
      </span>
    ),
    [streak],
  );

  if (pool.length < 5) return <NotEnoughWords need={5} onExit={onExit} />;

  return (
    <div className="gk-root db-root">
      <GameMusic gameId="daily-blitz" />
      <GameKitStyles />
      <AmbientBackground
        center="#FBEFE8"
        mid="#F2D2C3"
        edge="#7A3B54"
        glow={`rgba(255,158,120,${glowAlpha.toFixed(2)})`}
        glowAt="50% 34%"
        watermark="daily-blitz"
      />
      <style dangerouslySetInnerHTML={{ __html: DB_CSS }} />
      <div className="gk-sr" aria-live="assertive">{announce}</div>

      {phase === 'intro' && (
        <>
          <header className="db-bar">
            <div className="db-streak"><span aria-hidden="true">🔥</span> <b>{streak}</b>일 연속</div>
            <div className="db-title">오늘의 챌린지 <span className="db-num">#{dayNo % 100000}</span></div>
            <div className="db-bar-right">
              <button
                type="button"
                className="gk-icon-btn"
                aria-label={sfx.muted ? '소리 켜기' : '소리 끄기'}
                aria-pressed={sfx.muted}
                onClick={() => sfx.setMuted((m) => !m)}
              >
                <IconSound muted={sfx.muted} />
              </button>
              {onExit && <button type="button" className="gk-exit" onClick={handleExit}>나가기</button>}
            </div>
          </header>

          <main className="gk-stage db-intro">
            <div className="db-cal" aria-hidden="true"><GameMark id="daily-blitz" /></div>
            <h1 className="db-h1">Daily Blitz</h1>
            <p className="db-lead">
              오늘의 <b>{dailyN}단어</b>를 <b>{Math.round(TOTAL_MS / 1000)}초</b> 시계 하나로 통과하세요.
              {usingOwn ? ' 지금 고른 자료의 단어로 돌아갑니다.' : ' 단어장을 연결하면 내 단어로 바뀝니다.'}
            </p>

            <ul className="db-rules">
              <li><span className="db-rule-n" aria-hidden="true">1</span> 뜻을 보고 영어를 고릅니다. 빠를수록 점수가 큽니다.</li>
              <li><span className="db-rule-n" aria-hidden="true">2</span> 시계는 하나 — 맞히면 늘고, 틀리면 줄어듭니다.</li>
              <li><span className="db-rule-n" aria-hidden="true">3</span> 확신이 서면 <b>승부</b> — 3초를 걸고 점수 ×3.</li>
              <li><span className="db-rule-n" aria-hidden="true">4</span> {dailyN}문항 뒤에도 시간이 남으면 <b>연장전</b>이 이어집니다.</li>
            </ul>

            <WeekDots week={week} today={tKey} done={doneSet} />

            {alreadyDone ? (
              <>
                <div className="db-done-badge">
                  오늘 완료 · {store?.today?.correct}/{dailyN} · {store?.today?.score?.toLocaleString()}점
                  <span className="db-done-grid" aria-hidden="true">{store?.today?.grid}</span>
                </div>
                <div className="db-actions">
                  <button type="button" className="gk-btn gk-btn--primary db-start" onClick={() => startRun('free')}>
                    다시 도전 · 다른 단어
                  </button>
                  {onExit && <button type="button" className="gk-btn" onClick={handleExit}>내일 또 만나요</button>}
                </div>
              </>
            ) : (
              <div className="db-actions">
                <button type="button" className="gk-btn gk-btn--primary db-start" onClick={() => startRun('daily')}>
                  오늘의 챌린지 시작
                </button>
              </div>
            )}
          </main>
        </>
      )}

      {phase === 'playing' && question && (
        <>
          <Hud
            score={score}
            progress={progress}
            combo={combo.combo}
            comboMult={combo.mult}
            extra={hudExtra}
            muted={sfx.muted}
            onToggleMute={() => sfx.setMuted((m) => !m)}
            onExit={onExit ? handleExit : undefined}
          />
          <div className="db-clock">
            <TimerBar frac={count.frac} warning={count.warning} seconds={count.remainSec} label="남은 시간" />
          </div>
          <div className="db-pips" aria-hidden="true">
            {Array.from({ length: dailyN }, (_, i) => {
              const r = results[i];
              const now = !question.over && i === question.round;
              return (
                <span
                  key={i}
                  className={`db-pip ${r ? `db-pip--${r}` : ''} ${now ? 'db-pip--now' : ''}`}
                  data-glyph={r ? MARK_GLYPH[r] : now ? '▸' : ''}
                />
              );
            })}
            {question.over && <span className="db-ot-chip">연장 {question.round - dailyN + 1}</span>}
          </div>
          <p className="gk-sr">
            {dailyN}문항 중 {results.length}문항 완료 · 정답 {correctCount}개
          </p>

          <main className="gk-stage db-play">
            <Board
              q={question}
              stage={stage}
              picked={picked}
              staked={staked}
              canStake={canStake}
              dailyN={dailyN}
              onOpen={stableOpen}
              onPick={stablePick}
            />
          </main>

          {/* 부유 텍스트는 래퍼 안에 둔다 — .gk-root > * 규칙(명시도 0,4,0)이 직계 자식의
              position 을 relative 로 덮어써서 직계로 두면 좌표가 먹지 않는다. */}
          <div className="db-gain-layer" aria-hidden="true">
            {gain && <span key={gain.id} className={`db-gain db-gain--${gain.tone}`}>{gain.txt}</span>}
          </div>
        </>
      )}

      {phase === 'result' && (
        <ResultView
          mode={mode}
          grid={grid}
          results={results}
          dailyN={dailyN}
          correctCount={correctCount}
          score={score}
          overOk={overOk}
          overTotal={overTotal}
          stakeWins={stakeWins}
          stakeTries={stakeTries}
          missed={missed}
          bestPrev={bestInfo.prev}
          bestImproved={bestInfo.improved}
          streak={streak}
          week={week}
          today={tKey}
          done={doneSet}
          toMidnight={toMidnight}
          comboBest={combo.best}
          onRestart={() => startRun('free')}
          onExit={handleExit}
        />
      )}
    </div>
  );
}

// ─── 7일 점 캘린더 ───
function WeekDots({ week, today, done }: { week: string[]; today: string; done: Set<string> }) {
  const filled = week.filter((d) => done.has(d)).length;
  return (
    <div className="db-week" role="img" aria-label={`최근 7일 중 ${filled}일 완료`}>
      {week.map((d) => {
        const isToday = d === today;
        const isDone = done.has(d);
        return (
          <span
            key={d}
            className={`db-day ${isDone ? 'db-day--on' : ''} ${isToday ? 'db-day--today' : ''}`}
            aria-hidden="true"
          >
            {isDone ? '●' : isToday ? '○' : '·'}
          </span>
        );
      })}
    </div>
  );
}

// ─── 결과 ───
function ResultView({
  mode, grid, results, dailyN, correctCount, score, overOk, overTotal,
  stakeWins, stakeTries, missed, bestPrev, bestImproved, streak, week, today, done, toMidnight, comboBest,
  onRestart, onExit,
}: {
  mode: Mode;
  grid: string;
  results: Mark[];
  dailyN: number;
  correctCount: number;
  score: number;
  overOk: number;
  overTotal: number;
  stakeWins: number;
  stakeTries: number;
  missed: Word[];
  bestPrev: number | null;
  bestImproved: boolean;
  streak: number;
  week: string[];
  today: string;
  done: Set<string>;
  toMidnight: string;
  comboBest: number;
  onRestart: () => void;
  onExit: () => void;
}) {
  const perfect = correctCount === dailyN && dailyN > 0;
  const improved = bestImproved;

  const lead = perfect
    ? '오늘 전부 통과했어요'
    : correctCount >= Math.ceil(dailyN * 0.7)
      ? '오늘 잘 마쳤어요'
      : '오늘도 한 걸음';

  const stats: { num: ReactNode; label: string; accent?: boolean }[] = [
    { num: score.toLocaleString(), label: '점수', accent: true },
    { num: `${correctCount}/${dailyN}`, label: mode === 'daily' ? '오늘의 정답' : '정답' },
    { num: grid, label: '기록' },
  ];
  if (overTotal > 0) stats.push({ num: `${overOk}/${overTotal}`, label: '연장전' });
  if (mode === 'daily') stats.push({ num: `🔥 ${streak}`, label: '연속' });

  const hint = overTotal === 0
    ? '시간을 아끼면 연장전이 열려요. 확실한 단어는 빠르게 통과하세요.'
    : stakeTries === 0
      ? `연장 ${overTotal}라운드. 확실한 단어에 승부를 걸면 점수가 3배가 됩니다.`
      : `연장 ${overTotal}라운드 · 승부 ${stakeWins}/${stakeTries}. 다음엔 한 라운드 더.`;

  const badge = improved
    ? <><span aria-hidden="true">▲</span> 개인 최고 갱신</>
    : perfect
      ? <><span aria-hidden="true">★</span> 오늘 만점</>
      : comboBest >= 6
        ? <><span aria-hidden="true">🔥</span> 최장 {comboBest}연속</>
        : undefined;

  const reveal = missed.length > 0
    ? (
      <div className="db-miss">
        <div className="db-miss-title">다시 만나면 좋을 단어</div>
        <ul className="db-miss-list">
          {missed.map((w) => (
            <li key={w.en} className="db-miss-item">
              <b className="db-miss-en">{w.en}</b>
              <span className="db-miss-ko">{w.ko}</span>
              {w.pron && <span className="db-miss-pron">{w.pron}</span>}
              {w.example && <span className="db-miss-ex">{w.example}</span>}
            </li>
          ))}
        </ul>
      </div>
    )
    : undefined;

  const footer = (
    <div className="db-foot">
      <div className="db-legend">
        {(['fast', 'ok', 'stake', 'wrong', 'skip'] as Mark[]).map((m) => (
          <span key={m} className="db-legend-item">
            <span aria-hidden="true">{MARK_CHAR[m]}</span> {MARK_TEXT[m]}
          </span>
        ))}
      </div>
      <div className="db-foot-row">
        <WeekDots week={week} today={today} done={done} />
        {toMidnight && <span className="db-next">{toMidnight} 후 새 챌린지</span>}
      </div>
      <p className="db-foot-note">
        {results.length}문항 결과 — {(['fast', 'ok', 'stake', 'wrong', 'skip'] as Mark[])
          .map((m) => ({ m, n: results.filter((r) => r === m).length }))
          .filter((x) => x.n > 0)
          .map((x) => `${MARK_TEXT[x.m]} ${x.n}`)
          .join(' · ')}
      </p>
    </div>
  );

  return (
    <GameDone
      lead={lead}
      stats={stats}
      onRestart={onRestart}
      onExit={onExit}
      restartLabel="다시 도전 · 다른 단어"
      celebrate={perfect}
      mark="daily-blitz"
      best={{ prev: bestPrev, now: score, label: '점수', improved }}
      badge={badge}
      restartHint={hint}
      reveal={reveal}
      footer={footer}
    />
  );
}

const DB_CSS = `
  .db-bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--bd); }
  .db-streak { font-size: 13px; color: var(--t2); font-weight: 600; }
  .db-streak b { color: var(--streak); font-size: 15px; }
  .db-title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 14px; color: var(--t1); }
  .db-num { color: var(--t3); font-weight: 700; }
  .db-bar-right { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }

  .db-intro { gap: 14px; text-align: center; }
  .db-cal { width: 72px; height: 72px; display: grid; place-items: center; border-radius: 22px; color: var(--streak); background: color-mix(in srgb, var(--bg) 55%, transparent); border: 1px solid color-mix(in srgb, var(--t1) 12%, transparent); box-shadow: 0 14px 38px -12px rgba(0,0,0,.32); backdrop-filter: blur(6px); }
  .db-cal svg { width: 40px; height: 40px; }
  .db-h1 { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(28px, 6vw, 44px); font-weight: 800; color: var(--t1); }
  .db-lead { margin: 0; color: var(--t2); font-size: 14.5px; max-width: 38ch; line-height: 1.6; }
  .db-lead b { color: var(--t1); }
  .db-rules { list-style: none; margin: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; text-align: left; max-width: min(460px, 92vw); border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); }
  .db-rules li { display: flex; align-items: flex-start; gap: 9px; font-size: 13.5px; line-height: 1.55; color: var(--t2); }
  .db-rules b { color: var(--t1); }
  .db-rule-n { flex: none; width: 19px; height: 19px; margin-top: 1px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: var(--ti); background: var(--combo); }
  .db-done-badge { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; font-size: 13.5px; font-weight: 700; color: var(--t1); background: color-mix(in srgb, var(--success) 14%, transparent); border: 1px solid color-mix(in srgb, var(--success) 40%, var(--bd)); padding: 8px 16px; border-radius: 999px; }
  .db-done-grid { letter-spacing: 2px; }
  .db-start { min-width: 220px; font-size: 16px; min-height: 54px; }
  .db-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

  /* 7일 점 캘린더 — 색만이 아니라 글리프(● ○ ·)로도 구분 */
  .db-week { display: inline-flex; align-items: center; gap: 9px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 65%, transparent); }
  .db-day { font-size: 13px; line-height: 1; color: var(--t4); font-weight: 800; }
  .db-day--on { color: var(--streak); }
  .db-day--today { outline: 2px solid color-mix(in srgb, var(--combo) 55%, transparent); outline-offset: 3px; border-radius: 50%; }

  .db-clock { padding: 10px 16px 0; }
  .db-clock .gk-timer { width: min(560px, 92vw); margin: 0 auto; }
  .db-clock .gk-timer-track { height: 10px; }

  .db-pips { display: flex; gap: 5px; align-items: center; justify-content: center; padding: 10px 16px 0; flex-wrap: wrap; }
  .db-pip { position: relative; width: 24px; height: 20px; border-radius: 6px; background: var(--bg3); border: 1px solid var(--bd); }
  .db-pip::after { content: attr(data-glyph); position: absolute; inset: 0; display: grid; place-items: center; font-size: 10px; font-weight: 800; line-height: 1; color: var(--ti); }
  .db-pip--now { border-color: var(--combo); background: color-mix(in srgb, var(--combo) 22%, transparent); animation: gk-pop 1.1s ease-in-out infinite; }
  .db-pip--now::after { color: var(--combo); }
  .db-pip--fast { background: var(--success); border-color: var(--success); }
  .db-pip--ok { background: var(--active); border-color: var(--active); }
  .db-pip--stake { background: var(--streak); border-color: var(--streak); }
  .db-pip--wrong { background: var(--error); border-color: var(--error); }
  .db-pip--skip { background: var(--bg3); border-color: var(--bd); }
  .db-pip--skip::after { color: var(--t4); }
  .db-ot-chip { margin-left: 6px; font-size: 11px; font-weight: 800; letter-spacing: .04em; color: var(--streak); border: 1px solid color-mix(in srgb, var(--streak) 45%, var(--bd)); border-radius: 999px; padding: 3px 9px; }

  .db-play { gap: clamp(14px, 3vh, 26px); justify-content: flex-start; padding-top: clamp(14px, 3vh, 30px); overflow-y: auto; overscroll-behavior: contain; }
  .db-board { display: flex; flex-direction: column; align-items: center; gap: clamp(14px, 3vh, 26px); width: min(560px, 94vw); }
  .db-prompt-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .db-round { font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; letter-spacing: .1em; color: var(--t3); }
  .db-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(28px, 6.2vw, 46px); font-weight: 800; color: var(--t1); word-break: keep-all; animation: gk-pop .3s ease-out; }
  .db-staked-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--streak); border: 1px solid color-mix(in srgb, var(--streak) 50%, var(--bd)); background: color-mix(in srgb, var(--streak) 12%, transparent); border-radius: 999px; padding: 4px 11px; }

  .db-decide { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .db-decide-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); text-align: center; }
  .db-decide-btns { display: grid; grid-template-columns: 1fr; gap: 10px; width: 100%; }
  @media (min-width: 480px) { .db-decide-btns { grid-template-columns: 1fr 1fr; } }
  .db-choice { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 62px; padding: 10px 16px; }
  .db-choice-main { font-size: 15.5px; font-weight: 800; }
  .db-choice-sub { font-size: 11.5px; font-weight: 600; opacity: .82; display: inline-flex; align-items: center; gap: 5px; }
  /* .gk-kbd 는 색을 정하지 않아 상속받는다 — primary 버튼 위(--ti, 밝은색)에서는 배경(--bg)과
     같은 밝기라 사라진다. 칩 안에서는 본문색으로 고정. */
  .db-choice-sub .gk-kbd { color: var(--t1); }
  .db-choice--stake { border-color: color-mix(in srgb, var(--streak) 55%, var(--bd)); color: var(--t1); background: color-mix(in srgb, var(--streak) 10%, var(--bg)); }
  .db-choice--stake:hover { border-color: var(--streak); }
  .db-choice--stake:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--streak) 32%, transparent); }
  .db-choice[aria-disabled="true"] { opacity: .5; cursor: default; }
  .db-choice[aria-disabled="true"]:hover { border-color: var(--bd); }
  .gk-root .db-choice:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }

  .db-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
  /* 홀수 개(5지선다)면 마지막 타일이 한 칸 비우고 서지 않게 두 칸을 채운다. */
  .db-tiles > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  .gk-root .db-tile { justify-content: flex-start; gap: 10px; min-height: 62px; padding: 12px 14px; font-size: clamp(15px, 3.4vw, 21px); }
  .db-tile-key { flex: none; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-family: var(--font-display, system-ui); font-size: 11px; font-weight: 800; color: var(--t3); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg2) 70%, transparent); }
  .db-tile-en { flex: 1; min-width: 0; overflow-wrap: anywhere; }

  .db-reveal { width: 100%; padding: 12px 15px; border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 78%, transparent); display: flex; flex-direction: column; gap: 5px; text-align: left; animation: gk-pop .26s ease-out; }
  .db-reveal-head { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
  .db-reveal-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 19px; font-weight: 800; color: var(--t1); }
  .db-reveal-pron { font-size: 12.5px; color: var(--t3); }
  .db-reveal-pos { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; color: var(--t3); border: 1px solid var(--bd); border-radius: 5px; padding: 1px 5px; }
  .db-reveal-ko { font-size: 14.5px; font-weight: 700; color: var(--t2); }
  .db-reveal-ex { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; line-height: 1.6; color: var(--t3); }
  .db-reveal-mine { font-size: 12.5px; color: var(--t3); border-top: 1px dashed var(--bd); padding-top: 6px; margin-top: 2px; }
  .db-reveal-mine b { color: var(--t2); }
  .db-reveal-near { color: var(--streak); font-weight: 700; }

  .db-hud-streak { font-size: 13px; font-weight: 800; color: var(--streak); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .db-gain-layer { height: 0; overflow: visible; pointer-events: none; }
  .db-gain { position: fixed; left: 50%; top: 46%; transform: translateX(-50%); font-family: var(--font-display, system-ui); font-size: 17px; font-weight: 800; pointer-events: none; z-index: 3; animation: gk-gain 1.05s ease-out forwards; white-space: nowrap; text-shadow: 0 1px 10px color-mix(in srgb, var(--bg) 80%, transparent); }
  .db-gain--good { color: var(--success); }
  .db-gain--bad { color: var(--error); }

  .db-miss { display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .db-miss-title { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); }
  .db-miss-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; max-height: 30vh; overflow-y: auto; }
  .db-miss-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; min-height: 44px; padding: 7px 10px; border-radius: var(--r-md, 10px); background: color-mix(in srgb, var(--bg2) 70%, transparent); border: 1px solid var(--bd); }
  .db-miss-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 15px; font-weight: 800; color: var(--t1); }
  .db-miss-ko { font-size: 13px; color: var(--t2); font-weight: 700; }
  .db-miss-pron { font-size: 11.5px; color: var(--t4); }
  .db-miss-ex { flex-basis: 100%; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 12px; color: var(--t3); line-height: 1.5; }

  /* 결과 화면 — 세로로 긴 구성(오답 복습 카드 + 캘린더)이라 작은 화면에서 스크롤을 허용한다. */
  .db-root .gk-done { overflow-y: auto; justify-content: center; gap: 26px; }
  /* stats 3번째 칸은 항상 이모지 결과 그리드(ResultView 의 stats 배열 순서 고정).
     기본 num 크기(최대 38px)로는 10칸이 가로를 터뜨린다. */
  .db-root .gk-done-stat:nth-child(3) .gk-done-num { font-size: clamp(15px, 3.8vw, 22px); letter-spacing: 2px; line-height: 1.3; }

  .db-foot { display: flex; flex-direction: column; align-items: center; gap: 9px; }
  .db-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: center; font-size: 11.5px; font-weight: 700; color: var(--t3); }
  .db-legend-item { display: inline-flex; align-items: center; gap: 4px; }
  .db-foot-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .db-next { font-size: 12px; font-weight: 800; color: var(--t3); font-variant-numeric: tabular-nums; }
  .db-foot-note { margin: 0; font-size: 11.5px; color: var(--t4); text-align: center; }

  @media (max-width: 400px) {
    .db-pip { width: 21px; height: 18px; }
    .db-clock { padding-top: 8px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .db-meaning, .db-pip--now, .db-reveal { animation: none; }
    /* 부유 텍스트는 모션 대신 정지 표기 — showGain 의 타이머가 1.15초 뒤 걷어낸다. */
    .db-gain { animation: none; opacity: 1; }
  }
`;
