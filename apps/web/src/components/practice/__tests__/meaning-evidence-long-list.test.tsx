// apps/web/src/components/practice/__tests__/meaning-evidence-long-list.test.tsx
// 긴 근거 목록 — 높이를 묶어도 두 목록(근거 · 견주기)의 문장 수 · 원문 · 순서는 그대로, 짧은 목록은 예전 모양 그대로.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ seed: [] as unknown[] }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  // compareOpen · target 을 심어 견주기 목록까지 서버 렌더로 그린다(그 외 상태는 초기값)
  return { ...actual, useState: (init: unknown) => actual.useState(h.seed.length ? h.seed.shift() : init) }
})

import { MeaningEvidence } from '../MeaningEvidence'

const LONG = Array.from({ length: 28 }, (_, i) => `Sentence number ${i + 1} of the long excerpt.`)
const SHORT = ['The bakery opens early.', 'People line up.', 'The owner bakes by hand.']
const CHOICES = ['a', 'b', 'c', 'd', 'e']

/** 상태 순서: picked · skipped · compareOpen · target · comparePicked */
const render = (sentences: string[]) => {
  h.seed = [null, false, true, 3, null]
  return renderToString(<MeaningEvidence sentences={sentences} explanation="x" chosen={{ n: 1, text: 'a' }} correct choices={CHOICES} />)
}
const listButtons = (html: string, testId: string) => {
  const m = html.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</div>`))
  return [...(m?.[1] ?? '').matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((x) => x[1])
}

describe('MeaningEvidence 긴 목록', () => {
  it('28문장: 두 목록 모두 전 문장 · 원문 · 순서 그대로, 묶인 스크롤 상자 + 안내', () => {
    const html = render(LONG)
    expect(listButtons(html, 'meaning-evidence-list')).toEqual(LONG)
    expect(listButtons(html, 'meaning-compare-list')).toEqual(LONG)
    expect(html.match(/data-testid="meaning-evidence-scroll-hint"/g)).toHaveLength(2)
    expect(html).toMatch(/data-testid="meaning-evidence-list"/)
    expect(html.match(/overflow-y-auto/g)).toHaveLength(2)
  })
  it('짧은 목록: 문장 그대로 · 스크롤 상자 · 안내 없음(예전 크기)', () => {
    const html = render(SHORT)
    expect(listButtons(html, 'meaning-evidence-list')).toEqual(SHORT)
    expect(listButtons(html, 'meaning-compare-list')).toEqual(SHORT)
    expect(html).not.toContain('meaning-evidence-scroll-hint')
    expect(html).not.toContain('overflow-y-auto')
  })
})
