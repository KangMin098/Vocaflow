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
  // minWords 는 **buildTiles 통과 후의 타일 수**가 아니라 raw 단어 수라, 16 으로 잡으면
  // 3자 미만·14자 초과·정규화 중복이 걸러진 뒤 보드가 무너졌다(v07.10 반증 실측:
  // 통과 타일 16개일 때 보드 평균 14.01칸 · 최소 9칸 · 16칸 미만 82.4% · 격자1 생성
  // 실패 2.0%). 24 로 올려 설계 스펙(그룹 3/3/2 · 보드 16칸)이 성립하는 구간에서만
  // 진입시킨다. 세 격자를 한 단어도 겹치지 않게 채우는 데 필요한 48칸 중 모자란
  // 자리는 게임 쪽에서 맛보기 단어(own=false · FSRS 미적재)로 메운다.
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold
        module="connections"
        label="Connections"
        minWords={24}
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
