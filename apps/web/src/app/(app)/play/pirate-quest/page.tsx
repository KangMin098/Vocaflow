// apps/web/src/app/(app)/play/pirate-quest/page.tsx
// Pirate's Bounty 임시 페이지 — 풀스크린 게임

'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ResourceContext } from '@/components/layout/ResourceContext';
import { GameKitStyles, GameMusic } from '@/components/game/_shared/gamekit';

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
      {/* 복귀는 아케이드 — 카탈로그 closeHref 및 세션 셸 닫기(X/Esc)와 같은 목적지. */}
      <PirateQuestGame onExit={() => router.push('/arcade')} />
      {/* 배경음악 — R3F 캔버스 밖에서 좌하단 fixed 로 띄운다(gamekit 미사용 게임이라 스타일 동반 주입).
          카탈로그가 트랙을 선언해두고 컨트롤이 없으면 그 선언이 거짓이 된다. */}
      <GameKitStyles />
      <GameMusic gameId="pirate-quest" />
    </main>
  );
}
