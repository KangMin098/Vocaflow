// apps/web/src/app/(app)/play/daily-blitz/page.tsx — /play/daily-blitz
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/daily-blitz/DailyBlitzGame').then((m) => ({ default: m.DailyBlitzGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function DailyBlitzPlayPage() {
  // 데일리 뱅크 사용(스코프 무관) → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold
        module="daily-blitz"
        label="Daily Blitz"
        minWords={0}
        render={({ onCorrect, onWrong, onExit }) => <Game onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
