// apps/web/src/lib/recommend/types.ts
//
// 추천 엔진 타입 — CLAUDE.md §17.3 [3] 추천 축
//
// 호출 위치는 정확히 3곳 (§17 안티패턴 1: 4곳 이상 노출 금지):
//   1. Hub Today CTA            ← 이번 단계
//   2. FloatingSparkle (워크스페이스)  ← 미래 단계
//   3. 세션 종료 직후 화면         ← 미래 단계

import type { MasteryLevel, ModuleId } from '@/lib/srs';

/**
 * 추천 근거(설명용 닫힌 코드) — TS 전송 속성일 뿐 DB enum · 스키마가 아니다.
 * due_review = 복습 시점이 된 단어 · resume_text = 열어 둔 본인 글 · practice_flow = 어휘 연습 흐름 단서
 * explore = 단서 없이 새 자료 · unconfirmed = 조회 실패 · 예외 · 아직 확인 전(근거를 확인했다고 말하지 않는다).
 * 어느 것도 독해 실력 측정이 아니다.
 */
export type RecommendationReason = 'due_review' | 'resume_text' | 'practice_flow' | 'explore' | 'unconfirmed';

/**
 * 추천 결과 — UI에 그대로 렌더되는 격려형 라벨 + 라우팅 정보
 *
 * 라벨은 항상 격려형. 정확도/실패 카운트 노출 금지 (§17 안티패턴 5).
 * FSRS 변수(D/S/R) 직접 노출 금지 (§17 안티패턴 2).
 */
export interface RecommendedAction {
  /** 진입할 모듈 — 'library'는 cold start fallback */
  module: ModuleId | 'library';

  /** 사용자에게 보여줄 격려형 라벨 (UI 그대로 표시) */
  label: string;

  /** 큐로 전달할 단어 ID (Flashcard/SpellForge 등) */
  wordIds?: string[];

  /** 진입할 텍스트 ID (workspace/scriptquiz) */
  textId?: string;

  /** 큐 빌더에 전달할 strategy — Cold에 'interleaved' 강제 금지 (§17 안티패턴 3) */
  strategy?: 'blocked' | 'hybrid' | 'interleaved';

  /** Dictation 단위 */
  unit?: 'sentence' | 'paragraph' | 'full';

  /** 추천 근거(선택) — 없으면 카드가 구체 근거를 지어내지 않는 일반 문구를 쓴다 */
  reason?: RecommendationReason;
}

/** Mock 데모용 — 실제 DB 연동 후 user_stats 조회로 대체 */
export interface MockUserContext {
  masteryLevel: MasteryLevel;
  totalWords: number;
  currentStreak: number;
  /** R<0.6 단어 수 — Mock에서는 직접 주입 */
  urgentWordCount: number;
  /** 진행 중인 텍스트 제목 (없으면 undefined) */
  inProgressTextTitle?: string;
  /** 진행 중 텍스트 ID (workspace 라우팅용) */
  inProgressTextId?: string;
}

/**
 * 서버 추천 + 그 추천을 만든 계정 — 개인 글(P2)은 화면의 브라우저 신원이 이 계정과 **긍정 확인된** 때만 그린다(use-next-action).
 * `ownerId` 는 비교용이다 — DOM · URL · 이벤트 · 저장소에 넣지 않는다.
 */
export interface OwnedNextAction {
  action: RecommendedAction
  /** 개인 글 없이 결정한 추천 — 신원이 확인되지 않았을 때 대신 쓴다 */
  fallback: RecommendedAction
  /** action 에 개인 글(제목 · textId)이 들어 있나 */
  personal: boolean
  ownerId: string | null
}
