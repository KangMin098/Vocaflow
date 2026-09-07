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
  /** 사전 DB inflected_forms — 예문 하이라이트/빈칸의 불규칙 굴절 인식용 (없으면 규칙 fallback) */
  inflectedForms?: string[]
  /** 자주 함께 쓰는 표현(collocations) — 정답면에만 절제 노출(Progressive Disclosure). 없으면 미표시 */
  collocations?: string[]
  /**
   * 파생어(`derived_forms`) · 유의어(`synonyms`) · 반의어(`antonyms`) — 정답면 하단.
   *
   * ⚠️ 셋 다 **사전에 있었는데 화면이 안 읽던 칸**이다(실측 2026-08-30: 58.8% · 71.1% · 51.5%).
   *   시중 단어장은 표제어 아래에 이 셋을 붙이는 것이 기본형인데(실측 파생어 41.4% ·
   *   유의/반의 26%), 우리는 그보다 많이 갖고도 학습자에게 보여 준 적이 없었다.
   *   없으면 미표시 — 빈 줄이 카드를 흔들지 않게 한다.
   */
  derived?: string[]
  synonyms?: string[]
  antonyms?: string[]
  /**
   * 다의어 품사별 뜻 (meanings_ko ≥2 sense) — 정답면 "여러 뜻" 노출. 단일 sense면 미표시(flat meaning 충분).
   * `example`/`exampleKo` 는 **그 뜻으로만 읽히는 문장**이다 — 뜻 목록만으로는 갈라지지 않는다.
   */
  senses?: { pos: string; meaning: string; example?: string; exampleKo?: string }[]
  /** 대표 예문의 한국어 해석 — 없으면 미표시(해석 없는 예문은 학습자가 건너뛴다) */
  exampleTranslation?: string
  /** 어원 root 분해 (word_root_links) — 정답면 어원 힌트. prefix→root→suffix 순. 없으면 미표시 */
  roots?: { root: string; gloss: string; affix: string }[]
  /** 어근 기반 니모닉(mnemonic_ko) — 정답면 기억 힌트. 없으면 미표시 */
  mnemonic?: string
  textId: string // 스크립트 ID
  textTitle: string // 스크립트 제목
  textChapter: string // 챕터
  /** 그림책 단어면 그 페이지 삽화 url — Dual Coding 시각 단서 (StoryWeaver 등) */
  illustrationUrl?: string
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
