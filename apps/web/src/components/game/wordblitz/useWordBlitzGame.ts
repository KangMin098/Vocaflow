// apps/web/src/components/game/wordblitz/useWordBlitzGame.ts
// WordBlitz 게임 로직 (Master Redesign - 가로형 6.5×5×2.8 박스)
//
// GAME_CONFIG:
//   CLAW_HOME_Y = 4.2, CLAW_DROP_Y = 1.5, CLAW_X_RANGE = 2.5
// 인형 7개: PLUSHIE_POSITIONS (앞줄 4 + 뒷줄 3 지그재그 무더기)
// 인형 Y = 0.1 (박스 바닥 위), 회전 Y 는 PLUSHIE_POSITIONS.rotY 사용 (자연 무더기)
// 키보드: ←→ 이동, Space/Enter/↓ 떨어뜨리기

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SAMPLE_WORDS,
  PLUSHIE_TYPES,
  PLUSHIE_POSITIONS,
  POINTS,
  type Word,
} from '@/lib/wordblitz/data';
import type {
  GameState,
  PlushieInstance,
  ClawTargets,
  LiveClawState,
} from '@/lib/wordblitz/types';

export const GAME_CONFIG = {
  CLAW_HOME_Y: 2.8,
  CLAW_DROP_Y: 0.9,
  CLAW_X_RANGE: 4.0,
  PLUSHIE_COUNT: 7,
  GRAB_RADIUS: 2.0,
  TIMING: {
    DROP_DURATION: 1500,
    PRE_CLOSE_DELAY: 150,
    CLOSE_DURATION: 450,
    POST_CLOSE_DELAY: 150,
    RETURN_DURATION: 1300,
    RESULT_DISPLAY: 1800,
    POST_RESULT_DELAY: 200,
  },
} as const;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface UseWordBlitzGameOptions {
  wordPool?: Word[];
  onCorrect?: (word: Word) => void;
  onWrong?: (word: Word) => void;
  enableSpeech?: boolean;
}

