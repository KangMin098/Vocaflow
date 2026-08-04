// apps/web/src/app/(app)/play/wordfall-cadence/page.tsx — /play/wordfall-cadence
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/wordfall-cadence/WordfallCadenceGame').then((m) => ({ default: m.WordfallCadenceGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function WordfallCadencePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold module="wordfall-cadence" label="Wordfall Cadence" minWords={4} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
