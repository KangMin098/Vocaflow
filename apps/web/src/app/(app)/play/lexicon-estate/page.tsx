// apps/web/src/app/(app)/play/lexicon-estate/page.tsx — /play/lexicon-estate
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-estate/LexiconEstateGame').then((m) => ({ default: m.LexiconEstateGame })),
  { ssr: false, loading: () => <GameLoading message="도면을 펼치는 중…" /> },
);

export default function LexiconEstatePlayPage() {
  // 내장 의미장 뱅크(6 카테고리 × 4) 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="도면을 펼치는 중…" />}>
      <GamePlayScaffold
        module="lexicon-estate"
        label="Lexicon Estate"
        minWords={0}
        render={({ onCorrect, onWrong, onExit }) => <Game onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
