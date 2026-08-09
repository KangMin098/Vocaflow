// apps/web/src/components/game/wordsmith-vigil/WordsmithVigilGame.tsx
// Wordsmith's Vigil — 타이핑 서바이버. 뜻만 든 안개 정령이 촛불로 내려온다. 조준한 정령의
// 영어 철자를 **기억해서** 칸에 채워 넣어야 흩어진다(철자는 화면에 없다 · 칸 수만 보인다).
//
// v07.9 재설계 — 이전 버전은 첫 글자 하나로 정답 철자를 통째로 띄우고 오타를 삼켜서
// "떠올려 쓰기"가 "보고 베끼기"였다(인출 규칙 1·4 위반). 지금은
//   · 제출 전 철자 노출 0 — 칸 수(길이)만 · 조준한 한 마리에 한해서만
//   · 부분 정답 오라클 0 — 오답 제출에 어떤 글자가 맞았는지 알려주지 않는다
//   · 오답 제출은 콤보 파괴 + 낙하 가속의 실비용이라 무작위 시도가 항상 손해
//   · 힌트(기름)로 산 철자는 onCorrect 가 아니라 onWrong 으로 기록(학습 신호 오염 차단)
// 그 위에 3밤 + 새벽 피날레(약 2분 44초 완결) · 서약(판돈) · 콤보 티어 보상을 얹었다.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  GameDone,
  NotEnoughWords,
  ParticleBurst,
  FeedbackIcon,
  TimerBar,
  IconSound,
  Kbd,
  GameMusic,
  useSfx,
  useCountUp,
  useCombo,
  usePersonalBest,
  DEFAULT_COMBO_TIERS,
  clamp,
  shuffle,
  type Word,
} from '@/components/game/_shared/gamekit';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점', pos: 'n' }, { en: 'reserved', ko: '내성적인', pos: 'adj' },
  { en: 'inclined', ko: '경향이 있는', pos: 'adj' }, { en: 'consequence', ko: '결과', pos: 'n' },
  { en: 'judgment', ko: '판단', pos: 'n' }, { en: 'ability', ko: '능력', pos: 'n' },
  { en: 'balance', ko: '균형', pos: 'n' }, { en: 'courage', ko: '용기', pos: 'n' },
  { en: 'develop', ko: '발전시키다', pos: 'v' }, { en: 'reduce', ko: '줄이다', pos: 'v' },
  { en: 'sudden', ko: '갑작스러운', pos: 'adj' }, { en: 'honest', ko: '정직한', pos: 'adj' },
  { en: 'generous', ko: '관대한', pos: 'adj' }, { en: 'vivid', ko: '생생한', pos: 'adj' },
  { en: 'endure', ko: '견디다', pos: 'v' }, { en: 'persuade', ko: '설득하다', pos: 'v' },
  { en: 'scarce', ko: '부족한', pos: 'adj' }, { en: 'genuine', ko: '진짜의', pos: 'adj' },
];

const START_HP = 3;
const MAX_ON_SCREEN = 5;      // Sweller — 동시 낙하 상한(밤3에서 화면이 무너지지 않게)
const START_OIL = 2;
const MAX_OIL = 3;
const VOW_SCORE_MULT = 3;
const VOW_SELF_SPEED = 1.4;   // 서약한 정령은 더 빨리 내려온다
const VOW_OTHERS_SPEED = 1.15;// 다른 정령도 함께 빨라진다 — 붐빌수록 위험한 판돈
const VOW_CD_OK = 5000;
const VOW_CD_FAIL = 12000;
const MAX_RESTORES = 2;       // 서약으로 되살릴 수 있는 촛불 총량
const HINT_SCORE_RATIO = 0.35;
const HINT_SHOW_MS = 1800;
const NEAR_PROG = 0.85;       // 이 아래에서 잡으면 "아슬아슬" 보너스
const URGENT_PROG = 0.7;
const WRONG_SURGE = 0.1;      // 오답 제출 1회당 낙하 진행 가속(실비용)

// ── 밤 스케줄 — 무한 생존을 버리고 시작·중반·끝이 있는 한 판으로. 총 164초. ──
type SegKind = 'wave' | 'breath' | 'dawn';
interface Segment {
  kind: SegKind; ms: number;
  spawnMs: number; endSpawnMs: number;
  fallMs: number; endFallMs: number;
  title: string; sub: string;
}
// 요구 처리량(spawn 간격)은 밤1 2.9초/마리 → 새벽 1.4초/마리로 조여진다. 낙하 시간
// (생각할 시간)은 10.8초 → 5.8초로 줄어든다. 동시 낙하 상한이 있어 죽음의 나선은 없다.
const SCHEDULE: Segment[] = [
  { kind: 'wave', ms: 36000, spawnMs: 3000, endSpawnMs: 2700, fallMs: 12000, endFallMs: 10800, title: '첫 번째 밤', sub: '' },
  { kind: 'breath', ms: 5000, spawnMs: 0, endSpawnMs: 0, fallMs: 10800, endFallMs: 10800, title: '두 번째 밤', sub: '안개가 짙어집니다' },
  { kind: 'wave', ms: 42000, spawnMs: 2400, endSpawnMs: 2100, fallMs: 10000, endFallMs: 8800, title: '두 번째 밤', sub: '' },
  { kind: 'breath', ms: 5000, spawnMs: 0, endSpawnMs: 0, fallMs: 8800, endFallMs: 8800, title: '세 번째 밤', sub: '정령이 서두릅니다' },
  { kind: 'wave', ms: 42000, spawnMs: 1900, endSpawnMs: 1700, fallMs: 8200, endFallMs: 7200, title: '세 번째 밤', sub: '' },
  { kind: 'breath', ms: 4000, spawnMs: 0, endSpawnMs: 0, fallMs: 7200, endFallMs: 7200, title: '새벽 직전', sub: '마지막 30초' },
  { kind: 'dawn', ms: 30000, spawnMs: 1500, endSpawnMs: 1300, fallMs: 6600, endFallMs: 5800, title: '새벽', sub: '' },
];
const NIGHT_MS = SCHEDULE.reduce((a, s) => a + s.ms, 0);

// 가로 슬롯 — 최소 간격을 넓게 잡고(라벨 겹침), 양끝을 22/78% 로 당겨(translateX(-50%)
// 클리핑) 390px 에서도 카드가 화면 밖으로 잘리지 않게 한다.
const SLOTS_X = [22, 50, 78, 34, 66, 28, 72, 44, 56];
const cleanWord = (en: string) => en.toLowerCase().replace(/[^a-z]/g, '');
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

/** 이미 쓰인 슬롯에서 가장 멀리 떨어진 자리를 고른다 — 동시 낙하 시 겹침 최소화. */
function freeSlot(taken: number[]): number {
  let bestX = SLOTS_X[0];
  let bestD = -1;
  for (const x of SLOTS_X) {
    const d = taken.length === 0 ? 100 : Math.min(...taken.map((t) => Math.abs(t - x)));
    if (d > bestD) { bestD = d; bestX = x; }
  }
  return bestX;
}

function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}

interface Wisp {
  id: number;
  w: Word;
  ce: string;
  prog: number;
  x: number;
  /** 이미 오답/힌트로 FSRS 실패를 기록했는가 — 한 마리당 1회만 적재. */
  logged: boolean;
  /** 기름으로 철자를 샀는가 — 격파해도 onCorrect 로 올리지 않는다. */
  hinted: boolean;
  /** 철자 노출 종료 시각(performance.now 기준). 0 이면 비노출. */
  revealUntil: number;
}
interface Burst { key: number; x: number; y: number; i: number; late: boolean }
interface Float { key: number; x: number; y: number; text: string; kind: 'gain' | 'warn' | 'calm' }
interface Reveal { key: number; ko: string; en: string }

