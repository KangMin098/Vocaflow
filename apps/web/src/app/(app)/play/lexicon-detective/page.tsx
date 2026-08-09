// apps/web/src/app/(app)/play/lexicon-detective/page.tsx — /play/lexicon-detective
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-detective/LexiconDetectiveGame').then((m) => ({ default: m.LexiconDetectiveGame })),
  { ssr: false, loading: () => <GameLoading message="사건철을 여는 중…" /> },
);

export default function LexiconDetectivePlayPage() {
  // 사건(증거 봉투·조서 진술·함정·위증)을 학습자 단어장에서 절차적으로 생성한다.
  // 진술 5줄 + 함정 봉투 5개 = 최대 10개 어휘가 필요하고, 게임 내부에서 다시 뜻 중복을
  // 제거하므로 여기서 10개를 요구한다(내부 하한 8).
  return (
    <Suspense fallback={<GameLoading message="사건철을 여는 중…" />}>
      <GamePlayScaffold
        module="lexicon-detective"
        label="Lexicon Detective"
        minWords={10}
        loadingMessage="사건철을 여는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
