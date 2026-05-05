// apps/web/src/components/game/wordblitz/useWordBlitzGame.ts
// WordBlitz 게임 로직 - v5 좌표계
//
// v5 변경:
//   - clawHomeY 6, clawDropY 2 (MACHINE과 일치)
//   - 인형 Y = 0.1 (박스 바닥 위)

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
  CLAW_HOME_Y: 6,
  CLAW_DROP_Y: 2,
  CLAW_X_RANGE: 2.2,
  PLUSHIE_COUNT: 7,
  GRAB_RADIUS: 1.5,
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

    let targetPlaced = false;
    const plushies: PlushieInstance[] = selected.map((word, i) => {
      const isTarget = !targetPlaced && word.en === target.en;
      if (isTarget) targetPlaced = true;

      const pos = PLUSHIE_POSITIONS[i];

      return {
        id: `${word.en}-${i}-${Date.now()}`,
        word,
        type: PLUSHIE_TYPES[i % PLUSHIE_TYPES.length],
        isTarget,
        // 인형 Y = 0.1 (박스 바닥 0 위에 살짝 떠 있는 듯)
        position: [pos.x, 0.1, pos.z],
        rotationY: (Math.random() - 0.5) * 0.6,
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveClawDelta(-0.15);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveClawDelta(0.15);
      } else if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        void dropClaw();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveClawDelta, dropClaw]);

  useEffect(() => {
    generatePlushies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePhysics = useCallback((dtRaw: number) => {
    const dt = Math.min(dtRaw, 0.05);
    const targets = targetsRef.current;
    const live = liveStateRef.current;

    live.clawX += (targets.clawTargetX - live.clawX) * 0.07;

    const velX = (live.clawX - targets.prevX) / dt;
    targets.prevX = live.clawX;

    targets.clawSwingVel += -velX * 0.5 * dt;
    targets.clawSwingVel += -live.clawSwing * 7 * dt;
    targets.clawSwingVel *= Math.pow(0.5, dt);
    live.clawSwing += targets.clawSwingVel * dt;
    live.clawSwing = Math.max(-0.3, Math.min(0.3, live.clawSwing));

    const phaseFactor =
      isSequenceRunningRef.current && targets.clawTargetY < live.clawY
        ? 0.025
        : isSequenceRunningRef.current && targets.clawTargetY > live.clawY
          ? 0.04
          : 0.05;
    live.clawY += (targets.clawTargetY - live.clawY) * phaseFactor;

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
