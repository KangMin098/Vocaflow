// apps/web/src/components/game/scriptquiz/types.ts

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
