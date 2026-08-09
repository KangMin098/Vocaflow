// apps/web/src/app/(app)/play/silent-rule/page.tsx — /play/silent-rule
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/silent-rule/SilentRuleGame').then((m) => ({ default: m.SilentRuleGame })),
  { ssr: false, loading: () => <GameLoading message="문을 여는 중…" /> },
);

export default function SilentRulePlayPage() {
  // 학습자 단어에서 철자 규칙 쌍을 파생해 격자에 우선 배치한다(그 칸만 FSRS 기록).
  // 파생에 실패한 규칙만 내장 뱅크로 채우므로 6개면 세션이 성립한다.
  return (
    <Suspense fallback={<GameLoading message="문을 여는 중…" />}>
      <GamePlayScaffold
        module="silent-rule"
        label="The Silent Rule"
        minWords={6}
        loadingMessage="문을 여는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
