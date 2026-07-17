// apps/web/src/app/(app)/play/word-economy/page.tsx — /play/word-economy
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/word-economy/WordEconomyGame').then((m) => ({ default: m.WordEconomyGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function WordEconomyPlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold module="word-economy" label="Word Economy" minWords={4} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
