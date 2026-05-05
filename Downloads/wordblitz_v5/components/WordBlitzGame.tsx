// apps/web/src/components/game/wordblitz/WordBlitzGame.tsx
// WordBlitz 메인 게임 컨테이너
//
// v4.2 변경:
//   - ClawScene에 targetsRef 전달 (조이스틱 반응용)

'use client';

import { Suspense } from 'react';
import { useWordBlitzGame } from './useWordBlitzGame';
import { ClawScene } from './ClawScene';
import {
  WordBlitzHUD,
  WordBlitzHeader,
  WordBlitzLoading,
  WordBlitzResultToast,
  MeaningBanner,
  KbdHints,
} from './WordBlitzUI';
import type { Word } from '@/lib/wordblitz/data';
import './WordBlitzUI.module.css';

interface WordBlitzGameProps {
  wordPool?: Word[];
  onCorrect?: (word: Word) => void;
  onWrong?: (word: Word) => void;
  onExit?: () => void;
  enableSpeech?: boolean;
}

export function WordBlitzGame({
  wordPool,
  onCorrect,
  onWrong,
  onExit,
  enableSpeech = true,
}: WordBlitzGameProps) {
  const { state, liveStateRef, targetsRef, updatePhysics } = useWordBlitzGame({
    wordPool,
    onCorrect,
    onWrong,
    enableSpeech,
  });

  return (
    <>
      <Suspense fallback={<WordBlitzLoading message="3D 모델 로딩 중..." />}>
        <ClawScene
          state={state}
          liveStateRef={liveStateRef}
          targetsRef={targetsRef}
          updatePhysics={updatePhysics}
        />
      </Suspense>

      <WordBlitzHeader onExit={onExit} />
      <WordBlitzHUD score={state.score} captured={state.captured} />
      <KbdHints />
      <MeaningBanner targetWord={state.targetWord} />
      <WordBlitzResultToast result={state.lastResult} />
    </>
  );
}
