// apps/web/src/app/(app)/play/word-customs/page.tsx — /play/word-customs
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/word-customs/WordCustomsGame').then((m) => ({ default: m.WordCustomsGame })),
  { ssr: false, loading: () => <GameLoading message="심사대를 여는 중…" /> },
);

export default function WordCustomsPlayPage() {
  // 내장 여행자 뱅크(여권·위조 큐레이션) 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="심사대를 여는 중…" />}>
      <GamePlayScaffold
        module="word-customs"
        label="Word Customs"
        minWords={0}
        render={({ wordPool, onCorrect, onWrong, onExit }) => <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
