// apps/web/src/app/(app)/play/connections/page.tsx — /play/connections
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/connections/ConnectionsGame').then((m) => ({ default: m.ConnectionsGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function ConnectionsPlayPage() {
  // 격자 한 판이 16타일(규칙 그룹 + 침입자)이라 최소 16단어가 필요하다.
  // v07.9 이전에는 내장 큐레이션 뱅크만 돌려 minWords=0 이었고, 그 탓에 학습자
  // 단어장이 한 글자도 쓰이지 않아 learning_records 가 0건이었다.
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold
        module="connections"
        label="Connections"
        minWords={16}
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
