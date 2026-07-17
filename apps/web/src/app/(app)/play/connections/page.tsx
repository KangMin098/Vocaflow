// apps/web/src/app/(app)/play/connections/page.tsx — /play/connections
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/connections/ConnectionsGame').then((m) => ({ default: m.ConnectionsGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function ConnectionsPlayPage() {
  // Connections 는 내장 큐레이션 뱅크 사용(스코프 단어 불필요) → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold
        module="connections"
        label="Connections"
        minWords={0}
        render={({ onCorrect, onExit }) => <Game onCorrect={onCorrect} onExit={onExit} />}
      />
    </Suspense>
  );
}
