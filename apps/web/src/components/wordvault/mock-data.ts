// apps/web/src/components/wordvault/mock-data.ts
// WordVault 데모 데이터
//
// §17 v2.0 SRS — 4색 분포 시각 검증용 결정적 SrsCard.
//   id 1, 8 → STABLE (초록)
//   id 2    → SHAKY  (주황)
//   id 4, 6 → RISK   (빨강) — SpotlightWord + MemoryDecayDistribution 노출
//   나머지   → 'new'  (회색)
// 분포 결과: stable 2 / shaky 1 / risk 2 / new 3 (전체 8개).
// DB 연동 후엔 vocabularies row에서 rowToCard()로 자연 채워짐.

import type { SrsCard } from '@/lib/srs'
import type { WordItem } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()

// stable: R = 0.9^(1/10) ≈ 0.9895 ≥ 0.95 → 초록
const STABLE_CARD: SrsCard = {
  id: '1',
  difficulty: 5.0,
  stability: 10,
  lastReviewAt: new Date(now - 1 * DAY_MS),
  nextReviewAt: new Date(now + 9 * DAY_MS),
  moduleHistory: ['flashcard'],
  reviewCount: 4,
}

// shaky: R = 0.9^(3/2) ≈ 0.854 → 0.70~0.95 → 주황
const SHAKY_CARD: SrsCard = {
  id: '2',
  difficulty: 6.5,
  stability: 2,
  lastReviewAt: new Date(now - 3 * DAY_MS),
  nextReviewAt: new Date(now - 1 * DAY_MS),
  moduleHistory: ['flashcard', 'dictation'],
  reviewCount: 2,
}

// risk: R = 0.9^(5/1) ≈ 0.59 → < 0.70 → 빨강
const RISK_CARD: SrsCard = {
  id: '4',
  difficulty: 7.2,
  stability: 1,
  lastReviewAt: new Date(now - 5 * DAY_MS),
  nextReviewAt: new Date(now - 4 * DAY_MS),
  moduleHistory: ['flashcard'],
  reviewCount: 1,
}

// risk(2): R = 0.9^(7/1.5) ≈ 0.61 → < 0.70 → 빨강
const RISK_CARD_2: SrsCard = {
  id: '6',
  difficulty: 7.5,
  stability: 1.5,
  lastReviewAt: new Date(now - 7 * DAY_MS),
  nextReviewAt: new Date(now - 5.5 * DAY_MS),
  moduleHistory: ['flashcard', 'spellforge'],
  reviewCount: 2,
}

// stable(2): R ≈ 0.97 → 초록
const STABLE_CARD_2: SrsCard = {
  id: '8',
  difficulty: 4.5,
  stability: 14,
  lastReviewAt: new Date(now - 2 * DAY_MS),
  nextReviewAt: new Date(now + 12 * DAY_MS),
  moduleHistory: ['flashcard', 'dictation', 'wordblitz'],
  reviewCount: 6,
}

