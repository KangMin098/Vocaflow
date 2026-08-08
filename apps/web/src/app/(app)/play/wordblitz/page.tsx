// apps/web/src/app/(app)/play/wordblitz/page.tsx
// Next.js App Router - /play/wordblitz
// SSR 비활성화 (Three.js는 client-only)
//
// 단어 스코프는 `useGameWordScope` 공용 훅 — 스캐폴드 17종과 동일한 3단 규칙:
//   ?set=/?text= → 내 복습 큐(due) → 맛보기.
//   (v07.4 이전엔 이 페이지가 자체 스코프 로직을 복제했고 mine 단계가 없어,
//    카탈로그가 `source:'mine'` 으로 광고하는데 정작 내 단어를 안 쓰는 불일치가 있었다.)

'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { WordBlitzLoading } from '@/components/game/wordblitz/WordBlitzUI';
import { gameResourceContext } from '@/lib/game/scope-resource';
import { useGameSessionRecorder } from '@/lib/game/use-session-recorder';
import { useGameWordScope } from '@/lib/game/use-word-scope';
import { POINTS, type Word } from '@/lib/wordblitz/data';
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

/** 4지선다 1문항을 만들려면 정답 1 + 오답 3. */
const MIN_WORDS = 4;

export default function WordBlitzPage() {
  const router = useRouter();
  const scope = useGameWordScope({ label: 'WordBlitz', minWords: MIN_WORDS });
  // 세션 집계 — 셸 X·Esc·뒤로가기 포함 모든 종료 경로에서 scores·XP 적립.
  // 점수 산식은 게임 고정점 복제(POINTS).
  const session = useGameSessionRecorder({
    module: 'wordblitz',
    scope,
    computeScore: (correct, wrong) => correct * POINTS.CORRECT + wrong * POINTS.WRONG,
  });

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
          본문에서 단어를 추가하거나 단어장을 먼저 살펴보세요.
        </p>
        <button
          type="button"
          onClick={() => router.push(resolveSessionReturnHref(scope.from, scope.text, '/wordvault'))}
          className="min-h-[44px] rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13px] font-[800]"
          style={{ background: 'var(--combo)', color: 'var(--ti)' }}
        >
          내 단어장으로
        </button>
      </main>
    );
  }

  // gamekit Word({en,ko,pron,…}) → wordblitz Word({en,ko,pron}) — 상위호환 서브셋.
  const wordPool: Word[] | undefined = scope.words?.map((w) => ({
    en: w.en,
    ko: w.ko,
    ...(w.pron ? { pron: w.pron } : {}),
  }));

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext resource={gameResourceContext(scope)} />
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
      />
    </main>
  );
}
