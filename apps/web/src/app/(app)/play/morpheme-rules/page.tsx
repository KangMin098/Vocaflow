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
  // 내장 형태소·회랑 뱅크 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="회랑을 여는 중…" />}>
      <GamePlayScaffold
        module="morpheme-rules"
        label="Morpheme Rules"
        minWords={0}
        render={({ onCorrect, onWrong, onExit }) => <Game onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
