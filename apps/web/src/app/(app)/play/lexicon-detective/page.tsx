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
  //
  // v07.11 — minWords 10 → 6. 사건 크기를 상수가 아니라 **풀 크기의 함수**로 바꿨다:
  //   봉투 E = clamp(round(풀 × 0.7), 4, 8) · 진술 M ≤ Amax(E) · 위증 F ∈ [0, …]
  // 풀 12단어 이상이면 E = 8 로 v07.10 과 완전히 같은 판이 나오고, 그 아래에서만 작아진다.
  //
  // **6 이 하한인 이유** — 게임이 성립하는 서로 다른 뜻의 하한은 5다:
  //   봉투 4(정답 2 + 함정 2) + 위증이 빌려 쓸 봉투 밖 단어 1.
  //   4로 내리면 위증 상한이 0이 되어 '기각'이 죽고 위증 수가 0으로 특정된다(= 소거법 부활).
  //   봉투 3으로 내리면 정답이 항상 2줄이라 F = M − 2 로 역산된다.
  // 여기에 뜻 충돌 여유 1을 얹어 6. 단어 6개 중 두 개가 같은 첫 뜻을 쓰더라도
  // capacity 5 가 남아 학습자가 고른 자료 그대로 사건이 선다.
  // (시뮬: capacity 5~40 × 3사건 × 200,000판 — 불변식 위반 0건, 위증 역산 가능 조합 0건.)
  return (
    <Suspense fallback={<GameLoading message="사건철을 여는 중…" />}>
      <GamePlayScaffold
        module="lexicon-detective"
        label="Lexicon Detective"
        minWords={6}
        loadingMessage="사건철을 여는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
