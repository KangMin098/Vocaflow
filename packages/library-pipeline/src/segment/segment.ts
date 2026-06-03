// packages/library-pipeline/src/segment/segment.ts
// LCP v2.0 — book → chapter 분할 통합

import type {
  NormalizedBook,
  ChapterSegment,
  SegmentOptions,
} from '../types'
import { findChapterBoundaries } from './regex-segmenter'
import {
  computeParagraphOffsets,
  computeSentenceOffsets,
  countWords,
} from './offset-calculator'

const DEFAULT_OPTIONS: Required<SegmentOptions> = {
  fallbackChunkWords: 5000,
  minChapterWords: 200,
}

/**
 * 챕터 마커 제목에 그룹(계층) 라벨을 실어 나르는 구분자 (U+001F).
 * ingest 가 "CHAPTER N. <title><group>" 로 emit → 여기서 분리.
 * gutenberg 등 sentinel 없는 마커는 group=undefined (평면).
 */
export const CHAPTER_GROUP_SEP = '\u001F'

function splitTitleGroup(raw: string | undefined): { title?: string; group?: string } {
  if (raw == null) return {}
  const idx = raw.indexOf(CHAPTER_GROUP_SEP)
  if (idx < 0) {
    const t = raw.trim()
    return t ? { title: t } : {}
  }
  const t = raw.slice(0, idx).trim()
  const g = raw.slice(idx + 1).trim()
  return { ...(t && { title: t }), ...(g && { group: g }) }
}

/**
 * book → chapter 분할.
 * 1) 정규식 boundary 시도
 * 2) 발견된 boundary 중 minChapterWords 미만은 다음과 병합
 * 3) boundary 0개면 fallbackChunkWords 단위로 균등 분할
 */
export function segmentBook(
  book: NormalizedBook,
  opts: SegmentOptions = {},
): ChapterSegment[] {
  const options = { ...DEFAULT_OPTIONS, ...opts }
  const body = book.body

  const boundaries = findChapterBoundaries(body)

  if (boundaries.length === 0) {
    return splitByWordCount(body, options.fallbackChunkWords)
  }

  const chapters: ChapterSegment[] = []
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i]!
    const start = b.charOffset
    const end =
      i + 1 < boundaries.length ? boundaries[i + 1]!.charOffset : body.length
    const content = body.slice(start, end).trim()
    const wc = countWords(content)

    const { title, group } = splitTitleGroup(b.title)
    chapters.push({
      chapter_idx: i + 1,
      ...(title && { chapter_title: title }),
      ...(group && { group_label: group }),
      content,
      word_count: wc,
      paragraph_offsets: computeParagraphOffsets(content),
      sentence_offsets: computeSentenceOffsets(content),
    })
  }

  return mergeShortChapters(chapters, options.minChapterWords)
}

function splitByWordCount(body: string, target: number): ChapterSegment[] {
  const paragraphs = body.split(/\n\s*\n+/)
  const chapters: ChapterSegment[] = []
  let buffer: string[] = []
  let bufferWords = 0
  let chapterIdx = 1

  const flush = (): void => {
    if (buffer.length === 0) return
    const content = buffer.join('\n\n').trim()
    chapters.push({
      chapter_idx: chapterIdx++,
      content,
      word_count: bufferWords,
      paragraph_offsets: computeParagraphOffsets(content),
      sentence_offsets: computeSentenceOffsets(content),
    })
    buffer = []
    bufferWords = 0
  }

  for (const p of paragraphs) {
    buffer.push(p)
    bufferWords += countWords(p)
    if (bufferWords >= target) flush()
  }
  flush()

  return chapters
}

function mergeShortChapters(
  chapters: ChapterSegment[],
  minWords: number,
): ChapterSegment[] {
  const merged: ChapterSegment[] = []
  for (const ch of chapters) {
    const last = merged[merged.length - 1]
    if (last && last.word_count < minWords) {
      const content = `${last.content}\n\n${ch.content}`
      const wc = last.word_count + ch.word_count
      merged[merged.length - 1] = {
        ...last,
        content,
        word_count: wc,
        paragraph_offsets: computeParagraphOffsets(content),
        sentence_offsets: computeSentenceOffsets(content),
      }
    } else {
      merged.push(ch)
    }
  }
  return merged.map((ch, i) => ({ ...ch, chapter_idx: i + 1 }))
}
