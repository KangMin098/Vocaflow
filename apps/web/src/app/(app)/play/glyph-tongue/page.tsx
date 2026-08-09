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
  // v07.9 — minWords=0 이던 시절 이 게임은 기본 진입에서 학습자 단어를 **한 번도** 받지
  // 못했다(use-word-scope: minWords 0 = 내장 뱅크 전용 → loadsPool=false). 그래서
  // recordGameResult 가 내장 단어를 vocabularies 에서 못 찾아 FSRS 에 아무것도 남지 않았다.
  // 이제 due 큐를 받는다. 예문이 붙은 단어가 모자라면 게임이 큐레이션 룬으로 자리를
  // 메우므로(GlyphTongueGame.buildRun) 단어가 적은 학습자도 막히지 않는다.
  return (
    <Suspense fallback={<GameLoading message="비문을 여는 중…" />}>
      <GamePlayScaffold
        module="glyph-tongue"
        label="The Glyph Tongue"
        minWords={4}
        render={({ wordPool, onCorrect, onWrong, onExit }) => <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
