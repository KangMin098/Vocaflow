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
// v08.1 — 전용 recordWordBlitzResult 대신 공용 recordGameResult 를 쓴다.
// 전용 레코더에는 FSRS 무결성 가드(assisted 무시 · 같은 카드 10분 재채점 금지)가 없어서
// 게임이 assisted 를 붙여도 그대로 카드가 갱신됐다. 판정은 중앙 한 곳(record-result.ts).
import { recordGameResult } from '@/lib/game/record-result';
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
 * v08.2 — 10 이었다. 그 하한이 공용 단어장 + 도서 챕터 653 세트 중 **20.8%** 를 거절했다
 * (세트 크기 1사분위 11단어 · 중앙값 30). 학습자가 고른 도서 챕터를 게임이 거절하는 것은
 * "몰래 다른 단어로 바꿔치지 않는다"의 대가로 치기엔 너무 비쌌다.
 *
 * 게임 쪽에서 판의 형태를 전부 풀 크기의 함수로 바꿨다(WordBlitzGame.tsx v08.2 주석) —
 * 단계 수 = clamp(round(n×3/5), 3, 8) · 선택지 상한 = clamp(min(n−2, ⌊n×0.75⌋), 4, 6) ·
 * 창/난이도/형태 램프는 진행률 기반. 그래서 6단어짜리 챕터도 20발·4단계짜리 짧은 판으로
 * 온전히 성립한다(거절 20.8% → 10.3%).
 *
 * **6 아래로 내리지 않는 이유** — 이 게임의 최소 보드는 4지선다이고(3지선다는 추측률
 * 25%→33%), 보드 밖에 최소 2단어가 남아야 미끼를 '고르는' 의미가 생긴다. 4+2 = 6.
 * 게임 내부 하한(MIN_POOL)과 같은 값이라 페이지와 게임의 판단이 어긋나지 않는다.
 */
const MIN_WORDS = 6;

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
    // v08.1 — 오답이 **가점**이었다(correct×120 + wrong×30). 그래서 아케이드 XP 관점에서
    // '아무 타일이나 눌러 최대한 많은 단어를 만난다'가 순이득이었다(정확도와 무관한 XP).
    // 부호를 뒤집어 정확도에 연동한다. 0 미만으로는 내려가지 않는다 —
    // 못 푼 판이 마이너스로 남는 것은 비난이고, 이 앱의 피드백 원칙에 어긋난다.
    computeScore: (correct, wrong) => Math.max(0, correct * POINTS.CORRECT - wrong * POINTS.WRONG),
  });

  return (
    <WordBlitzGame
      wordPool={wordPool}
      onExit={() => {
        session.flush();
        // 닫기 복귀: ?from 우선 → 스코프 텍스트 → 모듈 hub
        router.push(resolveSessionReturnHref(scope.from, scope.text, '/wordblitz'));
      }}
      // opts.assisted = 정답을 이미 보여준 뒤의 입력(재출제 · 좁은 창 시간 초과 · 방치).
      // 세션 정확도에는 정직하게 반영하되 FSRS 카드는 중앙에서 건너뛴다.
      onCorrect={(word, opts) => {
        session.countCorrect();
        void recordGameResult({
          word: word.en,
          isCorrect: true,
          module: 'wordblitz',
          assisted: opts?.assisted,
        });
      }}
      onWrong={(word, opts) => {
        session.countWrong();
        void recordGameResult({
          word: word.en,
          isCorrect: false,
          module: 'wordblitz',
          assisted: opts?.assisted,
          // 무엇과 헷갈렸는지 — 컴포저의 `confusion-log` 유형이 이 신호로 짝을 만든다.
          chosen: opts?.chosen,
        });
      }}
      onRestart={() => {
        session.flush();
        onNextRound();
      }}
    />
  );
}
