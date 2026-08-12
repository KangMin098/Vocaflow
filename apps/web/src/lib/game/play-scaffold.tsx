// apps/web/src/lib/game/play-scaffold.tsx
// 게임 플레이 라우트 공용 스캐폴드 — 단어 스코프 해석 · 결과 기록 · 복귀 · ResourceContext.
// 각 /play/<game>/page.tsx 는 이 스캐폴드에 게임 render 만 넘겨 얇게 유지.
//
// 스코프 해석은 `useGameWordScope`(explicit → mine → demo) 단일 출처.
// 독립 3D 페이지(/play/wordblitz)도 같은 훅을 써서 두 경로가 어긋나지 않는다.

'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { GameLoading, NotEnoughWords, type Word, type ArcadeGameId } from '@/components/game/_shared/gamekit';
import { useGameWordScope } from '@/lib/game/use-word-scope';
import { useGameSessionRecorder } from '@/lib/game/use-session-recorder';
import { gameResourceContext } from '@/lib/game/scope-resource';
import { recordGameResult } from '@/lib/game/record-result';
import { resolveSessionReturnHref } from '@/lib/layout/session-return';

/**
 * `assisted` — 정답을 이미 보여준 뒤의 입력(힌트 구매 · 리빌 직후 재출제 · 자동 pass).
 * 게임 점수·콤보에는 반영하되 **FSRS 에는 올리지 않는다**. 넘기지 않으면 false.
 * (판정 자체는 record-result 가 중앙에서 한다 — 게임별로 기준이 갈리지 않게.)
 */
export interface ResultOpts {
  assisted?: boolean;
}

interface RenderArgs {
  wordPool?: Word[];
  onCorrect: (word: Word, opts?: ResultOpts) => void;
  onWrong: (word: Word, opts?: ResultOpts) => void;
  onExit: () => void;
}

export function GamePlayScaffold({
  module,
  label,
  minWords = 4,
  loadingMessage,
  render,
}: {
  module: ArcadeGameId;
  label: string;
  minWords?: number;
  loadingMessage?: string;
  render: (args: RenderArgs) => ReactNode;
}) {
  const router = useRouter();
  const scope = useGameWordScope({ label, minWords });
  // 셸 X·Esc·뒤로가기까지 포함해 세션 종료 시 scores·XP 를 반드시 남긴다.
  const session = useGameSessionRecorder({ module, scope });

  // ── 결합 침묵 제거 (v08.5) — 훅은 **early return 앞에** 있어야 한다 ────────
  //
  // `recordGameResult` 는 학습자 vocabularies 에 없는 단어를 카드 갱신 없이 넘긴다.
  // 실측 97.9% 가 그 경로다(내 단어 225개 vs 세트 단어 56,079개 · 겹침 2.1%).
  // 그동안 그 사실이 화면에 전혀 나타나지 않아서, 학습자는 세트로 열심히 놀고도
  // 복습 일정에 아무것도 남지 않는 것을 알 수 없었다.
  //
  // **한 곳에서 센다.** 게임마다 각자 우회하던 것을 중앙으로 올린다 —
  // morpheme-bank.ts · morph-bank.ts · due-words.ts · catalog.tsx 가 같은 문제를
  // 따로 적고 따로 대응하고 있었다.
  //
  // ⚠️ 아래 두 훅을 loading·insufficient early return **뒤로** 옮기면
  // "Rendered more hooks than during the previous render" 로 화면이 깨진다
  // (로딩이 끝나는 순간 훅 개수가 바뀐다). 실제로 그렇게 만들었다가 런타임에서 잡았다 —
  // tsc·단위 테스트는 못 잡는다.
  const notMine = useRef(new Set<string>());
  const [notMineCount, setNotMineCount] = useState(0);

  if (scope.loading) {
    return <GameLoading message={loadingMessage ?? '단어 불러오는 중…'} />;
  }

  if (scope.insufficient) {
    return (
      <NotEnoughWords
        need={minWords}
        onExit={() => router.push(resolveSessionReturnHref(scope.from, scope.text, '/wordvault'))}
      />
    );
  }

  const onExit = () => {
    session.flush();
    router.push(resolveSessionReturnHref(scope.from, scope.text, '/arcade'));
  };

  const track = async (word: string, p: Promise<Awaited<ReturnType<typeof recordGameResult>>>) => {
    const res = await p;
    // 'assisted' · 'cooldown' 은 의도된 무결성 가드이므로 세지 않는다 — 결함이 아니다.
    if (res.ok && !res.updated && res.reason === 'not-mine') {
      const key = word.toLowerCase();
      if (!notMine.current.has(key)) {
        notMine.current.add(key);
        setNotMineCount(notMine.current.size);
      }
    }
  };

  const onCorrect = (word: Word, opts?: ResultOpts) => {
    session.countCorrect();
    void track(
      word.en,
      recordGameResult({ word: word.en, isCorrect: true, module, assisted: opts?.assisted }),
    );
  };
  const onWrong = (word: Word, opts?: ResultOpts) => {
    session.countWrong();
    void track(
      word.en,
      recordGameResult({ word: word.en, isCorrect: false, module, assisted: opts?.assisted }),
    );
  };

  // 셸에 position: relative — 고지 배지가 이 셸을 기준으로 붙는다. 없으면 가장 가까운
  // positioned 조상(게임마다 다르다)에 붙어 배지 위치가 게임별로 튄다.
  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext resource={gameResourceContext(scope)} />
      {notMineCount > 0 && <NotMineNotice count={notMineCount} />}
      {render({ wordPool: scope.words, onCorrect, onWrong, onExit })}
    </main>
  );
}

/**
 * "이 단어는 아직 내 단어가 아니에요" 고지.
 *
 * 학습을 **끊지 않는다** — 게임 위에 겹치는 작은 배지이고, 누를 것이 없다(Calm UI ·
 * 학습 중 모달 금지). 다만 사실은 말한다: 이 세션의 일부는 복습 일정에 남지 않는다.
 *
 * 왜 세션당 한 번인가: 단어마다 알리면 97.9% 경로에서 화면이 고지로 덮인다.
 * 누적 개수만 조용히 갱신한다(Implicit Progress 의 반대 방향 — 조용한 사실 통지).
 */
function NotMineNotice({ count }: { count: number }) {
  return (
    <p
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        margin: 0,
        padding: '6px 12px',
        borderRadius: 999,
        maxWidth: 'min(92vw, 460px)',
        textAlign: 'center',
        fontSize: 11.5,
        lineHeight: 1.45,
        color: '#F3E7D2',
        background: 'rgba(20,16,12,.82)',
        border: '1px solid rgba(176,132,58,.45)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
      }}
    >
      이 세션의 {count}개는 아직 내 단어가 아니어서 복습 일정에는 반영되지 않아요
    </p>
  );
}
