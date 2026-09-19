// apps/web/src/components/text-viewer/__tests__/text-new.test.tsx
//
// `/text/new` 「붙여 넣으면 칠해지는 입력칸」(2026-09-19 · DD-30) 의 계약.
//   ① 예시 글의 단어 수는 **본문에서 센다** — 상수 「280단어」(실제 40낱말 남짓)가 있었다(I5)
//   ② 예시 목록에 난이도 상수가 없다
//   ③ 저장 관측의 커버리지 — 칠하지 못했으면 -1, 칠했으면 고른 학년의 정수 %

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { LevelProfile } from '@/lib/textfit/profile'

import { coveragePctOf, defaultLevelOf, type PaintState } from '../NewTextPaint'
import { SampleScripts, wordCountOf } from '../SampleScripts'

describe('SampleScripts — 지어낸 수치 없음', () => {
  it('단어 수는 본문 공백 기준으로 센다', () => {
    expect(wordCountOf('  Stay hungry,   stay foolish.  ')).toBe(4)
    expect(wordCountOf('')).toBe(0)
  })

  it('난이도 상수(쉬움/보통/어려움)를 달지 않는다', () => {
    const html = renderToString(<SampleScripts onSelect={() => {}} />)
    expect(html).not.toMatch(/쉬움|보통|어려움/)
    expect(html).toContain('낱말')
  })
})

describe('NewTextPaint — 저장 관측의 커버리지', () => {
  const profile = {
    fitLevel: 5,
    readings: [
      { level: 5, coverage: 0.964 },
      { level: 6, coverage: 0.991 },
    ],
  } as unknown as LevelProfile
  const ready: PaintState = { kind: 'ready', profile, surfaces: {}, analysed: 'x' }

  it('칠하지 못했으면 -1', () => {
    expect(coveragePctOf({ kind: 'idle' }, 6)).toBe(-1)
    expect(coveragePctOf({ kind: 'error', message: '' }, 6)).toBe(-1)
  })

  it('칠했으면 고른 학년의 정수 %', () => {
    expect(coveragePctOf(ready, 5)).toBe(96)
    expect(coveragePctOf(ready, 6)).toBe(99)
  })

  it('처음 학년은 적정 학년, 없으면 고1(6)', () => {
    expect(defaultLevelOf(ready)).toBe(5)
    expect(defaultLevelOf({ kind: 'idle' })).toBe(6)
  })
})
