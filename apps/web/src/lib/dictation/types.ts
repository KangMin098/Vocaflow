// apps/web/src/lib/dictation/types.ts
// Dictation 도메인 타입
//
// v07 변경 — 자료(DictationResource)를 걷어냈다.
//   받아쓸 것은 이제 localStorage 리소스가 아니라 DB 학습 자산이고, 그 해석은
//   lib/dictation/source.ts(DictationSource)가 맡는다. 세션은 "어떤 문장들을
//   지금 풀고 있는가"만 안다.
//
//   'unit'(문장/단락/전체)은 chunkSize(한 번에 받아쓸 문장 수)로 대체됐다.
//   단락·전체는 연속 본문에서만 성립하는 개념이라 단어장·오늘의 받아쓰기에서는
//   말이 안 됐고, 실제로 학습자가 조절하고 싶은 것은 "한 번에 몇 문장이냐"다.

import type { DailyReason } from './source'

export type DictationOrder = 'sequential' | 'random'
export type ScoringMode = 'smart' | 'strict'
export type CEFRCode = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type CEFRGroup = '초급' | '중급' | '고급'
export type SessionPhase = 'idle' | 'listening' | 'typing' | 'feedback' | 'complete'

/** 한 문항에 담기는 문장 수. 3 이상은 Dictogloss(듣고 메모 후 재구성) 영역. */
export type ChunkSize = 1 | 2 | 3

export interface DictationConfig {
  chunkSize: ChunkSize
  count: number | 'all'
  order: DictationOrder
  scoring: ScoringMode
  cefr: CEFRCode
  /** 0.5 ~ 1.25 */
  speed: number
  /** 자동 반복 횟수 */
  autoRepeat: number
  hintsAllowed: boolean
  voice: string
}

export interface WordResult {
  expected: string
  actual: string
  status: 'correct' | 'misspelled' | 'wrong' | 'missing' | 'extra'
  similarity: number
  errorType?: 'capitalization' | 'punctuation' | 'spelling' | 'word-choice'
}

export interface ErrorPattern {
  type: 'phonetic' | 'morphological' | 'syntactic' | 'lexical'
  subtype: string
  description: string
  examples: { expected: string; actual: string }[]
  frequency: number
  suggestion: string
  cefrLevel?: CEFRCode[]
}

export interface ScoringResult {
  accuracy: number
  wordResults: WordResult[]
  errorPatterns: ErrorPattern[]
  feedback: string
}

export interface DictationItem {
  index: number
  expectedText: string
  translation?: string
  /** 이 문항이 훈련하는 내 단어(원형) */
  targetWords: string[]
  /** 단어별 굴절형 — 적중 판정용 */
  targetForms: Record<string, string[]>
  /** "Chapter 3" · "복습 임박 단어" 등 출처 라벨 */
  contextLabel?: string
  /** 오늘의 받아쓰기에서 이 문장이 뽑힌 이유 */
  reason?: DailyReason
  /** 재도전 문장의 지난번 정확도 — 이번 결과와 나란히 보여준다 */
  previousAccuracy?: number

  userInput?: string
  result?: ScoringResult
  attemptCount: number
  hintsUsed: number
  /**
   * 사용한 가장 강한 힌트 단계 (0=없음 … 4=정답 보기).
   * 개수가 아니라 강도가 중요하다 — '첫 글자 보기' 3번과 '정답 보기' 1번은 전혀 다른 일이다.
   */
  maxHintLevel: number
  /** 몇 번 다시 들었는가 — 정확도와 함께 봐야 난이도를 안다 */
  replayCount: number
  timeMs?: number
  /** 채점 후 산출 */
  errorTags?: string[]
  targetHits?: string[]
  skipped?: boolean
}

export interface DictationSession {
  /** DB dictation_sessions.id (uuid). 비로그인이면 `local-*`. */
  id: string
  /** DB 에 남았는가 — false 면 이 기기에서만 보인다 */
  persisted: boolean
  config: DictationConfig
  resourceTitle: string
  resourceSubtitle: string
  /** DB source_kind 와 동일 */
  sourceKind: string
  textId?: string
  libraryBookId?: string
  chapterIdx?: number
  sharedSetId?: string

  items: DictationItem[]
  currentIndex: number
  startedAt: number
  completedAt?: number
  totalAccuracy?: number
  totalTimeMs?: number
  totalHintsUsed: number
}
