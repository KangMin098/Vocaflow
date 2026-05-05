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
