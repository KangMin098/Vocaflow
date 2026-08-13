// apps/web/src/components/game/scriptquiz/types.ts

import type { ContentRef } from '@/lib/content/content-ref'

export type QuizScreen = 'start' | 'question' | 'feedback' | 'result'
export type AnswerState = 'idle' | 'selected' | 'answered'

export interface QuizOption {
  /** 영어 본문 (immersion 기본) */
  text: string
  /** 한국어 번역 (showKorean 토글 시 보조 표시) */
  textKo?: string
}

export interface QuizQuestion {
  id: string
  type: 'multiple' | 'truefalse' | 'blank'
  /** 영어 질문 (immersion 기본) */
  question: string
  /** 한국어 질문 (showKorean 토글 시 보조 표시) */
  questionKo?: string
  options: QuizOption[]
  correctIndex: number
  /** 스크립트 근거 문장 — Lora italic 으로 표시 */
  sourceSnippet: string
  sourceSentenceIdx?: number
}

export interface QuizSession {
  textTitle: string
  textChapter?: string
  /**
   * 무엇으로 푸는 퀴즈인가. 큐레이션 챕터 경로는 enroll 없이 도서로 바로 들어와
   * `texts.id` 가 없다 — 그래서 완주 기록이 "어떤 도서였는지 모르는 행"으로 남았다.
   * 세션이 이 값을 들고 다녀야 완주 지점에서 귀속시킬 수 있다.
   */
  content?: ContentRef
  questions: QuizQuestion[]
}

export interface QuizAnswer {
  questionId: string
  selectedIndex: number
  isCorrect: boolean
  timeMs: number
}

// 큐레이션 챕터 퀴즈 카탈로그 (허브 discovery) — 클라이언트/서버 공용 타입.
export interface ChapterQuizCatalogChapter {
  chapterIdx: number
  chapterTitle: string
  questionCount: number
}

export interface ChapterQuizCatalogBook {
  bookId: string
  bookTitle: string
  bookVLevel: number | null
  chapters: ChapterQuizCatalogChapter[]
  questionTotal: number
}
