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
        // 한 세션 = 중복 없는 단어 12개(길이 오름차순). 스코프가 작아도 최소 6개는 있어야
        // "매 판 다른 단어 · 겹치지 않는 라운드"가 성립한다.
        minWords={6}
        render={(p) => <Game {...p} />}
      />
    </Suspense>
  );
}
