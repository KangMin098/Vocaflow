// apps/web/src/components/pirate-quest/PirateQuestGame.tsx
// Pirate's Bounty v08 — "밀물 잠수(Tide Dive)"
//
// 한 문장 규칙:
//   해변 자리에 뜬 영단어를 외워라. 라벨이 물에 잠긴 뒤 뜻이 불리면 그 자리를 눌러라.
//   언제든 확정할 수 있지만, 한 번이라도 틀리면 이번 잠수의 미확정 보물은 전부 잃는다.
//
// v07.8 감사(16/50)가 지적한 다섯 가지를 규칙 자체로 고쳤다:
//   1) 그림이 정답을 누설 → 라벨과 모델의 결합을 끊었다(logic.buildDive). 나무통 위에 sword.
//      게다가 제출 시점에는 라벨이 물에 잠겨 화면에서 사라진다 — 재인이 아니라 인출.
//   2) 오답이 정답을 안 알려줌 → 오답 시 목표 단어를 주역으로 공개하고, missQueue 로
//      같은 세션 안에서 반드시 다시 출제한다(끝화면·다음 판까지 이어진다).
//   3) 긴장 곡선 평탄 → 100초 시간은행 + 회차마다 라벨 수 증가·노출 시간 감소 + 씬 저묾.
//   4) 매 라운드 1.2~1.5초 강제 정지 + 중앙 모달 → 전부 하단 인라인. 정지는 확정 정산
//      0.64초와 오답 교정(즉시 스킵 가능)뿐이고, 그동안 밀물은 멈춘다(읽는 데 벌 없음).
//   5) 사운드·키보드·44px·reduced-motion 부재 → 전부 연결.
//
// FSRS 계약: 정답 회수 시 onCorrect(target), 오답 시 onWrong(target).
//   등불(힌트)을 쓴 잠수의 정답은 인출로 치지 않아 onCorrect 를 올리지 않는다.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';

import {
  useCombo,
  useCountdown,
  usePersonalBest,
  useSfx,
  type Word,
} from '@/components/game/_shared/gamekit';

import { PirateScene, type SceneMarker } from './PirateScene';
import { PirateGate, PirateQuestUI, type DoneInfo, type MissInfo, type SettleInfo } from './PirateQuestUI';
import type { MarkerMode } from './PirateModel';
import {
  BANK_WORDS,
  PQ,
  bankValue,
  buildDive,
  buildScenery,
  chainMult,
  depthFrac,
  haulPoints,
  markerCount,
  type Dive,
  type Phase,
} from './logic';

interface PirateQuestGameProps {
  wordPool?: Word[];
  onCorrect?: (word: Word) => void;
  onWrong?: (word: Word) => void;
  onExit?: () => void;
}

const GOLD = ['#FFD54A', '#FFE9A8', '#E6A72C', '#FFF6E4'];

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

