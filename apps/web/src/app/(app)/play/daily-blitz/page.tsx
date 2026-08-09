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
  // v07.10 — 게임 쪽 dailyN 이 min(10, max(5, pool−5)) 로 바뀌어 8 이 정확히 하한이 됐다:
  //   pool 8 → 오늘의 세트 5문항 + 예비어 3개(연장전 재고 겸 "미공개 오답 후보").
  //   예비어가 0 이면 매 문항의 정답 공개가 소거법 단서가 되어 후반 문항이 영어 없이 확정된다.
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
