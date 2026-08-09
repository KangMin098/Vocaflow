// apps/web/src/app/(app)/play/cascade/page.tsx — /play/cascade
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/cascade/CascadeGame').then((m) => ({ default: m.CascadeGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function CascadePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      {/* 보드에 서로 다른 단어가 6~8장 동시에 올라간다(정원 6 · 하드 캡 8) — 그보다
          적으면 소거법으로 뜻을 몰라도 풀리고(인출 무력화), 같은 단어만 겹쳐 판이
          단조로워진다. 뜻이 겹치는 단어(줄이다/줄어들다)는 게임 쪽에서 같은 보드에
          올리지 않으므로, 스코프는 서로 다른 단어 8개만 보장하면 된다. */}
      <GamePlayScaffold module="cascade" label="Cascade" minWords={8} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
