// apps/web/src/lib/dictation/types.ts
// Dictation 도메인 타입

export type DictationUnit = 'sentence' | 'paragraph' | 'whole';
// 'difficulty-first' 는 v06.21 에서 제거 — 오답 이력 기반 구현 미완성 (Phase 2 예정).
//   Phase 2 부활 시 learning_records 누적 → 빈도 기반 재정렬.
export type DictationOrder = 'sequential' | 'random';
export type ScoringMode = 'smart' | 'strict';
export type CEFRCode = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type CEFRGroup = '초급' | '중급' | '고급';
export type SessionPhase = 'idle' | 'listening' | 'typing' | 'feedback' | 'complete';

export interface DictationResource {
  id: string;
  title: string;
  /** 원본 영어 스크립트 */
  script: string;
  source: 'library' | 'direct-script' | 'direct-file';
  cefr?: CEFRCode;
  /** 한국어 번역 (선택) */
  translation?: string;
  createdAt: number;
}

export interface DictationConfig {
  resourceId: string;
  unit: DictationUnit;
  count: number | 'all';
  order: DictationOrder;
  scoring: ScoringMode;
  cefr: CEFRCode;
  /** 0.5 ~ 1.5 */
  speed: number;
  /** 자동 반복 횟수 */
  autoRepeat: number;
  hintsAllowed: boolean;
  voice: string;
}

export interface WordResult {
  expected: string;
  actual: string;
  status: 'correct' | 'misspelled' | 'wrong' | 'missing' | 'extra';
  similarity: number;
  errorType?: 'capitalization' | 'punctuation' | 'spelling' | 'word-choice';
}

export interface ErrorPattern {
  type: 'phonetic' | 'morphological' | 'syntactic' | 'lexical';
  subtype: string;
  description: string;
  examples: { expected: string; actual: string }[];
  frequency: number;
  suggestion: string;
  cefrLevel?: CEFRCode[];
}

export interface ScoringResult {
  accuracy: number;
  wordResults: WordResult[];
  errorPatterns: ErrorPattern[];
  feedback: string;
}

export interface DictationItem {
  index: number;
  expectedText: string;
  translation?: string;
  /** 사용자 입력 */
  userInput?: string;
  result?: ScoringResult;
  attemptCount: number;
  hintsUsed: number;
  timeMs?: number;
}

export interface DictationSession {
  id: string;
  config: DictationConfig;
  resourceTitle: string;
  items: DictationItem[];
  currentIndex: number;
  startedAt: number;
  completedAt?: number;
  totalAccuracy?: number;
  totalTimeMs?: number;
  totalHintsUsed: number;
}
