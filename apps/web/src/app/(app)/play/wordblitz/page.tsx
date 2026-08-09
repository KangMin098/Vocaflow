// apps/web/src/app/(app)/play/wordblitz/page.tsx
// Next.js App Router - /play/wordblitz
//
// 단어 스코프는 `useGameWordScope` 공용 훅 — 스캐폴드 17종과 동일한 3단 규칙:
//   ?set=/?text= → 내 복습 큐(due) → 맛보기.
//
// v08 — "다시 하기" 가 메타 보상 0 이던 문제를 여기서 고친다.
//   useGameSessionRecorder 는 scoredRef 1회 가드라 한 번 flush 하면 그 인스턴스는
//   두 번 적재하지 않는다(중복 방지 목적). 그래서 게임 내부에서만 재시작하면
//   2판째부터 scores 도 아케이드 XP 도 0 이었다.
//   → 레코더를 라운드 단위 자식(WordBlitzRound)으로 내리고 key 로 remount 한다.
//     언마운트 cleanup 이 이전 판을 flush 하고, 새 인스턴스가 새 판을 집계한다.
//     (레코더 훅 자체는 lib 공용이라 건드리지 않는다 — 필요한 reset() 은 킷 요청으로.)

'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { WordBlitzLoading } from '@/components/game/wordblitz/WordBlitzUI';
// 게임은 gamekit Word({en,ko,pron?,example?,pos?,inflected?})를 받는다 —
// lib/wordblitz/data 의 Word({en,ko,pron?})는 그 서브셋이라 v08 이 쓰는 example/pos 가 잘린다.
import type { Word } from '@/components/game/_shared/gamekit';
import { gameResourceContext } from '@/lib/game/scope-resource';
import { useGameSessionRecorder } from '@/lib/game/use-session-recorder';
import { useGameWordScope, type WordScope } from '@/lib/game/use-word-scope';
import { POINTS } from '@/lib/wordblitz/data';
import { recordWordBlitzResult } from '@/lib/wordblitz/record-result';
import { resolveSessionReturnHref } from '@/lib/layout/session-return';

const WordBlitzGame = dynamic(
  () =>
    import('@/components/game/wordblitz/WordBlitzGame').then((mod) => ({
      default: mod.WordBlitzGame,
    })),
  {
    ssr: false,
    loading: () => <WordBlitzLoading message="게임 초기화 중..." />,
  }
);

/**
 * 연사(v08)는 선택지가 4→6개까지 늘고 표적을 무복원으로 뽑는다.
 * 6지선다 한 문항에 6단어 + 직전 반복 회피 여유까지 필요해 10개를 하한으로 둔다.
 * (게임 내부 절대 하한은 6 — 그 아래로는 NotEnoughWords 를 띄운다.)
 */
const MIN_WORDS = 10;

export default function WordBlitzPage() {
  const router = useRouter();
  const scope = useGameWordScope({ label: 'WordBlitz', minWords: MIN_WORDS });
  const [round, setRound] = useState(0);

  // gamekit Word({en,ko,pron,example,pos,inflected}) 를 그대로 넘긴다 —
  // v08 의 '문맥' 조임 카드가 example 을, 유사 오답 스코어러가 pos 를 쓴다.
  const wordPool: Word[] | undefined = useMemo(
    () =>
      scope.words?.map((w) => ({
        en: w.en,
        ko: w.ko,
        ...(w.pron ? { pron: w.pron } : {}),
        ...(w.example ? { example: w.example } : {}),
        ...(w.pos ? { pos: w.pos } : {}),
        ...(w.inflected && w.inflected.length > 0 ? { inflected: w.inflected } : {}),
      })),
    [scope.words],
  );

  const nextRound = useCallback(() => setRound((r) => r + 1), []);

  if (scope.loading) {
    return <WordBlitzLoading message="단어 불러오는 중..." />;
  }

  // ?set=/?text= 로 명시 진입했는데 그 자료에 단어가 없음 — 다른 단어로 바꿔치지 않고 안내.
  if (scope.insufficient) {
    return (
      <main
        className="flex h-screen w-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: 'var(--bg2)', color: 'var(--t1)' }}
      >
        <div className="select-none text-4xl" aria-hidden>
          📚
        </div>
        <h1 className="font-display text-[16px] font-[700]" style={{ color: 'var(--t1)' }}>
          이 자료에 학습할 단어가 아직 없어요
        </h1>
        <p className="font-body text-[13px]" style={{ color: 'var(--t2)' }}>
          연사는 최소 {MIN_WORDS}개 단어가 필요해요. 본문에서 단어를 추가하거나 단어장을 먼저
          살펴보세요.
        </p>
        <button
          type="button"
          onClick={() => router.push(resolveSessionReturnHref(scope.from, scope.text, '/wordvault'))}
          className="min-h-[44px] rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13px] font-[800] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--combo)] focus-visible:ring-offset-2"
          style={{ background: 'var(--combo)', color: 'var(--ti)' }}
        >
          내 단어장으로
        </button>
      </main>
    );
  }

  return (
    <main style={{ width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <ResourceContext resource={gameResourceContext(scope)} />
      <WordBlitzRound key={round} scope={scope} wordPool={wordPool} onNextRound={nextRound} />
    </main>
  );
}

/**
 * 한 판(라운드) = 한 세션 레코더. key 가 바뀌면 통째로 remount 되고,
 * 언마운트 cleanup(useGameSessionRecorder 내부)이 직전 판을 scores 에 남긴다.
 */
function WordBlitzRound({
  scope,
  wordPool,
  onNextRound,
}: {
  scope: WordScope;
  wordPool: Word[] | undefined;
  onNextRound: () => void;
}) {
  const router = useRouter();
  // 세션 집계 — 셸 X·Esc·뒤로가기 포함 모든 종료 경로에서 scores·XP 적립.
  // 점수 산식은 게임 고정점 복제(POINTS).
  const session = useGameSessionRecorder({
    module: 'wordblitz',
    scope,
    computeScore: (correct, wrong) => correct * POINTS.CORRECT + wrong * POINTS.WRONG,
  });

  return (
    <WordBlitzGame
      wordPool={wordPool}
      onExit={() => {
        session.flush();
        // 닫기 복귀: ?from 우선 → 스코프 텍스트 → 모듈 hub
        router.push(resolveSessionReturnHref(scope.from, scope.text, '/wordblitz'));
      }}
      onCorrect={(word) => {
        session.countCorrect();
        void recordWordBlitzResult({ word: word.en, isCorrect: true }); // learning_records(FSRS)
      }}
      onWrong={(word) => {
        session.countWrong();
        void recordWordBlitzResult({ word: word.en, isCorrect: false });
      }}
      onRestart={() => {
        session.flush();
        onNextRound();
      }}
    />
  );
}
