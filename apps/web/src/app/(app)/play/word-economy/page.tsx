// apps/web/src/app/(app)/play/word-economy/page.tsx — /play/word-economy
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/word-economy/WordEconomyGame').then((m) => ({ default: m.WordEconomyGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function WordEconomyPlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      {/* minWords 6 — 4지선다(정답 1 + 오답 3) 에 더해, 지분·재상장 문항은 **철자가 닮은**
          오답을 골라 난이도를 판돈에 묶는다. 후보가 6개는 돼야 그 선택이 성립한다.
          (카탈로그 GAME_CATALOG 의 word-economy minWords 는 아직 4 — 중앙에서 6으로 맞춰야 한다.) */}
      <GamePlayScaffold module="word-economy" label="Word Economy" minWords={6} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
