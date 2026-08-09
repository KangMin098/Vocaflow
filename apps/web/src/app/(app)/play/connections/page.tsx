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
  // v07.10 은 24 였다. 규격이 "16칸 × 3격자" 로 고정돼 있어 세 격자를 겹치지 않게
  // 채우려면 48타일이 필요했고, 그 아래에서는 보드가 무너졌기 때문이다. 그런데 DB
  // 실측상 공용 단어장·도서 챕터 653세트의 **43.2%** 가 24단어에 미달한다 — 학습자가
  // 고른 챕터의 절반 가까이를 "자료가 모자라다"며 돌려보내고 있었다.
  //
  // v07.11 에서 규격 자체를 풀 크기의 함수로 바꿨다(puzzle.ts planFor). 이제 하한은
  // 규격이 아니라 **한 격자가 공정하게 성립하는 최소치**다:
  //   그룹 4칸 + 침입자 4칸 = 8타일.
  //   · 그룹이 4칸인 것은 UI 계약(확인 n/4)이자 인지부하 상한이라 못 줄인다.
  //   · 침입자가 4칸 미만이면 마지막 그룹이 소거법으로 공짜가 된다(3라운드에서 막은
  //     익스플로짓). 4칸이면 마지막 확정 앞에서도 C(8,4)=70 가지가 남는다.
  // 그래서 8 아래로는 못 내린다. 8~19단어 구간은 게임이 맛보기 단어로 20타일까지만
  // 자리를 메우고(own=false · FSRS 미적재) 격자 수·보드 칸 수를 줄여서 돈다 —
  // 20단어 이상이면 맛보기를 한 타일도 섞지 않는다.
  //
  // 실측(실 DB 세트 275개 × 20세션): 생성 실패 0 · 완주 100% · 중복 타일 0 ·
  // 침입자 4칸 미만 0 · 노출 단어가 그룹에 오른 격자 0.
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold
        module="connections"
        label="Connections"
        minWords={8}
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
