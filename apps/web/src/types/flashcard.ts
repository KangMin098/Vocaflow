// apps/web/src/types/flashcard.ts

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
  textId: string // 원문 ID
  textTitle: string // 원문 제목
  textChapter: string // 챕터
  srs: SRSState
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
