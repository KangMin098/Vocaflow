// apps/web/src/app/(app)/play/lexicon-hands/page.tsx — /play/lexicon-hands
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-hands/LexiconHandsGame').then((m) => ({ default: m.LexiconHandsGame })),
  { ssr: false, loading: () => <GameLoading message="계약서를 펴는 중…" /> },
);

// minWords=16 — 마지막 계약에서 손패 9장을 서로 다른 단어로 채우고 주문 5건을 뽑아야 한다.
// 게임 내 buildPool 이 (a) 뜻이 겹치는 단어(한 주문에 정답이 둘이 되어 불공정)와
// (b) 2어 표제어(give up 등, 단일 영단어 카드가 아니다)를 걷어내므로, 게이트 숫자는
// 그 탈락분을 감안해 12 → 16 으로 올렸다. 12 로 통과한 자료가 정제 후 10 미만으로 떨어져
// 조용히 맛보기 풀로 갈아타던 경로(감사 지적)를 줄인다.
const MIN_WORDS = 16;

/**
 * 스코프 종류를 게임에 넘긴다. `?set=` / `?text=` 가 있으면 사용자가 "이 자료로"를
 * 명시한 explicit 스코프 — 정제 후 단어가 모자라도 게임이 맛보기로 바꿔치지 않고
 * 안내 화면을 띄운다(use-word-scope 의 '몰래 바꿔치지 않는다' 원칙과 동일 기준).
 */
function LexiconHandsPlay() {
  const params = useSearchParams();
  const explicit = !!(params.get('set') || params.get('text'));

  return (
    <GamePlayScaffold
      module="lexicon-hands"
      label="Lexicon Hands"
      minWords={MIN_WORDS}
      loadingMessage="주문서를 받아오는 중…"
      render={({ wordPool, onCorrect, onWrong, onExit }) => (
        <Game
          wordPool={wordPool}
          scopeKind={explicit ? 'explicit' : 'mine'}
          onCorrect={onCorrect}
          onWrong={onWrong}
          onExit={onExit}
        />
      )}
    />
  );
}

export default function LexiconHandsPlayPage() {
  return (
    <Suspense fallback={<GameLoading message="계약서를 펴는 중…" />}>
      <LexiconHandsPlay />
    </Suspense>
  );
}
