// packages/library-pipeline/test/segmentation.snapshot.test.ts
// 골든셋 스냅샷 — normalizeBook + segmentBook 분절 회귀 가드.
// 챕터 수·챕터별 단어 수·문장 수 배열이 바뀌면 분절 로직 변경 신호.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { normalizeBook } from '../src/normalize'
import { segmentBook } from '../src/segment/segment'
import type { RawBook } from '../src/types'

const FIX = join(__dirname, 'fixtures', 'books')

function loadRaw(slug: string): RawBook {
  const meta = JSON.parse(readFileSync(join(FIX, slug, 'meta.json'), 'utf8'))
  return {
    source: meta.source,
    source_id: meta.source_id,
    source_url: meta.source_url,
    title: meta.title,
    language: 'en',
    license: meta.license,
    raw_content: readFileSync(join(FIX, slug, 'raw.txt'), 'utf8'),
    fetched_at: new Date(0),
  }
}

function segmentSummary(slug: string) {
  const segments = segmentBook(normalizeBook(loadRaw(slug)))
  return {
    chapters: segments.length,
    titles: segments.map((c) => c.chapter_title ?? null),
    word_counts: segments.map((c) => c.word_count),
    sentence_counts: segments.map((c) => c.sentence_offsets.length),
  }
}

describe('segmentBook — 골든셋 스냅샷', () => {
  it('alice-wonderland-gutenberg (12챕터 기대)', () => {
    const s = segmentSummary('alice-wonderland-gutenberg')
    expect(s.chapters).toBe(12)
    expect(s).toMatchSnapshot()
  })

  it('sherlock-holmes-gutenberg (단편 12편 기대)', () => {
    const s = segmentSummary('sherlock-holmes-gutenberg')
    expect(s.chapters).toBe(12)
    expect(s).toMatchSnapshot()
  })
})
