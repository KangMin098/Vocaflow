// apps/web/src/app/(main)/text/[id]/word-enrichment.ts
// Phase 11.7 — 본문 string + chapter words → enriched parts 변환
//
// - 동일 단어 첫 출현만 interactive (반복 방지)
// - case-insensitive 매칭, 원본 case 보존 표시
// - shared_dictionary 미매칭 단어도 lbv 메타로 표시

import type { ChapterWord } from '@/lib/library/chapter-words-queries';
import type { Word, MemoryStatus } from '@/types/library';
import type { TextParagraphPart } from './text-content-helpers';

/**
 * 본문 paragraph 1개 + 사용 가능한 chapter words → enriched parts.
 *
 * @param paragraphText paragraph 본문 (raw string)
 * @param wordMap 사용 가능한 chapter word lookup (lowercased key)
 * @param consumedWords 이미 본문에서 매칭된 단어들 (lowercased) — 첫 출현만 interactive
 */
export function enrichParagraph(
  paragraphText: string,
  wordMap: Map<string, ChapterWord>,
  consumedWords: Set<string>,
): TextParagraphPart[] {
  if (wordMap.size === 0 || !paragraphText) {
    return paragraphText ? [{ text: paragraphText }] : [];
  }

  const parts: TextParagraphPart[] = [];
  const regex = /([A-Za-z]+(?:'[A-Za-z]+)?|[^A-Za-z]+)/g;
  let match: RegExpExecArray | null;
  let buffer = '';

  while ((match = regex.exec(paragraphText)) !== null) {
    const segment = match[1]!;
    const lower = segment.toLowerCase();

    if (
      /^[A-Za-z]/.test(segment) &&
      wordMap.has(lower) &&
      !consumedWords.has(lower)
    ) {
      if (buffer.length > 0) {
        parts.push({ text: buffer });
        buffer = '';
      }

      const chapterWord = wordMap.get(lower)!;
      parts.push({
        text: segment,
        word: toWord(segment, chapterWord),
      });

      consumedWords.add(lower);
    } else {
      buffer += segment;
    }
  }

  if (buffer.length > 0) {
    parts.push({ text: buffer });
  }

  return parts;
}

/**
 * 책 본문 전체 paragraph[] + chapter words → 모든 paragraph의 enriched parts.
 * consumedWords는 chapter 전체 통합 (반복 방지).
 */
export function enrichBook(
  paragraphTexts: string[],
  chapterWords: ChapterWord[],
): TextParagraphPart[][] {
  const wordMap = new Map<string, ChapterWord>();
  for (const w of chapterWords) {
    wordMap.set(w.word.toLowerCase(), w);
  }
  const consumedWords = new Set<string>();
  return paragraphTexts.map((para) =>
    enrichParagraph(para, wordMap, consumedWords),
  );
}

function toWord(displayText: string, ch: ChapterWord): Word {
  return {
    id: ch.word,
    text: displayText,
    meaning: ch.meaning ?? '(의미 미등록)',
    pronunciation: '',
    pos: ch.pos ?? '',
    status: 'new' as MemoryStatus,
    exampleSentence: ch.exampleSentence ?? '',
    vLevel: ch.vLevel,
  };
}
