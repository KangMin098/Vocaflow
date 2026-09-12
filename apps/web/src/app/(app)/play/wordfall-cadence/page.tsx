// apps/web/src/app/(app)/play/wordfall-cadence/page.tsx — /play/wordfall-cadence
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/wordfall-cadence/WordfallCadenceGame').then((m) => ({ default: m.WordfallCadenceGame })),
  { ssr: false, loading: () => <GameLoading message="게임 초기화 중…" /> },
);

// minWords 8 — 종지(cadence) 보드가 표적 3 + 미끼 3 으로 6칸을 채운다.
// 정확히 6이면 15문제와 종지 9슬롯이 전부 같은 6단어에서 나오고, 열기 2 이상(5지)에서
// 6개 중 5개가 항상 보드에 올라 정답 확률이 1/5 로 고정된다(v07.10 반증). 8이면 5지
// 보드가 8중 5, 종지 보드가 8중 6 — 미끼가 실제로 미끼 노릇을 한다.
export default function WordfallCadencePlayPage() {
  return (
    <Suspense fallback={<GameLoading message="게임 초기화 중…" />}>
      <GamePlayScaffold module="wordfall-cadence" label="Wordfall Cadence" minWords={8} render={(p) => <Game {...p} />} />
    </Suspense>
  );
}
