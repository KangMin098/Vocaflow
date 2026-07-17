// apps/web/src/lib/recommend/next-action.mock.ts
//
// 추천 엔진 Mock — DB 미연동 상태에서 Hub/FloatingSparkle 등을 실동작 검증.
// CLAUDE.md §17.9 추천 우선순위 P1~P4 그대로 구현.
//
// DB 연동 시 swap 대상은 getMockNextAction 한 함수뿐 — 호출자(HubHero 등)는 변경 X.

import { decideNextAction } from './decide';
import type { MockUserContext, RecommendedAction } from './types';

/**
 * §17.9 P1~P4 우선순위 — 첫 매칭에서 즉시 반환.
 *
 * P1: 회상 위급 (urgentWordCount >= 3) → 익히기 (flashcard review)
 * P2: 진행 중 텍스트 (Context-Dependent 보존) → 스크립트 (workspace)
 * P3: mastery_level 분기 — 흐름 순(라이브러리→스크립트→단어→익히기→정복→완성) 자연 진행
 *      - cold → 익히기 시작 (flashcard blocked 10)
 *      - warm → 익히기 다지기 (spellforge — 철자로 강화)
 *      - hot  → 정복 도전 (scriptquiz — 텍스트 단위 통합 검증)
 * P4: cold start fallback → 라이브러리 (L0 Discover)
 *
 * 주의: Dictation(L6 완성)은 자연 추천 대상에서 제외 — 사용자가 명시적으로 선택할 때만.
 *      §17.10 IA 원칙 — 흐름의 마지막 단계는 학습자 의지 발현 시점.
 */
export function getMockNextAction(ctx: MockUserContext): RecommendedAction {
  // 결정 로직은 decideNextAction 단일 출처 (실 추천 getNextActionForUser 와 동일).
  return decideNextAction({
    masteryLevel: ctx.masteryLevel,
    urgentWordCount: ctx.urgentWordCount,
    inProgressTextTitle: ctx.inProgressTextTitle,
    inProgressTextId: ctx.inProgressTextId,
  });
}

/** 데모용 mock 컨텍스트 — Hub 페이지에서 케이스를 골라 사용 */
export const MOCK_USER_CONTEXTS: Record<
  'cold' | 'warm_urgent' | 'warm_inprogress' | 'hot' | 'cold_start',
  MockUserContext
> = {
  cold: {
    masteryLevel: 'cold',
    totalWords: 12,
    currentStreak: 2,
    urgentWordCount: 0,
  },
  warm_urgent: {
    masteryLevel: 'warm',
    totalWords: 150,
    currentStreak: 8,
    urgentWordCount: 5,
  },
  warm_inprogress: {
    masteryLevel: 'warm',
    totalWords: 200,
    currentStreak: 12,
    urgentWordCount: 1,
    inProgressTextTitle: 'The Climate Report 2024',
    inProgressTextId: 'mock-text-1',
  },
  hot: {
    masteryLevel: 'hot',
    totalWords: 620,
    currentStreak: 35,
    urgentWordCount: 0,
  },
  cold_start: {
    masteryLevel: 'cold',
    totalWords: 0,
    currentStreak: 0,
    urgentWordCount: 0,
  },
};

/**
 * RecommendedAction → 라우팅 경로.
 * Hub Today CTA · FloatingSparkle · 세션 종료 화면 모두 동일 매핑 사용.
 */
export function actionToHref(action: RecommendedAction): string {
  switch (action.module) {
    case 'workspace':
      return action.textId ? `/text/${action.textId}` : '/text';
    case 'scriptquiz':
      return action.textId ? `/scriptquiz?textId=${action.textId}` : '/scriptquiz';
    case 'flashcard':
      return '/flashcard?mode=review';
    case 'dictation':
      return action.unit ? `/dictate?unit=${action.unit}` : '/dictate';
    case 'spellforge':
      return '/spellforge';
    case 'pairflip':
      return '/pairflip';
    case 'wordblitz':
      return '/wordblitz';
    case 'wordvault':
      return '/wordvault';
    case 'textviewer':
      return '/text';
    // 'library' + 추천 엔진이 내지 않는 그 외 모듈(아케이드 게임 등) → 라이브러리(L0 Discover) 폴백
    default:
      return '/library';
  }
}
