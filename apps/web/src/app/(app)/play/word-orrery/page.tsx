// apps/web/src/app/(app)/play/word-orrery/page.tsx — /play/word-orrery
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/word-orrery/WordOrreryGame').then((m) => ({ default: m.WordOrreryGame })),
  { ssr: false, loading: () => <GameLoading message="항성계를 정렬하는 중…" /> },
);

export default function WordOrreryPlayPage() {
  // 항성계 크기는 자료 크기의 함수다(planOrrery) — 성좌 3~6개 + 성계 밖 오답 후보.
  // 4단어면 3성좌·봉인 2개(인출 5회)로 짧은 판이 서고, 10단어부터 6성좌·봉인 4개가 된다.
  // 도서 챕터·공용 세트의 절반 이상이 24단어 미만이라 하한을 6으로 두면 그 자료들이
  // 게임을 아예 못 연다 — 판이 짧아지는 편이 못 여는 것보다 낫다.
  // 4단어에 못 미치면 스캐폴드가 맛보기로 degrade 하고(wordPool=undefined),
  // 게임은 내장 14단어 뱅크에서 성계를 만든다.
  return (
    <Suspense fallback={<GameLoading message="항성계를 정렬하는 중…" />}>
      <GamePlayScaffold
        module="word-orrery"
        label="The Word Orrery"
        minWords={4}
        loadingMessage="항성계를 정렬하는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
