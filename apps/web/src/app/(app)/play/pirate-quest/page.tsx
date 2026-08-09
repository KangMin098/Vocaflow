// apps/web/src/app/(app)/play/pirate-quest/page.tsx — /play/pirate-quest
// Pirate's Bounty 풀스크린 3D.
//
// v07.8 — 이 페이지가 드디어 **단어를 흘려보내고, 그 결과를 남긴다.**
//   이전 판은 게임이 GLB 29개에 묶여 있어(단어 = 모델) 학습자 단어를 쓸 수 없었고,
//   이 페이지도 onExit 하나만 넘겨 FSRS·scores 가 통째로 비어 있었다.
//   라벨↔모델 결합을 끊은 지금은 어떤 어휘든 올라가므로 스캐폴드 17종과 같은 계약을 쓴다.
//
//   ⚠️ DB module_id enum 은 `pirate_quest`(언더스코어)만 갖고 있었다 — 코드의 하이픈과
//   어긋나 insert 가 조용히 실패하던 경로였다(record-result 가 audit 실패를 흡수한다).
//   2026-08-09 마이그레이션 add_remaining_arcade_module_ids 로 'pirate-quest' 를 추가하고
//   enum 조회로 확인한 뒤에야 이 배선을 켰다.
//
//   GamePlayScaffold 가 <main 100vw×100vh overflow:hidden> 을 이미 씌우므로
//   이전에 이 파일이 손으로 두르던 래퍼는 필요 없다.

'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

import { GameKitStyles, GameLoading, GameMusic } from '@/components/game/_shared/gamekit';
import { GamePlayScaffold } from '@/lib/game/play-scaffold';

const PirateQuestGame = dynamic(
  () =>
    import('@/components/pirate-quest/PirateQuestGame').then((mod) => ({
      default: mod.PirateQuestGame,
    })),
  {
    ssr: false,
    loading: () => <GameLoading message="해변을 여는 중…" />,
  },
);

/** 한 잠수에 최대 6자리 + 최근 회피 여유. 이보다 적으면 내장 해적 뱅크로 논다. */
const MIN_WORDS = 8;

export default function PirateQuestPage() {
  return (
    <Suspense fallback={<GameLoading message="해변을 여는 중…" />}>
      <GamePlayScaffold
        module="pirate-quest"
        label="Pirate's Bounty"
        minWords={MIN_WORDS}
        loadingMessage="해변을 여는 중…"
        render={({ wordPool, onCorrect, onWrong, onExit }) => (
          <>
            <PirateQuestGame
              wordPool={wordPool}
              onCorrect={onCorrect}
              onWrong={onWrong}
              onExit={onExit}
            />
            {/* 배경음악 — R3F 캔버스 밖 좌하단 fixed. 카탈로그가 트랙을 선언해두고
                컨트롤이 없으면 그 선언이 거짓이 된다(gamekit 미사용 게임이라 스타일 동반 주입). */}
            <GameKitStyles />
            <GameMusic gameId="pirate-quest" />
          </>
        )}
      />
    </Suspense>
  );
}
