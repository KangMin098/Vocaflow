// apps/web/src/lib/library/__tests__/librivox-align.snapshot.test.ts
// 골든셋 스냅샷 — LibriVox 챕터 정합 회귀 가드.
// fixture 는 src/test/fixtures/librivox/ (text_chapters=DB 실측 · sections=librivox.org API 동결).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  alignChaptersByTitle,
  alignChaptersByVolume,
} from '../librivox-chapter-map'

const FIX = join(__dirname, '..', '..', '..', 'test', 'fixtures', 'librivox')

interface AlignFixture {
  text_chapters: Array<{ chapter_idx: number; title: string | null; group_label: string | null }>
  volumes: Array<{
    volume_number: number | null
    librivox_title: string
    sections: Array<{ n: number; title: string; url: string; secs: number | null; reader: string | null }>
  }>
}

function load(name: string): AlignFixture {
  return JSON.parse(readFileSync(join(FIX, `${name}.json`), 'utf8'))
}

/** 스냅샷용 압축 — 챕터별 배정 오디오 섹션 제목(멀티파트는 ' | ' 연결) */
function mapSummary(chapterMap: Record<number, { parts: Array<{ title: string | null }> }>) {
  return Object.fromEntries(
    Object.entries(chapterMap).map(([idx, v]) => [idx, v.parts.map((p) => p.title).join(' | ')]),
  )
}

describe('alignChaptersByTitle — Wind in the Willows 단권 (골든셋)', () => {
  // 제목 정합은 정규화 키 완전 일치만 배정(정확도 우선) — LibriVox 측 오타
  // "Dulce Dolmum"(ch.5 "Dulce Domum")은 자동 배정하지 않고 gap(TTS)으로 남는 것이 명세.
  it('11/12 매핑 + 오타 챕터 gap 스냅샷', () => {
    const f = load('wind-in-the-willows')
    const r = alignChaptersByTitle(f.text_chapters, f.volumes.flatMap((v) => v.sections))
    expect(r.matched).toBe(11)
    expect(r.unmatched_idx).toEqual([5])
    expect({
      matched: r.matched,
      total_chapters: r.total_chapters,
      unmatched_idx: r.unmatched_idx,
      ambiguous: r.ambiguous,
      unused_sections: r.unused_sections,
      chapter_map: mapSummary(r.chapter_map),
    }).toMatchSnapshot()
  })
})

describe('alignChaptersByVolume — Les Misérables 다권 5권 (골든셋)', () => {
  it('권-인지 구조 매핑 스냅샷 (gap·conflicts·number_trusted 포함)', () => {
    const f = load('les-miserables')
    const volumes = f.volumes.map((v) => ({
      volume_number: v.volume_number as number,
      sections: v.sections,
    }))
    const r = alignChaptersByVolume(f.text_chapters, volumes)
    expect(r.total_chapters).toBe(364)
    expect({
      matched: r.matched,
      total_chapters: r.total_chapters,
      unmatched_idx: r.unmatched_idx,
      conflicts: r.conflicts,
      number_trusted: r.number_trusted,
      orphan_sections: r.orphan_sections,
      chapter_map: mapSummary(r.chapter_map),
    }).toMatchSnapshot()
  })
})
