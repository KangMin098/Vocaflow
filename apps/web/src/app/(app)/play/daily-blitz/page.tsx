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
  // v07.9 — 더 이상 내장 뱅크 전용 게임이 아니다. `?set=`/`?text=` 또는 내 복습 큐의 단어로
  // 오늘의 세트를 뽑는다(내장 뱅크는 폴백). minWords=8 인 이유:
  //   후반·연장 라운드가 6지선다이므로 목표어 1 + 오답 5 = 6개가 최소이고,
  //   여기에 오답을 "닮은 단어"로 고를 여지(+2)를 두어야 찍기가 통하지 않는다.
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold
        module="daily-blitz"
        label="Daily Blitz"
        minWords={8}
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
