// apps/web/src/lib/game/play-scaffold.tsx
// 게임 플레이 라우트 공용 스캐폴드 — 스코프 단어 로드 · 결과 기록 · 복귀 · ResourceContext.
// 각 /play/<game>/page.tsx 는 이 스캐폴드에 게임 render 만 넘겨 얇게 유지.

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { GameLoading, NotEnoughWords, type Word, type ArcadeGameId } from '@/components/game/_shared/gamekit';
import { createClient } from '@/lib/supabase/client';
import { recordGameScore } from '@/lib/scores/record-score';
import { recordGameResult } from '@/lib/game/record-result';
import { fetchScopedWords } from '@/lib/workspace/scoped-words';
import { resolveSessionReturnHref } from '@/lib/layout/session-return';

interface RenderArgs {
  wordPool?: Word[];
  onCorrect: (word: Word) => void;
  onWrong: (word: Word) => void;
  onExit: () => void;
}

interface Pool {
  words: Word[];
  title: string;
  subtitle: string;
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
  const searchParams = useSearchParams();
  const set = searchParams.get('set') ?? undefined;
  const text = searchParams.get('text') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const chapterNum = Number(searchParams.get('chapter'));
  const chapter = Number.isInteger(chapterNum) && chapterNum > 0 ? chapterNum : null;
  const scoped = !!(set || text);

  const [pool, setPool] = useState<Pool | null>(null);

  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const startRef = useRef(0);
  const scoredRef = useRef(false);
  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!scoped) return;
    let mounted = true;
    void (async () => {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      const res = await fetchScopedWords(client, { set, text, chapter, userId: user?.id ?? null });
      if (!mounted) return;
      setPool({
        words: (res?.words ?? []).map((w) => ({
          en: w.word,
          ko: w.meaning,
          pron: w.pronunciation || undefined,
        })),
        title: res?.title ?? label,
        subtitle: res?.subtitle ?? '',
      });
    })();
    return () => {
      mounted = false;
    };
  }, [scoped, set, text, chapter, label]);

  if (scoped && pool === null) {
    return <GameLoading message={loadingMessage ?? '단어 불러오는 중…'} />;
  }
  if (scoped && pool && pool.words.length < minWords) {
    return (
      <NotEnoughWords
        need={minWords}
        onExit={() => router.push(resolveSessionReturnHref(from, text, '/wordvault'))}
      />
    );
  }

  const onExit = () => {
    const correct = correctRef.current;
    const wrong = wrongRef.current;
    const captured = correct + wrong;
    if (!scoredRef.current && captured > 0) {
      scoredRef.current = true;
      void recordGameScore({
        module,
        score: correct * 100,
        totalQuestions: captured,
        correctCount: correct,
        accuracy: Math.round((correct / captured) * 100),
        durationSeconds: startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : undefined,
        ...(text ? { textId: text } : {}),
        metadata: { captured, wrong, scoped },
      });
    }
    router.push(resolveSessionReturnHref(from, text, `/${moduleHub(module)}`));
  };

  const onCorrect = (word: Word) => {
    correctRef.current += 1;
    void recordGameResult({ word: word.en, isCorrect: true, module });
  };
  const onWrong = (word: Word) => {
    wrongRef.current += 1;
    void recordGameResult({ word: word.en, isCorrect: false, module });
  };

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext
        resource={
          scoped && pool
            ? { type: 'vocab', label: pool.title, position: pool.subtitle, href: '/text' }
            : { type: 'library', label, position: '아케이드 단어 게임', href: `/${moduleHub(module)}` }
        }
      />
      {render({ wordPool: scoped && pool ? pool.words : undefined, onCorrect, onWrong, onExit })}
    </main>
  );
}

// 모듈 → hub 경로 (닫기 fallback)
function moduleHub(module: ArcadeGameId): string {
  return module; // /cascade · /connections … (게임별 hub 부재 시 SessionFrame closeHref 로 보정)
}
