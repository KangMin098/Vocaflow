// apps/web/src/app/(app)/play/silent-rule/page.tsx — /play/silent-rule
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/silent-rule/SilentRuleGame').then((m) => ({ default: m.SilentRuleGame })),
  { ssr: false, loading: () => <GameLoading message="패널을 여는 중…" /> },
);

export default function SilentRulePlayPage() {
  // 내장 규칙 클러스터 뱅크 사용 → minWords=0.
  return (
    <Suspense fallback={<GameLoading message="패널을 여는 중…" />}>
      <GamePlayScaffold
        module="silent-rule"
        label="The Silent Rule"
        minWords={0}
        render={({ onCorrect, onWrong, onExit }) => <Game onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