export function PirateQuestGame({ wordPool, onCorrect, onWrong, onExit }: PirateQuestGameProps) {
  const reduced = usePrefersReducedMotion();
  const sfx = useSfx();
  const pb = usePersonalBest('pirate-quest');

  const [scenery] = useState(buildScenery);
  const [phase, setPhase] = useState<Phase>('loading');
  const [dive, setDive] = useState<Dive | null>(null);
  const [score, setScore] = useState(0);
  const [bestChain, setBestChain] = useState(0);
  const [lastHaul, setLastHaul] = useState<Word | null>(null);
  const [miss, setMiss] = useState<MissInfo | null>(null);
  const [settle, setSettle] = useState<SettleInfo | null>(null);
  const [revealAt, setRevealAt] = useState<{ target: number; picked: number } | null>(null);
  const [lanternLit, setLanternLit] = useState(false);
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

  scoreRef.current = score;
  bestChainRef.current = bestChain;
  diveRef.current = dive;
  phaseRef.current = phase;

  const clearFlow = useCallback(() => {
    if (flowTimerRef.current !== null) {
      window.clearTimeout(flowTimerRef.current);
      flowTimerRef.current = null;
    }
  }, []);

  // ── 단어 풀 ───────────────────────────────────────────────────────────
  // 학습자 스코프 단어가 충분하면 그것으로, 아니면 내장 해적 뱅크로.
  // 라벨이 GLB 와 완전히 분리됐기 때문에 이제 어떤 단어든 이 해변에 올릴 수 있다.
  const pool = useMemo(() => {
    const clean = (wordPool ?? []).filter((w) => w?.en?.trim() && w?.ko?.trim());
    return clean.length >= PQ.MAX_K + 2 ? clean : BANK_WORDS;
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

  const tideRunning = phase === 'scan' || phase === 'haul' || phase === 'choice';
  const tide = useCountdown({
    totalMs: PQ.TIDE_MS,
    running: tideRunning,
    warnAtMs: PQ.WARN_MS,
    onEnd: finish,
  });
  const tideRef = useRef(tide);
  tideRef.current = tide;

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
    const k = markerCount(bankedItemsRef.current);
    const forced = missQueueRef.current.splice(0, 1);
    // slice(-0) 은 배열 전체를 돌려준다 — 0 이면 회피 집합을 아예 비워야 한다.
    const avoid = Math.max(0, Math.min(pool.length - k - 1, 12));
    const recent = new Set(avoid > 0 ? recentRef.current.slice(-avoid) : []);
    const d = buildDive({ index: diveCountRef.current, pool, scenery, k, forced, recent });
    d.markers.forEach((m) => recentRef.current.push(m.word.en.toLowerCase()));
    if (recentRef.current.length > 48) recentRef.current = recentRef.current.slice(-48);

    scanDoneRef.current = false;
    diveRef.current = d;
    setDive(d);
    setLastHaul(null);
    setMiss(null);
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
      const grantMs = d.hauled * PQ.BANK_MS_PER_ITEM;
      tideRef.current.extend(grantMs);
      sfxRef.current.coin();
      setScore((s) => s + amount);
      bankedItemsRef.current += d.hauled;
      setSettle({ points: amount, seconds: Math.round(grantMs / 1000), full, items: d.hauled });
      setBurst((b) => ({ key: b.key + 1, colors: GOLD }));
      setPhase('settle');
      clearFlow();
      flowTimerRef.current = window.setTimeout(() => {
        flowTimerRef.current = null;
        beginDive();
      }, PQ.SETTLE_MS);
    },
    [beginDive, clearFlow],
  );

  // ── 자리 선택 ─────────────────────────────────────────────────────────
  const handlePick = useCallback(
    (badge: number) => {
      const d = diveRef.current;
      if (busyRef.current || phaseRef.current !== 'haul' || !d || d.asking == null) return;
      const target = d.markers.find((m) => m.badge === d.asking);
      const picked = d.markers.find((m) => m.badge === badge);
      if (!target || !picked || picked.hauled) return;
      busyRef.current = true;

      if (picked.badge === target.badge) {
        const points = haulPoints(d.hauled);
        const nextCombo = combo.hit();
        sfxRef.current.correct(nextCombo, false);
        setBurst((b) => ({ key: b.key + 1, colors: GOLD }));
        setLastHaul(target.word);
        if (!d.lantern) onCorrect?.(target.word);

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
      onWrong?.(target.word);
      missQueueRef.current.push(target.word);
      if (!missedRef.current.some((w) => w.en === target.word.en)) missedRef.current.push(target.word);
      tideRef.current.drain(PQ.WRONG_DRAIN_MS);

      const nd: Dive = { ...d, pending: 0, asking: null, queue: [] };
      diveRef.current = nd;
      setDive(nd);
      setRevealAt({ target: target.badge, picked: picked.badge });
      setMiss({ target: target.word, picked: picked.word, lost, near });
      setPhase('reveal');
      clearFlow();
      flowTimerRef.current = window.setTimeout(() => {
        flowTimerRef.current = null;
        beginDive();
      }, PQ.REVEAL_MS);
    },
    [combo, onCorrect, onWrong, bank, beginDive, clearFlow],
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
    diveCountRef.current = 0;
    bankedItemsRef.current = 0;
    bestChainRef.current = 0;
    recentRef.current = [];
    // 놓친 단어는 다음 판으로 들고 간다 — 끝화면의 "놓친 n단어부터"가 거짓이 되지 않게.
    missQueueRef.current = [...missedRef.current];
    missedRef.current = [];
    combo.reset();
    setScore(0);
    setBestChain(0);
    setDone(null);
    tideRef.current.reset(PQ.TIDE_MS);
    beginDive();
  }, [clearFlow, combo, beginDive]);

  const handleExit = useCallback(() => {
    clearFlow();
    onExit?.();
  }, [clearFlow, onExit]);

  // ── 키보드 ────────────────────────────────────────────────────────────
  // 핸들러는 매 프레임(밀물 tick) 새로 만들어지므로 ref 로 잡아두고 리스너는 한 번만 건다.
  const keysRef = useRef({ diveNow, handlePick, handleLantern, handlePushLuck, handleBank, handleContinue, handleExit });
  keysRef.current = { diveNow, handlePick, handleLantern, handlePushLuck, handleBank, handleContinue, handleExit };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keysRef.current;
      if (e.key === 'Escape') {
        k.handleExit();
        return;
      }
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
      else if (phase === 'reveal') {
        if (revealAt && m.badge === revealAt.target) mode = 'correct';
        else if (revealAt && m.badge === revealAt.picked) mode = 'wrong';
        // 남은 라벨도 함께 공개 — 오답이 학습 기회가 되도록.
        else mode = m.hauled ? 'hauled' : 'label';
      } else if (m.hauled) mode = 'hauled';
      else if (lanternLit) mode = 'label';
      else mode = 'hidden';

      return {
        slot: m.slot,
        badge: m.badge,
        mode,
        en: m.word.en,
        ko: m.word.ko,
        interactive: phase === 'haul' && !m.hauled,
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
        score={score}
        combo={combo.combo}
        comboMult={combo.mult}
        tierLabel={tierLabel}
        bankPreview={bankPreview}
        nextChainMult={nextChainMult}
        askKo={askKo}
        lastHaul={lastHaul}
        miss={miss}
        settle={settle}
        done={done}
        muted={sfx.muted}
        burstKey={burst.key}
        burstColors={burst.colors}
        onToggleMute={() => sfx.setMuted((v) => !v)}
        onExit={handleExit}
        onDiveNow={diveNow}
        onBank={handleBank}
        onPushLuck={handlePushLuck}
        onLantern={handleLantern}
        onContinue={handleContinue}
        onRestart={handleRestart}
      />
    </>
  );
}
