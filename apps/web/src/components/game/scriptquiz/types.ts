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
