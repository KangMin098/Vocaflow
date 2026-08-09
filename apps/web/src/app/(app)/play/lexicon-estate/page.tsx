// apps/web/src/app/(app)/play/lexicon-estate/page.tsx — /play/lexicon-estate
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-estate/LexiconEstateGame').then((m) => ({ default: m.LexiconEstateGame })),
  { ssr: false, loading: () => <GameLoading message="도면을 펼치는 중…" /> },
);

export default function LexiconEstatePlayPage() {
  // 한 판이 3층 × 최대 9칸 = 22개 방이고 **같은 단어를 다시 내지 않는다**(v07.9 에서
  // 재출제 폐지 — 60~120초 전에 뜻을 본 단어를 다시 묻는 건 인출이 아니라 재인이었다).
  // 그래서 20개부터 내 단어로 짓는다. 그보다 적으면 스캐폴드가 부족 안내를 띄운다.
  return (
    <Suspense fallback={<GameLoading message="도면을 펼치는 중…" />}>
      <GamePlayScaffold
        module="lexicon-estate"
        label="Lexicon Estate"
        minWords={20}
        loadingMessage="도면을 펼치는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
