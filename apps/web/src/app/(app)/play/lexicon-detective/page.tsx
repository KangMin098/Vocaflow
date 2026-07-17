// apps/web/src/app/(app)/play/lexicon-detective/page.tsx — /play/lexicon-detective
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-detective/LexiconDetectiveGame').then((m) => ({ default: m.LexiconDetectiveGame })),
  { ssr: false, loading: () => <GameLoading message="사건철을 여는 중…" /> },
);

export default function LexiconDetectivePlayPage() {
  // 내장 사건 뱅크(현장·서사 큐레이션) 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="사건철을 여는 중…" />}>
      <GamePlayScaffold
        module="lexicon-detective"
        label="Lexicon Detective"
        minWords={0}
        render={({ onCorrect, onWrong, onExit }) => <Game onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
