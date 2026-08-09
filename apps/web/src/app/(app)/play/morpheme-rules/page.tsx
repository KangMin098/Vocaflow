// apps/web/src/app/(app)/play/morpheme-rules/page.tsx — /play/morpheme-rules
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/morpheme-rules/MorphemeRulesGame').then((m) => ({ default: m.MorphemeRulesGame })),
  { ssr: false, loading: () => <GameLoading message="회랑을 여는 중…" /> },
);

export default function MorphemeRulesPlayPage() {
  // 회랑은 내장 형태소 격자에서 절차 생성되므로 단어장이 비어도 성립한다 → minWords=0.
  // 다만 wordPool 이 있으면 학습자 단어에 등장하는 어근이 회랑에 우선 배치되고,
  // 봉인을 풀 때 "내 단어장" 한 줄이 붙는다(Context-Dependent 연결).
  return (
    <Suspense fallback={<GameLoading message="회랑을 여는 중…" />}>
      <GamePlayScaffold
        module="morpheme-rules"
        label="Morpheme Rules"
        minWords={0}
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
