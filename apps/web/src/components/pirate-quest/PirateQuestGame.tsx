// apps/web/src/components/pirate-quest/PirateQuestGame.tsx
// Pirate's Bounty v08.2 — "밀물 잠수(Tide Dive)"
//
// 한 문장 규칙:
//   해변 자리에 뜬 영단어를 외워라. 라벨이 물에 잠긴 뒤 뜻이 불리면 그 자리를 눌러라.
//   언제든 확정할 수 있지만, 한 번이라도 틀리면 이번 잠수의 미확정 보물은 전부 잃는다.
//
// ── FSRS 계약 (3라운드 수정의 핵심) ───────────────────────────────────────
// 이 게임의 실패 모드는 두 가지가 섞여 있다: **뜻을 모른다**(어휘 lapse) 와
// **뜻은 아는데 자리를 잊었다**(위치 망각). 이전 판은 둘을 구분하지 않고 전부
// onWrong 으로 올려 FSRS 복습 일정을 위치 기억 시험 결과로 오염시켰다.
//
//   · 정답 회수 → onCorrect(target)
//       - 등불(힌트)을 켠 잠수라면 { assisted: true } — 화면이 답을 이미 보여줬다.
//       - 남은 후보가 2개 이하인 마지막 회수라면 { assisted: true } —
//         자기가 누른 자리를 기억하는 플레이어에겐 50% 동전던지기다.
//   · 오답 → 즉시 onWrong 을 쏘지 않는다. 교정 카드 앞에 3지선다 마이크로 체크를 둔다.
//       - 뜻을 맞히면(= 위치만 놓쳤다) FSRS 에 아무것도 올리지 않는다.
//       - 틀리거나 4초 무응답이면 onWrong(target) — 모르는 단어는 정직하게 오답으로 올린다.
//         (아무것도 안 올려 "모르는 단어가 FSRS 에서 지워지는" 함정을 피한다.)
//
// 그 밖의 반증 대응은 logic.ts 상단 주석 참조 (완전 회수 배수 → 밀물 시간,
// 회수한 자리 은폐·재클릭 가능, 마커 겹침 해소, missQueue 확정 출제).

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';

import {
  useCombo,
  useCountdown,
  usePersonalBest,
  useSessionEscape,
  useSfx,
  type Word,
} from '@/components/game/_shared/gamekit';
import type { ResultOpts } from '@/lib/game/play-scaffold';

import { PirateScene, type SceneMarker } from './PirateScene';
import {
  PirateGate,
  PirateQuestUI,
  type DoneInfo,
  type MissInfo,
  type RecallInfo,
  type SettleInfo,
} from './PirateQuestUI';
import type { MarkerMode } from './PirateModel';
import {
  BANK_WORDS,
  PQ,
  bankValue,
  beachMetrics,
  buildDive,
  buildScenery,
  chainMult,
  depthFrac,
  haulPoints,
  isNarrowChoice,
  markerCount,
  recallOptions,
  type BeachMetrics,
  type Dive,
  type Phase,
} from './logic';

interface PirateQuestGameProps {
  wordPool?: Word[];
  onCorrect?: (word: Word, opts?: ResultOpts) => void;
  onWrong?: (word: Word, opts?: ResultOpts) => void;
  onExit?: () => void;
}

const GOLD = ['#FFD54A', '#FFE9A8', '#E6A72C', '#FFF6E4'];

/**
 * 마이크로 체크가 뜬 직후 입력을 안 받는 시간.
 * 직전 화면에서 숫자키를 연타하던 손이 보기 1번을 눌러버리면 33% 확률의 우연한
 * "정답"이 FSRS 판정(오답을 올릴지 말지)을 바꾼다.
 */
const RECALL_ARM_MS = 320;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return reduced;
}

