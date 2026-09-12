// apps/web/src/app/(app)/play/cascade/page.tsx — /play/cascade
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/cascade/CascadeGame').then((m) => ({ default: m.CascadeGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

export default function CascadePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      {/* minWords 5 = 게임이 진짜로 성립하는 하한.
          16칸 보드는 서로 다른 단어 4개(logic.DISTINCT_MIN)면 장수 상한 안에서 채워지고,
          찍기 정답률 25% 는 물방울 3개로 완주가 불가능하다(시뮬 완주율 0%). 5 로 잡는 건
          ko 완전일치 중복 제거로 한 개쯤 빠져도 게임 안에서 튕기지 않게 하는 여유분.
          목표 인출 수·장수 상한·만조 환급은 풀 크기에 따라 함께 줄어든다(goalFor) —
          단어가 적으면 판이 짧아질 뿐, 도서 챕터가 게임을 못 여는 일은 없어야 한다. */}
      <GamePlayScaffold module="cascade" label="Cascade" minWords={5} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
