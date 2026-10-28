// apps/web/src/components/practice/__tests__/meaning-evidence-relation.test.tsx
// T-0205 관계 판단 — 견주기 결과(대상 + 문장)가 있을 때만 다섯 선택이 붙고, 고른 뒤에는 중립 안내만(정답 · 점수 표시 없음).
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ seed: [] as unknown[] }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (init: unknown) => actual.useState(h.seed.length ? h.seed.shift() : init) }
})

import { MeaningEvidence, RELATIONS, RELATION_NOTE } from '../MeaningEvidence'

const SENTS = ['The bakery opens early.', 'People line up.', 'The owner bakes by hand.']
const CHOICES = ['a', 'b', 'c', 'd', 'e']
/** 상태 순서: picked · skipped · compareOpen · target · comparePicked · relation */
const render = (seed: unknown[], props: Partial<Parameters<typeof MeaningEvidence>[0]> = {}) => {
  h.seed = seed
  return renderToString(<MeaningEvidence sentences={SENTS} explanation="x" chosen={{ n: 1, text: 'a' }} correct choices={CHOICES} {...props} />)
}

describe('MeaningEvidence 관계 판단', () => {
  it('다섯 가지 관계 · 문구', () => {
    expect(RELATIONS.map((r) => r.label)).toEqual(['내 답을 뒷받침해요', '견준 선택지를 뒷받침해요', '두 선택지 모두를 뒷받침해요', '어느 쪽도 뒷받침하지 않아요', '아직 판단하기 어려워요'])
    expect(RELATION_NOTE).toContain('채점하지 않아요')
    expect(RELATION_NOTE).not.toMatch(/정답|맞|틀|점수|자신감/)
  })

  it('대상 + 문장을 모두 고른 견주기 결과 안에만 붙는다', () => {
    expect(render([null, false, true, 3, null])).not.toContain('data-testid="meaning-relation"')
    expect(render([null, false, true, null, null])).not.toContain('data-testid="meaning-relation"')
    const html = render([null, false, true, 3, 1])
    expect(html).toContain('data-testid="meaning-relation"')
    expect(html.match(/data-relation="/g)).toHaveLength(5)
    expect(html.match(/aria-pressed="true"[^>]*data-relation/g)).toBeNull()
    expect(html).not.toContain('data-testid="meaning-relation-note"')
    expect(html).not.toContain('data-relation-mark')
  })

  it('고른 관계는 aria-pressed 하나 · 중립 안내만, 원래 정답이어도 판단을 정답으로 표시하지 않는다', () => {
    const html = render([null, false, true, 3, 1, 'target'])
    expect(html.match(/aria-pressed="true" data-relation="([a-z]+)"/)?.[1]).toBe('target')
    expect(html).toContain(RELATION_NOTE)
    // 색만으로 구분하지 않는다 — 고른 단추에만 장식 체크 표지 하나
    expect(html.match(/data-relation-mark/g)).toHaveLength(1)
    expect(html).toMatch(/aria-pressed="true" data-relation="target"[^>]*>(<!-- -->)?<svg[^>]*aria-hidden="true"/)
    const rel = html.slice(html.indexOf('data-testid="meaning-relation"'))
    expect(rel).not.toMatch(/정답|맞았|틀렸|점수/)
  })

  it('해설 없는 문항: 미등록 안내와 관계 판단이 함께 있고 판단은 정답과 섞이지 않는다', () => {
    const html = render([null, false, true, 3, 1, 'unsure'], { explanation: null })
    expect(html).toContain('이 문항에는 등록된 해설이 없어요.')
    expect(html).toContain(RELATION_NOTE)
  })

  it('견줄 다른 선택지가 없으면(선택지 없음) 관계 판단도 없다', () => {
    expect(render([null, false, true, 3, 1, 'mine'], { choices: null })).not.toContain('data-testid="meaning-relation"')
  })
})
