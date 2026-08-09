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
  // 회랑은 내장 형태소 격자에서 절차 생성되므로 단어장이 비어도 성립한다. wordPool 이
  // 있으면 학습자 단어에 등장하는 어근이 회랑에 우선 배치되고 봉인에 "내 단어장" 한 줄이
  // 붙는다(Context-Dependent 연결).
  //
  // 그렇다고 minWords=0 을 두면 안 된다 — useGameWordScope 는 minWords>0 일 때만
  // 내 복습 큐를 조회한다. 0 이면 스코프 없이 들어온 학습자의 단어를 **영영 안 쓰고**,
  // recordGameResult 가 전부 silent skip 되어 learning_records 가 0 으로 남는다
  // (v07.8 DB 실측: 큐레이션 계열 10종이 실제로 0건이었다).
  // 6 이면 단어가 있는 학습자는 자기 어근으로 회랑이 짜이고 FSRS 가 쌓이며,
  // 부족하면 기존대로 내장 격자로 degrade 한다(맛보기 라벨로 명시).
  return (
    <Suspense fallback={<GameLoading message="회랑을 여는 중…" />}>
      <GamePlayScaffold
        module="morpheme-rules"
        label="Morpheme Rules"
        minWords={6}
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
