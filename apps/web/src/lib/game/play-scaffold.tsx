// apps/web/src/lib/game/play-scaffold.tsx
// 게임 플레이 라우트 공용 스캐폴드 — 단어 스코프 해석 · 결과 기록 · 복귀 · ResourceContext.
// 각 /play/<game>/page.tsx 는 이 스캐폴드에 게임 render 만 넘겨 얇게 유지.
//
// 스코프 해석은 `useGameWordScope`(explicit → mine → demo) 단일 출처.
// 독립 3D 페이지(/play/wordblitz)도 같은 훅을 써서 두 경로가 어긋나지 않는다.

'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { GameLoading, NotEnoughWords, type Word, type ArcadeGameId } from '@/components/game/_shared/gamekit';
import { useGameWordScope } from '@/lib/game/use-word-scope';
import { useGameSessionRecorder } from '@/lib/game/use-session-recorder';
import { gameResourceContext } from '@/lib/game/scope-resource';
import { recordGameResult } from '@/lib/game/record-result';
import { resolveSessionReturnHref } from '@/lib/layout/session-return';

interface RenderArgs {
  wordPool?: Word[];
  onCorrect: (word: Word) => void;
  onWrong: (word: Word) => void;
  onExit: () => void;
}

export function GamePlayScaffold({
  module,
  label,
  minWords = 4,
  loadingMessage,
  render,
}: {
  module: ArcadeGameId;
  label: string;
  minWords?: number;
  loadingMessage?: string;
  render: (args: RenderArgs) => ReactNode;
}) {
  const router = useRouter();
  const scope = useGameWordScope({ label, minWords });
  // 셸 X·Esc·뒤로가기까지 포함해 세션 종료 시 scores·XP 를 반드시 남긴다.
  const session = useGameSessionRecorder({ module, scope });

  if (scope.loading) {
    return <GameLoading message={loadingMessage ?? '단어 불러오는 중…'} />;
  }

  if (scope.insufficient) {
    return (
      <NotEnoughWords
        need={minWords}
        onExit={() => router.push(resolveSessionReturnHref(scope.from, scope.text, '/wordvault'))}
      />
    );
  }

  const onExit = () => {
    session.flush();
    router.push(resolveSessionReturnHref(scope.from, scope.text, '/arcade'));
  };

  const onCorrect = (word: Word) => {
    session.countCorrect();
    void recordGameResult({ word: word.en, isCorrect: true, module });
  };
  const onWrong = (word: Word) => {
    session.countWrong();
    void recordGameResult({ word: word.en, isCorrect: false, module });
  };

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext resource={gameResourceContext(scope)} />
      {render({ wordPool: scope.words, onCorrect, onWrong, onExit })}
    </main>
  );
}
