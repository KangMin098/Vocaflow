// apps/web/src/lib/dictation/analyzer.ts
// 오답 패턴 분석 - 음성/형태론/구문/어휘 분류

import type { ErrorPattern, WordResult } from './types';
import { levenshteinDistance } from './scoring';

const HOMOPHONES: Record<string, string[]> = {
  their: ['there', "they're"],
  there: ['their', "they're"],
  "they're": ['their', 'there'],
  your: ["you're"],
  "you're": ['your'],
  its: ["it's"],
  "it's": ['its'],
  to: ['too', 'two'],
  too: ['to', 'two'],
  two: ['to', 'too'],
  hear: ['here'],
  here: ['hear'],
  buy: ['by', 'bye'],
  by: ['buy', 'bye'],
  bye: ['buy', 'by'],
  weather: ['whether'],
  whether: ['weather'],
  through: ['threw'],
  threw: ['through'],
};

function isHomophone(a: string, b: string): boolean {
  const aL = a.toLowerCase();
  const bL = b.toLowerCase();
  return HOMOPHONES[aL]?.includes(bL) ?? false;
}

export function analyzeErrorPatterns(wordResults: WordResult[]): ErrorPattern[] {
  const patterns: ErrorPattern[] = [];

  // ─── 1. 음성 오류: 동사 -ed 누락 ───
  const edDrop = wordResults.filter(
    (w) =>
      w.expected.toLowerCase().endsWith('ed') &&
      w.actual &&
      !w.actual.toLowerCase().endsWith('ed') &&
      levenshteinDistance(w.expected.toLowerCase(), w.actual.toLowerCase() + 'ed') <= 1
  );
  if (edDrop.length > 0) {
    patterns.push({
      type: 'phonetic',
      subtype: 'past-tense-ed',
      description: '동사 과거형 -ed 발음 인식 어려움',
      examples: edDrop.map((e) => ({ expected: e.expected, actual: e.actual })),
      frequency: edDrop.length,
      suggestion: '동사 끝 -ed는 약하게 발음됩니다. 천천히 다시 들어보세요.',
      cefrLevel: ['A2', 'B1'],
    });
  }

  // ─── 2. 관사/약어 누락 ───
  const articleDrop = wordResults.filter(
    (w) => ['a', 'an', 'the'].includes(w.expected.toLowerCase()) && w.status === 'missing'
  );
  if (articleDrop.length > 0) {
    patterns.push({
      type: 'phonetic',
      subtype: 'article-drop',
      description: '관사 (a, an, the) 누락',
      examples: articleDrop.map((e) => ({ expected: e.expected, actual: e.actual || '(누락)' })),
      frequency: articleDrop.length,
      suggestion: '관사는 약하게 발음되어 놓치기 쉽습니다.',
      cefrLevel: ['A1', 'A2', 'B1'],
    });
  }

  // ─── 3. 복수형 -s 누락 ───
  const pluralDrop = wordResults.filter(
    (w) =>
      w.expected.toLowerCase().endsWith('s') &&
      !w.expected.toLowerCase().endsWith('ss') &&
      w.actual &&
      !w.actual.toLowerCase().endsWith('s') &&
      levenshteinDistance(w.expected.toLowerCase(), w.actual.toLowerCase() + 's') <= 1
  );
  if (pluralDrop.length > 0) {
    patterns.push({
      type: 'morphological',
      subtype: 'plural-s',
      description: '복수형 -s 누락',
      examples: pluralDrop.map((e) => ({ expected: e.expected, actual: e.actual })),
      frequency: pluralDrop.length,
      suggestion: '단어 끝 -s/es 발음에 주의하세요.',
      cefrLevel: ['A1', 'A2'],
    });
  }

  // ─── 4. 동음이의어 혼동 ───
  const homophone = wordResults.filter(
    (w) => w.actual && isHomophone(w.expected, w.actual)
  );
  if (homophone.length > 0) {
    patterns.push({
      type: 'lexical',
      subtype: 'homophones',
      description: '동음이의어 혼동',
      examples: homophone.map((e) => ({ expected: e.expected, actual: e.actual })),
      frequency: homophone.length,
      suggestion: "발음이 같지만 다른 단어입니다 (their/there/they're 등).",
      cefrLevel: ['B1', 'B2'],
    });
  }

  // ─── 5. 스펠링 오류 (위 패턴에 안 잡힌 것) ───
  const usedWords = new Set([
    ...edDrop,
    ...articleDrop,
    ...pluralDrop,
    ...homophone,
  ]);
  const spellingErrors = wordResults.filter(
    (w) => w.status === 'misspelled' && !usedWords.has(w)
  );
  if (spellingErrors.length > 0) {
    patterns.push({
      type: 'lexical',
      subtype: 'spelling',
      description: '스펠링 오류',
      examples: spellingErrors.map((e) => ({ expected: e.expected, actual: e.actual })),
      frequency: spellingErrors.length,
      suggestion: '음성을 다시 들으면서 스펠링도 체크해보세요.',
      cefrLevel: ['A1', 'A2', 'B1', 'B2'],
    });
  }

  // ─── 6. 단어 선택 오류 (전혀 다른 단어) ───
  const wrongWords = wordResults.filter(
    (w) => w.status === 'wrong' && !usedWords.has(w)
  );
  if (wrongWords.length > 0) {
    patterns.push({
      type: 'lexical',
      subtype: 'word-choice',
      description: '다른 단어로 들음',
      examples: wrongWords.slice(0, 5).map((e) => ({
        expected: e.expected,
        actual: e.actual,
      })),
      frequency: wrongWords.length,
      suggestion: '단어가 비슷하게 들리지만 다른 의미예요. 문맥을 활용하세요.',
      cefrLevel: ['B1', 'B2', 'C1'],
    });
  }

  return patterns.sort((a, b) => b.frequency - a.frequency);
}

/**
 * 세션 전체에서 오답 단어를 추출 (Flashcard 추가용)
 */
export interface MistakenWord {
  word: string;
  occurrences: number;
  contexts: string[];
}

export function extractMistakenWords(
  sessionItems: { wordResults?: WordResult[]; expectedText: string }[]
): MistakenWord[] {
  const wordMap = new Map<string, MistakenWord>();

  sessionItems.forEach((item) => {
    item.wordResults?.forEach((w) => {
      if (w.status === 'correct' || w.status === 'extra') return;
      const key = w.expected.toLowerCase();
      if (!key) return;
      const existing = wordMap.get(key);
      if (existing) {
        existing.occurrences += 1;
        if (existing.contexts.length < 3) {
          existing.contexts.push(item.expectedText);
        }
      } else {
        wordMap.set(key, {
          word: w.expected,
          occurrences: 1,
          contexts: [item.expectedText],
        });
      }
    });
  });

  return Array.from(wordMap.values()).sort((a, b) => b.occurrences - a.occurrences);
}
