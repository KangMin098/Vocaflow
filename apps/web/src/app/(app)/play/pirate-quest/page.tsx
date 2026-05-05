// apps/web/src/app/(app)/play/pirate-quest/page.tsx
// Pirate's Bounty 임시 페이지 — 풀스크린 게임

'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ResourceContext } from '@/components/layout/ResourceContext';

const PirateQuestGame = dynamic(
  () =>
    import('@/components/pirate-quest/PirateQuestGame').then((mod) => ({
      default: mod.PirateQuestGame,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2A1810, #5A2E14)',
          color: '#FFD93D',
          fontFamily: 'Bungee, cursive',
          fontSize: 18,
          letterSpacing: '0.1em',
        }}
      >
        🏴‍☠️ LOADING TREASURE...
      </div>
    ),
  }
);

export default function PirateQuestPage() {
  const router = useRouter();
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext
        resource={{
          type: 'custom',
          label: "Pirate's Bounty",
          position: '베타 · 단어 모험',
        }}
      />
      <PirateQuestGame onExit={() => router.push('/library')} />
    </main>
  );
}
