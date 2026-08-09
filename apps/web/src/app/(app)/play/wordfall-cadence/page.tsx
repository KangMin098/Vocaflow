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

// minWords 6 — 종지(cadence) 구간이 표적 3 + 미끼 3 으로 6칸 보드를 채운다.
// 4개로는 종지가 자기 자신을 미끼로 쓰게 되므로 실제 하한은 6이다.
export default function WordfallCadencePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold module="wordfall-cadence" label="Wordfall Cadence" minWords={6} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
