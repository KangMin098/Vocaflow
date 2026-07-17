// apps/web/src/app/(app)/play/lexicon-hands/page.tsx — /play/lexicon-hands
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-hands/LexiconHandsGame').then((m) => ({ default: m.LexiconHandsGame })),
  { ssr: false, loading: () => <GameLoading message="테이블을 펴는 중…" /> },
);

export default function LexiconHandsPlayPage() {
  // 내장 속성-태그 덱 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="테이블을 펴는 중…" />}>
      <GamePlayScaffold
        module="lexicon-hands"
        label="Lexicon Hands"
        minWords={0}
        render={({ wordPool, onCorrect, onWrong, onExit }) => <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