export const MOCK_WORDS: WordItem[] = [
  {
    id: 1,
    word: 'persistence',
    pos: 'n.',
    meaning: '끈기, 지속성',
    exampleEn: 'Practice and persistence pay off in the long run.',
    level: 'C1',
    levelClass: 'c',
    mastery: 4,
    lastDays: 2,
    nextDays: 3,
    srs: STABLE_CARD,
  },
  {
    id: 2,
    word: 'remarkable',
    pos: 'adj.',
    meaning: '주목할 만한, 놀랄 만한',
    exampleEn: 'Yesterday I went to a remarkable bookstore downtown.',
    level: 'B2',
    levelClass: 'b',
    mastery: 3,
    lastDays: 3,
    nextDays: 5,
    srs: SHAKY_CARD,
  },
  {
    id: 3,
    word: 'fascinating',
    pos: 'adj.',
    meaning: '매혹적인, 흥미로운',
    exampleEn: 'I discovered a fascinating biography about an artist.',
    level: 'B1',
    levelClass: 'b',
    mastery: 2,
    lastDays: 5,
    nextDays: 1,
  },
  {
    id: 4,
    word: 'obscure',
    pos: 'adj.',
    meaning: '잘 알려지지 않은, 모호한',
    exampleEn: 'It was about an obscure Renaissance artist.',
    level: 'C1',
    levelClass: 'c',
    mastery: 5,
    lastDays: 7,
    nextDays: 14,
    srs: RISK_CARD,
  },
  {
    id: 5,
    word: 'cozy',
    pos: 'adj.',
    meaning: '아늑한, 편안한',
    exampleEn: 'The atmosphere was incredibly cozy and warm.',
    level: 'B2',
    levelClass: 'b',
    mastery: 5,
    lastDays: 7,
    nextDays: 14,
  },
  {
    id: 6,
    word: 'atmosphere',
    pos: 'n.',
    meaning: '분위기, 대기',
    exampleEn: 'The atmosphere of the cafe was warm and welcoming.',
    level: 'B1',
    levelClass: 'b',
    mastery: 4,
    lastDays: 14,
    nextDays: 7,
    srs: RISK_CARD_2,
  },
  {
    id: 7,
    word: 'incredibly',
    pos: 'adv.',
    meaning: '믿을 수 없을 정도로',
    exampleEn: 'The view from the mountain was incredibly beautiful.',
    level: 'B2',
    levelClass: 'b',
    mastery: 2,
    lastDays: 5,
    nextDays: 1,
  },
  {
    id: 8,
    word: 'discovered',
    pos: 'v.',
    meaning: '발견했다',
    exampleEn: 'She discovered a new species of butterfly.',
    level: 'A2',
    levelClass: 'a',
    mastery: 4,
    lastDays: 14,
    nextDays: 7,
    srs: STABLE_CARD_2,
  },
  // v06.19 추가 — CEFR 6단계 시각 검증용 5개
  {
    id: 9,
    word: 'apple',
    pos: 'n.',
    meaning: '사과',
    exampleEn: 'I eat an apple every morning.',
    level: 'A1',
    levelClass: 'a',
    mastery: 5,
    lastDays: 30,
    nextDays: 60,
  },
  {
    id: 10,
    word: 'travel',
    pos: 'v.',
    meaning: '여행하다',
    exampleEn: 'They travel together every summer.',
    level: 'A2',
    levelClass: 'a',
    mastery: 4,
    lastDays: 14,
    nextDays: 30,
  },
  {
    id: 11,
    word: 'environment',
    pos: 'n.',
    meaning: '환경',
    exampleEn: 'The environment around us shapes our thinking.',
    level: 'B1',
    levelClass: 'b',
    mastery: 3,
    lastDays: 7,
    nextDays: 14,
  },
  {
    id: 12,
    word: 'consequence',
    pos: 'n.',
    meaning: '결과, 영향',
    exampleEn: 'Every choice has its consequence.',
    level: 'C1',
    levelClass: 'c',
    mastery: 3,
    lastDays: 5,
    nextDays: 7,
  },
  {
    id: 13,
    word: 'epitome',
    pos: 'n.',
    meaning: '전형, 본질',
    exampleEn: 'She is the epitome of grace under pressure.',
    level: 'C2',
    levelClass: 'c',
    mastery: 1,
    lastDays: 2,
    nextDays: 1,
  },
]

// CEFR 6단계 카운트 집계 헬퍼 (v06.19) — WordVault Hub Tier 3 용
export function tallyCEFR(words: WordItem[]): { level: import('@/types/library').CEFRLevel; count: number }[] {
  const order: import('@/types/library').CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const counts: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
  for (const w of words) {
    if (w.level in counts) counts[w.level] += 1
  }
  return order.map((level) => ({ level, count: counts[level] ?? 0 }))
}

export const MOCK_COLLECTIONS = [
  { id: 'all', name: '전체', count: 342 },
  { id: 'gatsby', name: 'The Great Gatsby', count: 156 },
  { id: '1984', name: '1984', count: 89 },
  { id: 'ted', name: 'TED', count: 47 },
  { id: 'bbc', name: 'BBC', count: 23 },
  { id: 'favorites', name: '즐겨찾기', count: 28 },
]

// ────────────────────────────────────────────────────────────────────
// v06.18 — Asset Hub 보강 mock
// ────────────────────────────────────────────────────────────────────

import type { AssetCollection } from './hub/AssetCollectionsRow'

/** 첫 단어 추가일로부터 오늘까지의 일수 (mock — Phase 2: vocabularies.created_at MIN) */
export const MOCK_ACCUMULATED_DAYS = 31

/** week-over-week 추세 (mock — Phase 2: 7일 vs 14일 stable/risk count diff) */
export const MOCK_TREND = {
  stableDelta: 8, // 이번 주 +8 stable
  riskDelta: -3, // 이번 주 -3 risk (긍정)
}

// ────────────────────────────────────────────────────────────────────
// v06.20 — BookShelf · LearningDimension · WordPeek mock
// ────────────────────────────────────────────────────────────────────

