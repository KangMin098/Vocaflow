// apps/web/src/app/(app)/play/wordsmith-vigil/page.tsx — /play/wordsmith-vigil
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/wordsmith-vigil/WordsmithVigilGame').then((m) => ({ default: m.WordsmithVigilGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function WordsmithVigilPlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold module="wordsmith-vigil" label="Wordsmith's Vigil" minWords={5} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
