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
  // 학습자 단어에서 철자 규칙 쌍을 파생해 격자에 우선 배치한다.
  // 파생에 실패한 규칙만 내장 뱅크로 채운다.
  //
  // minWords 6 → 12 (v07.10 반증 #5).
  //   6단어가 전부 명사/형용사면(animal·area·arm·action·answer·artist) 7개 파생기가
  //   전부 null 을 돌려주고 격자가 통째로 내장 뱅크가 된다 — 카탈로그는 이 게임을
  //   source:'mine' 으로 광고하는데 학습자 단어는 한 글자도 안 나오는 상태였다.
  //   due 상위 40단어 실측에서 12단어면 굴절 규칙 2개 이상이 붙는다.
  //   그래도 0쌍이 될 수는 있으므로 게임이 deck.mineCount === 0 을 화면에 밝힌다.
  return (
    <Suspense fallback={<GameLoading message="문을 여는 중…" />}>
      <GamePlayScaffold
        module="silent-rule"
        label="The Silent Rule"
        minWords={12}
        loadingMessage="문을 여는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
