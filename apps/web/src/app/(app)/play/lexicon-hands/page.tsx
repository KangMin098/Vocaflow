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

// minWords=8 (v07.11 · 16 에서 내림).
//
// 예전 16 은 "마지막 계약에서 손패 9장 + 주문 5건"이라는 **고정 판** 을 채우는 데 필요한
// 숫자였다. 그 판이 상수였기 때문에 학습자가 고른 도서 챕터·공용 단어장의 31.4% 가
// 입장 자체를 거절당했다(653세트 실측 · 1사분위 11단어 · 중앙값 30).
//
// 이제 손패·주문 칸·목표·납기가 전부 정제 풀 크기의 함수다(LexiconHandsGame:buildRounds).
// 게임이 구조적으로 성립하는 하한은 **정제 후 6단어** —
//   주문 2건(묶음 배수가 의미를 갖는 최소) + 미끼 3장(마지막 칸이 소거법으로
//   자동 정답이 되지 않는 최소) = 손패 5장, 여기에 반품·재드로우용 여분 1장.
// 게이트는 정제 **전** 개수를 보므로, buildPool 이 걷어내는 몫(뜻 중복 · 2어 표제어)을
// 4/3배 여유로 얹어 8 로 둔다. 8 아래로 내리면 정제 후 6을 못 넘기는 자료가 늘어
// 통과시켜 놓고 안에서 맛보기로 갈아타는(FSRS 적재 0) 경로가 되살아난다.
const MIN_WORDS = 8;

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
