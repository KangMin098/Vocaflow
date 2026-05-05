// apps/web/src/components/pirate-quest/PirateQuestGame.tsx
// Pirate's Bounty 메인 게임 (v3 — 창의적 보상 시스템)
//
// 룰:
//   1. 17개 단어 GLB 화면 배치 (게임 시작 시 셔플, 고정)
//   2. 매 라운드 4개 GLB 위에만 영단어 라벨 표시
//   3. 카드: 한국어 뜻만 + 🔊 발음
//   4. 사용자: 4개 GLB 라벨 중 정답 클릭
//
// 창의적 보상 (학습 효과 + 재미 + 지속성):
//   · 시간 보너스 — 5초 이내 정답 +50점 (빠른 회상 강화)
//   · 힌트 시스템 — 💡 클릭 시 정답 GLB 황금 외곽선 1.5초 (-15점, 라운드당 1회)
//   · 콤보 보상 — 5 streak +100, 10 streak +250 (지속성)
//   · maxStreak 추적 — 결과 화면에 최고 콤보 표시

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PirateScene } from './PirateScene';
import { PirateQuestUI } from './PirateQuestUI';
import { PIRATE_WORDS, GAME_CONFIG, POINTS, ITEM_SLOTS } from '@/lib/pirate-quest/data';
// CHOICES_PER_ROUND 사용 안 함 (모든 17 GLB 활성)
import type { PirateWord } from '@/lib/pirate-quest/data';
import type { GameState, ItemPlacement } from '@/lib/pirate-quest/types';

