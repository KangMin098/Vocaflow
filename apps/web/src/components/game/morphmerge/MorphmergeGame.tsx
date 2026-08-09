// apps/web/src/components/game/morphmerge/MorphmergeGame.tsx
// Morphmerge (형태 용광로) — 뜻을 듣고 그 낱말의 형태를 전부 찾아 용광로에 합친다.
//
// v07.9 전면 재설계. 이전 버전의 네 가지 구조적 결함을 걷어냈다.
//   1) 부분 선택이 "(2/5)" 로 **같은 어족임 + 총 형태 수**를 공짜로 알려줬다 →
//      무위험 브루트포스가 지배 전략이었다. 이제 모든 제출이 어족을 소모하고
//      시간·콤보를 실제로 태운다. 탐색 오라클 0.
//   2) 인출이 0 이었다 — "같은 접두 문자열 찾기"가 핵심 동사였고 한국어 뜻은 보상으로만
//      나왔다. 이제 **한국어 뜻이 문제**고 영어 형태가 답이다(뜻→형태 인출).
//      보드에는 한국어가 한 글자도 없고, 정답 공개는 제출 이후에만 일어난다.
//   3) 90초 내내 보드 크기·방해·규칙이 상수였다 → 판이 커지고(9→15), 방해가 대상과
//      닮아가고(접두·접미 유사도 편향), 5낱말째부터 **원형이 보드에서 사라진다**.
//      원형이 없으면 접두 스캔이 통하지 않는다 — 그 지점이 이 게임의 클라이맥스다.
//   4) wordPool 에 굴절형이 4개 미만이면 통째로 내장 뱅크로 갈아탔다 → 사용자
//      vocabularies 와 무관한 판이 되어 learning_records 가 0 건이었다. 이제 스코프
//      어족은 항상 쓰고(2배 가중), 굴절형 없는 스코프 단어도 방해 타일로 판에 올린다.
//
// 인출 규칙 준수 요약
//   · 제출 전 화면: 한국어 뜻 1개(=문제) + 영어 형태 타일들. 어느 타일이 답인지 특정할
//     정보는 없다. 형태 수(N)는 문제 사양이지 시도에 대한 피드백이 아니다.
//   · 부분 합치기는 "탐색"이 아니라 **비용을 치른 안전 선택**이다 — 어족을 소모하고
//     배수가 오르지 않는다. 다시 찔러볼 수 없다.
//   · 문맥(예문) 힌트로 산 정답은 onCorrect 로 올리지 않는다.
//   · 오답 귀속은 언제나 '이번 라운드의 대상 낱말' 하나 — 임의 lemma 강등 없음.

'use client';

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  GameKitStyles,
  GameLoading,
  AmbientBackground,
  GameDone,
  GameMusic,
  NotEnoughWords,
  ParticleBurst,
  FeedbackIcon,
  TimerBar,
  IconSound,
  Kbd,
  useSfx,
  useCountUp,
  useCountdown,
  useCombo,
  useFlipGrid,
  usePersonalBest,
  DEFAULT_COMBO_TIERS,
  clamp,
  type Word,
} from '@/components/game/_shared/gamekit';

import {
  buildPool,
  buildRound,
  maskExample,
  refillBag,
  type BuiltPool,
  type Family,
  type Round,
} from './morph-bank';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

/** 기본 제한 시간. 가산은 킷이 총량의 75% 로 상한 → 최장 ≈ 2분 55초. */
const TOTAL_MS = 100_000;
const WARN_MS = 15_000;
/** 마지막 구간 — 모든 획득 ×1.25. 시계가 곧 판돈이 되는 구간. */
const RUSH_MS = 25_000;

const PTS_TILE = 40;
const PTS_TILE_PARTIAL = 22;
const PTS_COMPLETE = 60;
const PTS_PER_EXTRA_FORM = 25;
const RUSH_MULT = 1.25;

const T_FULL_BASE = 2_000;
const T_FULL_PER_FORM = 400;
const T_TIER_UP = 3_000;
const T_WRONG = 4_000;
const T_PASS = 3_000;
const T_HINT = 1_500;

const HOLD_MS: Record<VerdictKind, number> = {
  full: 1_050,
  partial: 1_750,
  wrong: 2_250,
  pass: 1_950,
};

type Phase = 'playing' | 'reveal' | 'done';
type VerdictKind = 'full' | 'partial' | 'wrong' | 'pass';
type Mark = 'on' | 'correct' | 'wrong' | 'near' | 'merge' | 'dim';

interface Verdict {
  seq: number;
  kind: VerdictKind;
  icon: 'correct' | 'wrong' | 'near';
  main: string;
  gain: number;
  fam: Family;
  answer: string[];
  picked: string[];
  merged: string[];
  tiles: string[];
  dropped: string | null;
}

interface MissedEntry {
  key: string;
  lemma: string;
  ko: string;
  forms: string[];
}

const EMPTY_KEYS: readonly string[] = [];

function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}
function fmtMult(m: number): string {
  return m % 1 === 0 ? `×${m}` : `×${m.toFixed(1)}`;
}
function fmtSec(ms: number): string {
  return (ms / 1000).toFixed(1).replace(/\.0$/, '');
}

