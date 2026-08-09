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
  // 있으면 학습자 단어와 **정확히 일치**하는 주문이 봉인으로 우선 배치되고, 그 봉인에만
  // "내 단어장" 한 줄이 붙는다(Context-Dependent 연결 + FSRS 실적재).
  //
  // minWords=0 은 안 된다 — useGameWordScope 는 minWords>0 일 때만 내 복습 큐를 조회한다.
  // 0 이면 스코프 없이 들어온 학습자의 단어를 영영 안 쓰고 recordGameResult 가 전부
  // silent skip 된다(v07.8 DB 실측: 큐레이션 계열 10종이 실제로 0건이었다).
  //
  // v07.10 — 6 → 1. use-word-scope 의 `insufficient = kind==='explicit' && !enough` 때문에
  // `?set=` 으로 들어온 5단어짜리 챕터가 NotEnoughWords 로 **차단**됐다. 내용이 전부 내장
  // 격자인 이 게임에서 그 차단은 부당하다(단어 0개로도 성립하는 게임이 입장을 막았다).
  // 1 이면 explicit 스코프는 단어가 하나라도 있으면 통과하고, mine 스코프는 지금처럼
  // 조회되며, 겹치는 봉인이 없으면 게임 화면이 '맛보기 격자' 라벨을 스스로 단다.
  //
  // 스케일 다운 방식 — 이 게임은 판 크기를 줄이지 않는다. 회랑 4개 · 봉인 14개는 내장
  // 형태소 격자(접두사 8 × 어근 40)에서 나오므로 단어가 적어도 판이 짧아질 이유가 없다.
  // 대신 **학습자 단어가 봉인으로 들어가는 개수**가 풀 크기의 함수다(800세션×풀크기 시뮬):
  //   풀 0개 → 내 단어 봉인 0.00 · 1개 → 0.94 · 4개 → 3.97 · 8개 → 5.72 · 12개 → 6.63
  //   · 24개 → 7.84 (생성 실패 0건 · 봉인 수는 어느 풀에서도 14개 그대로)
  // 즉 단어가 적으면 "내 복습에 닿는 봉인"만 줄고 게임은 언제나 성립한다 — 못 여는 것보다
  // 낫다는 원칙 그대로다.
  return (
    <Suspense fallback={<GameLoading message="회랑을 여는 중…" />}>
      <GamePlayScaffold
        module="morpheme-rules"
        label="Morpheme Rules"
        minWords={1}
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
