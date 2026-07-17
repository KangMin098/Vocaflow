// apps/web/src/app/(app)/play/cascade/page.tsx — /play/cascade
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/cascade/CascadeGame').then((m) => ({ default: m.CascadeGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function CascadePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold module="cascade" label="Cascade" minWords={6} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
