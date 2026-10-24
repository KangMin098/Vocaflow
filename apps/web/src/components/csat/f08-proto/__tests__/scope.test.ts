// apps/web/src/components/csat/f08-proto/__tests__/scope.test.ts
import { describe, expect, it } from 'vitest'

import { buildItem } from '@/lib/csat/f08-proto/data'

import { scopeSpans } from '../parts'

describe('범위 표시 순서', () => {
  it('7번 문장의 If 조건(m2)과 부정(m1)이 원문 순서대로 둘 다 표시된다', () => {
    const r = buildItem('2026#34')
    if (r.state !== 'ready') throw new Error(r.state)
    const s7 = r.item.sentences[6]
    const spans = scopeSpans(s7, r.item.meanings)
    expect(spans.map((x) => x.m.id)).toEqual(['m2', 'm1'])
    expect(spans[0].at).toBeLessThan(spans[1].at)
  })

  it('겹치는 표현은 앞선 것 하나만 남긴다', () => {
    const m = (id: string, expression: string) => ({ id, sentence: 1, expression, meaningKo: '', scope: 'condition' as const, scopeNote: '' })
    expect(scopeSpans('a b c d', [m('x', 'b c'), m('y', 'c d')]).map((s) => s.m.id)).toEqual(['x'])
  })
})
