// apps/web/src/app/(app)/play/lexicon-hands/page.tsx — /play/lexicon-hands
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-hands/LexiconHandsGame').then((m) => ({ default: m.LexiconHandsGame })),
  { ssr: false, loading: () => <GameLoading message="계약서를 펴는 중…" /> },
);

// minWords=12 — 마지막 계약에서 손패 9장을 서로 다른 단어로 채우고 주문 5건을 뽑아야 한다.
// 뜻이 겹치는 단어는 주문의 정답을 둘로 만들어 불공정해지므로 en·ko 양쪽으로 중복을 걷어낸 뒤
// 세는데(게임 내 buildPool), 그 정제 후에도 12개가 남아야 한 계약이 성립한다.
export default function LexiconHandsPlayPage() {
  return (
    <Suspense fallback={<GameLoading message="계약서를 펴는 중…" />}>
      <GamePlayScaffold
        module="lexicon-hands"
        label="Lexicon Hands"
        minWords={12}
        loadingMessage="주문서를 받아오는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