/** 뷰포트 계측 — 마커 자리 선택과 카메라가 같은 수를 봐야 겹침이 풀린다. */
function useBeachMetrics(): BeachMetrics {
  const [metrics, setMetrics] = useState<BeachMetrics>(() =>
    beachMetrics(
      typeof window === 'undefined' ? 390 : window.innerWidth,
      typeof window === 'undefined' ? 844 : window.innerHeight,
    ),
  );
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() =>
        setMetrics(beachMetrics(window.innerWidth, window.innerHeight)),
      );
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
  return metrics;
}

export function PirateQuestGame({ wordPool, onCorrect, onWrong, onExit }: PirateQuestGameProps) {
  const reduced = usePrefersReducedMotion();
  const sfx = useSfx();
  const pb = usePersonalBest('pirate-quest');
  const metrics = useBeachMetrics();

  const [scenery] = useState(buildScenery);
  const [phase, setPhase] = useState<Phase>('loading');
  const [dive, setDive] = useState<Dive | null>(null);
  const [score, setScore] = useState(0);
  const [bestChain, setBestChain] = useState(0);
  const [lastHaul, setLastHaul] = useState<Word | null>(null);
  const [miss, setMiss] = useState<MissInfo | null>(null);
  const [recall, setRecall] = useState<RecallInfo | null>(null);
  const [knewMeaning, setKnewMeaning] = useState<boolean | null>(null);
  const [settle, setSettle] = useState<SettleInfo | null>(null);
  const [revealAt, setRevealAt] = useState<{ target: number; picked: number } | null>(null);
  const [lanternLit, setLanternLit] = useState(false);
  // PQ.LANTERN_MAX 가 as const 리터럴이라 그대로 두면 상태 타입이 `2` 로 좁혀져
  // 감소 대입(setLanternLeft(1))이 타입 에러가 된다 — number 로 명시.
  const [lanternLeft, setLanternLeft] = useState<number>(PQ.LANTERN_MAX);
  const [tideCapped, setTideCapped] = useState(false);
  const [tierLabel, setTierLabel] = useState<string | null>(null);
  const [burst, setBurst] = useState({ key: 0, colors: GOLD });
  const [done, setDone] = useState<DoneInfo | null>(null);

  const busyRef = useRef(false);
  const flowTimerRef = useRef<number | null>(null);
  const tierTimerRef = useRef<number | null>(null);
  const lanternTimerRef = useRef<number | null>(null);
  const scanDoneRef = useRef(false);
  const diveCountRef = useRef(0);
  const bankedItemsRef = useRef(0);
  const bestChainRef = useRef(0);
  const scoreRef = useRef(0);
  const recentRef = useRef<string[]>([]);
  const missQueueRef = useRef<Word[]>([]);
  const missedRef = useRef<Word[]>([]);
  const diveRef = useRef<Dive | null>(null);
  const phaseRef = useRef<Phase>('loading');
  const lanternLeftRef = useRef(PQ.LANTERN_MAX);
  /** 밀물에 실제로 더해진 누적 시간 — gamekit 의 가산 상한을 그대로 복제해 추적한다. */
  const grantedRef = useRef(0);
  /** 아직 판정이 안 끝난 마이크로 체크 (나가기·재시작 때 정직하게 마무리한다) */
  const pendingRecallRef = useRef<Word | null>(null);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  scoreRef.current = score;
  bestChainRef.current = bestChain;
  diveRef.current = dive;
  phaseRef.current = phase;

  const onCorrectRef = useRef(onCorrect);
  onCorrectRef.current = onCorrect;
  const onWrongRef = useRef(onWrong);
  onWrongRef.current = onWrong;

  const clearFlow = useCallback(() => {
    if (flowTimerRef.current !== null) {
      window.clearTimeout(flowTimerRef.current);
      flowTimerRef.current = null;
    }
  }, []);

  // ── 단어 풀 ───────────────────────────────────────────────────────────
  // 스캐폴드는 raw row 수로 minWords 를 판정하지만 이 게임은 ko 가 빈 항목을 못 쓴다.
  // 예전에는 정제 후 8개 미만이면 **통째로 해적 뱅크로 바꿔치기** 했다 — ?set= 으로
  // 특정 챕터를 고른 학습자가 라벨은 그 챕터 이름인 채 sword/barrel 을 풀게 되는
  // "몰래 다른 단어로 바꿔치지 않는다"(play-scaffold) 원칙 위반이었다.
  // 이제 쓸 수 있는 단어가 MIN_K 개만 있어도 그것으로 논다. 그마저 안 되면 바꿔치되
  // 화면에 그 사실을 적는다.
  const { pool, substituted } = useMemo(() => {
    const clean = (wordPool ?? []).filter((w) => w?.en?.trim() && w?.ko?.trim());
    if (clean.length >= PQ.MIN_K) return { pool: clean, substituted: false };
    return { pool: BANK_WORDS, substituted: (wordPool?.length ?? 0) > 0 };
  }, [wordPool]);

  // ── 콤보 ──────────────────────────────────────────────────────────────
  const combo = useCombo({
    onTierUp: (tier) => {
      if (!tier.label) return;
      setTierLabel(tier.label);
      sfx.coin();
      if (tierTimerRef.current !== null) window.clearTimeout(tierTimerRef.current);
      tierTimerRef.current = window.setTimeout(() => setTierLabel(null), 1700);
    },
    onBreak: () => setTierLabel(null),
  });
  const comboMultRef = useRef(1);
  comboMultRef.current = combo.mult;
  const comboBestRef = useRef(0);
  comboBestRef.current = combo.best;
  const comboNowRef = useRef(0);
  comboNowRef.current = combo.combo;

  // ── 세션 시계(밀물) ───────────────────────────────────────────────────
  const submitBestRef = useRef(pb.submit);
  submitBestRef.current = pb.submit;
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;

  const finish = useCallback(() => {
    clearFlow();
    const stranded = diveRef.current?.pending ?? 0;
    const res = submitBestRef.current(scoreRef.current);
    setDone({
      score: scoreRef.current,
      bankedItems: bankedItemsRef.current,
      bestCombo: comboBestRef.current,
      bestChain: bestChainRef.current,
      missed: [...missedRef.current],
      strandedPending: stranded,
      best: { prev: res.prev, now: scoreRef.current, improved: res.improved },
    });
    setPhase('done');
    if (res.improved && scoreRef.current > 0) sfxRef.current.fanfare();
  }, [clearFlow]);

  // recall / reveal / settle 동안 밀물은 멈춘다 — 읽는 데 벌을 주지 않는다.
  const tideRunning = phase === 'scan' || phase === 'haul' || phase === 'choice';
  const tide = useCountdown({
    totalMs: PQ.TIDE_MS,
    running: tideRunning,
    warnAtMs: PQ.WARN_MS,
    onEnd: finish,
  });
  const tideRef = useRef(tide);
  tideRef.current = tide;

  /**
   * 밀물 연장 — gamekit useCountdown 은 총량의 75% 까지만 더해주고 초과분을 조용히
   * 버린다(공용 자산이라 시그니처를 못 바꾼다). 같은 식으로 미리 잘라 **실제로 늘어난
   * 양만** 돌려주고, 그 값으로 정산 카드를 쓴다. 확정 30개(=75초)부터는 0 이 나온다.
   */
  const grantTide = useCallback((ms: number): number => {
    if (ms <= 0) return 0;
    const cap = PQ.TIDE_MS * PQ.EXTEND_CAP_RATIO;
    const allowed = Math.max(0, Math.min(ms, cap - grantedRef.current));
    if (allowed <= 0) {
      setTideCapped(true);
      return 0;
    }
    grantedRef.current += allowed;
    tideRef.current.extend(allowed);
    if (grantedRef.current >= cap - 1) setTideCapped(true);
    return allowed;
  }, []);

  // ── 라벨 노출 시계 ────────────────────────────────────────────────────
  const endScan = useCallback(() => {
    if (scanDoneRef.current || phaseRef.current !== 'scan') return;
    scanDoneRef.current = true;
    setDive((d) => {
      if (!d) return d;
      if (d.queue.length === 0) return { ...d, asking: null };
      return { ...d, asking: d.queue[0], queue: d.queue.slice(1) };
    });
    setPhase('haul');
  }, []);

  const scan = useCountdown({
    totalMs: PQ.TIDE_MS, // 첫 잠수 시작 시 reset(scanMs) 으로 실제 값이 들어간다
    running: phase === 'scan',
    warnAtMs: 700,
    onEnd: endScan,
  });
  const scanResetRef = useRef(scan.reset);
  scanResetRef.current = scan.reset;

  // ── 에셋 게이트 ───────────────────────────────────────────────────────
  const { active, progress, total } = useProgress();
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    if (assetsReady) return;
    if (total > 0 && !active && progress >= 100) {
      const t = window.setTimeout(() => setAssetsReady(true), 180);
      return () => window.clearTimeout(t);
    }
  }, [assetsReady, active, progress, total]);

  // 안전망 — 로더가 어떤 이유로든 100% 를 못 알리면 12초 뒤 그냥 시작한다(무한 대기 금지).
  useEffect(() => {
    const t = window.setTimeout(() => setAssetsReady(true), 12_000);
    return () => window.clearTimeout(t);
  }, []);

  // ── 잠수 생성 ─────────────────────────────────────────────────────────
  const beginDive = useCallback(() => {
    diveCountRef.current += 1;
    const m = metricsRef.current;
    const k = Math.min(markerCount(bankedItemsRef.current, m.maxK), pool.length);
    const forced = missQueueRef.current.splice(0, 1);
    // slice(-0) 은 배열 전체를 돌려준다 — 0 이면 회피 집합을 아예 비워야 한다.
    const avoid = Math.max(0, Math.min(pool.length - k - 1, 12));
    const recentSet = new Set(avoid > 0 ? recentRef.current.slice(-avoid) : []);
    const d = buildDive({
      index: diveCountRef.current,
      pool,
      scenery,
      k,
      forced,
      recent: recentSet,
      metrics: m,
    });
    d.markers.forEach((mk) => recentRef.current.push(mk.word.en.toLowerCase()));
    if (recentRef.current.length > 48) recentRef.current = recentRef.current.slice(-48);

    scanDoneRef.current = false;
    diveRef.current = d;
    setDive(d);
    setLastHaul(null);
    setMiss(null);
    setRecall(null);
    setKnewMeaning(null);
    setSettle(null);
    setRevealAt(null);
    setLanternLit(false);
    scanResetRef.current(d.scanMs);
    setPhase('scan');
  }, [pool, scenery]);

  // 에셋이 다 뜬 다음에 첫 잠수 — 빈 해변에서 시계가 도는 불공정 차단.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || !assetsReady || phase !== 'loading') return;
    startedRef.current = true;
    beginDive();
  }, [assetsReady, phase, beginDive]);

  // 전환마다 입력 잠금 해제 (같은 tick 의 중복 입력만 막는 가벼운 잠금)
  useEffect(() => {
    busyRef.current = false;
  }, [phase, dive?.asking]);

  useEffect(
    () => () => {
      if (flowTimerRef.current !== null) window.clearTimeout(flowTimerRef.current);
      if (tierTimerRef.current !== null) window.clearTimeout(tierTimerRef.current);
      if (lanternTimerRef.current !== null) window.clearTimeout(lanternTimerRef.current);
      document.body.style.cursor = 'auto';
    },
    [],
  );

  // ── 확정 ──────────────────────────────────────────────────────────────
  const bank = useCallback(
    (d: Dive, full: boolean) => {
      const amount = bankValue(d, comboMultRef.current);
      // 등불 잠수는 밀물을 되돌려주지 않는다 — 이게 없으면
      // "스캔 즉시 종료 → 등불 → 전량 회수" 가 잠수당 +8.5초짜리 무한 안전 주행이 된다.
      const grantMs = d.lantern ? 0 : d.hauled * PQ.BANK_MS_PER_ITEM + (full ? PQ.FULL_HAUL_MS : 0);
      const gained = grantTide(grantMs);
      sfxRef.current.coin();
      setScore((s) => s + amount);
      bankedItemsRef.current += d.hauled;
      setSettle({
        points: amount,
        seconds: Math.round(gained / 1000),
        full,
        items: d.hauled,
        lantern: d.lantern,
        capped: !d.lantern && grantMs > 0 && gained === 0,
      });
      setBurst((b) => ({ key: b.key + 1, colors: GOLD }));
      setPhase('settle');
      clearFlow();
      flowTimerRef.current = window.setTimeout(() => {
        flowTimerRef.current = null;
        beginDive();
      }, PQ.SETTLE_MS);
    },
    [beginDive, clearFlow, grantTide],
  );

  // ── 오답 뒤 마이크로 체크 ─────────────────────────────────────────────
  /**
   * 위치 실패와 어휘 실패를 가른다.
   *  - 뜻을 맞히면 FSRS 에 아무것도 올리지 않는다(자리만 놓친 것).
   *  - 틀리거나 무응답이면 onWrong — 모르는 단어는 정직하게 오답으로 올라가야 복습이 잡힌다.
   * 게임 안 재출제(missQueue)는 어느 쪽이든 그대로다.
   */
  const resolveRecall = useCallback(
    (choice: string | null) => {
      const target = pendingRecallRef.current;
      if (!target) return;
      pendingRecallRef.current = null;
      const knew = choice != null && choice.trim() === target.ko.trim();
      if (knew) sfxRef.current.click();
      else onWrongRef.current?.(target);
      setKnewMeaning(knew);
    },
    [],
  );

  const closeRecall = useCallback(
    (choice: string | null) => {
      if (phaseRef.current !== 'recall') return;
      busyRef.current = true;
      clearFlow();
      resolveRecall(choice);
      setPhase('reveal');
      flowTimerRef.current = window.setTimeout(() => {
        flowTimerRef.current = null;
        beginDive();
      }, PQ.REVEAL_MS);
    },
    [beginDive, clearFlow, resolveRecall],
  );

  /**
   * 사용자 입력용 진입점. 마이크로 체크가 뜨자마자 320ms 는 입력을 안 받는다 —
   * 직전 화면에서 숫자키/Enter 를 연타하던 손이 보기 1번을 눌러버리면
   * 33% 확률의 우연한 "정답"이 FSRS 판정을 바꾸기 때문이다.
   */
  const recallArmedAtRef = useRef(0);
  const handleRecallPick = useCallback(
    (choice: string | null) => {
      if (phaseRef.current !== 'recall') return;
      if (performance.now() - recallArmedAtRef.current < RECALL_ARM_MS) return;
      closeRecall(choice);
    },
    [closeRecall],
  );
  const recallTimeoutRef = useRef(closeRecall);
  recallTimeoutRef.current = closeRecall;

  // ── 자리 선택 ─────────────────────────────────────────────────────────
  const handlePick = useCallback(
    (badge: number) => {
      const d = diveRef.current;
      if (busyRef.current || phaseRef.current !== 'haul' || !d || d.asking == null) return;
      const target = d.markers.find((m) => m.badge === d.asking);
      const picked = d.markers.find((m) => m.badge === badge);
      // 이미 회수한 자리도 그대로 누를 수 있다(정상 오답 처리) — 화면이 후보를 지워주지 않는다.
      if (!target || !picked) return;
      busyRef.current = true;

      // 화면이 정답을 이미 보여줬거나(등불), 소거로 후보가 2개 이하로 좁혀진 회수는
      // 인출 증거가 아니다. 점수·콤보에는 반영하되 FSRS 카드는 건드리지 않는다.
      const assisted = d.lantern || isNarrowChoice(d);

      if (picked.badge === target.badge) {
        const points = haulPoints(d.hauled);
        // 등불 잠수는 콤보를 올리지도 끊지도 않는다 — 무손실로 ×4 까지 타던 경로 차단.
        const nextCombo = d.lantern ? comboNowRef.current : combo.hit();
        sfxRef.current.correct(nextCombo, false);
        setBurst((b) => ({ key: b.key + 1, colors: GOLD }));
        setLastHaul(target.word);
        onCorrectRef.current?.(target.word, assisted ? { assisted: true } : undefined);

        const nd: Dive = {
          ...d,
          markers: d.markers.map((m) => (m.badge === target.badge ? { ...m, hauled: true } : m)),
          pending: d.pending + points,
          hauled: d.hauled + 1,
          asking: null,
        };
        diveRef.current = nd;
        setDive(nd);
        if (nd.hauled > bestChainRef.current) {
          bestChainRef.current = nd.hauled;
          setBestChain(nd.hauled);
        }

        // 물을 자리가 다 떨어지면 자동 확정 — 판돈을 더 걸 곳이 없다.
        // (마지막 한 자리는 애초에 묻지 않는다. 선택지 1개는 인출이 아니다.)
        if (nd.queue.length === 0) bank(nd, true);
        else setPhase('choice');
        return;
      }

      // 오답 — 이번 잠수의 미확정분을 전부 잃는다.
      const lost = d.pending;
      const near = d.hauled >= 2;
      combo.miss();
      if (near) sfxRef.current.nearMiss();
      else sfxRef.current.wrong();
      missQueueRef.current.push(target.word);
      if (!missedRef.current.some((w) => w.en === target.word.en)) missedRef.current.push(target.word);
      tideRef.current.drain(PQ.WRONG_DRAIN_MS);

      const nd: Dive = { ...d, pending: 0, asking: null, queue: [] };
      diveRef.current = nd;
      setDive(nd);
      setRevealAt({ target: target.badge, picked: picked.badge });
      setMiss({ target: target.word, picked: picked.word, lost, near, hauledPick: picked.hauled });

      // onWrong 은 여기서 쏘지 않는다 — 마이크로 체크가 어휘 실패인지 먼저 가린다.
      pendingRecallRef.current = target.word;
      setKnewMeaning(null);
      setRecall({ word: target.word, options: recallOptions(d, target.word) });
      recallArmedAtRef.current = performance.now();
      setPhase('recall');
      clearFlow();
      flowTimerRef.current = window.setTimeout(() => {
        flowTimerRef.current = null;
        recallTimeoutRef.current(null); // 무응답 = 모름 = onWrong
      }, PQ.RECALL_MS);
    },
    [combo, bank, clearFlow],
  );

  // ── 조작 ──────────────────────────────────────────────────────────────
  const diveNow = useCallback(() => {
    if (busyRef.current || phaseRef.current !== 'scan') return;
    busyRef.current = true;
    sfxRef.current.click();
    endScan();
  }, [endScan]);

  const handleBank = useCallback(() => {
    const d = diveRef.current;
    if (busyRef.current || phaseRef.current !== 'choice' || !d) return;
    busyRef.current = true;
    bank(d, false);
  }, [bank]);

  const handlePushLuck = useCallback(() => {
    const d = diveRef.current;
    if (busyRef.current || phaseRef.current !== 'choice' || !d) return;
    busyRef.current = true;
    sfxRef.current.click();
    if (d.queue.length === 0) {
      bank(d, true);
      return;
    }
    const nd: Dive = { ...d, asking: d.queue[0], queue: d.queue.slice(1) };
    diveRef.current = nd;
    setDive(nd);
    setPhase('haul');
  }, [bank]);

  const handleLantern = useCallback(() => {
    const d = diveRef.current;
    if (phaseRef.current !== 'haul' || !d || d.lantern) return;
    if (lanternLeftRef.current <= 0) return;
    lanternLeftRef.current -= 1;
    setLanternLeft(lanternLeftRef.current);
    sfxRef.current.click();
    const nd: Dive = { ...d, lantern: true };
    diveRef.current = nd;
    setDive(nd);
    tideRef.current.drain(PQ.LANTERN_DRAIN_MS);
    setLanternLit(true);
    if (lanternTimerRef.current !== null) window.clearTimeout(lanternTimerRef.current);
    lanternTimerRef.current = window.setTimeout(() => {
      lanternTimerRef.current = null;
      setLanternLit(false);
    }, PQ.LANTERN_MS);
  }, []);

  const handleContinue = useCallback(() => {
    if (phaseRef.current !== 'reveal') return;
    clearFlow();
    beginDive();
  }, [clearFlow, beginDive]);

  const handleRestart = useCallback(() => {
    clearFlow();
    resolveRecall(null);
    diveCountRef.current = 0;
    bankedItemsRef.current = 0;
    bestChainRef.current = 0;
    recentRef.current = [];
    grantedRef.current = 0;
    lanternLeftRef.current = PQ.LANTERN_MAX;
    setLanternLeft(PQ.LANTERN_MAX);
    setTideCapped(false);
    // 놓친 단어는 다음 판으로 들고 간다 — 끝화면의 "놓친 n단어부터"가 거짓이 되지 않게.
    missQueueRef.current = [...missedRef.current];
    missedRef.current = [];
    combo.reset();
    setScore(0);
    setBestChain(0);
    setDone(null);
    tideRef.current.reset(PQ.TIDE_MS);
    beginDive();
  }, [clearFlow, combo, beginDive, resolveRecall]);

  const handleExit = useCallback(() => {
    clearFlow();
    // 판정이 안 끝난 마이크로 체크는 "모름"으로 마감한다 — 나가기로 오답을 지울 수 없다.
    resolveRecall(null);
    onExit?.();
  }, [clearFlow, onExit, resolveRecall]);

  // ── 키보드 ────────────────────────────────────────────────────────────
  // 핸들러는 매 프레임(밀물 tick) 새로 만들어지므로 ref 로 잡아두고 리스너는 한 번만 건다.
  const keysRef = useRef({
    diveNow,
    handlePick,
    handleLantern,
    handlePushLuck,
    handleBank,
    handleContinue,
    handleExit,
    handleRecallPick,
  });
  keysRef.current = {
    diveNow,
    handlePick,
    handleLantern,
    handlePushLuck,
    handleBank,
    handleContinue,
    handleExit,
    handleRecallPick,
  };
  const recallRef = useRef(recall);
  recallRef.current = recall;

  // Esc = 나가기. 셸과 목적지는 같지만, 이 게임의 handleExit 은 미판정 마이크로 체크를
  // "모름"으로 마감한 뒤 나간다 — 셸이 대신 닫으면 그 마감이 건너뛰어지고, 두 리스너가
  // 함께 발화하면 이동이 두 번 쌓인다. 소유권을 여기서 가져와 한 번만 나간다.
  useSessionEscape(() => {
    keysRef.current.handleExit();
    return true;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keysRef.current;
      // 버튼에 포커스가 있으면 Enter/Space 는 브라우저가 그 버튼을 누른다 — 중복 발화 금지.
      const ae = document.activeElement;
      const onButton = ae instanceof HTMLElement && ae.tagName === 'BUTTON';
      const p = phaseRef.current;

      if (p === 'scan') {
        if (!onButton && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault();
          k.diveNow();
        }
        return;
      }
      if (p === 'haul') {
        const n = Number(e.key);
        const count = diveRef.current?.markers.length ?? 0;
        if (Number.isInteger(n) && n >= 1 && n <= count) {
          e.preventDefault();
          k.handlePick(n);
          return;
        }
        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          k.handleLantern();
        }
        return;
      }
      if (p === 'choice') {
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          k.handlePushLuck();
          return;
        }
        if (!onButton && e.key === 'Enter') {
          e.preventDefault();
          k.handleBank();
        }
        return;
      }
      if (p === 'recall') {
        const n = Number(e.key);
        const opts = recallRef.current?.options.length ?? 0;
        if (Number.isInteger(n) && n >= 1 && n <= opts) {
          e.preventDefault();
          k.handleRecallPick(recallRef.current?.options[n - 1] ?? null);
        }
        return;
      }
      if (p === 'reveal') {
        if (!onButton && (e.key === 'Enter' || e.code === 'Space')) {
          e.preventDefault();
          k.handleContinue();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── 씬 마커 ───────────────────────────────────────────────────────────
  // pick 은 절대 identity 가 바뀌지 않는다 — 밀물 tick(초당 60회) 마다 25개 GLB 가
  // 재렌더되지 않도록 마커 배열을 안정화한다.
  const pickRef = useRef(handlePick);
  pickRef.current = handlePick;
  const pick = useCallback((badge: number) => pickRef.current(badge), []);

  const sceneMarkers: SceneMarker[] = useMemo(() => {
    if (!dive) return [];
    return dive.markers.map((m) => {
      let mode: MarkerMode;
      if (phase === 'scan') mode = 'label';
      else if (phase === 'recall') {
        // 마이크로 체크 중에는 어떤 라벨도 켜지 않는다 — 뜻 보기가 화면에 있다.
        mode = 'hidden';
      } else if (phase === 'reveal') {
        if (revealAt && m.badge === revealAt.target) mode = 'correct';
        else if (revealAt && m.badge === revealAt.picked) mode = 'wrong';
        else mode = 'hidden';
      } else if (lanternLit) mode = 'label';
      // 회수한 자리도 물에 잠긴 자리와 똑같이 보인다 — 소거로 후보가 줄지 않는다.
      else mode = 'hidden';

      return {
        slot: m.slot,
        badge: m.badge,
        mode,
        en: m.word.en,
        ko: m.word.ko,
        liftPx: m.liftPx,
        interactive: phase === 'haul',
        onPick: () => pick(m.badge),
      };
    });
  }, [dive, phase, revealAt, lanternLit, pick]);

  const askKo = useMemo(() => {
    if (!dive || dive.asking == null) return null;
    return dive.markers.find((m) => m.badge === dive.asking)?.word.ko ?? null;
  }, [dive]);

  const depth = depthFrac(dive?.index ?? 1);
  const focus = phase === 'haul' || phase === 'choice';
  const nextChainMult = chainMult(dive?.hauled ?? 0);
  const bankPreview = dive ? bankValue(dive, combo.mult) : 0;

  return (
    <>
      <PirateScene
        scenery={scenery}
        markers={sceneMarkers}
        depth={depth}
        focus={focus}
        reduced={reduced}
      />

      {phase === 'loading' && (
        <PirateGate progress={total > 0 ? progress : 0} onExit={handleExit} />
      )}

      <PirateQuestUI
        phase={phase}
        dive={dive}
        scanFrac={phase === 'scan' ? scan.frac : 0}
        scanSeconds={phase === 'scan' ? scan.remainSec : 0}
        tideFrac={tide.frac}
        tideWarning={tide.warning}
        tideSeconds={tide.remainSec}
        tideCapped={tideCapped}
        score={score}
        combo={combo.combo}
        comboMult={combo.mult}
        tierLabel={tierLabel}
        bankPreview={bankPreview}
        nextChainMult={nextChainMult}
        askKo={askKo}
        lastHaul={lastHaul}
        miss={miss}
        recall={recall}
        knewMeaning={knewMeaning}
        settle={settle}
        done={done}
        lanternLeft={lanternLeft}
        substitutedPool={substituted}
        muted={sfx.muted}
        burstKey={burst.key}
        burstColors={burst.colors}
        onToggleMute={() => sfx.setMuted((v) => !v)}
        onExit={handleExit}
        onDiveNow={diveNow}
        onBank={handleBank}
        onPushLuck={handlePushLuck}
        onLantern={handleLantern}
        onRecallPick={handleRecallPick}
        onContinue={handleContinue}
        onRestart={handleRestart}
      />
    </>
  );
}
