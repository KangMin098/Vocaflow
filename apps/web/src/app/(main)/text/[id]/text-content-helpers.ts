// apps/web/src/app/(main)/text/[id]/text-content-helpers.ts
// Phase 11.6 — server/client 양쪽에서 사용 가능한 순수 헬퍼.
// Phase 11.12.1 — boilerplate (TOC + 반복 chapter 헤더) client-side strip
//                 (DB content_chunks는 보존, A 옵션 자동화 후 normalize.ts 재처리로 동기화)

import type { Word } from '@/types/library';
import type { ChapterWord } from '@/lib/library/chapter-words-queries';
import { enrichBook } from './word-enrichment';
import { findSupportSpans, type SupportToken } from '@/lib/workspace/support';

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
  /** ADR 0002 — 읽기-중 이해 지원(노이즈). word 와 상호배타. */
  support?: SupportToken;
}

export interface TextParagraphSentence {
  id: number;
  parts: TextParagraphPart[];
}

export interface TextParagraph {
  id: number;
  sentences: TextParagraphSentence[];
}

// 문장 경계 분할 — 약어/이니셜 마침표 보호 (visible sentinel 토큰).
const SENT_ABBR = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'St', 'Jr', 'Sr', 'vs', 'etc',
  'Inc', 'Ltd', 'Co', 'Mt', 'Capt', 'Lt', 'Col', 'Gen', 'Sgt',
  'Rev', 'Hon', 'Gov', 'Sen', 'Rep', 'No', 'Vol',
];
const DOT_SENTINEL = '@@DOTSENT@@'; // 본문에 등장하지 않을 토큰

/** 단락 텍스트 → 문장 리스트. 약어/이니셜 마침표는 경계로 보지 않음. */
function splitIntoSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  let safe = t;
  for (const a of SENT_ABBR) {
    safe = safe.replace(new RegExp(`\\b${a}\\.`, 'g'), `${a}${DOT_SENTINEL}`);
  }
  // 이니셜 (A.  J. R.) — 단일 대문자 + 마침표 + 공백
  safe = safe.replace(/\b([A-Z])\.(?=\s)/g, `$1${DOT_SENTINEL}`);
  // 경계: .?! (+ 닫는 따옴표/괄호) + 공백 + (여는 따옴표/괄호)?대문자|숫자
  const parts = safe
    .split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘([]?[A-Z0-9])/g)
    .map((s) => s.split(DOT_SENTINEL).join('.').trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [t];
}

/**
 * 본문 + paragraph_offsets → Workspace paragraph 구조로 변환.
 * offsets 없으면 double-newline split fallback.
 * 각 단락을 실제 문장으로 분할 — 전역 고유 sentence id (재생/하이라이트 문장 단위).
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

  const filteredParas = splits.filter((p) => p.length > 0);

  // 단락 → 실제 문장 분할 (reading order). 빈 분할은 단락 전체 1문장 fallback.
  const perPara: string[][] = filteredParas.map((para) => splitIntoSentences(para));

  // 문장 단위 enrichment — flatten 후 enrich (consumedWords = 챕터 전체 첫 출현 기준)
  const flatSentences = perPara.flat();
  const enrichedFlat =
    chapterWords.length > 0
      ? enrichBook(flatSentences, chapterWords)
      : flatSentences.map((s) => [{ text: s }]);

  // 재그룹 — 단락별 문장 묶음 + 전역 고유 sentence id
  let cursor = 0;
  let sentId = 0;
  return perPara.map((sents, pIdx) => {
    const sentences = sents.map((_, si) => ({
      id: sentId++,
      parts: enrichedFlat[cursor + si]!,
    }));
    cursor += sents.length;
    return { id: pIdx, sentences };
  });
}

/**
 * plain-text part 안의 지원 어휘(외국어·고어·고유명사)를 support 토큰으로 분할.
 * word/support 가 이미 있는 part 는 보존 (학습 단어 우선).
 */
function splitPartBySupport(part: TextParagraphPart): TextParagraphPart[] {
  if (part.word || part.support) return [part];
  const spans = findSupportSpans(part.text);
  if (spans.length === 0) return [part];

  const out: TextParagraphPart[] = [];
  let last = 0;
  for (const sp of spans) {
    if (sp.start < last) continue; // 겹침 가드
    if (sp.start > last) out.push({ text: part.text.slice(last, sp.start) });
    out.push({ text: part.text.slice(sp.start, sp.end), support: sp.support });
    last = sp.end;
  }
  if (last < part.text.length) out.push({ text: part.text.slice(last) });
  return out;
}

/** word enrichment 후 plain part 안의 지원 어휘를 support 토큰으로 분할. */
export function annotateSupport(paragraphs: TextParagraph[]): TextParagraph[] {
  return paragraphs.map((p) => ({
    ...p,
    sentences: p.sentences.map((s) => ({ ...s, parts: s.parts.flatMap(splitPartBySupport) })),
  }));
}
