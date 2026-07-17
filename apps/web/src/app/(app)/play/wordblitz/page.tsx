// apps/web/src/app/(app)/play/wordblitz/page.tsx
// Next.js App Router - /play/wordblitz
// SSR 비활성화 (Three.js는 client-only)
//
// ?set={챕터 단어장 id} | ?text={스크립트 texts.id} 가 있으면 그 자료의 단어를
// wordPool 로 주입 (워크스페이스 "블리츠" pill). 없으면 기존 기본 단어 풀.

'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { WordBlitzLoading } from '@/components/game/wordblitz/WordBlitzUI';
import { recordGameScore } from '@/lib/scores/record-score';
import { createClient } from '@/lib/supabase/client';
import { POINTS, type Word } from '@/lib/wordblitz/data';
import { recordWordBlitzResult } from '@/lib/wordblitz/record-result';
import { fetchScopedWords } from '@/lib/workspace/scoped-words';
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

interface ScopedPool {
  words: Word[];
  title: string;
  subtitle: string;
}

export default function WordBlitzPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const set = searchParams.get('set') ?? undefined;
  const text = searchParams.get('text') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  // 세트 내 특정 챕터만 학습 (?set=…&chapter=N)
  const chapterNum = Number(searchParams.get('chapter'));
  const chapter = Number.isInteger(chapterNum) && chapterNum > 0 ? chapterNum : null;
  const scoped = !!(set || text);

  // scoped: null = 로딩, ScopedPool = 완료, { words: [] } = 단어 0개
  const [pool, setPool] = useState<ScopedPool | null>(null);

  // 세션 집계 — 정/오답 카운트(점수 복제 + scores 적재) + 시작 시각(소요시간).
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const startRef = useRef(0);
  const scoredRef = useRef(false); // exit 1회만 scores 적재
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
      const res = await fetchScopedWords(client, {
        set,
        text,
        chapter,
        userId: user?.id ?? null,
      });
      if (!mounted) return;
      setPool({
        words: (res?.words ?? []).map((w) => ({
          en: w.word,
          ko: w.meaning,
          pron: w.pronunciation || undefined,
        })),
        title: res?.title ?? '단어 게임',
        subtitle: res?.subtitle ?? '',
      });
    })();
    return () => {
      mounted = false;
    };
  }, [scoped, set, text, chapter]);

  // 스코프 진입인데 아직 로딩 중
  if (scoped && pool === null) {
    return <WordBlitzLoading message="단어 불러오는 중..." />;
  }

  // 스코프 진입인데 단어 0개
  if (scoped && pool && pool.words.length === 0) {
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
          onClick={() => router.push('/wordvault')}
          className="rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13px] font-[800]"
          style={{ background: 'var(--combo)', color: 'var(--ti)' }}
        >
          내 단어장으로
        </button>
      </main>
    );
  }

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext
        resource={
          scoped && pool
            ? {
                type: 'vocab',
                label: pool.title,
                position: pool.subtitle,
                href: '/text',
              }
            : {
                type: 'library',
                label: '속사 인지',
                position: '빠른 단어 게임',
                href: '/wordblitz',
              }
        }
      />
      <WordBlitzGame
        wordPool={scoped && pool ? pool.words : undefined}
        onExit={() => {
          // 게임 세션 점수 적재 (scores) — 1회. captured 0(미플레이)면 skip.
          const correct = correctRef.current;
          const wrong = wrongRef.current;
          const captured = correct + wrong;
          if (!scoredRef.current && captured > 0) {
            scoredRef.current = true;
            void recordGameScore({
              module: 'wordblitz',
              score: correct * POINTS.CORRECT + wrong * POINTS.WRONG, // 게임 점수식 복제(고정점)
              totalQuestions: captured,
              correctCount: correct,
              accuracy: Math.round((correct / captured) * 100),
              durationSeconds: startRef.current
                ? Math.round((Date.now() - startRef.current) / 1000)
                : undefined,
              ...(text ? { textId: text } : {}),
              metadata: { captured, wrong, scoped },
            });
          }
          // 닫기 복귀: ?from 우선 → 스코프 텍스트 → hub (id 유실·엉뚱한 목적지 방지)
          router.push(resolveSessionReturnHref(from, text, '/wordblitz'));
        }}
        onCorrect={(word) => {
          correctRef.current += 1;
          void recordWordBlitzResult({ word: word.en, isCorrect: true }); // learning_records(FSRS)
        }}
        onWrong={(word) => {
          wrongRef.current += 1;
          void recordWordBlitzResult({ word: word.en, isCorrect: false });
        }}
      />
    </main>
  );
}
