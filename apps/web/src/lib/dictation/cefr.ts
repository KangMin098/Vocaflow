// apps/web/src/lib/dictation/cefr.ts
// CEFR 레벨 시스템 (A1~C2) + 자동 감지 + 그룹별 추천
//
// v07 — recommended.unit(문장/단락/전체) → chunkSize(한 번에 받아쓸 문장 수).
//   단락·전체는 연속 본문에서만 성립해 단어장·오늘의 받아쓰기에 적용할 수 없었다.

import type { CEFRCode, CEFRGroup, ChunkSize } from './types';

export interface CEFRLevel {
  code: CEFRCode;
  korean: string;
  description: string;
  group: CEFRGroup;
  recommended: {
    chunkSize: ChunkSize;
    speed: number;
    autoRepeat: number;
    hintsAllowed: boolean;
    sessionCount: number;
  };
  vocabRange: [number, number];
  sentenceLength: [number, number];
  examTarget: string[];
}

export const CEFR_LEVELS: CEFRLevel[] = [
  // ─── 초급 ───
  {
    code: 'A1',
    korean: '입문 (초보)',
    description: '아주 단순한 일상 표현. 한 줄 1회 듣고 받아쓰기',
    group: '초급',
    recommended: {
      chunkSize: 1,
      speed: 0.75,
      autoRepeat: 3,
      hintsAllowed: true,
      sessionCount: 5,
    },
    vocabRange: [0, 500],
    sentenceLength: [3, 8],
    examTarget: ['Cambridge Pre-A1 Starters', 'TOEIC 120-225'],
  },
  {
    code: 'A2',
    korean: '기초',
    description: '간단한 일상 + 자기 소개. 짧은 문장 2-3회 듣기',
    group: '초급',
    recommended: {
      chunkSize: 1,
      speed: 0.85,
      autoRepeat: 3,
      hintsAllowed: true,
      sessionCount: 10,
    },
    vocabRange: [500, 1500],
    sentenceLength: [5, 12],
    examTarget: ['Cambridge KET', 'TOEIC 225-550', '고교 1-2학년'],
  },
  // ─── 중급 ───
  {
    code: 'B1',
    korean: '중급',
    description: '익숙한 주제 의견 표현. 단락 단위 가능',
    group: '중급',
    recommended: {
      chunkSize: 2,
      speed: 1.0,
      autoRepeat: 2,
      hintsAllowed: true,
      sessionCount: 10,
    },
    vocabRange: [1500, 3500],
    sentenceLength: [10, 18],
    examTarget: ['Cambridge PET', 'TOEIC 550-785', '대학 수능'],
  },
  {
    code: 'B2',
    korean: '중상급',
    description: '복잡한 주제 + 추상 개념. 빠른 속도 가능',
    group: '중급',
    recommended: {
      chunkSize: 2,
      speed: 1.0,
      autoRepeat: 2,
      hintsAllowed: false,
      sessionCount: 20,
    },
    vocabRange: [3500, 6000],
    sentenceLength: [12, 22],
    examTarget: ['Cambridge FCE', 'TOEIC 785-940', 'IELTS 5.5-6.5'],
  },
  // ─── 고급 ───
  {
    code: 'C1',
    korean: '고급',
    description: '유연성, 축약, 구비 분석. 전체 스크립트 도전',
    group: '고급',
    recommended: {
      chunkSize: 3,
      speed: 1.0,
      autoRepeat: 1,
      hintsAllowed: false,
      sessionCount: 20,
    },
    vocabRange: [6000, 10000],
    sentenceLength: [15, 30],
    examTarget: ['Cambridge CAE', 'TOEIC 940-990', 'IELTS 7.0-7.5', '통역 시험'],
  },
  {
    code: 'C2',
    korean: '최고급 (네이티브)',
    description: '학술/전문 분야. 빠른 속도 + 미세한 발음 차이',
    group: '고급',
    recommended: {
      chunkSize: 3,
      speed: 1.25,
      autoRepeat: 1,
      hintsAllowed: false,
      sessionCount: 20,
    },
    vocabRange: [10000, 20000],
    sentenceLength: [18, 35],
    examTarget: ['Cambridge CPE', 'IELTS 8.0+', '통번역 대학원'],
  },
];

export function getLevelByCode(code: CEFRCode): CEFRLevel {
  return CEFR_LEVELS.find((l) => l.code === code) ?? CEFR_LEVELS[2];
}

export function getLevelsByGroup(group: CEFRGroup): CEFRLevel[] {
  return CEFR_LEVELS.filter((l) => l.group === group);
}

/**
 * 텍스트 분석 → CEFR 레벨 자동 추정
 * - 평균 문장 길이 + 고유 단어 수 기준
 */
export function detectLevel(text: string): CEFRLevel {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const avgSentenceLength =
    sentences.length > 0 ? words.length / sentences.length : words.length;
  const uniqueWordCount = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ''))).size;

  // 어휘 다양성 우선, 다음 문장 길이
  for (const level of CEFR_LEVELS) {
    if (
      uniqueWordCount >= level.vocabRange[0] &&
      uniqueWordCount <= level.vocabRange[1]
    ) {
      return level;
    }
  }

  // fallback: 문장 길이 기반
  for (const level of CEFR_LEVELS) {
    if (
      avgSentenceLength >= level.sentenceLength[0] &&
      avgSentenceLength <= level.sentenceLength[1]
    ) {
      return level;
    }
  }

  return CEFR_LEVELS[2]; // B1 기본값
}
