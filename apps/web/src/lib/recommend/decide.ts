// apps/web/src/lib/recommend/decide.ts
//
// 추천 결정 로직 (순수) — CLAUDE.md §17.9 P1~P4. mock/실 컨텍스트 공용 단일 출처.
// getMockNextAction(데모)·getNextActionForUser(실 DB) 둘 다 이 함수로 결정.

import type { MasteryLevel } from '@/lib/srs'

import type { RecommendedAction } from './types'

export interface NextActionContext {
  masteryLevel: MasteryLevel
  /** due/위급 단어 수 (R<0.6 근사 = next_review_at 경과 단어) */
  urgentWordCount: number
  /** 진행 중 스크립트 (없으면 P2 비활성) */
  inProgressTextTitle?: string
  inProgressTextId?: string
}

/**
 * P1 위급 복습 → P2 진행 중 스크립트 → P3 mastery 흐름 순 → P4 cold start.
 * (getMockNextAction 의 로직을 추출 — 단일 출처)
 */
export function decideNextAction(ctx: NextActionContext): RecommendedAction {
  // P1 — 위급 단어 즉시 복습
  if (ctx.urgentWordCount >= 3) {
    return {
      module: 'flashcard',
      strategy: 'blocked',
      label: `위급 단어 ${ctx.urgentWordCount}개 다시 만나기`,
    }
  }

  // P2 — 진행 중 스크립트로 복귀 (Context-Dependent 보존)
  if (ctx.inProgressTextTitle) {
    return {
      module: 'workspace',
      label: `${ctx.inProgressTextTitle} 이어 듣기`,
      textId: ctx.inProgressTextId,
    }
  }

  // P3 — 흐름 순 자연 진행
  switch (ctx.masteryLevel) {
    case 'cold':
      return { module: 'flashcard', strategy: 'blocked', label: '익히기 시작 — 단어 만나보기' }
    case 'warm':
      return { module: 'spellforge', strategy: 'hybrid', label: '단어를 정확하게 — 철자로 다지기' }
    case 'hot':
      return { module: 'scriptquiz', strategy: 'interleaved', label: '정복 도전 — 스크립트 안에서 확인' }
  }

  // P4 — Cold start fallback
  return { module: 'library', label: '새 스크립트를 만나보세요' }
}
