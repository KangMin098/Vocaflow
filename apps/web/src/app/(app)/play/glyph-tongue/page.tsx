// apps/web/src/app/(app)/play/glyph-tongue/page.tsx — /play/glyph-tongue
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/glyph-tongue/GlyphTongueGame').then((m) => ({ default: m.GlyphTongueGame })),
  { ssr: false, loading: () => <GameLoading message="비문을 여는 중…" /> },
);

export default function GlyphTonguePlayPage() {
  // 내장 석실 뱅크(문맥·비문 큐레이션) 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="비문을 여는 중…" />}>
      <GamePlayScaffold
        module="glyph-tongue"
        label="The Glyph Tongue"
        minWords={0}
        render={({ wordPool, onCorrect, onWrong, onExit }) => <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
