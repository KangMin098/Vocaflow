// apps/web/src/components/workspace/WorkspaceWordBlitzMode.tsx
// Phase 11.9 B — Workspace ?mode=wordblitz 분기용 client wrapper
//
// 흐름:
// 1. mount 시 wordPool fetch (사용자 vocabularies + chapter LV 보충)
// 2. WordBlitzGame 렌더 (3D Three.js — dynamic import로 SSR 회피)
// 3. onCorrect/onWrong → recordWordBlitzResult server action
// 4. onExit → ?mode=read 복귀

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { buildWordBlitzPool } from '@/lib/wordblitz/word-pool';
import { recordWordBlitzResult } from '@/lib/wordblitz/record-result';
import { WordBlitzLoading } from '@/components/game/wordblitz/WordBlitzUI';
import type { Word } from '@/lib/wordblitz/data';

const WordBlitzGame = dynamic(
  () =>
    import('@/components/game/wordblitz/WordBlitzGame').then((mod) => ({
      default: mod.WordBlitzGame,
    })),
  {
    ssr: false,
    loading: () => <WordBlitzLoading message="게임 초기화 중..." />,
  },
);

interface Props {
  textId: string;
  libraryBookId: string | null;
  chapterIdx: number | null;
}

export function WorkspaceWordBlitzMode({
  textId,
  libraryBookId,
  chapterIdx,
}: Props) {
  const router = useRouter();
  const [wordPool, setWordPool] = useState<Word[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setError('로그인이 필요합니다.');
        return;
      }

      try {
        const pool = await buildWordBlitzPool(supabase, user.id, libraryBookId, chapterIdx);
        if (!cancelled) {
          if (pool.length < 4) {
            setError('단어가 부족해 게임을 시작할 수 없습니다 (최소 4개 필요).');
          } else {
            setWordPool(pool);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '단어 로드 실패');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [libraryBookId, chapterIdx]);

  function handleExit() {
    router.push(`/text/${textId}?mode=read`);
  }

  function handleCorrect(word: Word) {
    void recordWordBlitzResult({ word: word.en, isCorrect: true });
  }

  function handleWrong(word: Word) {
    void recordWordBlitzResult({ word: word.en, isCorrect: false });
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg)] px-6 text-center"
      >
        <div className="select-none text-3xl" aria-hidden>
          🎮
        </div>
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          WordBlitz 시작 불가
        </h2>
        <p className="max-w-md font-body text-[13px] text-[var(--t2)]">{error}</p>
        <button
          type="button"
          onClick={handleExit}
          className="mt-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 py-2 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          읽기로 돌아가기
        </button>
      </div>
    );
  }

  if (!wordPool) {
    return <WordBlitzLoading message="단어 풀 준비 중..." />;
  }

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <WordBlitzGame
        wordPool={wordPool}
        onCorrect={handleCorrect}
        onWrong={handleWrong}
        onExit={handleExit}
      />
    </main>
  );
}