export function useWordBlitzGame(options: UseWordBlitzGameOptions = {}) {
  const { wordPool = SAMPLE_WORDS, onCorrect, onWrong, enableSpeech = true } = options;

  const [state, setState] = useState<GameState>(() => ({
    clawX: 0,
    clawY: GAME_CONFIG.CLAW_HOME_Y,
    clawSwing: 0,
    clawOpen: 1,
    phase: 'idle',
    grabbedPlushieId: null,
    plushies: [],
    targetWord: null,
    score: 0,
    captured: 0,
    lastResult: null,
  }));

  const targetsRef = useRef<ClawTargets>({
    clawTargetX: 0,
    clawTargetY: GAME_CONFIG.CLAW_HOME_Y,
    clawTargetOpen: 1,
    clawSwingVel: 0,
    prevX: 0,
  });

  const liveStateRef = useRef<LiveClawState>({
    clawX: 0,
    clawY: GAME_CONFIG.CLAW_HOME_Y,
    clawSwing: 0,
    clawOpen: 1,
  });

  const isSequenceRunningRef = useRef(false);

  const generatePlushies = useCallback(() => {
    const target = wordPool[Math.floor(Math.random() * wordPool.length)];
    const selected = [...wordPool]
      .sort(() => Math.random() - 0.5)
      .slice(0, GAME_CONFIG.PLUSHIE_COUNT);

    if (!selected.find((w) => w.en === target.en)) {
      selected[0] = target;
    }

    // 인형 종류도 매번 셔플 → 매 라운드 다른 조합
    const shuffledTypes = [...PLUSHIE_TYPES].sort(() => Math.random() - 0.5);

    let targetPlaced = false;
    const plushies: PlushieInstance[] = selected.map((word, i) => {
      const isTarget = !targetPlaced && word.en === target.en;
      if (isTarget) targetPlaced = true;

      const pos = PLUSHIE_POSITIONS[i];

      return {
        id: `${word.en}-${i}-${Date.now()}`,
        word,
        type: shuffledTypes[i % shuffledTypes.length],
        isTarget,
        // 인형 Y = 0.1 (박스 바닥 0 위)
        position: [pos.x, 0.1, pos.z],
        // PLUSHIE_POSITIONS 에 정의된 자연스러운 무더기 회전
        rotationY: pos.rotY,
      };
    });

    setState((prev) => ({
      ...prev,
      plushies,
      targetWord: target,
      lastResult: null,
    }));
  }, [wordPool]);

  const moveClawDelta = useCallback((delta: number) => {
    if (isSequenceRunningRef.current) return;
    targetsRef.current.clawTargetX = Math.max(
      -1,
      Math.min(1, targetsRef.current.clawTargetX + delta)
    );
  }, []);

  const findNearestPlushie = useCallback(
    (plushies: PlushieInstance[]): PlushieInstance | null => {
      const clawWorldX = liveStateRef.current.clawX * GAME_CONFIG.CLAW_X_RANGE;
      let nearest: PlushieInstance | null = null;
      let minDist = Infinity;

      for (const p of plushies) {
        const dx = p.position[0] - clawWorldX;
        const dz = p.position[2];
        const dist = Math.hypot(dx, dz);

        if (dist < minDist && dist < GAME_CONFIG.GRAB_RADIUS) {
          minDist = dist;
          nearest = p;
        }
      }
      return nearest;
    },
    []
  );

  const speak = useCallback(
    (text: string) => {
      if (!enableSpeech || typeof window === 'undefined') return;
      if (!('speechSynthesis' in window)) return;

      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    },
    [enableSpeech]
  );

  const dropClaw = useCallback(async () => {
    if (isSequenceRunningRef.current) return;
    isSequenceRunningRef.current = true;

    const T = GAME_CONFIG.TIMING;
    const targets = targetsRef.current;

    try {
      setState((s) => ({ ...s, phase: 'dropping' }));
      targets.clawTargetY = GAME_CONFIG.CLAW_DROP_Y;
      await wait(T.DROP_DURATION);
      await wait(T.PRE_CLOSE_DELAY);

      setState((s) => ({ ...s, phase: 'grabbing' }));
      targets.clawTargetOpen = 0;
      await wait(T.CLOSE_DURATION);

      let grabbed: PlushieInstance | null = null;
      setState((prev) => {
        grabbed = findNearestPlushie(prev.plushies);
        return {
          ...prev,
          grabbedPlushieId: grabbed?.id ?? null,
        };
      });
      await wait(T.POST_CLOSE_DELAY);

      setState((s) => ({ ...s, phase: 'returning' }));
      targets.clawTargetY = GAME_CONFIG.CLAW_HOME_Y;
      await wait(T.RETURN_DURATION);

      if (grabbed) {
        const isCorrect = (grabbed as PlushieInstance).isTarget;
        const points = isCorrect ? POINTS.CORRECT : POINTS.WRONG;
        const grabbedRef = grabbed as PlushieInstance;

        setState((s) => ({
          ...s,
          phase: 'showing-result',
          score: s.score + points,
          captured: s.captured + 1,
          lastResult: {
            word: grabbedRef.word,
            isCorrect,
            points,
          },
        }));

        speak(grabbedRef.word.en);
        if (isCorrect) onCorrect?.(grabbedRef.word);
        else onWrong?.(grabbedRef.word);

        await wait(T.RESULT_DISPLAY);

        setState((s) => ({
          ...s,
          plushies: s.plushies.filter((p) => p.id !== grabbedRef.id),
          grabbedPlushieId: null,
          lastResult: null,
        }));
      }

      targets.clawTargetOpen = 1;
      await wait(T.POST_RESULT_DELAY);

      setState((s) => ({ ...s, phase: 'idle' }));
      generatePlushies();
    } finally {
      isSequenceRunningRef.current = false;
    }
  }, [findNearestPlushie, generatePlushies, onCorrect, onWrong, speak]);

  useEffect(() => {
    const keysHeld = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A' ||
          k === 'ArrowRight' || k === 'd' || k === 'D' ||
          k === 'ArrowDown') {
        e.preventDefault();
        keysHeld.add(k.toLowerCase());
      } else if (e.code === 'Space' || k === 'Enter') {
        if (e.repeat) return;
        e.preventDefault();
        void dropClaw();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.key.toLowerCase());
    };

    let rafId = 0;
    const tick = () => {
      // 매 프레임 hold 키 체크 → 부드러운 연속 이동
      if (!isSequenceRunningRef.current) {
        const left = keysHeld.has('arrowleft') || keysHeld.has('a');
        const right = keysHeld.has('arrowright') || keysHeld.has('d');
        if (left && !right) moveClawDelta(-0.025);
        else if (right && !left) moveClawDelta(0.025);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [moveClawDelta, dropClaw]);

  useEffect(() => {
    generatePlushies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePhysics = useCallback((dtRaw: number) => {
    const dt = Math.min(dtRaw, 0.05);
    const targets = targetsRef.current;
    const live = liveStateRef.current;

    // 가로 이동 - smoothing
    live.clawX += (targets.clawTargetX - live.clawX) * 0.07;

    // 진자 흔들림 (이동 속도에서 유도)
    const velX = (live.clawX - targets.prevX) / dt;
    targets.prevX = live.clawX;

    targets.clawSwingVel += -velX * 1.8 * dt;
    targets.clawSwingVel += -live.clawSwing * 6 * dt;
    targets.clawSwingVel *= Math.pow(0.55, dt);
    live.clawSwing += targets.clawSwingVel * dt;
    live.clawSwing = Math.max(-0.6, Math.min(0.6, live.clawSwing));

    // 세로 이동 - drop 단계에서 더 천천히
    const phaseFactor =
      isSequenceRunningRef.current && targets.clawTargetY < live.clawY
        ? 0.025  // 떨어질 때
        : isSequenceRunningRef.current && targets.clawTargetY > live.clawY
          ? 0.04   // 올라올 때
          : 0.05;
    live.clawY += (targets.clawTargetY - live.clawY) * phaseFactor;

    // 집게 열림/닫힘
    live.clawOpen += (targets.clawTargetOpen - live.clawOpen) * 0.15;

    return live;
  }, []);

  return useMemo(
    () => ({
      state,
      liveStateRef,
      targetsRef,
      moveClawDelta,
      dropClaw,
      updatePhysics,
      generatePlushies,
    }),
    [state, moveClawDelta, dropClaw, updatePhysics, generatePlushies]
  );
}
