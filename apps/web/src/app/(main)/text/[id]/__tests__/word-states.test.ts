// apps/web/src/app/(main)/text/[id]/__tests__/word-states.test.ts
//
// `/text/[id]` 원문 낱말 상태 — 감사(2026-09-18): 전부 'new' 하드코딩이었다. DD-27.

import { describe, expect, it } from 'vitest'

import type { ChapterWord } from '@/lib/library/chapter-words-queries'

import { enrichBook } from '../word-enrichment'
import { statesFromRows } from '../word-states'

const NOW = new Date('2026-09-19T00:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

describe('statesFromRows', () => {
  it('R(t) 로 상태를 계산한다 — 저장값이 아니다', () => {
    const s = statesFromRows(
      [
        { word: 'Fresh', stability: 30, difficulty: 5, last_review_at: ago(1) },
        { word: 'faded', stability: 1, difficulty: 6, last_review_at: ago(40) },
        { word: 'never', stability: 0, difficulty: 0, last_review_at: null },
      ],
      NOW,
    )
    expect(s).toEqual({ fresh: 'stable', faded: 'risk', never: 'new' })
  })

  it('같은 낱말이 여러 행이면 가장 잘 기억한 행 — 중복 저장이 상태를 깎지 않는다', () => {
    const s = statesFromRows(
      [
        { word: 'twice', stability: 1, difficulty: 6, last_review_at: ago(40) },
        { word: 'twice', stability: 30, difficulty: 5, last_review_at: ago(1) },
      ],
      NOW,
    )
    expect(s.twice).toBe('stable')
  })
})

describe('enrichBook — 상태가 낱말에 실린다', () => {
  const words = [
    { word: 'harbor', meaning: '항구', pos: 'n', vLevel: 5 },
    { word: 'lantern', meaning: '등불', pos: 'n', vLevel: 6 },
  ] as unknown as ChapterWord[]

  it('단어장에 있으면 그 상태, 없으면 new', () => {
    const parts = enrichBook(['The Harbor had a lantern.'], words, { harbor: 'risk' }).flat()
    const byText = Object.fromEntries(parts.filter((p) => p.word).map((p) => [p.text, p.word!.status]))
    expect(byText).toEqual({ Harbor: 'risk', lantern: 'new' })
  })

  it('상태를 주지 않으면 예전과 같다(전부 new) — 호출부 호환', () => {
    const parts = enrichBook(['harbor lantern'], words).flat()
    expect(parts.filter((p) => p.word).every((p) => p.word!.status === 'new')).toBe(true)
  })
})