interface PirateQuestGameProps {
  onExit?: () => void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// TTS 사용 안 함 (사용자 요청 — 영단어 듣기 없음)

/** 29개 단어 풀 중 25개 셔플 → 25 슬롯에 매핑. 매 게임마다 다른 조합. */
function createItemPlacements(): ItemPlacement[] {
  const selected = shuffle(PIRATE_WORDS).slice(0, ITEM_SLOTS.length);
  return selected.map((word, idx) => ({
    word,
    slot: ITEM_SLOTS[idx],
  }));
}

function createInitialState(): GameState {
  return {
    phase: 'intro',
    currentRound: 0,
    targetWord: null,
    itemPlacements: createItemPlacements(),
    fourChoices: [],
    score: 0,
    streak: 0,
    maxStreak: 0,
    correct: 0,
    roundStartedAt: 0,
    hintUsed: false,
    hintActive: false,
    lastResult: null,
    collected: [],
  };
}

export function PirateQuestGame({ onExit }: PirateQuestGameProps) {
  const [state, setState] = useState<GameState>(createInitialState);

  const isProcessingRef = useRef(false);
  const usedWordsRef = useRef<Set<string>>(new Set());

  /** 새 라운드 — 화면 25개 중 정답 1 + 오답 3 = 4개 라벨 */
  const startRound = useCallback(() => {
    setState((s) => {
      // 화면에 있는 단어 풀로 한정 (라벨 가능 = 정답 가능)
      const screenWords = s.itemPlacements.map((p) => p.word);
      const remaining = screenWords.filter((w) => !usedWordsRef.current.has(w.en));
      const pool = remaining.length > 0 ? remaining : screenWords;
      const target = pool[Math.floor(Math.random() * pool.length)];
      usedWordsRef.current.add(target.en);

      // 오답 3개도 화면에 있는 단어 중에서
      const distractors = shuffle(screenWords.filter((w) => w.en !== target.en)).slice(
        0,
        GAME_CONFIG.CHOICES_PER_ROUND - 1
      );
      const fourChoices = shuffle([target, ...distractors]);

      return {
        ...s,
        phase: 'playing',
        currentRound: s.currentRound + 1,
        targetWord: target,
        fourChoices,
        roundStartedAt: Date.now(),
        hintUsed: false,
        hintActive: false,
        lastResult: null,
      };
    });
  }, []);

  useEffect(() => {
    if (state.phase === 'intro') {
      const t = setTimeout(() => startRound(), 800);
      return () => clearTimeout(t);
    }
  }, [state.phase, startRound]);

  /** GLB 클릭 */
  const handleClick = useCallback(
    async (word: PirateWord) => {
      if (isProcessingRef.current || state.phase !== 'playing' || !state.targetWord) return;
      isProcessingRef.current = true;

      const isCorrect = word.en === state.targetWord.en;
      const elapsed = Date.now() - state.roundStartedAt;

      // 점수 계산 (다중 보너스)
      const basePoints = isCorrect ? POINTS.CORRECT : POINTS.WRONG;
      const streakBonus = isCorrect && state.streak >= 2 ? POINTS.STREAK_BONUS : 0;
      const timeBonus =
        isCorrect && !state.hintUsed && elapsed < POINTS.TIME_BONUS_THRESHOLD_MS
          ? POINTS.TIME_BONUS
          : 0;
      const hintPenalty = state.hintUsed ? POINTS.HINT_PENALTY : 0;

      const newStreak = isCorrect ? state.streak + 1 : 0;

      // 콤보 마일스톤 보너스 (한 번만)
      let comboBonus = 0;
      if (newStreak === 5) comboBonus = POINTS.COMBO_5_BONUS;
      if (newStreak === 10) comboBonus = POINTS.COMBO_10_BONUS;

      const totalPoints = basePoints + streakBonus + timeBonus + hintPenalty + comboBonus;

      setState((s) => ({
        ...s,
        phase: 'feedback',
        score: Math.max(0, s.score + totalPoints),
        streak: newStreak,
        maxStreak: Math.max(s.maxStreak, newStreak),
        correct: isCorrect ? s.correct + 1 : s.correct,
        collected: isCorrect ? [...s.collected, s.targetWord!] : s.collected,
        hintActive: false,
        lastResult: {
          word,
          isCorrect,
          points: totalPoints,
          timeBonus,
          hintPenalty,
        },
      }));

      await wait(isCorrect ? 1500 : 1200);

      if (state.currentRound >= GAME_CONFIG.TOTAL_ROUNDS) {
        setState((s) => ({ ...s, phase: 'complete' }));
        isProcessingRef.current = false;
        return;
      }
      isProcessingRef.current = false;
      startRound();
    },
    [state.phase, state.targetWord, state.streak, state.roundStartedAt, state.hintUsed, state.currentRound, startRound]
  );

  /** 힌트 사용 (정답 GLB 1.5초간 빛남) */
  const handleHint = useCallback(() => {
    if (state.phase !== 'playing' || state.hintUsed || !state.targetWord) return;
    setState((s) => ({ ...s, hintUsed: true, hintActive: true }));
    // 1.5초 후 외곽선 끔
    setTimeout(() => {
      setState((s) => ({ ...s, hintActive: false }));
    }, 1500);
  }, [state.phase, state.hintUsed, state.targetWord]);

  // (TTS 제거 — 사용자 요청)

  const handleRestart = useCallback(() => {
    usedWordsRef.current.clear();
    setState(createInitialState());
  }, []);

  const feedbackWord = useMemo(
    () => (state.phase === 'feedback' ? state.lastResult?.word ?? null : null),
    [state.phase, state.lastResult]
  );
  const feedbackIsCorrect = state.lastResult?.isCorrect ?? false;
  const activeChoiceEns = useMemo(() => state.fourChoices.map((w) => w.en), [state.fourChoices]);

  // 힌트 활성 시 정답 영단어 (외곽선용)
  const hintTargetEn = state.hintActive && state.targetWord ? state.targetWord.en : null;

  return (
    <>
      <PirateScene
        itemPlacements={state.itemPlacements}
        activeChoiceEns={activeChoiceEns}
        hintTargetEn={hintTargetEn}
        feedbackWord={feedbackWord}
        feedbackIsCorrect={feedbackIsCorrect}
        onChoiceClick={handleClick}
      />
      <PirateQuestUI
        state={state}
        onExit={onExit}
        onHint={handleHint}
        onRestart={handleRestart}
      />
    </>
  );
}
