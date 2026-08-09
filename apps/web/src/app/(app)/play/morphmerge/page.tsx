// apps/web/src/app/(app)/play/morphmerge/page.tsx — /play/morphmerge
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/morphmerge/MorphmergeGame').then((m) => ({ default: m.MorphmergeGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function MorphmergePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      {/* minWords=8 — 한 라운드는 대상 어족 1개(굴절형 보유 단어) + 방해 타일 8~14개로 짜인다.
          8개면 스코프에서 굴절형 보유 단어가 보통 4개 이상 나와 내장 뱅크 없이 판이 돌고,
          굴절형이 없는 나머지 단어도 방해 타일로 전부 판에 오른다. */}
      <GamePlayScaffold module="morphmerge" label="Morphmerge" minWords={8} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
