// packages/library-pipeline/src/normalize/boundary.ts
// LCP v2.0 — Gutenberg boilerplate 경계 제거 + TOC(목차) 제거

const START_MARKERS: RegExp[] = [
  /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i,
  /\*\*\* START OF [^*]+ \*\*\*/i,
]

const END_MARKERS: RegExp[] = [
  /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i,
  /End of (?:the )?Project Gutenberg/i,
]

/**
 * Gutenberg license header / footer 제거.
 * 마커가 없으면 원본 반환 (admin 수동 검토 흐름으로 보낸다는 가정).
 */
export function extractBody(rawContent: string): string {
  let startIdx = 0
  let endIdx = rawContent.length

  for (const re of START_MARKERS) {
    const m = rawContent.match(re)
    if (m && m.index !== undefined) {
      startIdx = m.index + m[0].length
      break
    }
  }

  for (const re of END_MARKERS) {
    const m = rawContent.match(re)
    if (m && m.index !== undefined) {
      endIdx = m.index
      break
    }
  }

  return rawContent.slice(startIdx, endIdx).trim()
}

/**
 * Project Gutenberg 텍스트의 illustration / sidenote / footnote 마커 제거.
 * 학습 가치 0 + 본문 흐름 단절 — 안전한 제거.
 *
 * 패턴:
 *   1. [Illustration]                     단순 마커
 *   2. [Illustration: caption ...]        단순 캡션
 *   3. [Illustration: caption [_inner_]]  nested (copyright/credit 포함)
 *   4. [Sidenote: ...]                    옆 주
 *   5. [Footnote N: ...]                  각주
 *
 * 호출 시점: extractBody 후, normalizePunctuation 전 (raw 마커가 살아있을 때).
 */
export function stripIllustrations(content: string): string {
  return content
    .replace(/\[Illustration(?::[\s\S]*?(?:\[[\s\S]*?\][\s\S]*?)?)?\]/g, '')
    .replace(/\[Sidenote:[\s\S]*?\]/g, '')
    .replace(/\[Footnote\s+\d+:[\s\S]*?\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * Phase 11.12 — Project Gutenberg style 목차(Table of Contents) 제거.
 *
 * TOC 패턴:
 *   - 3개 이상 연속된 "CHAPTER N." 헤더 (각 ≤ 120자, 줄바꿈으로 구분)
 *   - 본문 시작 1000자 이내에 위치
 *
 * 동작:
 *   - TOC 블록만 제거 (이후 진짜 chapter 헤더는 보존 → segmenter가 정상 분할)
 *   - 1000자 이후 발견 시 보존 (오탐 방지)
 *   - extractBody 후, reflowSoftHyphens 전에 호출 (줄바꿈 보존 필요)
 */
export function removeTableOfContents(content: string): string {
  const TOC_BLOCK_RE =
    /(?:^|\n)((?:[ \t]*(?:CHAPTER|Chapter)\s+[IVXLC\d]+[.:]?\s*[^\n]{0,120}\n+){3,})/

  const m = content.match(TOC_BLOCK_RE)
  if (!m || m.index === undefined) return content

  if (m.index > 1000) return content

  const before = content.slice(0, m.index)
  const after = content.slice(m.index + m[0].length)
  return (before + after).replace(/^[\s\r\n]+/, '')
}
