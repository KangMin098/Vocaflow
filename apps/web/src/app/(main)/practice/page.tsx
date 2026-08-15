// apps/web/src/app/(main)/practice/page.tsx
//
// Practice — 연습 단일 진입면.
//
// **왜 통합인가 (프로젝트가 이미 내린 결정의 이행)**
// `lib/framework/axes.ts` 가 못박아 뒀다:
//   > 활동(모드)은 Surface 가 아니다. Flashcard·Game Lab 은 "어떻게 연습하는가" 이므로
//   > 콘텐츠를 고른 뒤의 선택지로 내려간다. 별도 활동 탭은 사용률로 정당화되지 않으면
//   > 유지된 사례가 없다(Quizlet Gravity 제거 · Duolingo Stories 탭 폐지).
//   > 국외 12종 관측치: Busuu 3 · Memrise 3 · Babbel 4 · Vocabulary.com 4 · Duolingo 코어 6.
//   > **현재 우리는 8 표면 / 14 리프로 그 범위 밖이다.**
// `SurfaceId` 는 today·library·vault·growth **넷뿐**인데 사이드바는 Flashcard·WordBlitz·
// PairFlip·SpellForge 를 최상위로 팔고 있었다. 이 화면이 그 넷을 흡수한다.
//
// **왜 이렇게 조용한가 (실측 slop 제거)**
// 흡수 대상 4화면은 각자 **고채도 그라디언트 히어로**(핑크·파랑·초록·남색)를 갖고 있었다 —
// 한 사이드바 그룹인데 네 개의 다른 브랜드가 동시에 소리쳤다. 거기에 이모지 난이도 카드
// (🌱🎯🔥🚀👑), 상시 노출되는 "학습 효과 / 게임 규칙" 설명서, 카드 안의 카드 3중첩,
// 트로피 노란 카드까지 얹혀 있었다. 연습 화면은 **학습 직전의 대기실**이다. 자극이 아니라
// 준비가 필요하다.
//   → 그라디언트 0 · 이모지 0 · 설명서 0 · 중첩 카드 0. 지면은 테마의 `--bg` 그대로.
//
// **무엇을 고르게 하는가**
// 게임 이름이 아니라 **어느 쪽을 연습할지**(면)를 고른다. 어느 면이 무른지는 이미 실데이터가
// 있다(`/api/wordvault/facets` → `weakest`). 학습자가 도구를 고르느라 쓰던 판단을 화면이 대신한다.
//
// 개별 라우트(`/flashcard` 등)는 **그대로 둔다** — 딥링크와 기존 회귀 스펙이 그 주소를 쓴다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { Screen } from '@/components/ui/ios'
import { fetchDueGameWords } from '@/lib/game/due-words'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'
import { fetchSessionQueue } from '@/lib/learner/session-queue-query'
import { createClient } from '@/lib/supabase/server'

import { PracticeChooser } from './PracticeChooser'

export const metadata = {
  title: '연습 · Vocaflow',
  description: '오늘 어느 쪽을 연습할지 고르세요',
}

export default async function PracticePage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  // 각 면의 **실제 연습 분량**. 통합 화면이 개별 허브를 흡수하려면 개별 허브가 주던 숫자를
  // 버리면 안 된다 — 첫 버전은 총수만 말해서 "편안하지만 정보가 빈" 화면이 됐다(≈78 vs ≈77).
  //
  // ⚠️ 각 도구가 **실제로 쓰는 함수**를 그대로 부른다. 여기서 따로 세면 시작 후와 어긋나고,
  // 그건 목업을 지우고 새 거짓말을 만드는 것과 같다(GamePoolPanel 과 같은 계약).
  // ⚠️ 처방도 같이 읽는다 — `/practice/dcp`(Syntax 구문 연습)는 **이 화면의 하위 라우트**인데
  // 진입 경로가 허브 처방 하나뿐이었다. 연습 단일 진입면이 자기 밑에 있는 연습을 숨기고
  // 있었다는 뜻이다(통폐합 영향도 전수 검사에서 발견). 다만 DCP 는 stage 게이트가 있어
  // 항상 열려 있지 않으므로, **활성일 때만** 노출한다 — 잠긴 링크를 파는 것도 거짓 약속이다.
  const [queue, gamePool, prescription] = user
    ? await Promise.all([
        fetchSessionQueue(client, user.id), // Flashcard · SpellForge 가 공유
        fetchDueGameWords(client, user.id), // WordBlitz
        fetchTodayPrescription(),
      ])
    : [null, null, null]

  return (
    <Screen width="content" background="bg2" padX="md">
      <PracticeChooser
        ownedTotal={queue?.vocabTotal ?? null}
        sessionSize={queue ? queue.words.length : null}
        gamePoolSize={gamePool ? gamePool.words.length : null}
        syntaxCount={prescription?.practiceActive ? prescription.practiceCount : null}
      />
    </Screen>
  )
}