import type { VaultBook } from './hub/BookShelfSection'
import type { PeekWord } from './hub/WordPeekStrip'
import type { MasteryGroup } from '@/lib/wordvault/mastery'

/** BookShelf — 5종 Book Type (text 2 + level 2 + smart 1 + goal 잠금 1) */
export const MOCK_BOOKS: VaultBook[] = [
  {
    id: 'book-text-001',
    type: 'text',
    title: 'The Great Gatsby — Chapter 1',
    subtitle: 'B2 · 32단어',
    wordCount: 32,
    distribution: { stable: 12, shaky: 8, risk: 5, new: 7 },
    textStatus: 'in-progress',
    href: '/wordvault?view=browse&textId=text-001',
  },
  {
    id: 'book-text-002',
    type: 'text',
    title: 'TED · Power of Vulnerability',
    subtitle: 'B1 · 18단어',
    wordCount: 18,
    distribution: { stable: 7, shaky: 4, risk: 3, new: 4 },
    textStatus: 'extracted',
    href: '/wordvault?view=browse&textId=text-002',
  },
  {
    id: 'book-level-b1',
    type: 'level',
    title: 'B1 레벨 단어',
    subtitle: '83단어 · CEFR B1',
    wordCount: 83,
    distribution: { stable: 41, shaky: 20, risk: 12, new: 10 },
    href: '/wordvault?view=browse&level=B1',
  },
  {
    id: 'book-level-b2',
    type: 'level',
    title: 'B2 레벨 단어',
    subtitle: '61단어 · CEFR B2',
    wordCount: 61,
    distribution: { stable: 28, shaky: 15, risk: 10, new: 8 },
    href: '/wordvault?view=browse&level=B2',
  },
  {
    id: 'book-smart-risk',
    type: 'smart',
    title: '⚡ 복습이 필요한 단어',
    subtitle: 'R(t) < 0.7 · 35단어',
    wordCount: 35,
    distribution: { stable: 0, shaky: 0, risk: 35, new: 0 },
    href: '/wordvault?view=browse&filter=risk',
  },
  {
    id: 'book-goal-locked',
    type: 'goal',
    title: '목표 단어장',
    subtitle: '수능·토익 목표 설정',
    wordCount: 0,
    distribution: { stable: 0, shaky: 0, risk: 0, new: 0 },
    href: '#',
    isLocked: true,
  },
]

/** LearningDimension 3그룹 카운트 (mock — Phase 2: groupByMastery 호출) */
export const MOCK_MASTERY_GROUPS: MasteryGroup[] = [
  { stage: 'unmet', count: 63 },
  { stage: 'recognizing', count: 47 },
  { stage: 'multichannel', count: 27 },
]

/** 최근에 만난 단어 5개 (Word Peek 데스크톱 푸터) */
export const MOCK_RECENT_WORDS: PeekWord[] = [
  { id: 'w1', word: 'evolution', meaning: '진화', memoryState: 'shaky' },
  { id: 'w2', word: 'vulnerable', meaning: '취약한', memoryState: 'new' },
  { id: 'w3', word: 'compassion', meaning: '연민', memoryState: 'stable' },
  { id: 'w4', word: 'persist', meaning: '지속하다', memoryState: 'risk' },
  { id: 'w5', word: 'authentic', meaning: '진정한', memoryState: 'new' },
]

/** 자산 컬렉션 mock — type 3종 (text 2 + auto 1) */
export const MOCK_ASSET_COLLECTIONS: AssetCollection[] = [
  {
    id: 'col-text-001',
    type: 'text',
    title: 'The Great Gatsby — Chapter 1',
    subtitle: 'B2 · 32단어',
    wordCount: 32,
    distribution: { stable: 12, shaky: 8, risk: 5, new: 7 },
    href: '/wordvault?view=browse&textId=text-001',
  },
  {
    id: 'col-text-002',
    type: 'text',
    title: 'TED · Power of Vulnerability',
    subtitle: 'B1 · 18단어',
    wordCount: 18,
    distribution: { stable: 7, shaky: 4, risk: 3, new: 4 },
    href: '/wordvault?view=browse&textId=text-002',
  },
  {
    id: 'col-auto-recent',
    type: 'auto',
    title: '이번 주 만난 단어',
    subtitle: '최근 7일 추가',
    wordCount: 15,
    distribution: { stable: 0, shaky: 2, risk: 1, new: 12 },
    href: '/wordvault?view=browse&filter=recent7d',
    iconName: 'sparkles',
  },
]
