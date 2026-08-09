// apps/web/src/app/(app)/play/lexicon-estate/page.tsx — /play/lexicon-estate
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-estate/LexiconEstateGame').then((m) => ({ default: m.LexiconEstateGame })),
  { ssr: false, loading: () => <GameLoading message="도면을 펼치는 중…" /> },
);

export default function LexiconEstatePlayPage() {
  // 한 판이 3층 × 최대 9칸 = 22개 방 + 4지선다 오답 보기까지 쓰므로 12개부터 내 단어로 짓는다.
  // 그보다 적으면 스캐폴드가 wordPool 을 넘기지 않고(demo), 게임이 내장 맛보기 뱅크로 돈다.
  return (
    <Suspense fallback={<GameLoading message="도면을 펼치는 중…" />}>
      <GamePlayScaffold
        module="lexicon-estate"
        label="Lexicon Estate"
        minWords={12}
        loadingMessage="도면을 펼치는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