export function WordsmithVigilGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const pb = usePersonalBest('wordsmith-vigil');

  const pool = useRef<Word[]>([]);
  if (pool.current.length === 0) {
    const seen = new Set<string>();
    pool.current = (wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL)
      .filter((w) => w.en && w.ko)
      .filter((w) => {
        const c = cleanWord(w.en);
        // 12글자 상한 — 칸이 두 줄로 접히면 카드가 커져 다른 정령을 가린다(공정성).
        return c.length >= 2 && c.length <= 12;
      })
      .filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }
  const enough = pool.current.length >= 5;

  // ── 상태 ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [won, setWon] = useState(false);
  const [wisps, setWisps] = useState<Wisp[]>([]);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [hp, setHp] = useState(START_HP);
  const [oil, setOil] = useState(START_OIL);
  const [score, setScore] = useState(0);
  const [dispelled, setDispelled] = useState(0);
  const [segIdx, setSegIdx] = useState(0);
  const [nightLeft, setNightLeft] = useState(NIGHT_MS);
  const [banner, setBanner] = useState<{ title: string; sub: string } | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [missed, setMissed] = useState<Word[]>([]);
  const [vowId, setVowId] = useState<number | null>(null);
  const [vowCd, setVowCd] = useState(0);
  const [reject, setReject] = useState(false);
  const [pending, setPending] = useState(false);
  const [imeHint, setImeHint] = useState(false);
  const [focused, setFocused] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [fieldH, setFieldH] = useState(420);
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; improved: boolean } | null>(null);

  const shownScore = useCountUp(score);

  // ── ref 미러 (rAF 루프·이벤트 핸들러가 최신값을 보게) ─────────────────────
  const wispsRef = useRef<Wisp[]>([]);
  const targetRef = useRef<number | null>(null);
  const typedRef = useRef('');
  const hpRef = useRef(START_HP);
  const oilRef = useRef(START_OIL);
  const scoreRef = useRef(0);
  const dispelledRef = useRef(0);
  const attemptsRef = useRef(0);
  const hitsRef = useRef(0);
  const missedRef = useRef<Word[]>([]);
  const restoresRef = useRef(0);
  const vowRef = useRef<number | null>(null);
  const vowReadyAtRef = useRef(0);
  const phaseRef = useRef<'intro' | 'playing' | 'done'>('intro');
  const bagRef = useRef<Word[]>([]);
  const idRef = useRef(0);
  const keyRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const segRef = useRef(0);
  const segTRef = useRef(0);
  const spawnAccRef = useRef(0);
  const nightRef = useRef(0);
  const slowIdRef = useRef<number | null>(null);
  const slowUntilRef = useRef(0);
  const goldUntilRef = useRef(0);
  const endedRef = useRef(false);
  const mounted = useRef(true);
  const timersRef = useRef<number[]>([]);
  const quillRef = useRef<HTMLInputElement | null>(null);
  const fieldElRef = useRef<HTMLDivElement | null>(null);
  /** 칸을 다 채운 뒤 확정까지의 짧은 유예(잉크가 마르는 동안) — 백스페이스로 물릴 수 있다. */
  const commitRef = useRef<number | null>(null);
  const lastSubmitRef = useRef(0);

  wispsRef.current = wisps;
  targetRef.current = targetId;
  typedRef.current = typed;
  phaseRef.current = phase;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      if (mounted.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  const cancelCommit = useCallback(() => {
    if (commitRef.current != null) {
      window.clearTimeout(commitRef.current);
      commitRef.current = null;
    }
    setPending(false);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (commitRef.current != null) {
      window.clearTimeout(commitRef.current);
      commitRef.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimationFrame(rafRef.current);
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (commitRef.current != null) window.clearTimeout(commitRef.current);
    };
  }, []);

  // 필드 높이 실측 — 낙하를 % 대신 transform(px) 으로 그려 매 프레임 레이아웃을 피한다.
  // 같은 이펙트에서 첫 포커스도 잡는다(포커스 실패 시 붓 바에 '탭하여 계속 쓰기'가 뜬다).
  useEffect(() => {
    if (phase !== 'playing') return;
    const el = fieldElRef.current;
    quillRef.current?.focus();
    setFocused(document.activeElement === quillRef.current);
    if (!el) return;
    const read = () => mounted.current && setFieldH(el.clientHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // ── 연출 헬퍼 ───────────────────────────────────────────────────────────
  const travel = Math.max(60, fieldH - 76 - fieldH * 0.1);
  const travelRef = useRef(travel);
  travelRef.current = travel;
  // rAF 루프가 붙잡은 클로저도 최신 높이를 쓰도록 ref 경유(리사이즈 후 좌표 어긋남 방지).
  const yOf = useCallback((prog: number) => 8 + prog * travelRef.current, []);

  const pushFloat = useCallback(
    (x: number, y: number, text: string, kind: Float['kind']) => {
      keyRef.current += 1;
      const key = keyRef.current;
      setFloats((f) => [...f.slice(-5), { key, x, y, text, kind }]);
      later(() => setFloats((f) => f.filter((v) => v.key !== key)), 1000);
    },
    [later],
  );

  const pushBurst = useCallback(
    (x: number, y: number, i: number, late: boolean) => {
      keyRef.current += 1;
      const key = keyRef.current;
      setBursts((b) => [...b.slice(-4), { key, x, y, i, late }]);
      later(() => setBursts((b) => b.filter((v) => v.key !== key)), 760);
    },
    [later],
  );

  const pushReveal = useCallback(
    (w: Word) => {
      keyRef.current += 1;
      const key = keyRef.current;
      setReveals((r) => [...r.slice(-1), { key, ko: w.ko, en: w.en }]);
      later(() => setReveals((r) => r.filter((v) => v.key !== key)), 2800);
    },
    [later],
  );

  // ── 콤보 — 끊기면 배수를 실제로 잃는다. 티어마다 생존 자원으로 환급. ────────
  const combo = useCombo({
    onTierUp: (tier, c) => {
      if (c >= 16) {
        goldUntilRef.current = performance.now() + 6000;
      } else if (c >= 10) {
        if (oilRef.current < MAX_OIL) {
          oilRef.current += 1;
          setOil(oilRef.current);
          sfx.coin();
          setAnnounce(`${tier.label ?? ''} · 기름을 한 병 얻었어요`);
        }
      } else if (c >= 6) {
        const low = [...wispsRef.current].sort((a, b) => b.prog - a.prog)[0];
        if (low) {
          slowIdRef.current = low.id;
          slowUntilRef.current = performance.now() + 2500;
          pushFloat(low.x, yOf(low.prog), '숨통', 'calm');
        }
        setAnnounce(`${tier.label ?? ''} · 가장 아래 정령이 느려집니다`);
      }
    },
    onBreak: (lost) => {
      if (lost >= 3) setAnnounce(`${lost}연속이 끊겼어요 — 천천히 다시`);
    },
  });
  const comboRef = useRef(0);
  comboRef.current = combo.combo;

  // ── 단어 가방 — 매 판 순서가 달라지고 pool 을 고르게 소진한다. ───────────
  const drawWord = useCallback((exclude: Set<string>): Word => {
    if (bagRef.current.length === 0) bagRef.current = shuffle(pool.current);
    const i = bagRef.current.findIndex((w) => !exclude.has(w.en));
    if (i === -1) return bagRef.current[0];
    return bagRef.current.splice(i, 1)[0];
  }, []);

  // ── 종료 ────────────────────────────────────────────────────────────────
  const endRun = useCallback(
    (victory: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      cancelAnimationFrame(rafRef.current);
      clearTimers();
      setWon(victory);
      const r = pb.submit(scoreRef.current);
      setBestInfo({ prev: r.prev, improved: r.improved });
      if (victory) sfx.fanfare();
      else sfx.wrong();
      setPhase('done');
    },
    [clearTimers, pb, sfx],
  );

  // ── 서약 실패 처리 ──────────────────────────────────────────────────────
  const breakVow = useCallback(
    (x: number, y: number) => {
      if (vowRef.current == null) return;
      vowRef.current = null;
      setVowId(null);
      vowReadyAtRef.current = performance.now() + VOW_CD_FAIL;
      combo.miss();
      pushFloat(x, y, '서약이 꺼졌어요', 'warn');
    },
    [combo, pushFloat],
  );

  // ── 격파 ────────────────────────────────────────────────────────────────
  const dispel = useCallback(
    (wp: Wisp) => {
      const x = wp.x;
      const y = yOf(wp.prog);
      const late = wp.prog > NEAR_PROG;
      const vowed = vowRef.current === wp.id;
      const hinted = wp.hinted;

      let mult = 1;
      let nc = comboRef.current;
      if (!hinted) {
        nc = combo.hit();
        mult = multFor(nc);
      }
      const base = 100 + wp.ce.length * 6 + Math.round((1 - wp.prog) * 30) + (late ? 40 : 0);
      const gain = Math.max(
        10,
        Math.round(base * mult * (vowed ? VOW_SCORE_MULT : 1) * (hinted ? HINT_SCORE_RATIO : 1)),
      );

      scoreRef.current += gain;
      setScore(scoreRef.current);
      dispelledRef.current += 1;
      setDispelled(dispelledRef.current);
      if (!hinted) {
        hitsRef.current += 1;
        onCorrect?.(wp.w);
      }

      if (vowed) {
        vowRef.current = null;
        setVowId(null);
        vowReadyAtRef.current = performance.now() + VOW_CD_OK;
        if (!hinted && hpRef.current < START_HP && restoresRef.current < MAX_RESTORES) {
          restoresRef.current += 1;
          hpRef.current += 1;
          setHp(hpRef.current);
          pushFloat(x, y, '촛불이 다시 붙었어요', 'calm');
          sfx.coin();
        }
      }

      const intensity = clamp(1 + Math.floor(nc / 5) + (late ? 1 : 0), 1, 3);
      pushBurst(x, y, intensity, late);
      pushFloat(x, y, late ? `아슬아슬 +${gain}` : `+${gain}`, 'gain');
      sfx.correct(nc, nc > 0 && nc % 5 === 0);
      setAnnounce(`격파 · ${wp.w.ko} ${wp.w.en}`);

      wispsRef.current = wispsRef.current.filter((v) => v.id !== wp.id);
      setWisps(wispsRef.current);
      setTyped('');
      typedRef.current = '';
      if (targetRef.current === wp.id) {
        const nx = [...wispsRef.current].sort((a, b) => b.prog - a.prog)[0];
        targetRef.current = nx ? nx.id : null;
        setTargetId(targetRef.current);
      }
    },
    [combo, onCorrect, pushBurst, pushFloat, sfx, yOf],
  );

  // ── 제출 (Enter 또는 칸을 다 채운 순간) ─────────────────────────────────
  const submit = useCallback(
    (guess: string) => {
      const id = targetRef.current;
      if (id == null) return;
      const wp = wispsRef.current.find((v) => v.id === id);
      if (!wp) return;
      attemptsRef.current += 1;
      lastSubmitRef.current = performance.now();
      if (guess === wp.ce) {
        dispel(wp);
        return;
      }
      // 오답 — 어떤 글자가 맞았는지는 절대 알려주지 않는다(무위험 탐색 차단).
      // 대신 실비용: 콤보 소멸 + 낙하 가속. 무작위 시도가 항상 손해가 되게.
      const x = wp.x;
      const y = yOf(wp.prog);
      if (vowRef.current === wp.id) breakVow(x, y);
      else combo.miss();
      if (!wp.logged) {
        wp.logged = true;
        onWrong?.(wp.w);
      }
      wp.prog = Math.min(0.97, wp.prog + WRONG_SURGE);
      wispsRef.current = wispsRef.current.map((v) => (v.id === wp.id ? { ...wp } : v));
      setWisps(wispsRef.current);
      setTyped('');
      typedRef.current = '';
      setReject(true);
      later(() => setReject(false), 260);
      sfx.nearMiss();
      pushFloat(x, y, '다시 — 천천히', 'warn');
      setAnnounce('아직이에요 — 다시 떠올려 보세요');
    },
    [breakVow, combo, dispel, later, onWrong, pushFloat, sfx, yOf],
  );

  // ── 입력 ────────────────────────────────────────────────────────────────
  const onType = useCallback(
    (raw: string) => {
      if (phaseRef.current !== 'playing') return;
      cancelCommit();
      if (HANGUL.test(raw)) {
        // 한/영 상태가 한글이면 지금까지는 화면이 아무 반응도 하지 않았다(고장으로 읽힘).
        setImeHint(true);
        later(() => setImeHint(false), 2600);
        setTyped('');
        typedRef.current = '';
        return;
      }
      const id = targetRef.current;
      const wp = id == null ? null : wispsRef.current.find((v) => v.id === id);
      if (!wp) {
        setTyped('');
        typedRef.current = '';
        return;
      }
      const v = cleanWord(raw).slice(0, wp.ce.length);
      setTyped(v);
      typedRef.current = v;
      if (v.length === wp.ce.length) {
        // 마지막 글자 오타를 바로 알아챈 경우를 위해 260ms 유예 — 그 사이 백스페이스면 물린다.
        // (Enter 를 누르면 기다리지 않고 즉시 확정.)
        setPending(true);
        commitRef.current = window.setTimeout(() => {
          commitRef.current = null;
          if (!mounted.current) return;
          setPending(false);
          if (typedRef.current === v) submit(v);
        }, 260);
      }
    },
    [cancelCommit, later, submit],
  );

  const cycleTarget = useCallback(
    (dir: 1 | -1) => {
      const order = [...wispsRef.current].sort((a, b) => b.prog - a.prog);
      if (order.length === 0) return;
      const cur = order.findIndex((v) => v.id === targetRef.current);
      const nx = order[(((cur === -1 ? 0 : cur + dir) % order.length) + order.length) % order.length];
      if (!nx || nx.id === targetRef.current) return;
      cancelCommit();
      targetRef.current = nx.id;
      setTargetId(nx.id);
      setTyped('');
      typedRef.current = '';
      sfx.click();
      setAnnounce(`조준 · ${nx.w.ko} · ${nx.ce.length}글자`);
    },
    [cancelCommit, sfx],
  );

  const pickTarget = useCallback(
    (id: number) => {
      if (targetRef.current === id) return;
      const wp = wispsRef.current.find((v) => v.id === id);
      if (!wp) return;
      cancelCommit();
      targetRef.current = id;
      setTargetId(id);
      setTyped('');
      typedRef.current = '';
      sfx.click();
      setAnnounce(`조준 · ${wp.w.ko} · ${wp.ce.length}글자`);
      quillRef.current?.focus();
    },
    [cancelCommit, sfx],
  );

  // ── 서약 — 이 게임의 유일한 자발적 판돈 ─────────────────────────────────
  const makeVow = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    if (vowRef.current != null) return;
    if (performance.now() < vowReadyAtRef.current) return;
    const id = targetRef.current;
    const wp = id == null ? null : wispsRef.current.find((v) => v.id === id);
    if (!wp || wp.hinted) return;
    vowRef.current = wp.id;
    setVowId(wp.id);
    sfx.coin();
    pushFloat(wp.x, yOf(wp.prog), `서약 ×${VOW_SCORE_MULT}`, 'gain');
    setAnnounce('서약 — 점수 세 배, 대신 모든 정령이 빨라집니다');
  }, [pushFloat, sfx, yOf]);

  // ── 기름 — 철자를 사는 대신 학습 기록은 정직하게 실패로 남는다 ───────────
  const useOil = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    if (oilRef.current <= 0) return;
    const id = targetRef.current;
    const wp = id == null ? null : wispsRef.current.find((v) => v.id === id);
    if (!wp || wp.hinted) return;
    oilRef.current -= 1;
    setOil(oilRef.current);
    wp.hinted = true;
    wp.revealUntil = performance.now() + HINT_SHOW_MS;
    if (!wp.logged) {
      wp.logged = true;
      onWrong?.(wp.w);
    }
    if (vowRef.current === wp.id) breakVow(wp.x, yOf(wp.prog));
    wispsRef.current = wispsRef.current.map((v) => (v.id === wp.id ? { ...wp } : v));
    setWisps(wispsRef.current);
    sfx.click();
    setAnnounce(`기름 · ${wp.w.en}`);
  }, [breakVow, onWrong, sfx, yOf]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        cycleTarget(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) { useOil(); return; }
        if (typedRef.current.length > 0) {
          cancelCommit();
          submit(typedRef.current);
          return;
        }
        // 방금 확정된 직후의 습관성 Enter 로 서약이 걸리지 않게 한다(의도하지 않은 판돈 금지).
        if (performance.now() - lastSubmitRef.current < 500) return;
        makeVow();
      }
    },
    [cancelCommit, cycleTarget, makeVow, submit, useOil],
  );

  // 어디를 눌러도·어떤 글자를 쳐도 입력이 되살아난다(포커스가 조용히 죽지 않게).
  useEffect(() => {
    if (phase !== 'playing') return;
    const onWinKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement === quillRef.current) return;
      if (/^[a-zA-Z]$/.test(e.key) || e.key === 'Enter' || e.key === 'Tab') {
        quillRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onWinKey);
    return () => window.removeEventListener('keydown', onWinKey);
  }, [phase]);

  // ── 메인 루프 ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !enough || endedRef.current) return;
    cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();

    const loop = (now: number) => {
      if (!mounted.current || endedRef.current || phaseRef.current !== 'playing') return;
      const dt = Math.min(64, now - lastRef.current);
      lastRef.current = now;

      // 세그먼트 진행
      segTRef.current += dt;
      nightRef.current = Math.min(NIGHT_MS, nightRef.current + dt);
      while (segRef.current < SCHEDULE.length && segTRef.current >= SCHEDULE[segRef.current].ms) {
        segTRef.current -= SCHEDULE[segRef.current].ms;
        segRef.current += 1;
        if (segRef.current >= SCHEDULE.length) break;
        const seg = SCHEDULE[segRef.current];
        setSegIdx(segRef.current);
        spawnAccRef.current = 0;
        if (seg.kind === 'breath') {
          setBanner({ title: `ㅡ ${seg.title} ㅡ`, sub: seg.sub });
          setAnnounce(`${seg.title} — ${seg.sub}`);
        } else {
          setBanner(null);
          if (seg.kind === 'dawn') setAnnounce('새벽 — 마지막 구간입니다');
        }
      }
      if (segRef.current >= SCHEDULE.length) {
        // 새벽이 오면 남은 정령은 스스로 흩어진다 — 촛불이 남아 있으면 승리.
        endRun(hpRef.current > 0);
        return;
      }

      const seg = SCHEDULE[segRef.current];
      const t = clamp(segTRef.current / seg.ms, 0, 1);
      const fallMs = seg.fallMs + (seg.endFallMs - seg.fallMs) * t;
      const spawnMs = seg.spawnMs + (seg.endSpawnMs - seg.spawnMs) * t;
      const vowActive = vowRef.current != null;

      const escaped: Wisp[] = [];
      const next: Wisp[] = [];
      for (const wp of wispsRef.current) {
        let speed = 1;
        if (vowActive) speed *= wp.id === vowRef.current ? VOW_SELF_SPEED : VOW_OTHERS_SPEED;
        if (slowIdRef.current === wp.id && now < slowUntilRef.current) speed *= 0.75;
        const prog = wp.prog + (dt / fallMs) * speed;
        if (prog >= 1) escaped.push(wp);
        else next.push({ ...wp, prog });
      }

      if (escaped.length > 0) {
        // 한 프레임에 둘이 동시에 닿을 수 있다 — 하나만 세면 촛불이 공짜로 남는다.
        for (const es of escaped) {
          hpRef.current -= 1;
          if (!es.logged) {
            es.logged = true;
            onWrong?.(es.w);
          }
          missedRef.current = [...missedRef.current, es.w];
          if (vowRef.current === es.id) breakVow(es.x, yOf(1));
          pushReveal(es.w);
          if (targetRef.current === es.id) {
            targetRef.current = null;
            setTargetId(null);
            setTyped('');
            typedRef.current = '';
          }
        }
        combo.miss();
        setHp(hpRef.current);
        setMissed(missedRef.current);
        sfx.wrong();
        const last = escaped[escaped.length - 1];
        setAnnounce(`촛불 하나가 꺼졌어요 · ${last.w.ko}는 ${last.w.en}`);
      }

      // 스폰
      if (seg.spawnMs > 0) {
        spawnAccRef.current += dt;
        if (spawnAccRef.current >= spawnMs && next.length < MAX_ON_SCREEN) {
          spawnAccRef.current = 0;
          const busy = new Set(next.map((v) => v.w.en));
          const w = drawWord(busy);
          idRef.current += 1;
          // 위쪽(방금 생성된 구간)에 있는 정령과만 겹치면 되므로 그 자리들만 피한다.
          const x = freeSlot(next.filter((v) => v.prog < 0.3).map((v) => v.x));
          next.push({ id: idRef.current, w, ce: cleanWord(w.en), prog: 0, x, logged: false, hinted: false, revealUntil: 0 });
        } else if (spawnAccRef.current >= spawnMs) {
          spawnAccRef.current = spawnMs * 0.6; // 만원이면 조금 뒤에 다시 시도
        }
      }

      wispsRef.current = next;
      setWisps(next);

      // 조준이 비었으면 가장 급한 정령으로 — 단, 조준 중일 땐 절대 뺏지 않는다.
      if (targetRef.current == null || !next.some((v) => v.id === targetRef.current)) {
        const nx = [...next].sort((a, b) => b.prog - a.prog)[0];
        if (nx) {
          targetRef.current = nx.id;
          setTargetId(nx.id);
          setTyped('');
          typedRef.current = '';
        } else if (targetRef.current != null) {
          targetRef.current = null;
          setTargetId(null);
        }
      }

      setNightLeft(NIGHT_MS - nightRef.current);
      const cd = Math.max(0, Math.ceil((vowReadyAtRef.current - now) / 1000));
      setVowCd((v) => (v === cd ? v : cd));

      if (hpRef.current <= 0) {
        endRun(false);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, enough]);

  // ── 시작 / 재시작 ───────────────────────────────────────────────────────
  const begin = useCallback(() => {
    clearTimers();
    endedRef.current = false;
    hpRef.current = START_HP;
    oilRef.current = START_OIL;
    scoreRef.current = 0;
    dispelledRef.current = 0;
    attemptsRef.current = 0;
    hitsRef.current = 0;
    missedRef.current = [];
    restoresRef.current = 0;
    vowRef.current = null;
    vowReadyAtRef.current = 0;
    wispsRef.current = [];
    targetRef.current = null;
    typedRef.current = '';
    idRef.current = 0;
    segRef.current = 0;
    segTRef.current = 0;
    spawnAccRef.current = 2400; // 첫 정령은 곧바로 — 빈 화면으로 시작하지 않게
    nightRef.current = 0;
    slowIdRef.current = null;
    slowUntilRef.current = 0;
    goldUntilRef.current = 0;
    bagRef.current = shuffle(pool.current);
    combo.reset();
    setWisps([]); setTargetId(null); setTyped(''); setHp(START_HP); setOil(START_OIL);
    setScore(0); setDispelled(0); setSegIdx(0); setNightLeft(NIGHT_MS); setBanner(null);
    setBursts([]); setFloats([]); setReveals([]); setMissed([]); setVowId(null); setVowCd(0);
    setReject(false); setPending(false); setImeHint(false); setBestInfo(null); setWon(false);
    lastSubmitRef.current = 0;
    setAnnounce('첫 번째 밤이 시작됩니다');
    setPhase('playing');
    window.setTimeout(() => quillRef.current?.focus(), 40);
  }, [clearTimers, combo]);

  // ── 파생 ────────────────────────────────────────────────────────────────
  const seg = SCHEDULE[Math.min(segIdx, SCHEDULE.length - 1)];
  const target = useMemo(() => wisps.find((v) => v.id === targetId) ?? null, [wisps, targetId]);
  const accuracy = attemptsRef.current > 0 ? Math.round((hitsRef.current / attemptsRef.current) * 100) : 100;
  const uniqueMissed = useMemo(() => {
    const seen = new Set<string>();
    return missed.filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [missed]);
  const nowTs = typeof performance === 'undefined' ? 0 : performance.now();
  const golden = nowTs < goldUntilRef.current;

  if (!enough) return <NotEnoughWords need={5} onExit={onExit} />;

  // ── 인트로 — 규칙을 30초 안에. 첫 제스처로 포커스·오디오도 함께 살아난다. ──
  if (phase === 'intro') {
    return (
      <div className="gk-root wv-root">
        <GameKitStyles />
        <AmbientBackground center="#F7ECD8" mid="#D8B888" edge="#3A2A1C" glow="rgba(255,196,120,.34)" glowAt="50% 30%" watermark="wordsmith-vigil" />
        <style dangerouslySetInnerHTML={{ __html: WV_CSS }} />
        <GameMusic gameId="wordsmith-vigil" />
        <main className="wv-intro">
          <h1 className="wv-intro-title">필경사의 밤</h1>
          <p className="wv-intro-lead">뜻만 든 안개 정령이 촛불로 내려옵니다. 철자는 어디에도 적혀 있지 않아요.</p>
          <ul className="wv-intro-list">
            <li><b>조준된 정령</b>의 영어 철자를 떠올려 칸을 채우면 흩어집니다. 칸을 다 채우면 곧바로 확정되는데, 그 찰나에 <Kbd>←</Kbd> 백스페이스로 되물릴 수 있어요.</li>
            <li><Kbd>Tab</Kbd> 조준 바꾸기 · 정령을 눌러도 됩니다. 조준을 바꾸면 쓰던 글자는 지워져요.</li>
            <li><Kbd>Enter</Kbd> <b>서약</b> — 점수 ×3, 촛불도 되살릴 수 있지만 <b>모든 정령이 빨라집니다</b>.</li>
            <li><Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> <b>기름</b> — 철자를 잠깐 비춥니다. 대신 점수는 3분의 1, 복습 기록엔 &lsquo;아직&rsquo;으로 남아요.</li>
          </ul>
          <p className="wv-intro-foot">세 밤과 새벽, 약 2분 45초. 촛불 하나라도 남기고 새벽을 맞으면 이깁니다.</p>
          <div className="wv-intro-act">
            <button type="button" className="gk-btn gk-btn--primary" onClick={begin}>촛불 켜기</button>
            {onExit && <button type="button" className="gk-btn" onClick={onExit}>나가기</button>}
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'done') {
    const badge = bestInfo?.improved
      ? <><FeedbackIcon kind="correct" /> 개인 최고 갱신</>
      : won && uniqueMissed.length === 0
        ? <><FeedbackIcon kind="correct" /> 한 마리도 놓치지 않았어요</>
        : won
          ? <><FeedbackIcon kind="correct" /> 새벽까지 버팀</>
          : null;
    return (
      <div className="gk-root wv-root">
        <GameKitStyles />
        <AmbientBackground
          center={won ? '#FFF6E4' : '#F0E4D2'} mid={won ? '#E7C58C' : '#C8A87E'} edge="#3A2A1C"
          glow={won ? 'rgba(255,214,150,.44)' : 'rgba(255,196,120,.26)'} glowAt="50% 30%" watermark="wordsmith-vigil"
        />
        <style dangerouslySetInnerHTML={{ __html: WV_CSS }} />
        <GameMusic gameId="wordsmith-vigil" />
        <GameDone
          lead={won ? '새벽까지 지켰어요' : '오늘 여기까지 — 잘 했어요'}
          celebrate={won}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: dispelled, label: '흩은 정령' },
            { num: combo.best, label: '최고 연속' },
            { num: `${accuracy}%`, label: '철자 정확도' },
          ]}
          best={{ prev: bestInfo?.prev ?? null, now: score, label: '점수', improved: bestInfo?.improved }}
          badge={badge}
          reveal={
            uniqueMissed.length > 0 ? (
              <div className="wv-missed">
                <p className="wv-missed-t">놓친 정령 — 이 철자만 챙겨 가요</p>
                <ul className="wv-missed-l">
                  {uniqueMissed.slice(0, 8).map((w) => (
                    <li key={w.en}><span className="wv-missed-ko">{w.ko}</span><span className="wv-missed-en">{w.en}</span></li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          restartHint={
            won
              ? '다음 밤엔 서약을 한 번 더 걸어 보세요 — 붐빌 때 거는 서약이 가장 값집니다.'
              : uniqueMissed.length > 0
                ? `아래쪽 정령부터 조준하면 촛불이 버팁니다. ${uniqueMissed[0].ko}(${uniqueMissed[0].en})부터 다시.`
                : '조준을 자주 바꾸기보다 한 마리를 끝까지 — 그게 더 빠릅니다.'
          }
          onRestart={begin}
          onExit={() => onExit?.()}
          mark="wordsmith-vigil"
        />
      </div>
    );
  }

  const vowReady = vowId == null && vowCd === 0 && target != null && !target.hinted;

  return (
    <div
      className={`gk-root wv-root ${reject ? 'wv-reject' : ''}`}
      data-seg={seg.kind}
      data-gold={golden ? '1' : '0'}
      onPointerDown={(e) => {
        // 어디를 눌러도 입력이 살아난다 — 단, 버튼을 누른 것이면 그 버튼이 우선.
        if ((e.target as HTMLElement).closest('button')) return;
        quillRef.current?.focus();
      }}
    >
      <GameKitStyles />
      <AmbientBackground
        center="#F7ECD8" mid="#D8B888" edge="#3A2A1C"
        glow={vowId != null ? 'rgba(255,140,60,.5)' : golden ? 'rgba(255,214,150,.5)' : 'rgba(255,196,120,.3)'}
        glowAt={vowId != null ? '50% 45%' : '50% 26%'}
        watermark="wordsmith-vigil"
      />
      {/* 배경 레이어 — gk-atmos 클래스를 함께 달아야 킷의 `> :not(.gk-atmos)` 규칙이
          이 두 장을 z-index:1 콘텐츠로 끌어올리지 않는다(그러면 화면을 덮는다). */}
      <div className="gk-atmos wv-ember" aria-hidden="true" data-on={vowId != null ? '1' : '0'} />
      <div className="gk-atmos wv-gold" aria-hidden="true" data-on={golden ? '1' : '0'} />
      <style dangerouslySetInnerHTML={{ __html: WV_CSS }} />
      <GameMusic gameId="wordsmith-vigil" />
      <div className="gk-sr" aria-live="polite">{announce}</div>

      <header className="wv-hud">
        <div className="wv-stat">
          <span className="wv-lbl">SCORE</span>
          <span key={score} className="wv-score gk-bump">{shownScore.toLocaleString()}</span>
        </div>
        <div className="wv-candles" role="img" aria-label={`남은 촛불 ${hp}개`}>
          {Array.from({ length: START_HP }).map((_, i) => (
            <span key={i} className={`wv-candle ${i < hp ? 'wv-candle--lit' : 'wv-candle--out'}`} aria-hidden="true">
              <svg viewBox="0 0 16 24" width="15" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 11h6v10H5z" /><path d="M8 11V7" />
                {i < hp
                  ? <path className="wv-flame" d="M8 2c2 2 2.4 3.8 0 5-2.4-1.2-2-3 0-5Z" fill="currentColor" stroke="none" />
                  : <path d="M6 4.5l4 3M10 4.5l-4 3" opacity=".8" />}
              </svg>
            </span>
          ))}
        </div>
        <div className="wv-stat wv-stat--r">
          <span className="wv-lbl">연속</span>
          <span
            key={combo.combo}
            data-tier={combo.tierIndex}
            className={`wv-combo ${combo.combo > 0 ? 'wv-combo--on gk-bump' : ''}`}
          >
            {combo.combo > 0 ? `🔥 ${combo.combo}` : '—'}
            {combo.mult > 1 && <span className="wv-mult">×{combo.mult % 1 === 0 ? combo.mult : combo.mult.toFixed(1)}</span>}
          </span>
        </div>
        <button
          type="button"
          className="gk-icon-btn"
          aria-label={sfx.muted ? '소리 켜기' : '소리 끄기'}
          aria-pressed={sfx.muted}
          onClick={() => sfx.setMuted((m) => !m)}
        >
          <IconSound muted={sfx.muted} />
        </button>
        {onExit && <button type="button" className="gk-exit wv-exit" onClick={onExit}>나가기</button>}
      </header>

      <div className="wv-sub">
        <span className="wv-phase" data-dawn={seg.kind === 'dawn' ? '1' : '0'}>{seg.title}</span>
        <TimerBar
          frac={nightLeft / NIGHT_MS}
          warning={seg.kind === 'dawn'}
          label="남은 밤"
          seconds={Math.ceil(nightLeft / 1000)}
        />
      </div>

      <div className="wv-field" ref={fieldElRef}>
        {wisps.map((wp) => {
          const isTarget = wp.id === targetId;
          const urgent = wp.prog > URGENT_PROG;
          const vowed = wp.id === vowId;
          const revealed = wp.revealUntil > nowTs;
          const slowed = slowIdRef.current === wp.id && nowTs < slowUntilRef.current;
          return (
            <button
              type="button"
              key={wp.id}
              tabIndex={-1}
              className={`wv-wisp ${isTarget ? 'wv-wisp--on' : ''} ${urgent ? 'wv-wisp--urgent' : ''} ${vowed ? 'wv-wisp--vow' : ''} ${slowed ? 'wv-wisp--slow' : ''}`}
              style={{ left: `${wp.x}%`, transform: `translate3d(-50%, ${yOf(wp.prog)}px, 0)` }}
              onPointerDown={(e) => { e.stopPropagation(); pickTarget(wp.id); }}
              aria-label={`${wp.w.ko} · ${wp.ce.length}글자${isTarget ? ' · 조준 중' : ''}${urgent ? ' · 위급' : ''}`}
            >
              <span className="wv-wisp-top">
                {urgent && <span className="wv-chev" aria-hidden="true">▼</span>}
                <span className="wv-wisp-ko">{wp.w.ko}</span>
                {isTarget && wp.w.pos && <span className="wv-pos">{wp.w.pos}</span>}
              </span>
              {isTarget && (
                <span className="wv-slots" aria-hidden="true" data-pending={pending ? '1' : '0'}>
                  {Array.from({ length: wp.ce.length }).map((_, i) => {
                    const ch = i < typed.length ? typed[i] : null;
                    const rv = revealed ? wp.ce[i] : null;
                    return (
                      <span key={i} className="wv-slot" data-on={ch ? '1' : '0'} data-rev={!ch && rv ? '1' : '0'}>
                        {ch ?? rv ?? '·'}
                      </span>
                    );
                  })}
                </span>
              )}
              {vowed && <span className="wv-vow-tag" aria-hidden="true">서약 ×{VOW_SCORE_MULT}</span>}
            </button>
          );
        })}

        {bursts.map((b) => (
          <span key={b.key} className="wv-fx" style={{ left: `${b.x}%`, top: `${b.y}px` }} aria-hidden="true">
            <span className="wv-ring" data-late={b.late ? '1' : '0'} />
            <ParticleBurst intensity={b.i} colors={b.late ? ['#E8862F', 'var(--error)', 'var(--streak)'] : undefined} />
          </span>
        ))}

        {floats.map((f) => (
          <span key={f.key} className="wv-float" data-kind={f.kind} style={{ left: `${f.x}%`, top: `${f.y}px` }} aria-hidden="true">
            {f.text}
          </span>
        ))}

        <div className="wv-hearth" aria-hidden="true" />

        {banner && (
          <div className="wv-banner" aria-hidden="true">
            <span className="wv-banner-t">{banner.title}</span>
            {banner.sub && <span className="wv-banner-s">{banner.sub}</span>}
          </div>
        )}
      </div>

      <div className="wv-belt">
        {reveals.map((r) => (
          <p key={r.key} className="wv-reveal">
            <FeedbackIcon kind="wrong" />
            <span className="wv-reveal-ko">{r.ko}</span>
            <span className="wv-reveal-en">{r.en}</span>
          </p>
        ))}
        {imeHint && (
          <p className="wv-ime" role="status">
            <FeedbackIcon kind="near" />
            한/영 키를 눌러 영문으로 입력해 주세요
          </p>
        )}
      </div>

      <div className={`wv-quillbar ${focused ? '' : 'wv-quillbar--blur'}`}>
        <span className="wv-quill-ic" aria-hidden="true">✒</span>
        <span className="wv-quill-wrap">
          <input
            ref={quillRef}
            className="wv-quill"
            value={typed}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={target ? `${target.w.ko} — 철자를 떠올려 쓰세요` : '정령을 기다리는 중…'}
            aria-label={target ? `${target.w.ko}의 영어 철자 ${target.ce.length}글자 입력` : '영단어 입력'}
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            enterKeyHint="send" inputMode="text"
          />
          {!focused && (
            <button type="button" className="wv-refocus" onClick={() => quillRef.current?.focus()}>
              탭하여 계속 쓰기
            </button>
          )}
        </span>
        <button
          type="button"
          className="wv-act wv-act--vow"
          onClick={makeVow}
          disabled={!vowReady}
          aria-label={vowId != null ? '서약 진행 중' : vowCd > 0 ? `서약 ${vowCd}초 뒤 가능` : '서약하기 — 점수 세 배, 모든 정령이 빨라집니다'}
        >
          <span className="wv-act-ic" aria-hidden="true">🜂</span>
          <span className="wv-act-t">{vowId != null ? '서약 중' : vowCd > 0 ? `${vowCd}s` : `서약 ×${VOW_SCORE_MULT}`}</span>
        </button>
        <button
          type="button"
          className="wv-act"
          onClick={useOil}
          disabled={oil <= 0 || !target || target.hinted}
          aria-label={`기름 ${oil}병 — 철자를 잠깐 비춥니다. 점수가 줄고 복습 기록엔 실패로 남아요`}
        >
          <span className="wv-act-ic" aria-hidden="true">🕯</span>
          <span className="wv-act-t">기름 {oil}</span>
        </button>
      </div>

      {segIdx === 0 && (
        <p className="wv-keys">
          <Kbd>Tab</Kbd> 조준 · <Kbd>Enter</Kbd> 서약 · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> 기름
        </p>
      )}
    </div>
  );
}

const WV_CSS = `
  .wv-root { display: flex; flex-direction: column; }

  /* 서약 중 화면 톤 — 판돈이 걸린 순간이 눈으로 보이게. */
  .wv-ember { opacity: 0; transition: opacity .5s ease;
    background: radial-gradient(64% 46% at 50% 52%, rgba(255,140,60,.34), transparent 72%); }
  .wv-ember[data-on="1"] { opacity: 1; }
  /* UNREAL(16연속) — 화면이 잠시 황금빛으로. 배수가 최고치라는 걸 숫자 밖에서도 안다. */
  .wv-gold { opacity: 0; transition: opacity .9s ease;
    background: radial-gradient(78% 58% at 50% 30%, rgba(255,214,150,.34), transparent 74%); }
  .wv-gold[data-on="1"] { opacity: 1; }
  [data-theme="dark"] .wv-ember, [data-theme="dark"] .wv-gold { opacity: 0; }
  [data-theme="dark"] .wv-ember[data-on="1"] { opacity: .7; }
  [data-theme="dark"] .wv-gold[data-on="1"] { opacity: .55; }

  /* 공용 킷 버튼의 4상태 보강(킷 자체는 다른 세션이 잡고 있어 여기서 국소 보강). */
  .wv-root .gk-exit:active, .wv-root .gk-icon-btn:active { transform: scale(.96); }
  .wv-root .gk-exit:focus-visible, .wv-root .gk-icon-btn:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .wv-root .gk-exit:disabled, .wv-root .gk-icon-btn:disabled { opacity: .45; cursor: default; }

  /* ── 인트로 ── */
  .wv-intro { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px)); text-align: center; }
  .wv-intro-title { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(26px, 6vw, 38px); font-weight: 500; color: var(--t1); }
  .wv-intro-lead { margin: 0; max-width: 34ch; font-size: 14.5px; line-height: 1.7; color: var(--t2); }
  .wv-intro-list { margin: 0; padding: 16px 18px; max-width: min(560px, 92vw); list-style: none; display: flex; flex-direction: column; gap: 10px; text-align: left; border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter: blur(4px); }
  .wv-intro-list li { font-size: 13.5px; line-height: 1.65; color: var(--t2); }
  .wv-intro-list b { color: var(--t1); }
  .wv-intro-foot { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; color: var(--t3); }
  .wv-intro-act { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }

  /* ── HUD ── */
  .wv-hud { display: grid; grid-template-columns: auto 1fr auto auto auto; align-items: center; gap: 10px; padding: 10px 14px 8px; border-bottom: 1px solid var(--bd); z-index: 2; }
  .wv-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .wv-stat--r { align-items: flex-end; }
  .wv-lbl { font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--t3); text-transform: uppercase; }
  .wv-score { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--combo); }
  .wv-candles { display: flex; gap: 6px; justify-self: center; }
  .wv-candle--lit { color: #E8862F; }
  .wv-candle--out { color: var(--t4); opacity: .55; }
  .wv-flame { animation: wv-flicker 1.6s ease-in-out infinite; transform-origin: 8px 4px; }
  .wv-combo { display: inline-flex; align-items: baseline; gap: 4px; font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; transition: font-size .2s ease; }
  .wv-combo--on { color: var(--streak); }
  .wv-combo--on[data-tier="2"] { font-size: 18px; color: #E8622F; }
  .wv-combo--on[data-tier="3"] { font-size: 21px; color: #E0322F; text-shadow: 0 0 14px color-mix(in srgb, var(--error) 55%, transparent); }
  .wv-combo--on[data-tier="4"] { font-size: 24px; color: #E0322F; text-shadow: 0 0 18px color-mix(in srgb, var(--error) 70%, transparent); }
  .wv-mult { font-size: .74em; font-weight: 800; opacity: .9; }
  .wv-exit { padding: 8px 10px; }

  .wv-sub { display: flex; align-items: center; gap: 12px; padding: 6px 16px 8px; border-bottom: 1px solid var(--bd); z-index: 2; }
  .wv-phase { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; color: var(--t3); white-space: nowrap; }
  .wv-phase[data-dawn="1"] { color: #E8862F; font-weight: 700; }
  .wv-sub .gk-timer { flex: 1; }

  /* ── 필드 ── */
  .wv-field { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  .wv-hearth { position: absolute; left: 0; right: 0; bottom: 0; height: 10%; background: linear-gradient(0deg, color-mix(in srgb, #E8862F 30%, transparent), transparent); border-top: 1px dashed color-mix(in srgb, #E8862F 55%, transparent); }

  .wv-wisp { position: absolute; top: 0; left: 50%; will-change: transform; display: flex; flex-direction: column; align-items: center; gap: 5px; min-height: 44px; max-width: 40vw; padding: 8px 14px; border-radius: 14px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, transparent); color: var(--t1); box-shadow: 0 6px 20px -8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.35); backdrop-filter: blur(4px); font-family: inherit; cursor: pointer; transition: border-color .12s, box-shadow .12s, background .12s; }
  .wv-wisp:hover { border-color: color-mix(in srgb, var(--combo) 55%, var(--bd)); }
  .wv-wisp:active { box-shadow: 0 2px 10px -6px rgba(0,0,0,.5); }
  .wv-wisp:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .wv-wisp-top { display: flex; align-items: center; gap: 5px; max-width: 100%; }
  .wv-wisp-ko { font-family: var(--font-display, system-ui); font-size: clamp(14px, 3.3vw, 18px); font-weight: 800; color: var(--t1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wv-pos { font-size: 10px; font-weight: 800; letter-spacing: .04em; color: var(--t3); border: 1px solid var(--bd); border-radius: 5px; padding: 0 4px; }
  .wv-chev { font-size: 10px; color: var(--error); animation: wv-bob 1.2s ease-in-out infinite; }

  .wv-slots { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
  .wv-slot { display: grid; place-items: center; min-width: 15px; height: 20px; padding: 0 2px; border-bottom: 2px solid color-mix(in srgb, var(--t1) 22%, transparent); font-family: var(--font-english, ui-monospace, monospace); font-size: 14px; font-weight: 800; line-height: 1; color: var(--t4); text-transform: lowercase; }
  .wv-slot[data-on="1"] { color: var(--combo); border-bottom-color: var(--combo); }
  .wv-slot[data-rev="1"] { color: #E8862F; border-bottom-color: color-mix(in srgb, #E8862F 60%, transparent); }
  /* 확정 직전 유예 — 지금 백스페이스하면 물릴 수 있다는 신호. */
  .wv-slots[data-pending="1"] .wv-slot { animation: wv-dry .26s linear forwards; }

  .wv-wisp--on { border-color: var(--combo); background: color-mix(in srgb, var(--bg) 92%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 26%, transparent), 0 8px 24px -8px rgba(0,0,0,.4); }
  .wv-wisp--urgent { border-style: dashed; border-color: var(--error); }
  .wv-wisp--urgent .wv-wisp-ko { color: var(--error); }
  .wv-wisp--vow { border-color: #E8862F; box-shadow: 0 0 0 3px color-mix(in srgb, #E8862F 34%, transparent), 0 10px 28px -8px rgba(0,0,0,.45); }
  .wv-wisp--slow { border-color: var(--active, #3B82F6); box-shadow: 0 0 0 3px color-mix(in srgb, var(--active, #3B82F6) 30%, transparent); }
  .wv-vow-tag { font-size: 10px; font-weight: 800; letter-spacing: .04em; color: #E8862F; }

  .wv-fx { position: absolute; width: 0; height: 0; pointer-events: none; }
  .wv-ring { position: absolute; left: -26px; top: -26px; width: 52px; height: 52px; border-radius: 50%; border: 2px solid var(--combo); animation: wv-ring .34s var(--ease-settle, ease-out) forwards; }
  .wv-ring[data-late="1"] { border-color: #E8862F; }
  .wv-float { position: absolute; transform: translateX(-50%); font-size: 13px; font-weight: 800; white-space: nowrap; pointer-events: none; animation: gk-gain 1s ease-out forwards; }
  .wv-float[data-kind="gain"] { color: var(--combo); }
  .wv-float[data-kind="warn"] { color: var(--error); }
  .wv-float[data-kind="calm"] { color: var(--active, #3B82F6); }

  .wv-banner { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; animation: wv-banner 4.6s ease-in-out forwards; }
  .wv-banner-t { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(22px, 5.4vw, 32px); color: var(--t1); letter-spacing: .04em; }
  .wv-banner-s { font-size: 13px; font-weight: 700; color: var(--t3); }

  /* ── 하단 벨트(놓친 단어 공개 · IME 안내) — 모달 아님, 게임은 계속 흐른다. ── */
  .wv-belt { display: flex; flex-direction: column; gap: 6px; padding: 0 16px; z-index: 2; }
  .wv-reveal, .wv-ime { display: flex; align-items: center; gap: 8px; margin: 0; padding: 8px 12px; border-radius: var(--r-md, 10px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 84%, transparent); font-size: 13px; color: var(--t2); animation: wv-slip .22s ease-out; }
  .wv-reveal { color: var(--t2); }
  .wv-reveal-ko { font-weight: 800; color: var(--t1); }
  .wv-reveal-en { font-family: var(--font-english, ui-monospace, monospace); font-weight: 800; color: #E8862F; letter-spacing: .04em; }
  .wv-ime { border-color: color-mix(in srgb, var(--combo) 45%, var(--bd)); color: var(--t1); font-weight: 700; }

  /* ── 붓 바 ── */
  .wv-quillbar { display: flex; align-items: center; gap: 8px; padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 60%, transparent); z-index: 2; transition: opacity .2s; }
  .wv-quillbar--blur { opacity: .82; }
  .wv-quill-ic { font-size: 18px; color: var(--t3); }
  .wv-quill-wrap { position: relative; flex: 1; min-width: 0; display: flex; }
  .wv-quill { flex: 1; min-width: 0; min-height: 48px; padding: 0 14px; border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, ui-monospace, monospace); font-size: clamp(17px, 4vw, 21px); font-weight: 700; letter-spacing: .1em; outline: none; transition: border-color .15s, box-shadow .15s; }
  .wv-quill:hover { border-color: var(--t3); }
  .wv-quill:focus { border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 26%, transparent); }
  .wv-quill::placeholder { color: var(--t4); font-family: var(--font-display, system-ui); font-weight: 500; letter-spacing: 0; font-size: 13px; }
  .wv-refocus { position: absolute; inset: 0; display: grid; place-items: center; min-height: 48px; border-radius: var(--r-md, 10px); border: 1.5px dashed color-mix(in srgb, var(--combo) 60%, var(--bd)); background: color-mix(in srgb, var(--bg) 92%, transparent); color: var(--t2); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 700; cursor: pointer; }
  .wv-refocus:hover { color: var(--t1); border-color: var(--combo); }
  .wv-refocus:active { transform: scale(.99); }
  .wv-refocus:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .wv-reject .wv-quill { animation: gk-shake .24s ease-in-out; border-color: var(--error); }

  .wv-act { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-width: 56px; min-height: 48px; padding: 0 8px; border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t2); font-family: var(--font-display, system-ui); cursor: pointer; transition: border-color .15s, color .15s, transform .12s, background .15s; }
  .wv-act-ic { font-size: 15px; line-height: 1; }
  .wv-act-t { font-size: 10.5px; font-weight: 800; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  .wv-act:hover:not(:disabled) { color: var(--t1); border-color: var(--t3); }
  .wv-act:active:not(:disabled) { transform: scale(.96); }
  .wv-act:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .wv-act:disabled { opacity: .42; cursor: default; }
  .wv-act--vow:not(:disabled) { color: #E8862F; border-color: color-mix(in srgb, #E8862F 55%, var(--bd)); }
  .wv-act--vow:not(:disabled):hover { background: color-mix(in srgb, #E8862F 12%, transparent); }

  /* ── 결과 화면의 정답 공개(패배 시) ── */
  .wv-missed { text-align: left; }
  .wv-missed-t { margin: 0 0 8px; font-size: 12px; font-weight: 800; color: var(--t3); }
  .wv-missed-l { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr; gap: 4px; }
  .wv-missed-l li { display: flex; align-items: baseline; gap: 10px; }
  .wv-missed-ko { min-width: 7ch; font-weight: 700; color: var(--t2); }
  .wv-missed-en { font-family: var(--font-english, ui-monospace, monospace); font-weight: 800; letter-spacing: .04em; color: #E8862F; }
  @media (min-width: 560px) { .wv-missed-l { grid-template-columns: 1fr 1fr; gap: 4px 22px; } }

  .wv-keys { margin: 0; padding: 0 16px calc(10px + env(safe-area-inset-bottom, 0px)); text-align: center; font-size: 11.5px; color: var(--t4); z-index: 2; }
  @media (max-width: 420px) {
    .wv-keys { display: none; }
    .wv-act { min-width: 52px; padding: 0 6px; }
    .wv-quill-ic { display: none; }
    .wv-quillbar { gap: 6px; padding-left: 12px; padding-right: 12px; }
    .wv-hud { gap: 8px; padding: 10px 12px 8px; }
  }

  @keyframes wv-flicker { 0%,100% { opacity: 1; transform: scale(1); } 45% { opacity: .78; transform: scale(.9) translateY(.5px); } }
  @keyframes wv-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(2px); } }
  @keyframes wv-ring { 0% { transform: scale(.4); opacity: .9; } 100% { transform: scale(1.35); opacity: 0; } }
  @keyframes wv-slip { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wv-dry { from { border-bottom-color: var(--combo); } to { border-bottom-color: color-mix(in srgb, var(--combo) 25%, transparent); } }
  @keyframes wv-banner { 0% { opacity: 0; } 14% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .wv-flame, .wv-chev { animation: none; }
    .wv-slots[data-pending="1"] .wv-slot { animation: none; border-bottom-style: dotted; }
    .wv-reject .wv-quill { animation: none; }
    .wv-wisp, .wv-act, .wv-quillbar, .wv-ember, .wv-gold { transition: none; }
    .wv-ring { display: none; }
    .wv-float { animation: wv-slip .2s ease-out forwards; }
    .wv-banner { animation: wv-banner 4.6s linear forwards; }
  }
`;
