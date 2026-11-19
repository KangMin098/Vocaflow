// apps/web/src/lib/scriptquiz/__tests__/reader-anchor-exact-first.test.ts
// T-0214 Codex P2 2차 — Reader 문장 표: 전체가 같은 문장이 하나면 그것이 먼저(다른 문장이 그 글자를 품어도). 여럿이면 -1.
// 전체 일치가 없을 때만 예전 규칙(품은 문장이 하나뿐) — T-0209 근거 스니펫 의미는 그대로다.
import { describe, expect, it } from 'vitest'

import { buildEvidenceSentenceMap, readerSentenceFor } from '../reader-anchor'

describe('buildEvidenceSentenceMap · readerSentenceFor — 전체 일치 우선', () => {
  const content = 'They marched on. Resist! They resist oppression.'
  const reader = [
    { id: 10, text: 'They marched on.' },
    { id: 11, text: 'Resist!' },
    { id: 12, text: 'They resist oppression.' },
  ]
  it('짧은 문장이 다른 문장 안에 있어도 전체가 같은 문장 하나로', () => {
    expect(buildEvidenceSentenceMap(content, reader)).toEqual([10, 11, 12])
    expect(readerSentenceFor(content, 1, reader)).toBe(11)
  })
  it('전체 일치가 여럿이면 -1 / null', () => {
    const dup = [{ id: 1, text: 'Resist!' }, { id: 2, text: 'resist.' }]
    expect(buildEvidenceSentenceMap('Resist! resist.', dup)).toEqual([-1, -1])
    expect(readerSentenceFor('Resist! resist.', 0, dup)).toBeNull()
  })
  it('전체 일치가 없으면 예전대로 — Reader 문장이 그 문장을 품은 것이 하나뿐일 때만', () => {
    const merged = [{ id: 7, text: 'Hello there. The bakery opens early.' }]
    expect(buildEvidenceSentenceMap('The bakery opens early.', merged)).toEqual([7])
    const two = [{ id: 1, text: 'Yes, the bakery opens early.' }, { id: 2, text: 'No, the bakery opens early.' }]
    expect(buildEvidenceSentenceMap('The bakery opens early.', two)).toEqual([-1])
  })
})