// ─── 보드 (memo — 카운트다운이 매 프레임 부모를 다시 그려도 여기는 멈춰 있다) ──
const Board = memo(function Board({
  tiles,
  sel,
  marks,
  locked,
  onToggle,
  tileRef,
}: {
  tiles: string[];
  sel: string[];
  marks: Record<string, Mark> | null;
  locked: boolean;
  onToggle: (form: string) => void;
  tileRef: (form: string) => (el: HTMLButtonElement | null) => void;
}) {
  return (
    <div className="mm-board" role="group" aria-label="형태 타일">
      {tiles.map((form, i) => {
        const mark: Mark | undefined = marks
          ? marks[form]
          : sel.includes(form)
            ? 'on'
            : undefined;
        const showIcon = mark === 'correct' || mark === 'wrong' || mark === 'near';
        return (
          <button
            key={form}
            ref={tileRef(form)}
            type="button"
            className={`mm-tile${mark ? ` mm-tile--${mark}` : ''}`}
            onClick={() => onToggle(form)}
            aria-pressed={marks ? undefined : sel.includes(form)}
            aria-disabled={locked ? true : undefined}
          >
            {i < 9 && (
              <span className="mm-idx" aria-hidden="true">
                {i + 1}
              </span>
            )}
            <span className="mm-form">{form}</span>
            {mark === 'on' && (
              <span className="mm-mark mm-mark--on" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5l3.2 3.2L13 5" />
                </svg>
              </span>
            )}
            {showIcon && (
              <span className={`mm-mark mm-mark--${mark}`}>
                <FeedbackIcon kind={mark === 'near' ? 'near' : mark === 'correct' ? 'correct' : 'wrong'} size={11} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

export function MorphmergeGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const { correct: sfxCorrect, wrong: sfxWrong, nearMiss, click, coin, fanfare, tone, muted, setMuted } = useSfx();

  const pool = useMemo<BuiltPool>(() => buildPool(wordPool), [wordPool]);
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const [round, setRound] = useState<Round | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [phase, setPhase] = useState<Phase>('playing');
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [gems, setGems] = useState<string[]>([]);
  const [missed, setMissed] = useState<MissedEntry[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [gainFx, setGainFx] = useState<{ seq: number; text: string } | null>(null);
  const [timeFx, setTimeFx] = useState<{ seq: number; text: string; bad: boolean } | null>(null);
  const [burstSeq, setBurstSeq] = useState(0);
  const [bestInfo, setBestInfo] = useState<{ improved: boolean; prev: number | null } | null>(null);

  const shownScore = useCountUp(score);
  const pb = usePersonalBest('morphmerge');

  const roundRef = useRef<Round | null>(null);
  roundRef.current = round;
  const selRef = useRef<string[]>(sel);
  selRef.current = sel;
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const hintRef = useRef(false);
  hintRef.current = hintUsed;
  const solvedRef = useRef(0);
  const bagRef = useRef<Family[]>([]);
  const prevLemmaRef = useRef<string | null>(null);
  const roundIdRef = useRef(0);
  const fxRef = useRef(0);
  const rushRef = useRef(false);

  const showTime = useCallback((text: string, bad: boolean) => {
    fxRef.current += 1;
    setTimeFx({ seq: fxRef.current, text, bad });
  }, []);

  // ── 시계 ────────────────────────────────────────────────────────────────
  // reveal 동안은 멈춘다 — 정답을 읽는 시간까지 벌로 가져가지 않는다(Empathetic).
  const onEnd = useCallback(() => {
    setPhase('done');
    fanfare();
  }, [fanfare]);
  const onWarn = useCallback(() => {
    tone(300, 0.14, 'triangle', 0.045);
  }, [tone]);

  const cd = useCountdown({
    totalMs: TOTAL_MS,
    running: phase === 'playing',
    onEnd,
    warnAtMs: WARN_MS,
    onWarn,
  });
  const { extend, drain, reset: resetClock } = cd;

  const rush = phase !== 'done' && cd.remainMs > 0 && cd.remainMs <= RUSH_MS;
  rushRef.current = rush;

  // ── 콤보 ────────────────────────────────────────────────────────────────
  // 티어 승급은 hit() 안에서 동기 호출된다 — 시간 가산은 여기서 하되, 표시는
  // 같은 프레임의 정답 가산과 합쳐서 한 번만 띄운다(문구가 서로를 덮어쓰지 않게).
  const pendingTierRef = useRef<string | null>(null);
  const combo = useCombo({
    onTierUp: (tier) => {
      extend(T_TIER_UP);
      pendingTierRef.current = tier.label ?? fmtMult(tier.mult);
      coin();
    },
    onBreak: () => {
      tone(190, 0.16, 'sine', 0.04);
    },
  });
  const { hit: comboHit, miss: comboMiss, reset: comboReset } = combo;

  // ── 라운드 ──────────────────────────────────────────────────────────────
  const nextRound = useCallback(() => {
    const p = poolRef.current;
    if (p.families.length === 0) return;
    if (bagRef.current.length === 0) bagRef.current = refillBag(p.families, prevLemmaRef.current);
    const fam = bagRef.current.shift();
    if (!fam) return;
    prevLemmaRef.current = fam.lemma;
    roundIdRef.current += 1;
    const r = buildRound(p, fam, solvedRef.current, roundIdRef.current);
    setRound(r);
    setSel([]);
    setVerdict(null);
    setHintUsed(false);
    setHintText(null);
    setPhase('playing');
    setAnnounce(`${fam.ko} · ${r.answer.length}형태${r.dropped ? ' · 원형 제외' : ''}`);
  }, []);

  // 마운트 · 자료 교체 시 판 구성
  useEffect(() => {
    bagRef.current = [];
    prevLemmaRef.current = null;
    roundIdRef.current = 0;
    solvedRef.current = 0;
    nextRound();
  }, [pool, nextRound]);

  const newGame = useCallback(() => {
    solvedRef.current = 0;
    bagRef.current = [];
    prevLemmaRef.current = null;
    roundIdRef.current = 0;
    setScore(0);
    setSolved(0);
    setGems([]);
    setMissed([]);
    setBestInfo(null);
    setGainFx(null);
    setTimeFx(null);
    comboReset();
    resetClock();
    nextRound();
  }, [comboReset, resetClock, nextRound]);

  // ── 선택 ────────────────────────────────────────────────────────────────
  const toggle = useCallback(
    (form: string) => {
      if (phaseRef.current !== 'playing') return;
      const r = roundRef.current;
      if (!r || !r.tiles.includes(form)) return;
      const cur = selRef.current;
      if (cur.includes(form)) {
        // ref 를 즉시 갱신한다 — 같은 tick 안의 연속 입력(더블탭·키 리핏)이
        // 렌더 전 낡은 selRef 를 읽고 서로를 덮어쓰는 것을 막는다.
        selRef.current = cur.filter((f) => f !== form);
        setSel(selRef.current);
        click();
        return;
      }
      if (cur.length >= r.answer.length) {
        setAnnounce(`${r.answer.length}개까지 고를 수 있어요`);
        tone(240, 0.06, 'sine', 0.03);
        return;
      }
      selRef.current = [...cur, form];
      setSel(selRef.current);
      click();
    },
    [click, tone],
  );

  const clearSel = useCallback(() => {
    if (phaseRef.current !== 'playing' || selRef.current.length === 0) return;
    selRef.current = [];
    setSel(selRef.current);
    click();
  }, [click]);

  const undoSel = useCallback(() => {
    if (phaseRef.current !== 'playing' || selRef.current.length === 0) return;
    selRef.current = selRef.current.slice(0, -1);
    setSel(selRef.current);
    click();
  }, [click]);

  // ── 문맥 힌트 ───────────────────────────────────────────────────────────
  const doHint = useCallback(() => {
    if (phaseRef.current !== 'playing' || hintRef.current) return;
    const r = roundRef.current;
    const ex = r?.fam.example;
    if (!r || !ex) return;
    hintRef.current = true;
    setHintUsed(true);
    setHintText(maskExample(ex, r.fam));
    drain(T_HINT);
    showTime(`−${fmtSec(T_HINT)}초`, true);
    click();
    setAnnounce('문맥을 열었어요 — 이번 낱말은 점수 절반이에요');
  }, [drain, showTime, click]);

  // ── 제출 ────────────────────────────────────────────────────────────────
  const resolve = useCallback(
    (mode: 'merge' | 'pass') => {
      if (phaseRef.current !== 'playing') return;
      const r = roundRef.current;
      if (!r) return;
      const picked = mode === 'pass' ? [] : selRef.current;
      if (mode === 'merge' && picked.length === 0) return;
      // 같은 tick 의 중복 제출(Enter + 클릭) 차단 — 렌더를 기다리지 않고 즉시 잠근다.
      phaseRef.current = 'reveal';

      const answerSet = new Set(r.answer);
      const good = picked.filter((f) => answerSet.has(f));
      const bad = picked.filter((f) => !answerSet.has(f));
      const hinted = hintRef.current;
      const rushMul = rushRef.current ? RUSH_MULT : 1;
      const hintMul = hinted ? 0.5 : 1;

      let kind: VerdictKind;
      if (mode === 'pass') kind = 'pass';
      else if (bad.length > 0) kind = 'wrong';
      else if (good.length === r.answer.length) kind = 'full';
      else kind = 'partial';

      let gain = 0;
      let merged: string[] = [];
      let icon: Verdict['icon'] = 'wrong';
      let main = '';

      if (kind === 'full') {
        const c = comboHit();
        const mult = multFor(c);
        const base =
          good.length * PTS_TILE + PTS_COMPLETE + PTS_PER_EXTRA_FORM * Math.max(0, r.answer.length - 2);
        gain = Math.round(base * mult * rushMul * hintMul);
        merged = good;
        icon = 'correct';
        main = `합쳐졌어요 · ${fmtMult(mult)}${rushMul > 1 ? ' · 러시' : ''}`;
        const addMs = T_FULL_BASE + T_FULL_PER_FORM * Math.max(0, r.answer.length - 2);
        extend(addMs);
        const tierLabel = pendingTierRef.current;
        pendingTierRef.current = null;
        showTime(
          tierLabel ? `+${fmtSec(addMs + T_TIER_UP)}초 · ${tierLabel}` : `+${fmtSec(addMs)}초`,
          false,
        );
        sfxCorrect(c, c % 3 === 0);
        setBurstSeq((n) => n + 1);
        solvedRef.current += 1;
        setSolved((s) => s + 1);
        setGems((g) => [...g, r.fam.lemma]);
        if (!hinted) onCorrect?.(r.fam.word);
      } else if (kind === 'partial') {
        gain = Math.round(good.length * PTS_TILE_PARTIAL * rushMul * hintMul);
        merged = good;
        icon = 'near';
        main = `부분 합치기 · ${good.length}/${r.answer.length}형태 · 배수는 그대로`;
        nearMiss();
        setBurstSeq((n) => n + 1);
        // 뜻→낱말 인출 자체는 성공한 절반 이상의 시도만 FSRS 에 올린다.
        if (!hinted && good.length >= Math.ceil(r.answer.length / 2)) onCorrect?.(r.fam.word);
        setMissed((m) => [...m, { key: `${r.id}`, lemma: r.fam.lemma, ko: r.fam.ko, forms: r.fam.forms }]);
      } else if (kind === 'wrong') {
        comboMiss();
        icon = 'wrong';
        main = '다른 낱말의 형태가 섞였어요';
        drain(T_WRONG);
        showTime(`−${fmtSec(T_WRONG)}초`, true);
        sfxWrong();
        onWrong?.(r.fam.word);
        setMissed((m) => [...m, { key: `${r.id}`, lemma: r.fam.lemma, ko: r.fam.ko, forms: r.fam.forms }]);
      } else {
        comboMiss();
        icon = 'near';
        main = '넘겼어요 — 답을 열어 둘게요';
        drain(T_PASS);
        showTime(`−${fmtSec(T_PASS)}초`, true);
        tone(220, 0.13, 'sine', 0.04);
        onWrong?.(r.fam.word);
        setMissed((m) => [...m, { key: `${r.id}`, lemma: r.fam.lemma, ko: r.fam.ko, forms: r.fam.forms }]);
      }

      if (gain > 0) {
        setScore((s) => s + gain);
        fxRef.current += 1;
        setGainFx({ seq: fxRef.current, text: `+${gain}` });
      }

      fxRef.current += 1;
      setVerdict({
        seq: fxRef.current,
        kind,
        icon,
        main,
        gain,
        fam: r.fam,
        answer: r.answer,
        picked,
        merged,
        tiles: r.tiles,
        dropped: r.dropped,
      });
      setPhase('reveal');
      setAnnounce(`${main}. ${r.fam.lemma} · ${r.fam.ko} — ${r.fam.forms.join(', ')}`);
    },
    [comboHit, comboMiss, extend, drain, showTime, sfxCorrect, sfxWrong, nearMiss, tone, onCorrect, onWrong],
  );

  // 리빌 유지 시간 후 다음 라운드
  useEffect(() => {
    if (!verdict || phase !== 'reveal') return;
    const t = window.setTimeout(() => nextRound(), HOLD_MS[verdict.kind]);
    return () => window.clearTimeout(t);
  }, [verdict, phase, nextRound]);

  // 개인 최고 기록 제출 (완료 시 1회)
  const submitBest = useRef(pb.submit);
  submitBest.current = pb.submit;
  const scoreRef = useRef(0);
  scoreRef.current = score;
  useEffect(() => {
    if (phase !== 'done' || bestInfo) return;
    setBestInfo(submitBest.current(scoreRef.current));
  }, [phase, bestInfo]);

  // ── 키보드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current === 'done' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.key === 'Enter') {
        if (tag === 'BUTTON') return; // 포커스된 버튼의 기본 동작을 뺏지 않는다
        e.preventDefault();
        resolve('merge');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSel();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        undoSel();
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'ㅔ') {
        e.preventDefault();
        resolve('pass');
        return;
      }
      if (e.key === 'h' || e.key === 'H' || e.key === 'ㅗ') {
        e.preventDefault();
        doHint();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const r = roundRef.current;
        const idx = Number(e.key) - 1;
        if (r && idx < r.tiles.length) {
          e.preventDefault();
          toggle(r.tiles[idx]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resolve, clearSel, undoSel, doHint, toggle]);

  // ── 타일 ref (FLIP + 병합 비행) ────────────────────────────────────────
  const flip = useFlipGrid(round?.tiles ?? EMPTY_KEYS);
  const flipRef = flip.ref;
  const tileEls = useRef(new Map<string, HTMLButtonElement>());
  const tileRef = useCallback(
    (form: string) => (el: HTMLButtonElement | null) => {
      if (el) tileEls.current.set(form, el);
      else tileEls.current.delete(form);
      flipRef(form)(el);
    },
    [flipRef],
  );

  const crucibleRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!verdict || verdict.merged.length === 0) return;
    const box = crucibleRef.current?.getBoundingClientRect();
    if (!box) return;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height * 0.62;
    for (const form of verdict.merged) {
      const el = tileEls.current.get(form);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${Math.round(cx - (r.left + r.width / 2))}px`);
      el.style.setProperty('--my', `${Math.round(cy - (r.top + r.height / 2))}px`);
    }
  }, [verdict]);

  const marks = useMemo<Record<string, Mark> | null>(() => {
    if (!verdict) return null;
    const answerSet = new Set(verdict.answer);
    const pickedSet = new Set(verdict.picked);
    const mergedSet = new Set(verdict.merged);
    const m: Record<string, Mark> = {};
    for (const form of verdict.tiles) {
      if (mergedSet.has(form)) m[form] = 'merge';
      else if (answerSet.has(form)) m[form] = verdict.kind === 'partial' ? 'near' : 'correct';
      else if (pickedSet.has(form)) m[form] = 'wrong';
      else m[form] = 'dim';
    }
    return m;
  }, [verdict]);

  // ── 렌더 ────────────────────────────────────────────────────────────────
  if (pool.families.length < 2) return <NotEnoughWords need={8} onExit={onExit} />;

  if (phase === 'done') {
    const prev = bestInfo?.prev ?? null;
    const improved = bestInfo?.improved ?? false;
    const delta = prev != null && !improved ? prev - score : 0;
    const tail = missed.slice(-6);
    return (
      <div className="gk-root mm-root">
        <GameKitStyles />
        <AmbientBackground center="#EAF3EC" mid="#BEDFC6" edge="#1E3A2C" glow="rgba(130,224,168,.3)" glowAt="50% 30%" watermark="morphmerge" />
        <style dangerouslySetInnerHTML={{ __html: MM_CSS }} />
        <GameMusic gameId="morphmerge" />
        <GameDone
          mark="morphmerge"
          celebrate={improved}
          lead={solved >= 8 ? '형태를 잘 읽어냈어요' : '오늘 잘 마쳤어요'}
          badge={
            improved ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 개인 최고 갱신
              </>
            ) : solved >= 8 ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> {solved}낱말 완성
              </>
            ) : undefined
          }
          reveal={
            tail.length > 0 ? (
              <div className="mm-endreveal">
                <p className="mm-endreveal-head">놓친 낱말 — 다음 판을 위해 열어 둘게요</p>
                <ul className="mm-endreveal-list">
                  {tail.map((m) => (
                    <li key={m.key}>
                      <b>{m.lemma}</b>
                      <em>{m.ko}</em>
                      <span>{m.forms.join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: solved, label: '완성한 낱말' },
            { num: `🔥 ${combo.best}`, label: '최고 콤보' },
          ]}
          best={{ prev, now: score, label: '점수', improved }}
          restartHint={
            improved
              ? '이 기록이 다음 판의 기준이 돼요'
              : delta > 0
                ? `${delta.toLocaleString()}점 차이였어요 — 한 판 더?`
                : '5낱말째부터 원형이 사라져요 — 거기서부터가 진짜예요'
          }
          onRestart={newGame}
          onExit={() => onExit?.()}
        />
      </div>
    );
  }

  if (!round) {
    return <GameLoading message="용광로 예열 중…" />;
  }

  const need = round.answer.length;
  const full = sel.length === need;
  const locked = phase !== 'playing';
  const chaseFrac = pb.best && pb.best > 0 ? clamp(score / pb.best, 0, 1) : null;

  return (
    <div className="gk-root mm-root" data-rush={rush ? '1' : '0'}>
      <GameKitStyles />
      <AmbientBackground center="#EAF3EC" mid="#BEDFC6" edge="#1E3A2C" glow="rgba(130,224,168,.28)" glowAt="50% 24%" watermark="morphmerge" />
      <style dangerouslySetInnerHTML={{ __html: MM_CSS }} />
      <GameMusic gameId="morphmerge" />
      <div className="gk-sr" aria-live="polite">
        {announce}
      </div>

      <header className="mm-hud">
        <div className="mm-stat">
          <span className="mm-lbl">SCORE</span>
          <span key={score} className="mm-score gk-bump">
            {shownScore.toLocaleString()}
          </span>
        </div>

        <div className="mm-timerwrap">
          <TimerBar frac={cd.frac} warning={cd.warning} seconds={cd.remainSec} label="남은 시간" />
          {timeFx && (
            <span key={timeFx.seq} className="mm-tfx" data-bad={timeFx.bad ? '1' : '0'} aria-hidden="true">
              {timeFx.text}
            </span>
          )}
        </div>

        <div className="mm-stat mm-stat--r">
          <span className="mm-lbl">콤보</span>
          <span
            key={combo.combo}
            data-tier={clamp(combo.tierIndex, 0, 4)}
            className={`mm-combo ${combo.combo > 0 ? 'mm-combo--on gk-bump' : ''}`}
          >
            {combo.combo > 0 ? `🔥 ${combo.combo}` : '—'}
            {combo.mult > 1 && <span className="mm-mult">{fmtMult(combo.mult)}</span>}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className="gk-icon-btn"
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          aria-pressed={muted}
        >
          <IconSound muted={muted} />
        </button>
        {onExit && (
          <button type="button" onClick={onExit} className="gk-exit">
            나가기
          </button>
        )}
      </header>

      {chaseFrac !== null && (
        <div className="mm-chase" aria-hidden="true">
          <div className="mm-chase-fill" style={{ width: `${chaseFrac * 100}%` }} />
        </div>
      )}

      <section className="mm-crucible" ref={crucibleRef} aria-label="이번 낱말">
        <p className="mm-ask">이 뜻의 낱말을 찾아 형태를 합치세요</p>
        <p className="mm-ko">{round.fam.ko}</p>
        <div className="mm-chips">
          <span className="mm-chip mm-chip--n">{need}형태</span>
          {round.dropped && <span className="mm-chip mm-chip--drop">원형 제외</span>}
          {rush && <span className="mm-chip mm-chip--rush">러시 ×1.25</span>}
          <button
            type="button"
            className="mm-hintbtn"
            onClick={doHint}
            disabled={!round.fam.example || hintUsed || locked}
          >
            {hintUsed ? '문맥 열림' : round.fam.example ? `문맥 −${fmtSec(T_HINT)}초` : '문맥 없음'}
          </button>
        </div>
        {hintText && <p className="mm-hinttext">{hintText}</p>}
        {gems.length > 0 && (
          <div className="mm-rail" aria-label={`완성한 낱말 ${gems.length}개`}>
            {gems.slice(-8).map((g, i) => (
              <span className="mm-gem" key={`${g}-${i}`}>
                {g}
              </span>
            ))}
          </div>
        )}
        <span className="mm-burst" aria-hidden="true">
          {burstSeq > 0 && <ParticleBurst key={burstSeq} intensity={2} colors={['var(--success)', 'var(--combo)', 'var(--active)']} />}
        </span>
        {gainFx && (
          <span key={gainFx.seq} className="mm-gain" aria-hidden="true">
            {gainFx.text}
          </span>
        )}
      </section>

      <div className={`mm-verdict${verdict ? ` mm-verdict--${verdict.kind}` : ' mm-verdict--idle'}`}>
        {verdict ? (
          <>
            <span className="mm-verdict-ic">
              <FeedbackIcon kind={verdict.icon} size={15} />
            </span>
            <span className="mm-verdict-body">
              <b className="mm-verdict-main">{verdict.main}</b>
              <span className="mm-verdict-forms">
                <em>{verdict.fam.lemma}</em> · {verdict.fam.ko} — {verdict.fam.forms.join(' · ')}
                {verdict.dropped && <i> (원형 {verdict.dropped} 는 이번 판에서 뺐어요)</i>}
              </span>
            </span>
          </>
        ) : (
          <span className="mm-verdict-body">
            <span className="mm-verdict-forms">
              {round.id === 1
                ? '한 낱말의 형태를 전부 모으면 합쳐져요 — 예: go · goes · went · gone'
                : `전부 맞히면 배수가 오르고 시간이 늘어요 · 하나라도 틀리면 −${fmtSec(T_WRONG)}초`}
            </span>
          </span>
        )}
      </div>

      <Board tiles={round.tiles} sel={sel} marks={marks} locked={locked} onToggle={toggle} tileRef={tileRef} />

      <div className="mm-actions">
        <button
          type="button"
          className="gk-btn gk-btn--primary mm-merge"
          onClick={() => resolve('merge')}
          disabled={sel.length === 0 || locked}
        >
          {sel.length === 0 ? '합치기' : full ? `합치기 ${sel.length}/${need}` : `부분 합치기 ${sel.length}/${need}`}
        </button>
        <button type="button" className="gk-btn" onClick={() => resolve('pass')} disabled={locked}>
          넘기기 −{fmtSec(T_PASS)}초
        </button>
      </div>

      <p className="mm-note">
        {sel.length === 0
          ? '한국어 뜻에 맞는 낱말의 형태만 고르세요'
          : full
            ? `완성 제출 · 맞으면 ${fmtMult(multFor(combo.combo + 1))} 배수와 시간 보너스`
            : '지금 낸 것만 채점돼요 · 안전하지만 배수는 오르지 않아요'}
      </p>

      <p className="mm-keys">
        <Kbd>1</Kbd>–<Kbd>9</Kbd> 타일 · <Kbd>Enter</Kbd> 합치기 · <Kbd>Backspace</Kbd> 하나 취소 ·{' '}
        <Kbd>Esc</Kbd> 전체 해제 · <Kbd>P</Kbd> 넘기기 · <Kbd>H</Kbd> 문맥
      </p>
    </div>
  );
}

const MM_CSS = `
  .gk-root.mm-root { display: flex; flex-direction: column; }

  .mm-hud { display: grid; grid-template-columns: auto minmax(96px, 1fr) auto auto auto; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--bd); }
  .mm-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .mm-stat--r { align-items: flex-end; }
  .mm-lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; color: var(--t3); text-transform: uppercase; }
  .mm-score { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--combo); }
  .mm-timerwrap { position: relative; display: flex; align-items: center; min-width: 0; }
  .mm-timerwrap .gk-timer { flex: 1; min-width: 0; }
  .mm-tfx { position: absolute; left: 0; top: 100%; margin-top: 3px; font-size: 11.5px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--success); white-space: nowrap; animation: gk-gain .95s ease forwards; pointer-events: none; }
  .mm-tfx[data-bad="1"] { color: var(--error); }
  .mm-combo { display: inline-flex; align-items: baseline; gap: 5px; font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; }
  .mm-combo--on { color: var(--streak); }
  .mm-combo--on[data-tier="2"] { color: #E8622F; }
  .mm-combo--on[data-tier="3"], .mm-combo--on[data-tier="4"] { color: #E0322F; }
  .mm-mult { font-size: .78em; font-weight: 800; opacity: .9; }

  .mm-chase { height: 3px; background: color-mix(in srgb, var(--t1) 10%, transparent); }
  .mm-chase-fill { height: 100%; background: color-mix(in srgb, var(--combo) 70%, transparent); transition: width .45s var(--ease-settle); }

  .mm-crucible { position: relative; margin: 10px 12px 0; padding: 11px 14px 12px; border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 74%, transparent); backdrop-filter: blur(6px); display: flex; flex-direction: column; gap: 7px; transition: border-color .4s var(--ease-settle), box-shadow .4s var(--ease-settle); }
  .mm-root[data-rush="1"] .mm-crucible { border-color: color-mix(in srgb, var(--warning) 58%, var(--bd)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--warning) 22%, transparent), 0 10px 30px -18px color-mix(in srgb, var(--warning) 60%, transparent); }
  .mm-ask { margin: 0; font-size: 10.5px; font-weight: 700; letter-spacing: .07em; color: var(--t3); text-transform: uppercase; }
  .mm-ko { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(24px, 6.6vw, 34px); font-weight: 600; line-height: 1.14; color: var(--t1); word-break: keep-all; }
  .mm-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .mm-chip { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--bd); font-size: 11.5px; font-weight: 800; color: var(--t2); background: color-mix(in srgb, var(--bg) 60%, transparent); }
  .mm-chip--n { border-color: color-mix(in srgb, var(--combo) 45%, var(--bd)); color: var(--combo); }
  .mm-chip--drop { border-color: color-mix(in srgb, var(--active) 55%, var(--bd)); color: var(--active); }
  .mm-chip--rush { border-color: color-mix(in srgb, var(--warning) 55%, var(--bd)); color: var(--warning); }
  .mm-hintbtn { margin-left: auto; min-height: 44px; padding: 0 12px; border-radius: var(--r-md, 8px); border: 1px dashed var(--bd); background: transparent; color: var(--t3); font-family: var(--font-display, system-ui); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
  .mm-hintbtn:hover:not(:disabled) { color: var(--t1); border-color: var(--t3); background: color-mix(in srgb, var(--bg) 70%, transparent); }
  .mm-hintbtn:active:not(:disabled) { transform: scale(.97); }
  .mm-hintbtn:focus-visible { outline: none; border-style: solid; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .mm-hintbtn:disabled { opacity: .45; cursor: default; }
  .mm-hinttext { margin: 0; font-family: var(--font-english, ui-monospace, monospace); font-size: 13px; line-height: 1.55; color: var(--t2); border-left: 2px solid color-mix(in srgb, var(--active) 60%, transparent); padding-left: 9px; }

  .mm-rail { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 1px; scrollbar-width: none; }
  .mm-rail::-webkit-scrollbar { display: none; }
  .mm-gem { flex: none; padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--success) 42%, var(--bd)); background: var(--success-light); color: var(--success); font-family: var(--font-english, ui-monospace, monospace); font-size: 11px; font-weight: 800; animation: gk-pop .34s var(--ease-spring); }
  .mm-burst { position: absolute; left: 50%; top: 62%; width: 0; height: 0; }
  .mm-gain { position: absolute; right: 14px; top: 10px; font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--success); animation: gk-gain .95s ease forwards; pointer-events: none; }

  .mm-verdict { display: flex; align-items: flex-start; gap: 9px; margin: 8px 12px 0; padding: 9px 12px; min-height: 54px; border-radius: var(--r-md, 10px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 58%, transparent); transition: border-color .2s, background .2s; }
  .mm-verdict-ic { flex: none; margin-top: 2px; }
  .mm-verdict-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .mm-verdict-main { font-size: 13px; font-weight: 800; color: var(--t1); }
  .mm-verdict-forms { font-size: 12px; line-height: 1.5; color: var(--t3); overflow-wrap: anywhere; }
  .mm-verdict-forms em { font-family: var(--font-english, ui-monospace, monospace); font-style: normal; font-weight: 800; color: var(--t2); }
  .mm-verdict-forms i { font-style: normal; color: var(--t4); }
  .mm-verdict--full { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); background: var(--success-light); }
  .mm-verdict--full .mm-verdict-ic, .mm-verdict--full .mm-verdict-main { color: var(--success); }
  .mm-verdict--partial { border-color: color-mix(in srgb, var(--warning) 55%, var(--bd)); background: var(--warning-light); }
  .mm-verdict--partial .mm-verdict-ic, .mm-verdict--partial .mm-verdict-main { color: var(--warning); }
  .mm-verdict--pass { border-color: color-mix(in srgb, var(--active) 50%, var(--bd)); background: var(--active-light); }
  .mm-verdict--pass .mm-verdict-ic, .mm-verdict--pass .mm-verdict-main { color: var(--active); }
  .mm-verdict--wrong { border-color: color-mix(in srgb, var(--error) 55%, var(--bd)); background: var(--error-light); }
  .mm-verdict--wrong .mm-verdict-ic, .mm-verdict--wrong .mm-verdict-main { color: var(--error); }

  .mm-board { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: center; gap: 8px; padding: 12px; }
  .mm-tile { position: relative; overflow: visible; min-height: 52px; padding: 10px 14px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, ui-monospace, monospace); font-size: clamp(15px, 3.5vw, 20px); font-weight: 700; cursor: pointer; animation: mm-in .3s var(--ease-settle) both; transition: transform .2s var(--ease-spring), border-color .15s, background .15s, box-shadow .15s, opacity .2s; }
  .mm-tile:hover:not(.mm-tile--on):not([aria-disabled="true"]) { border-color: var(--t3); transform: translateY(-2px); }
  .mm-tile:active:not([aria-disabled="true"]) { transform: scale(.95); }
  .mm-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .mm-tile[aria-disabled="true"] { cursor: default; pointer-events: none; }
  .mm-tile--on { border-color: var(--combo); background: color-mix(in srgb, var(--combo) 12%, var(--bg)); color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 22%, transparent); }
  .mm-tile--correct { border-color: var(--success); background: var(--success-light); color: var(--success); }
  .mm-tile--wrong { border-color: var(--error); background: var(--error-light); color: var(--error); animation: gk-shake .34s ease-in-out; }
  .mm-tile--near { border-color: var(--warning); background: var(--warning-light); color: var(--warning); border-style: dashed; }
  .mm-tile--dim { opacity: .32; }
  .mm-tile--merge { animation: mm-merge .44s var(--ease-settle) forwards; z-index: 2; }
  .mm-form { display: inline-block; }
  .mm-idx { position: absolute; left: 7px; top: -7px; padding: 0 4px; border-radius: 5px; border: 1px solid var(--bd); background: var(--bg2); color: var(--t4); font-family: var(--font-display, system-ui); font-size: 9.5px; font-weight: 800; line-height: 13px; pointer-events: none; display: none; }
  @media (hover: hover) and (min-width: 720px) { .mm-idx { display: block; } }
  .mm-mark { position: absolute; right: -6px; top: -6px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; pointer-events: none; border: 1.5px solid var(--bg); }
  .mm-mark--on { background: var(--combo); color: var(--ti); }
  .mm-mark--correct { background: var(--success); color: var(--ti); }
  .mm-mark--wrong { background: var(--error); color: var(--ti); }
  .mm-mark--near { background: var(--warning); color: var(--ti); }

  .mm-actions { display: flex; gap: 8px; justify-content: center; padding: 8px 12px 0; flex-wrap: wrap; }
  .mm-merge { min-width: 176px; }
  /* 킷의 gk-btn/gk-exit/gk-icon-btn 은 focus-visible 규칙이 없다 — 4상태를 여기서 채운다.
     GameKitStyles 보다 뒤에 주입되고 명시도(0,2,0)도 높아 안전하게 덮인다. */
  .mm-root .gk-btn:focus-visible,
  .mm-root .gk-exit:focus-visible,
  .mm-root .gk-icon-btn:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .mm-root .gk-exit:active, .mm-root .gk-icon-btn:active { transform: scale(.96); }
  .mm-note { margin: 6px 0 0; padding: 0 16px; text-align: center; font-size: 12px; line-height: 1.4; color: var(--t3); min-height: 34px; }
  .mm-keys { margin: 0; padding: 0 16px calc(10px + env(safe-area-inset-bottom, 0px)); text-align: center; font-size: 11px; color: var(--t4); display: none; }
  @media (hover: hover) and (min-width: 720px) { .mm-keys { display: block; } }
  @media (max-width: 719px) { .mm-note { padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px)); } }

  .mm-endreveal { text-align: left; }
  .mm-endreveal-head { margin: 0 0 8px; font-size: 12.5px; font-weight: 800; color: var(--t2); }
  .mm-endreveal-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .mm-endreveal-list li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-size: 13px; }
  .mm-endreveal-list b { font-family: var(--font-english, ui-monospace, monospace); color: var(--t1); }
  .mm-endreveal-list em { font-family: var(--font-body, Georgia, serif); font-style: italic; color: var(--t2); }
  .mm-endreveal-list span { font-family: var(--font-english, ui-monospace, monospace); font-size: 11.5px; color: var(--t4); }

  @keyframes mm-in { from { opacity: 0; transform: translateY(6px) scale(.96); } to { opacity: 1; transform: none; } }
  @keyframes mm-merge {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(var(--mx, 0px), var(--my, -70px)) scale(.26); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .mm-tile, .mm-chase-fill, .mm-crucible { transition: none; }
    .mm-tile { animation: none; }
    .mm-tile--wrong { animation: gk-rm-fade .28s ease !important; }
    .mm-tile--merge { animation: gk-rm-fade .3s ease forwards !important; opacity: .18; }
    .mm-gem { animation: none; }
    .mm-gain, .mm-tfx { animation: gk-rm-fade 1.1s ease forwards; }
  }
`;
