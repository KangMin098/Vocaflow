// apps/web/src/lib/dictation/scoring.ts
// Dictation 채점 - Smart 모드 (기본) + Strict 모드
// Levenshtein 유사도 + Word-level alignment (Needleman-Wunsch 단순화)

import type { ScoringMode, ScoringResult, WordResult } from './types';
import { analyzeErrorPatterns } from './analyzer';

export interface ScoringRules {
  ignoreCase: boolean;
  ignorePunctuation: boolean;
  ignoreMultipleSpaces: boolean;
  allowContractions: boolean;
  misspelledThreshold: number;
  misspelledScore: number;
}

export const SCORING_RULES: Record<ScoringMode, ScoringRules> = {
  smart: {
    ignoreCase: true,
    ignorePunctuation: true,
    ignoreMultipleSpaces: true,
    allowContractions: true,
    misspelledThreshold: 0.8,
    misspelledScore: 0.5,
  },
  strict: {
    ignoreCase: false,
    ignorePunctuation: false,
    ignoreMultipleSpaces: false,
    allowContractions: false,
    misspelledThreshold: 1.0,
    misspelledScore: 0,
  },
};

const CONTRACTIONS: Record<string, string> = {
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "i'm": 'i am',
  "you're": 'you are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "we're": 'we are',
  "they're": 'they are',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "hadn't": 'had not',
  "let's": 'let us',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "who's": 'who is',
};

export function expandContractions(text: string): string {
  let result = text;
  Object.entries(CONTRACTIONS).forEach(([short, long]) => {
    const escaped = short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), long);
  });
  return result;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Word-level alignment using dynamic programming.
 * Returns array of {exp, act} pairs (one or both may be null for gaps).
 */
function alignWords(
  expected: string[],
  actual: string[]
): { exp: string | null; act: string | null }[] {
  const m = expected.length;
  const n = actual.length;

  // DP table - cost of aligning expected[0..i] with actual[0..j]
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = levenshteinSimilarity(expected[i - 1], actual[j - 1]);
      const matchCost = sim >= 0.8 ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + matchCost, // match/substitute
        dp[i - 1][j] + 1, // delete (missing word)
        dp[i][j - 1] + 1 // insert (extra word)
      );
    }
  }

  // Backtrack
  const result: { exp: string | null; act: string | null }[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sim = levenshteinSimilarity(expected[i - 1], actual[j - 1]);
      const matchCost = sim >= 0.8 ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + matchCost) {
        result.unshift({ exp: expected[i - 1], act: actual[j - 1] });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      result.unshift({ exp: expected[i - 1], act: null });
      i--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      result.unshift({ exp: null, act: actual[j - 1] });
      j--;
    } else {
      break;
    }
  }

  return result;
}

export function scoreSentence(
  expected: string,
  actual: string,
  mode: ScoringMode
): ScoringResult {
  const rules = SCORING_RULES[mode];

  let normExpected = expected;
  let normActual = actual;

  if (rules.ignoreCase) {
    normExpected = normExpected.toLowerCase();
    normActual = normActual.toLowerCase();
  }

  if (rules.ignorePunctuation) {
    normExpected = normExpected.replace(/[.,!?;:"()[\]–—]/g, '');
    normActual = normActual.replace(/[.,!?;:"()[\]–—]/g, '');
  }

  if (rules.allowContractions) {
    normExpected = expandContractions(normExpected);
    normActual = expandContractions(normActual);
  }

  if (rules.ignoreMultipleSpaces) {
    normExpected = normExpected.replace(/\s+/g, ' ').trim();
    normActual = normActual.replace(/\s+/g, ' ').trim();
  }

  const expectedTokens = tokenize(normExpected);
  const actualTokens = tokenize(normActual);

  const alignment = alignWords(expectedTokens, actualTokens);

  const wordResults: WordResult[] = alignment.map(({ exp, act }) => {
    if (!exp && act) {
      return {
        expected: '',
        actual: act,
        status: 'extra',
        similarity: 0,
      };
    }
    if (exp && !act) {
      return {
        expected: exp,
        actual: '',
        status: 'missing',
        similarity: 0,
      };
    }
    const e = exp!;
    const a = act!;
    const similarity = levenshteinSimilarity(e, a);

    if (similarity === 1) {
      return { expected: e, actual: a, status: 'correct', similarity };
    }
    if (similarity >= rules.misspelledThreshold) {
      return {
        expected: e,
        actual: a,
        status: 'misspelled',
        similarity,
        errorType: 'spelling',
      };
    }
    return {
      expected: e,
      actual: a,
      status: 'wrong',
      similarity,
      errorType: 'word-choice',
    };
  });

  // 점수 계산
  const totalWeight = Math.max(wordResults.length, 1);
  const weightedScore = wordResults.reduce((sum, r) => {
    if (r.status === 'correct') return sum + 1;
    if (r.status === 'misspelled') return sum + rules.misspelledScore;
    return sum;
  }, 0);
  const accuracy = (weightedScore / totalWeight) * 100;

  // 오류 패턴 분석
  const errorPatterns = analyzeErrorPatterns(wordResults);

  // 피드백 메시지
  const feedback = generateFeedback(accuracy, errorPatterns.length);

  return {
    accuracy,
    wordResults,
    errorPatterns,
    feedback,
  };
}

function generateFeedback(accuracy: number, patternCount: number): string {
  if (accuracy === 100) return '완벽해요! 🎯';
  if (accuracy >= 90) return '훌륭해요. 거의 완벽합니다.';
  if (accuracy >= 75) return '잘했어요. 몇 단어만 더 신경 쓰면 됩니다.';
  if (accuracy >= 60) return '괜찮아요. 패턴을 보고 다시 도전해보세요.';
  if (patternCount > 0) return '아직 어려운 부분이 있어요. 천천히 다시 들어보세요.';
  return '천천히 한 번 더 들어보세요.';
}
