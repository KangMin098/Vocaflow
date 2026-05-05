// apps/web/src/app/(app)/play/wordblitz/page.tsx
// Next.js App Router - /play/wordblitz
// SSR 비활성화 (Three.js는 client-only)

'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ResourceContext } from '@/components/layout/ResourceContext';
import { WordBlitzLoading } from '@/components/game/wordblitz/WordBlitzUI';

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

export default function WordBlitzPage() {
  const router = useRouter();

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext
        resource={{
          type: 'library',
          label: '정글 어드벤처',
          position: 'Stage 1 · 인형뽑기',
          href: '/wordblitz',
        }}
      />
      <WordBlitzGame
        onExit={() => router.push('/library')}
        onCorrect={(word) => {
          // TODO: SRS 큐 업데이트 - 정답 단어 다음 노출 미루기
          // updateSRS(word.en, 'correct');
          console.log('✅ Correct:', word.en);
        }}
        onWrong={(word) => {
          // TODO: SRS 큐 업데이트 - 오답 단어 빠르게 재노출
          // updateSRS(word.en, 'wrong');
          console.log('❌ Wrong:', word.en);
        }}
      />
    </main>
  );
}
