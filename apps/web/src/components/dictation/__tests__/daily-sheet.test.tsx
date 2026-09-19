// apps/web/src/components/dictation/__tests__/daily-sheet.test.tsx
//
// `/dictate` 「오늘의 받아쓰기 문제지」(2026-09-19 · DD-36) 의 계약.
//   ① 빈칸 하나 = 낱말 하나, 폭 = 낱말 길이 — **글자는 화면에 나오지 않는다**(보이면 받아쓰기가 아니다)
//   ② 내 낱말(굴절형 포함) 자리만 타깃 빈칸
//   ③ 문장부호는 그대로

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { DailyDictation } from '@/lib/dictation/daily'

import { DailySheet, blanksOf } from '../DailySheet'

describe('blanksOf', () => {
  it('낱말마다 빈칸 · 길이 · 문장부호 보존 · 굴절형 타깃', () => {
    const b = blanksOf('She walked home, quietly.', ['walk'])
    expect(b).toEqual([
      { len: 3, target: false },
      { len: 6, target: true },
      { len: 4, target: false },
      { punct: ',' },
      { len: 7, target: false },
      { punct: '.' },
    ])
  })
})

describe('DailySheet', () => {
  const daily = {
    kind: 'daily',
    title: '오늘의 받아쓰기',
    subtitle: '',
    meta: { due: 1, retry: 1, fresh: 0 },
    sentences: [
      { text: 'The keeper opened the gate.', targetWords: ['keeper'], targetForms: {}, reason: 'due' },
      { text: 'Rain fell all night.', targetWords: [], targetForms: {}, reason: 'retry', previousAccuracy: 62 },
    ],
  } as unknown as DailyDictation

  it('문장 글자를 렌더하지 않는다 — 빈칸만', () => {
    const html = renderToString(<DailySheet daily={daily} starting={false} onStart={() => {}} />)
    expect(html).not.toContain('keeper')
    expect(html).not.toContain('Rain fell')
    expect((html.match(/data-daily-line=""/g) ?? []).length).toBe(2)
    expect((html.match(/data-blank="target"/g) ?? []).length).toBe(1)
  })

  it('줄마다 왜 이 문장인지 — 재도전은 지난 정확도와', () => {
    const html = renderToString(<DailySheet daily={daily} starting={false} onStart={() => {}} />).replace(/<!-- -->/g, '')
    expect(html).toContain('복습 임박')
    expect(html).toContain('재도전 · 지난번 62%')
  })
})
