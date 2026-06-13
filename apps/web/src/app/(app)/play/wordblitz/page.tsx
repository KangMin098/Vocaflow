// apps/web/src/app/(app)/play/wordblitz/page.tsx
// Next.js App Router - /play/wordblitz
// SSR 비활성화 (Three.js는 client-only)
//
// ?set={챕터 단어장 id} | ?text={스크립트 texts.id} 가 있으면 그 자료의 단어를
// wordPool 로 주입 (워크스페이스 "블리츠" pill). 없으면 기존 기본 단어 풀.

'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { WordBlitzLoading } from '@/components/game/wordblitz/WordBlitzUI';
import { createClient } from '@/lib/supabase/client';
import { fetchScopedWords } from '@/lib/workspace/scoped-words';
import type { Word } from '@/lib/wordblitz/data';

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
  const scoped = !!(set || text);

  // scoped: null = 로딩, ScopedPool = 완료, { words: [] } = 단어 0개
  const [pool, setPool] = useState<ScopedPool | null>(null);

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
  }, [scoped, set, text]);

  // 스코프 진입인데 아직 로딩 중
  if (scoped && pool === null) {
    return <WordBlitzLoading message="단어 불러오는 중..." />;
  }

  // 스코프 진입인데 단어 0개
  if (scoped && pool && pool.words.length === 0) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#1a4a08] px-6 text-center">
        <div className="select-none text-4xl" aria-hidden>
          🌴
        </div>
        <h1 className="font-display text-[16px] font-[700] text-[#FFE234]">
          이 자료에 학습할 단어가 아직 없어요
        </h1>
        <p className="font-body text-[13px] text-white/80">
          본문에서 단어를 추가하거나 단어장을 먼저 살펴보세요.
        </p>
        <button
          type="button"
          onClick={() => router.push('/wordvault')}
          className="rounded-[var(--r-md)] bg-[#FFE234] px-5 py-2.5 font-display text-[13px] font-[800] text-[#1a4a08]"
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
                label: '정글 어드벤처',
                position: 'Stage 1 · 인형뽑기',
                href: '/wordblitz',
              }
        }
      />
      <WordBlitzGame
        wordPool={scoped && pool ? pool.words : undefined}
        onExit={() => router.push(scoped ? '/text' : '/library')}
        onCorrect={(word) => {
          // TODO: SRS 큐 업데이트 - 정답 단어 다음 노출 미루기
          console.log('✅ Correct:', word.en);
        }}
        onWrong={(word) => {
          // TODO: SRS 큐 업데이트 - 오답 단어 빠르게 재노출
          console.log('❌ Wrong:', word.en);
        }}
      />
    </main>
  );
}
