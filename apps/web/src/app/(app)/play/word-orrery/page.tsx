// apps/web/src/app/(app)/play/word-orrery/page.tsx — /play/word-orrery
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/word-orrery/WordOrreryGame').then((m) => ({ default: m.WordOrreryGame })),
  { ssr: false, loading: () => <GameLoading message="항성계를 정렬하는 중…" /> },
);

export default function WordOrreryPlayPage() {
  // 내장 성좌 뱅크(현상=수제 오센틱 콘텐츠) 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="항성계를 정렬하는 중…" />}>
      <GamePlayScaffold
        module="word-orrery"
        label="The Word Orrery"
        minWords={0}
        render={({ onCorrect, onWrong, onExit }) => <Game onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
