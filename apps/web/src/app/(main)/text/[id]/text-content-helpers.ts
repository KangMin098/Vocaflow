// apps/web/src/app/(main)/text/[id]/text-content-helpers.ts
// Phase 11.6 — server/client 양쪽에서 사용 가능한 순수 헬퍼.
// v06.58 — 검수 페이지(BookContentReader)와 본문/줄바꿈 정합:
//   • boilerplate (TOC + 반복 chapter 헤더) client-side strip 제거.
//     ingest/normalize 단계가 SSoT — workspace 가 raw DB content 그대로 표시.
//   • paragraph 내부 newline 도 paragraph break 로 인정 (단락 분리).

import type { Word } from '@/types/library';
import type { ChapterWord } from '@/lib/library/chapter-words-queries';
import { enrichBook } from './word-enrichment';
import { findSupportSpans, type SupportToken } from '@/lib/workspace/support';

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

/** 단락 텍스트 → 문장 리스트. 약어/이니셜 마침표는 경계로 보지 않음.
 *
 *  v06.58 — sentence 경계 separator 를 `\s+` → `[ \t]+` 로 변경.
 *    `\n` 은 sentence 경계로 보지 않고 sentence text 안에 보존.
 *    → ReadingUniverse 의 `whitespace-pre-line` 으로 `<br>` 효과 (검수와 정합).
 *    예: "Hello.\nWorld."  → ["Hello.\nWorld."]  (한 sentence, \n 보존)
 *        "Hello.  World."  → ["Hello.", "World."] (한 줄, 일반 sentence 경계)
 */
function splitIntoSentences(text: string): string[] {
  const t = text.replace(/^\s+|\s+$/g, '');
  if (!t) return [];
  let safe = t;
  for (const a of SENT_ABBR) {
    safe = safe.replace(new RegExp(`\\b${a}\\.`, 'g'), `${a}${DOT_SENTINEL}`);
  }
  // 이니셜 (A.  J. R.) — 단일 대문자 + 마침표 + 공백
  safe = safe.replace(/\b([A-Z])\.(?=\s)/g, `$1${DOT_SENTINEL}`);
  // 경계: .?! (+ 닫는 따옴표/괄호) + 공백/탭(\n 제외) + (여는 따옴표/괄호)?대문자|숫자
  const parts = safe
    .split(/(?<=[.!?]["'”’)\]]?)[ \t]+(?=["'“‘([]?[A-Z0-9])/g)
    .map((s) => s.split(DOT_SENTINEL).join('.').replace(/^[ \t]+|[ \t]+$/g, ''))
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [t];
}

/**
 * 본문 + paragraph_offsets → Workspace paragraph 구조로 변환.
 * offsets 없으면 double-newline split fallback.
 * 각 단락을 실제 문장으로 분할 — 전역 고유 sentence id (재생/하이라이트 문장 단위).
 *
 * v06.58 — 검수 페이지(BookContentReader)와 본문/줄바꿈 정합:
 *   • boilerplate strip 제거 (raw content 그대로) — 검수와 동일 SSoT.
 *     TOC/chapter header 정리는 ingest/normalize 단계에서 처리.
 *   • paragraph 경계는 paragraph_offsets 만 사용 (검수와 동일).
 *     paragraph 내부 `\n` 은 sentence text 에 보존 → ReadingUniverse 의
 *     `whitespace-pre-line` 으로 `<br>` 효과 (검수 `whitespace-pre-wrap` 와 동등).
 */
export function buildParagraphsFromContent(
  content: string,
  paragraphOffsets: number[],
  chapterWords: ChapterWord[] = [],
): TextParagraph[] {
  if (!content) return [];

  // v06.58 — boilerplate strip 제거. 검수(BookContentReader.splitByOffsets) 와 동일.
  const rawSplits: string[] =
    paragraphOffsets && paragraphOffsets.length > 0
      ? paragraphOffsets.map((start, i) => {
          const end =
            i + 1 < paragraphOffsets.length ? paragraphOffsets[i + 1]! : content.length;
          // 시작/끝만 trim — paragraph 내부 \n 은 sentence text 에 보존.
          return content.slice(start, end).replace(/^\s+|\s+$/g, '');
        })
      : content
          // offsets 없을 때만 double-newline fallback
          .split(/\n\s*\n/)
          .map((p) => p.replace(/^\s+|\s+$/g, ''))
          .filter(Boolean);

  const filteredParas = rawSplits.filter((p) => p.length > 0);

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
