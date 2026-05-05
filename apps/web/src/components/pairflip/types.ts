// apps/web/src/components/pairflip/types.ts
// CLAUDE.md §17.6 모듈 매트릭스 정합 — L4a Recognize (공간기억 + 매칭)

export type PairFlipLevel = 'easy' | 'normal' | 'hard' | 'expert' | 'master'

export type PairFlipMode = 'word_meaning' | 'word_definition'
// word_image (이미지 모드) 는 Phase 2 — 이미지 자산 준비 후 추가

export interface PairFlipLevelConfig {
  id: PairFlipLevel
  label: string
  emoji: string
  pairCount: number // 2, 5, 6, 8, 10
  cardCount: number // pairCount * 2
  timeLimit: number // seconds
  gridCols: number // 모바일·데스크톱 동일 (Calm UI: layout shift 회피)
  description: string
}

export type PairFlipCardState =
  | 'covered' // 뒤집혀 있음 (default)
  | 'flipped' // 사용자가 클릭하여 앞이 보이는 중
  | 'matched' // 매칭 성공 (사라지기 전 1.2s 애니메이션)
  | 'shaking' // 매칭 실패 (잠시 흔들림)
  | 'gone' // 완전히 사라짐

export type PairFlipCardType = 'word' | 'meaning'

export interface PairFlipCard {
  id: string
  pairId: string
  type: PairFlipCardType
  content: string
  partOfSpeech?: string
  phonetic?: string
  state: PairFlipCardState
  position: number
  attempts: number
  patternIndex?: number // 뒷면 패턴 0..4
}

export type PairFlipPhase =
  | 'idle'
  | 'reveal_first'
  | 'reveal_second'
  | 'matched'
  | 'mismatched'
  | 'won'
  | 'lost'

export interface PairFlipPairResult {
  pairId: string
  word: string
  meaning: string
  attempts: number
  matchedAt: number
  fsrsRating: 1 | 2 | 3 | 4
}

export interface PairFlipSession {
  level: PairFlipLevel
  mode: PairFlipMode
  cards: PairFlipCard[]
  startedAt: number
  endedAt?: number
  matchedPairs: number
  totalAttempts: number
  combo: number
  maxCombo: number
  hintsUsed: number
  score: number
  phase: PairFlipPhase
  selectedCardIds: string[]
  pairResults: PairFlipPairResult[]
}

export interface PairFlipConfig {
  level: PairFlipLevel
  mode: PairFlipMode
}

export interface PairFlipResultData {
  level: PairFlipLevel
  mode: PairFlipMode
  totalPairs: number
  matchedPairs: number
  totalAttempts: number
  maxCombo: number
  hintsUsed: number
  score: number
  durationMs: number
  pairResults: PairFlipPairResult[]
  phase: 'won' | 'lost'
}
