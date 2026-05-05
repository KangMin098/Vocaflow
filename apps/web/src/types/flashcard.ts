// apps/web/src/types/flashcard.ts

import type { SrsCard } from '@/lib/srs'

export type SRSRating = 'again' | 'hard' | 'good' | 'easy'

export type FlashcardPhase =
  | 'recall' // 3초 인출 시간
  | 'flippable' // 1차 평가 + 카드 클릭 가능
  | 'flipped' // 카드 뒤집힌 상태
  | 'evaluated' // SRS 평가 완료, 다음 카드 진입 중
  | 'completed' // 세션 완료

export type FirstJudgeAnswer = 'no' | 'yes'

export interface SRSState {
  easinessFactor: number // 1.3 ~ 2.5+ (default 2.5)
  interval: number // 다음 등장까지 일수
  repetitions: number // 연속 성공 횟수
  nextReviewAt: Date
  lapses: number // 'again' 누적 횟수
}

export interface FlashcardWord {
  id: string
  text: string
  meaning: string
  pronunciation: string
  pos: string
  exampleSentence: string
  exampleSentenceWithBlank: string
  textId: string // 스크립트 ID
  textTitle: string // 스크립트 제목
  textChapter: string // 챕터
  srs: SRSState // 기존 SM-2 (UI 호환 — SRSBar 등이 소비)
  /**
   * §17 v2.0 FSRS 필드 — 병행 운영 (CLAUDE.md §17.4 "기존 sm2.ts wrapper 유지" 정합)
   * undefined이면 FSRS 경로 비활성 — applyReview 호출 안 함.
   * DB 연동 후엔 vocabularies row → rowToCard()로 채워짐.
   */
  srsV2?: SrsCard
}

export interface DifficultWord {
  word: FlashcardWord
  attemptCount: number
}

export interface SessionStats {
  totalCards: number
  studiedCards: number
  startTime: Date
  durationSeconds: number
  ratingCounts: {
    again: number
    hard: number
    good: number
    easy: number
  }
  difficultWords: DifficultWord[]
  honestyScore: number // Hard 솔직 평가 비율
}

export interface PauseMessage {
  icon: string
  text: string
}
