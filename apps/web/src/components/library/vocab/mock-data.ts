// apps/web/src/components/library/vocab/mock-data.ts
//
// 샘플 6 세트 — Phase 2: shared_word_sets 테이블에서 fetch.

import type { VocabCategoryId } from './categories'

export interface VocabSet {
  id: string
  title: string
  category: Exclude<VocabCategoryId, 'all'>
  cefr: string
  wordCount: number
  description: string
  /** 이미 구독한 세트 — 카드 disabled 처리 */
  isSubscribed?: boolean
}

export const MOCK_VOCAB_SETS: VocabSet[] = [
  {
    id: 'csat-top1000',
    title: '수능 빈출 어휘 TOP 1000',
    category: 'csat',
    cefr: 'B2',
    wordCount: 1000,
    description: '최근 10개년 수능 출제 어휘 분석 기반',
  },
  {
    id: 'high-essential-2000',
    title: '고등 필수 2000',
    category: 'high',
    cefr: 'B1~B2',
    wordCount: 2000,
    description: 'EBS 수능 연계 핵심 어휘',
  },
  {
    id: 'middle-1200',
    title: '중등 필수 1200',
    category: 'middle',
    cefr: 'A2~B1',
    wordCount: 1200,
    description: '교육부 중등 기본 어휘 기반',
  },
  {
    id: 'toeic-900',
    title: 'TOEIC 900 핵심',
    category: 'eng_test',
    cefr: 'B2',
    wordCount: 1200,
    description: 'Part 5/6 빈출 문법·어휘',
  },
  {
    id: 'civil-9th',
    title: '공무원 9급 영어',
    category: 'civil',
    cefr: 'B2~C1',
    wordCount: 2000,
    description: '연도별 출제 빈도 분석',
  },
  {
    id: 'business-email',
    title: '비즈니스 이메일 표현',
    category: 'business',
    cefr: 'B2',
    wordCount: 600,
    description: '실무 빈출 표현·관용구',
  },
]
