// apps/web/src/components/wordvault/types.ts
// WordVault 도메인 타입

import type { SrsCard } from '@/lib/srs'

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type LevelClass = 'a' | 'b' | 'c'
export type LearnState = 'fresh' | 'progress' | 'known' | 'mastered' | 'review'

export interface WordItem {
  /** 단어 고유 ID */
  id: number
  /** 영단어 */
  word: string
  /** 품사 (n. v. adj. adv. ...) */
  pos: string
  /** 한국어 뜻 */
  meaning: string
  /** 영어 예문 */
  exampleEn: string
  /** CEFR 난이도 */
  level: CefrLevel
  /** 난이도 색상 클래스 */
  levelClass: LevelClass
  /** 마스터 단계 (1~5) */
  mastery: 1 | 2 | 3 | 4 | 5
  /** 마지막 학습 며칠 전 */
  lastDays: number
  /** 다음 복습 며칠 후 */
  nextDays: number
  /**
   * §17 v2.0 SRS 필드 — FSRS 호환 (D/S/R)
   * undefined = 'new' 처리 (mock 데이터 또는 DB 미연동 단어)
   * DB 연동 후: vocabularies row에서 rowToCard()로 채움
   */
  srs?: SrsCard
}

export type ListenContent = 'word' | 'word-example'
export type ListenSpeed = 0.75 | 1.0 | 1.25 | 1.5
export type ListenGap = 0.5 | 1.0 | 2.0
export type ListenRepeat = 1 | 2 | 999

export interface ListenSettings {
  content: ListenContent
  speed: ListenSpeed
  gap: ListenGap
  repeat: ListenRepeat
  shuffle: boolean
}

export type StudyState = 'hidden' | 'meaning-shown' | 'example-shown'

export type ScreenName = 'browse' | 'study' | 'review'

export type HideType = 'word' | 'meaning'

export interface HideStates {
  word: boolean
  meaning: boolean
}
