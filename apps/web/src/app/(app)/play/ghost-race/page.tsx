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
      {/* minWords 6 — 후반 랩은 보기 5개(정답 1 + 오답 4)를 쓰고, 중복 제거 큐가 한 랩(12구간)
          안에서 같은 단어를 반복하지 않으려면 최소 6개가 필요하다. */}
      <GamePlayScaffold module="ghost-race" label="Ghost Race" minWords={6} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
