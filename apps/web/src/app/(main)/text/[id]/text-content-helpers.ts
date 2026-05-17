// apps/web/src/app/(main)/text/[id]/text-content-helpers.ts
// Phase 11.6 — server/client 양쪽에서 사용 가능한 순수 헬퍼.
// Phase 11.12.1 — boilerplate (TOC + 반복 chapter 헤더) client-side strip
//                 (DB content_chunks는 보존, A 옵션 자동화 후 normalize.ts 재처리로 동기화)

import type { Word } from '@/types/library';
import type { ChapterWord } from '@/lib/library/chapter-words-queries';
import { enrichBook } from './word-enrichment';

// Phase 11.12.1 — boilerplate 정규식 (normalize/boundary.ts와 동일 정책)
const TOC_PATTERN =
  /^([\s\r\n]*(?:CHAPTER|Chapter)\s+[IVXLC0-9]+[.:]?[^\n]{0,120}\n+){3,}/;
const HEADER_PATTERN =
  /^[\s\r\n]*(?:CHAPTER|Chapter)\s+[IVXLC0-9]+\.[\s\r\n]+[^\r\n]+[\s\r\n]+/;
const SIMPLE_HEADER_PATTERN =
  /^[\s\r\n]*(?:CHAPTER|Chapter)\s+[IVXLC0-9]+\.?[\s\r\n]+/;
const MAX_BOILERPLATE_SCAN = 1500;

interface StripResult {
  content: string;
  trimmedChars: number;
}

/**
 * 본문 시작에서 TOC + 반복 chapter 헤더 제거.
 * 본문 1500자 이내에 패턴 있을 때만 (중간 character의 "Chapter X" 언급 오탐 회피).
 * 사용자 직접 입력 텍스트는 정규식 미매칭 → trimmedChars=0 (회귀 0).
 */
function stripBoilerplate(content: string): StripResult {
  if (content.length === 0) return { content, trimmedChars: 0 };

  let trimmed = content;
  let trimmedChars = 0;

  const tocScan = trimmed.slice(0, MAX_BOILERPLATE_SCAN);
  const tocMatch = tocScan.match(TOC_PATTERN);
  if (tocMatch && tocMatch.index === 0) {
    trimmed = trimmed.slice(tocMatch[0].length);
    trimmedChars += tocMatch[0].length;
  }

  const headerScan = trimmed.slice(0, MAX_BOILERPLATE_SCAN);
  const headerMatch = headerScan.match(HEADER_PATTERN);
  if (headerMatch && headerMatch.index === 0) {
    trimmed = trimmed.slice(headerMatch[0].length);
    trimmedChars += headerMatch[0].length;
  } else {
    const simpleScan = trimmed.slice(0, MAX_BOILERPLATE_SCAN);
    const simpleMatch = simpleScan.match(SIMPLE_HEADER_PATTERN);
    if (simpleMatch && simpleMatch.index === 0) {
      trimmed = trimmed.slice(simpleMatch[0].length);
      trimmedChars += simpleMatch[0].length;
    }
  }

  const lead = trimmed.match(/^[\s\r\n]+/);
  if (lead) {
    trimmed = trimmed.slice(lead[0].length);
    trimmedChars += lead[0].length;
  }

  return { content: trimmed, trimmedChars };
}

/**
 * paragraph_offsets를 trimmedChars만큼 shift.
 * 음수는 0으로 clamp. 0이 연속되면 첫 번째만 유지.
 */
function shiftOffsets(
  offsets: number[] | null | undefined,
  trimmedChars: number,
): number[] {
  if (!offsets || offsets.length === 0) return [];
  if (trimmedChars === 0) return offsets;
  const shifted = offsets.map((o) => Math.max(0, o - trimmedChars));
  return shifted.filter((o, i, arr) => i === 0 || o !== arr[i - 1]);
}

export interface TextParagraphPart {
  text: string;
  /** Phase 11.7 — chapter words enrichment 결과. 미매칭 단어는 plain text. */
  word?: Word;
}

export interface TextParagraphSentence {
  id: number;
  parts: TextParagraphPart[];
}

export interface TextParagraph {
  id: number;
  sentences: TextParagraphSentence[];
}

/**
 * 본문 + paragraph_offsets → Workspace paragraph 구조로 변환.
 * offsets 없으면 double-newline split fallback.
 */
export function buildParagraphsFromContent(
  content: string,
  paragraphOffsets: number[],
  chapterWords: ChapterWord[] = [],
): TextParagraph[] {
  if (!content) return [];

  // Phase 11.12.1 — boilerplate 제거 + offset shift
  const { content: cleanContent, trimmedChars } = stripBoilerplate(content);
  const adjustedOffsets = shiftOffsets(paragraphOffsets, trimmedChars);

  const splits: string[] =
    adjustedOffsets && adjustedOffsets.length > 0
      ? adjustedOffsets.map((start, i) => {
          const end =
            i + 1 < adjustedOffsets.length ? adjustedOffsets[i + 1]! : cleanContent.length;
          return cleanContent.slice(start, end).trim();
        })
      : cleanContent
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean);

  const filtered = splits.filter((p) => p.length > 0);

  // Phase 11.7 — chapter words enrichment (미제공 시 plain text fallback)
  const enrichedParts =
    chapterWords.length > 0
      ? enrichBook(filtered, chapterWords)
      : filtered.map((p) => [{ text: p }]);

  return enrichedParts.map((parts, i) => ({
    id: i,
    sentences: [
      {
        id: 0,
        parts,
      },
    ],
  }));
}
