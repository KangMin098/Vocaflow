// packages/library-pipeline/src/story/text.ts
//
// LCP Story 원문 정규화 정책과 원문/판본 구간 검증 — 계약: docs/LCP_STORY.md §7.
//
// 구간 단위: JavaScript 문자열 인덱스(UTF-16 코드 단위), 반열린 범위 [start, end).
// 정규화 정책 `story-text-v1`: 올바른 UTF-16(짝 없는 서로게이트 없음) · NFC · 줄바꿈 LF ·
//   BOM/NUL/CR 없음 · 줄 끝 공백 없음 · 문단 사이는 정확히 빈 줄 하나("\n\n") · 본문 앞뒤 공백 없음.
//   구간 경계는 서로게이트 쌍(이모지 등 한 글자)을 가를 수 없다.
// 스냅숏 본문은 이 형태여야 한다 — 검증기는 본문을 몰래 고치지 않는다(고치면 구간이 어긋난다).

import { IllFormedUnicodeError, assertWellFormed, isWellFormedUnicode, sha256Hex } from './canonical'

export { IllFormedUnicodeError, isWellFormedUnicode }

export const TEXT_NORMALIZATION = 'story-text-v1' as const

/**
 * 원천 문자열을 story-text-v1 로 바꾼다. 스냅숏 작성기(S3)가 쓴다. 멱등이다.
 * 짝 없는 서로게이트(잘못된 UTF-16)는 고치지 않고 IllFormedUnicodeError 로 거부한다 —
 * UTF-8 인코더가 U+FFFD 로 바꿔 서로 다른 문자열이 같은 해시가 되기 때문이다.
 */
export function normalizeSourceText(raw: string): string {
  assertWellFormed(raw, 'text')
  return raw
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+$/u, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 이 문자열이 이미 story-text-v1 정본 형태인가. 잘못된 UTF-16 은 정본이 아니다. */
export function isNormalizedText(text: string): boolean {
  return isWellFormedUnicode(text) && !text.includes('\u0000') && normalizeSourceText(text) === text
}

/** index 가 서로게이트 쌍 한가운데(높은 서로게이트 뒤 · 낮은 서로게이트 앞)인가. */
export function splitsSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false
  const before = text.charCodeAt(index - 1)
  const after = text.charCodeAt(index)
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff
}

export interface ParagraphSpan {
  index: number
  start: number
  end: number
}

/** 정본 본문의 문단 구간. 문단 구분자("\n\n")는 어느 문단에도 속하지 않는다. */
export function paragraphSpans(text: string): ParagraphSpan[] {
  const spans: ParagraphSpan[] = []
  let start = 0
  let index = 0
  for (;;) {
    const sep = text.indexOf('\n\n', start)
    const end = sep === -1 ? text.length : sep
    spans.push({ index, start, end })
    if (sep === -1) break
    start = sep + 2
    index += 1
  }
  return spans
}

export interface SourceAnchorInput {
  source_sha256: string
  paragraph: number
  start: number
  end: number
  quote: string
}

export interface SpanIssue {
  code: string
  message: string
}

/** 원문 앵커 하나를 「전원문」으로 검증한다 — 해시 · 문단 · 범위 · 정확 인용. */
export function checkSourceAnchor(
  anchor: SourceAnchorInput,
  text: string,
  textSha256: string,
  paragraphs: readonly ParagraphSpan[],
): SpanIssue[] {
  const issues: SpanIssue[] = []
  if (anchor.source_sha256 !== textSha256) {
    issues.push({ code: 'anchor_source_hash_mismatch', message: 'anchor 가 다른 원문 해시를 가리킨다' })
    return issues
  }
  const { start, end } = anchor
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || start >= end) {
    issues.push({ code: 'anchor_range_invalid', message: `범위 [${start}, ${end}) 가 원문 길이 ${text.length} 안의 비지 않은 구간이 아니다` })
    return issues
  }
  if (splitsSurrogatePair(text, start) || splitsSurrogatePair(text, end)) {
    issues.push({ code: 'anchor_splits_surrogate', message: `범위 [${start}, ${end}) 가 서로게이트 쌍(한 글자)을 가른다` })
    return issues
  }
  const para = paragraphs[anchor.paragraph]
  if (!para) {
    issues.push({ code: 'anchor_paragraph_missing', message: `문단 ${anchor.paragraph} 이 없다` })
    return issues
  }
  if (start < para.start || end > para.end) {
    issues.push({ code: 'anchor_outside_paragraph', message: `범위 [${start}, ${end}) 가 문단 ${anchor.paragraph} [${para.start}, ${para.end}) 밖이다` })
  }
  const actual = text.slice(start, end)
  if (actual !== anchor.quote) {
    issues.push({ code: 'anchor_quote_mismatch', message: '인용이 원문 구간과 정확히 같지 않다' })
  }
  if (anchor.quote.trim() !== anchor.quote) {
    issues.push({ code: 'anchor_untrimmed', message: '인용 앞뒤에 공백이 있다 — 구간을 좁혀야 한다' })
  }
  return issues
}

export interface EditionSpanInput {
  unit_id: string
  start: number
  end: number
  quote: string
}

/** 판본 단위 본문 안의 구간(활동 선지 등)을 검증한다. */
export function checkEditionSpan(span: EditionSpanInput, unitText: string | undefined): SpanIssue[] {
  if (unitText === undefined) {
    return [{ code: 'span_unit_missing', message: `단위 ${span.unit_id} 가 없다` }]
  }
  const { start, end } = span
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > unitText.length || start >= end) {
    return [{ code: 'span_range_invalid', message: `범위 [${start}, ${end}) 가 단위 ${span.unit_id} 안의 비지 않은 구간이 아니다` }]
  }
  if (splitsSurrogatePair(unitText, start) || splitsSurrogatePair(unitText, end)) {
    return [{ code: 'span_splits_surrogate', message: `단위 ${span.unit_id} 의 범위가 서로게이트 쌍(한 글자)을 가른다` }]
  }
  if (unitText.slice(start, end) !== span.quote) {
    return [{ code: 'span_quote_mismatch', message: `단위 ${span.unit_id} 의 인용이 구간과 다르다` }]
  }
  return []
}

/** 두 반열린 구간이 겹치는가. */
export function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/** 정본 본문의 해시 — UTF-8 바이트 sha256. 잘못된 UTF-16 은 IllFormedUnicodeError. */
export function sourceTextSha256(text: string): string {
  return sha256Hex(text)
}

export interface SurfaceMetrics {
  words: number
  sentences: number
  mean_sentence_words: number
}

/**
 * 표면 계측 — 단어·문장 수. CEFR · V-Level · 커버리지 측정이 아니다(그것은 사전 결합이 필요한 S3/S4 범위).
 * 화면이나 계획서에서 언어 수준 실측처럼 표시하지 않는다.
 */
export function surfaceMetrics(texts: readonly string[]): SurfaceMetrics {
  let words = 0
  let sentences = 0
  for (const t of texts) {
    words += (t.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
    sentences += (t.match(/[^.!?]+[.!?]+["'”’)]*/g) ?? []).filter((s) => /[A-Za-z]/.test(s)).length
  }
  return {
    words,
    sentences,
    mean_sentence_words: sentences === 0 ? 0 : Math.round((words / sentences) * 10) / 10,
  }
}
