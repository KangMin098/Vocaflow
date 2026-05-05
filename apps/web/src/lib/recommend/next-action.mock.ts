// apps/web/src/lib/recommend/next-action.mock.ts
//
// 추천 엔진 Mock — DB 미연동 상태에서 Hub/FloatingSparkle 등을 실동작 검증.
// CLAUDE.md §17.9 추천 우선순위 P1~P4 그대로 구현.
//
// DB 연동 시 swap 대상은 getMockNextAction 한 함수뿐 — 호출자(HubHero 등)는 변경 X.

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
  // P1 — 위급 단어 즉시 복습
  if (ctx.urgentWordCount >= 3) {
    return {
      module: 'flashcard',
      strategy: 'blocked',
      label: `위급 단어 ${ctx.urgentWordCount}개 다시 만나기`,
    };
  }

  // P2 — 진행 중 스크립트로 복귀
  if (ctx.inProgressTextTitle) {
    return {
      module: 'workspace',
      label: `${ctx.inProgressTextTitle} 이어 듣기`,
      textId: ctx.inProgressTextId,
    };
  }

  // P3 — 흐름 순 자연 진행
  switch (ctx.masteryLevel) {
    case 'cold':
      return {
        module: 'flashcard',
        strategy: 'blocked',
        label: '익히기 시작 — 단어 만나보기',
      };
    case 'warm':
      return {
        module: 'spellforge',
        strategy: 'hybrid',
        label: '단어를 정확하게 — 철자로 다지기',
      };
    case 'hot':
      return {
        module: 'scriptquiz',
        strategy: 'interleaved',
        label: '정복 도전 — 스크립트 안에서 확인',
      };
  }

  // P4 — Cold start
  return { module: 'library', label: '새 스크립트를 만나보세요' };
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
    case 'wordblitz':
      return '/wordblitz';
    case 'wordvault':
      return '/wordvault';
    case 'textviewer':
      return '/text';
    case 'library':
      return '/library';
  }
}
