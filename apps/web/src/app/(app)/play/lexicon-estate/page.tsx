// apps/web/src/app/(app)/play/lexicon-estate/page.tsx — /play/lexicon-estate
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';
import { GameLoading } from '@/components/game/_shared/gamekit';

const Game = dynamic(
  () => import('@/components/game/lexicon-estate/LexiconEstateGame').then((m) => ({ default: m.LexiconEstateGame })),
  { ssr: false, loading: () => <GameLoading message="도면을 펼치는 중…" /> },
);

export default function LexiconEstatePlayPage() {
  // minWords 8 (v07.10 · 이전 20).
  //
  // 저택 규모가 이제 풀 크기 n 의 함수다(LexiconEstateGame 의 planRun) — 층 수·도면
  // 칸 수·이월 수·예산·드래프트 장수·판돈이 전부 n 에서 나오므로, 작은 단어장이면
  // 작은 저택이 선다. 20 이던 하한은 "3층 × 3×3 = 22칸"이 상수였기 때문이고,
  // 그 탓에 도서 챕터·공용 단어장 653세트의 36.6% 가 입장을 거절당했다.
  //
  // 8 이 구조적 하한인 이유 — 감정 보기는 도면에 이미 인쇄된 뜻을 절대 쓰지 않는다
  // (소거법 차단). 카드를 집는 순간 인쇄돼 있을 수 있는 뜻이 최대 (칸 수 − 1)개이므로
  // 4지선다를 유지하려면 `칸 수 ≤ n − 3`. 여기에 게임의 최소 골격
  // (배치에 선택이 있으려면 2×2=4칸 · 이월과 복도배수가 살려면 2층: 이월 1 + 새 방 3)
  // 을 얹으면 새 단어 4+3 = 7 이 이론적 최소다. 8 은 "같은 한국어 뜻을 가진 단어 한 쌍"
  // 만큼의 여유 1을 더한 값 — 7 로 내리면 뜻이 겹치는 순간 미끼가 2개로 떨어진다.
  // 실측(추출한 설계 로직 4,000판 × 풀 크기별): n=8 완주 77.5% · 서로 다른 출제 7.4/8 ·
  // 빈칸 0 · 보기 항상 4개 · 소거 가능 미끼 0건.
  return (
    <Suspense fallback={<GameLoading message="도면을 펼치는 중…" />}>
      <GamePlayScaffold
        module="lexicon-estate"
        label="Lexicon Estate"
        minWords={8}
        loadingMessage="도면을 펼치는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <Game wordPool={wordPool} onCorrect={onCorrect} onWrong={onWrong} onExit={onExit} />
        )}
      />
    </Suspense>
  );
}
