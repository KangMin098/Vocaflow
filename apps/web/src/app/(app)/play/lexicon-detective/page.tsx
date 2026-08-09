// apps/web/src/app/(app)/play/lexicon-detective/page.tsx — /play/lexicon-detective
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-detective/LexiconDetectiveGame').then((m) => ({ default: m.LexiconDetectiveGame })),
  { ssr: false, loading: () => <GameLoading message="사건철을 여는 중…" /> },
);

export default function LexiconDetectivePlayPage() {
  // 사건(증거 봉투·조서 진술·함정·위증)을 학습자 단어장에서 절차적으로 생성한다.
  // v07.10 부터 위증 수·진술 수가 매 판 추첨이라 한 사건이 쓰는 어휘는
  // 봉투 8개 + 위증 최대 3개 = 최대 11개다. 다만 게임 내부 planCase 가
  // 풀 크기에 맞춰 함정 → 위증 → 진술 줄 순으로 줄여 8개까지 안전하게 내려간다
  // (시뮬 8~40단어 × 3사건 × 4,000판 위반 0건). 카탈로그와 같은 10 을 유지한다.
  return (
    <Suspense fallback={<GameLoading message="사건철을 여는 중…" />}>
      <GamePlayScaffold
        module="lexicon-detective"
        label="Lexicon Detective"
        minWords={10}
        loadingMessage="사건철을 여는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
