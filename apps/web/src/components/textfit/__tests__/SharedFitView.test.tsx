// apps/web/src/components/textfit/__tests__/SharedFitView.test.tsx
//
// `/fit/s` 렌더 계약 — docs/design/compare/fit-s.md · DD-25.
//   ① 받은 결과가 먼저다 — 빈 입력칸(textarea)을 그리지 않는다(감사: 결과가 폼 뒤로 밀렸다).
//   ② 가장 어려운 낱말 줄이 **적정 학년**으로 칠해진다 — `/fit` 과 같은 규칙(v > level).
//   ③ 1차 행동은 「내 지문으로 해 보기」(/fit).
//   ④ 원문을 지어내지 않는다 — 낱말 사이에는 공백만.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { decodeProfile, encodeProfile } from '@/lib/textfit/share'
import type { LevelProfile } from '@/lib/textfit/profile'

import { SharedFitView, wordTokens } from '../SharedFitView'

vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

const LEVELS = [3, 4, 5, 6, 7, 8, 9, 10] as const
function profile(): LevelProfile {
  const base: LevelProfile = {
    totalTokens: 120,
    uniqueContentWords: 60,
    readings: LEVELS.map((level, i) => ({
      level,
      label: String(level),
      coverageHigh: 0.6 + i * 0.05,
      coverageLow: 0.6 + i * 0.05,
      coverage: 0.6 + i * 0.05,
      band: 'fit' as LevelProfile['readings'][number]['band'],
      unknownWords: 10 - i,
    })),
    fitLevel: 7,
    textVLevel: 6,
    resolvedShare: 1,
    hardestWords: [
      { surface: 'contingent', lemma: 'contingent', count: 1, status: 'leveled', vLevel: 9 },
      { surface: 'scarce', lemma: 'scarce', count: 1, status: 'leveled', vLevel: 7 },
      { surface: 'pathway', lemma: 'pathway', count: 1, status: 'leveled', vLevel: 6 },
    ],
    breakdown: { leveled: 3, unleveled: 0, function_word: 0 } as LevelProfile['breakdown'],
  }
  // 실제 공유 링크를 한 번 거친 모양으로 — 인코딩이 버리는 것은 여기서도 없다
  return decodeProfile(encodeProfile(base))!
}

describe('SharedFitView', () => {
  it('① 빈 입력칸이 없다', () => {
    const html = renderToString(<SharedFitView profile={profile()} />)
    expect(html).not.toContain('<textarea')
  })

  it('② 적정 학년(7)으로 칠한다 — 7 보다 높은 낱말만', () => {
    const html = renderToString(<SharedFitView profile={profile()} />)
    expect(html.match(/<mark/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
    expect(html).toMatch(/<mark[^>]*>contingent<\/mark>/)
    expect(html).not.toMatch(/<mark[^>]*>scarce<\/mark>/)
  })

  it('③ 1차 행동은 /fit', () => {
    const html = renderToString(<SharedFitView profile={profile()} />)
    expect(html).toMatch(/href="\/fit"[^>]*>.*내 지문으로 해 보기/s)
  })

  it('④ 낱말 사이에는 공백만 — 문장부호를 지어내지 않는다', () => {
    const toks = wordTokens(profile())
    expect(toks.map((t) => t.t).join('')).toBe('contingent scarce pathway')
    expect(toks.filter((t) => t.v === undefined).every((t) => t.t === ' ')).toBe(true)
  })
})
