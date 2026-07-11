// apps/web/src/app/(app)/play/ghost-race/page.tsx — /play/ghost-race
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/ghost-race/GhostRaceGame').then((m) => ({ default: m.GhostRaceGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function GhostRacePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold module="ghost-race" label="Ghost Race" minWords={4} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
