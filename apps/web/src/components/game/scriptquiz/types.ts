// apps/web/src/components/game/scriptquiz/types.ts

import type { ContentRef } from '@/lib/content/content-ref'

export type QuizScreen = 'start' | 'question' | 'feedback' | 'result'
/** `grading` = 서버 채점을 기다리는 중. 정답이 클라이언트에 없으므로 이 상태가 생겼다. */
export type AnswerState = 'idle' | 'selected' | 'grading' | 'answered'

export interface QuizOption {
  /** 영어 본문 (immersion 기본) */
  text: string
  /** 한국어 번역 (showKorean 토글 시 보조 표시) */
  textKo?: string
}

/**
 * 브라우저로 내려보내는 문항 — **정답이 없다.**
 *
 * ⚠️ 예전에는 `correctIndex` 와 `sourceSnippet` 이 여기 있었다. `ScriptQuiz` 가
 *   `'use client'` 라 이 객체는 통째로 RSC 페이로드에 직렬화되고, 그래서
 *   `/scriptquiz/play?book=…&ch=…` 를 열어 **시작하기를 누르기 전에** `Ctrl+U` 만 눌러도
 *   5~10문항의 정답 인덱스와 근거 문장이 그대로 보였다(채점도 브라우저가 했다).
 *   같은 저장소의 DCP 는 정반대를 지키고 있다 — `lib/learner/dcp-actions.ts` 의
 *   "문항 테이블은 **열어서도 안 된다**" 주석. **타입에서 지워 재발을 막는다.**
 *   정답·근거는 답한 뒤 `gradeScriptQuizAnswer` 가 그때 하나만 돌려준다.
 */
export interface QuizQuestion {
  id: string
  type: 'multiple' | 'truefalse' | 'blank'
  /** 영어 질문 (immersion 기본) */
  question: string
  /** 한국어 질문 (showKorean 토글 시 보조 표시) */
  questionKo?: string
  options: QuizOption[]
}

/**
 * 이 세션의 정답표가 **서버 어디에 있는가.** 클라이언트는 이 값만 들고 다니고,
 * 채점 server action 이 그것으로 원본을 다시 읽어 판정한다.
 */
export type QuizSource =
  | { kind: 'book'; bookId: string; chapterIdx: number }
  | { kind: 'text'; textId: string }
  /** 데모 5문항 — 정답표는 `lib/scriptquiz/sample-answers.ts`(server-only)에 있다. */
  | { kind: 'sample' }

export interface QuizSession {
  textTitle: string
  textChapter?: string
  /**
   * 무엇으로 푸는 퀴즈인가. 큐레이션 챕터 경로는 enroll 없이 도서로 바로 들어와
   * `texts.id` 가 없다 — 그래서 완주 기록이 "어떤 도서였는지 모르는 행"으로 남았다.
   * 세션이 이 값을 들고 다녀야 완주 지점에서 귀속시킬 수 있다.
   */
  content?: ContentRef
  /** 채점을 어디에 물을 것인가. */
  source: QuizSource
  questions: QuizQuestion[]
}

/**
 * 채점 결과 한 건 — **정답과 근거는 여기로 온다.**
 * 결과 화면의 오답 목록이 「내 답 / 정답」을 그릴 수 있는 것도 이 값 덕분이다.
 */
export interface QuizAnswer {
  questionId: string
  /** 시간 초과는 -1 */
  selectedIndex: number
  correctIndex: number
  isCorrect: boolean
  /** 스크립트 근거 문장 — Lora italic 으로 표시. 없으면 빈 문자열 */
  sourceSnippet: string
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
