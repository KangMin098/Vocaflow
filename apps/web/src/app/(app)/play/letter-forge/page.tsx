// apps/web/src/app/(app)/play/letter-forge/page.tsx — /play/letter-forge
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/letter-forge/LetterForgeGame').then((m) => ({ default: m.LetterForgeGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function LetterForgePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold
        module="letter-forge"
        label="Letter Forge"
        minWords={5}
        render={(p) => <Game {...p} />}
      />
    </Suspense>
  );
}
