// apps/web/src/app/(app)/play/word-orrery/page.tsx — /play/word-orrery
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/word-orrery/WordOrreryGame').then((m) => ({ default: m.WordOrreryGame })),
  { ssr: false, loading: () => <GameLoading message="항성계를 정렬하는 중…" /> },
);

export default function WordOrreryPlayPage() {
  // 한 항성계 = 여섯 성좌 = 학습자 단어 6개. 내 단어(due 큐)로 매 판 새 성계를 만든다.
  // 단어가 6개에 못 미치면 스캐폴드가 맛보기로 degrade 하고(wordPool=undefined),
  // 게임은 내장 14단어 뱅크에서 6개를 뽑아 그때도 판마다 성계가 달라진다.
  return (
    <Suspense fallback={<GameLoading message="항성계를 정렬하는 중…" />}>
      <GamePlayScaffold
        module="word-orrery"
        label="The Word Orrery"
        minWords={6}
        loadingMessage="항성계를 정렬하는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
