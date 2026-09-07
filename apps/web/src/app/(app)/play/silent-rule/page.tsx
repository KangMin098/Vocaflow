// apps/web/src/app/(app)/play/silent-rule/page.tsx — /play/silent-rule
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/silent-rule/SilentRuleGame').then((m) => ({ default: m.SilentRuleGame })),
  { ssr: false, loading: () => <GameLoading message="문을 여는 중…" /> },
);

export default function SilentRulePlayPage() {
  // 학습자 단어에서 철자 규칙 쌍을 파생해 격자에 우선 배치한다.
  // 파생에 실패한 규칙만 내장 뱅크로 채운다.
  //
  // minWords 12 → 6 (v07.11).
  //
  // 먼저 확인한 것: **격자는 풀 크기에 매인 적이 없다.** 규칙마다 내장 뱅크가 16~20쌍을
  // 대므로 pool 0 에서도 200판 시뮬 전부 6~10칸이 빈칸·중복·증거유출 0 으로 찼다.
  // 풀에 매여 있던 것은 하나뿐 — 학습자 단어가 판에 등장하는가(deck.mineCount).
  //
  // 12 를 지불하고 산 것: 실 DB(shared_words 세트) 시뮬에서 12단어의 mineCount 0 비율은
  // 9.7% 였다. 즉 25.4% 의 도서 챕터를 거절하고도 10% 는 못 막았다.
  // 그래서 문턱 대신 **단어당 파생률**을 고쳤다(rules.ts v07.11 — 품사·굴절형 없이 도는
  // 규칙 4개 추가). 21.4% → 34.4%. 그 결과 실 세트 시뮬:
  //     6단어 → mineCount 0 이 31.8% → **9.1%** (봉인이 내 단어에 걸리는 판 66.3%)
  //     8단어 → 19.2% → 7.7%
  //    12단어 →  9.7% → 3.2%
  //
  // 6 아래로 더 내리지 않는 이유는 격자가 아니라 **봉인**이다. 봉인은 이 게임에서
  // 유일한 비-assisted FSRS 인출(화면에 없는 규칙으로 철자를 손으로 생성)인데,
  // 파생 쌍이 1개뿐이면 그 쌍은 격자 노출에 쓰고 봉인은 뱅크 단어가 된다.
  // 봉인이 내 단어에 걸리는 판 비율: 6단어 66.3% · 5단어 45.0% · 4단어 27.8%.
  // 5 이하에서는 "내 단어를 실제로 인출한 세션"이 절반을 밑돈다 — 거기가 하한이다.
  // 그래도 0쌍이 될 수는 있으므로 게임이 deck.mineCount === 0 을 화면에 밝힌다.
  return (
    <Suspense fallback={<GameLoading message="문을 여는 중…" />}>
      <GamePlayScaffold
        module="silent-rule"
        label="The Silent Rule"
        minWords={6}
        loadingMessage="문을 여는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
