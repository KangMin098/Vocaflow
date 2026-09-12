// apps/web/src/app/(app)/play/word-customs/page.tsx — /play/word-customs
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/word-customs/WordCustomsGame').then((m) => ({ default: m.WordCustomsGame })),
  { ssr: false, loading: () => <GameLoading message="심사대를 여는 중…" /> },
);

export default function WordCustomsPlayPage() {
  // 위조 서류를 **학습자 단어에서 생성**하므로 실 어휘가 필요하다(minWords=0 이던 시절엔
  // use-word-scope 가 'mine'(내 복습 큐)조차 조회하지 않아 아무리 플레이해도 FSRS 기록이 0이었다).
  // 최소 8개 — 2일 근무(하루 4건) 편성의 하한. 12개 이상이면 3일 근무로 늘어난다.
  return (
    <Suspense fallback={<GameLoading message="심사대를 여는 중…" />}>
      <GamePlayScaffold
        module="word-customs"
        label="Word Customs"
        minWords={8}
        render={({ wordPool, onCorrect, onWrong, onExit }) => <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />}
      />
    </Suspense>
  );
}
