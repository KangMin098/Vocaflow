// packages/library-pipeline/src/compose/gates-background.test.ts
//
// I12 배경 사실 면제 — 소프트뉴스를 여는 예외이자, 남용되면 게이트가 무너지는 지점.

import { describe, expect, it } from 'vitest'

import { buildFingerprint } from './fingerprint'
import { checkSourceIndependence, type ComposeDraft, type FactCard, type SourceRecord } from './gates'

const SOURCES: SourceRecord[] = [
  { id: 's1', publisher: 'dw.com', url: 'https://dw.com/a', published_at: '', fingerprint: buildFingerprint('one') },
  { id: 's2', publisher: 'bbc.co.uk', url: 'https://bbc.co.uk/a', published_at: '', fingerprint: buildFingerprint('two') },
]

const draft = (ids: string[]): ComposeDraft => ({
  text: 'irrelevant for this gate',
  fact_order: ids,
  event_occurred_at: '2026-08-12T17:46:00Z',
})

const fact = (
  id: string,
  kind: FactCard['kind'],
  sourceIds: string[],
): FactCard => ({
  id,
  claim: `fact ${id}`,
  kind,
  attestations: sourceIds.map((s, i) => ({ source_id: s, ordinal: i })),
})

describe('I12 — 배경 사실은 1계통으로 통과한다', () => {
  it('교과서 지식에 2계통을 요구하지 않는다', () => {
    // "달이 지구와 해 사이를 지나면 일식" 은 누구의 취재 성과도 아니다. 여기에까지 2계통을
    // 요구해서 학습 적합 사건 152건이 막혀 있었다(실측 2026-08-19).
    const facts = [fact('bg', 'background', ['s1']), fact('ev', 'event', ['s1', 's2'])]
    const r = checkSourceIndependence(draft(['bg', 'ev']), facts, SOURCES)
    expect(r.verdict).toBe('PASS')
  })

  it('면제를 쓴 건수를 숨기지 않고 보고한다', () => {
    const facts = [fact('bg', 'background', ['s1']), fact('ev', 'event', ['s1', 's2'])]
    const r = checkSourceIndependence(draft(['bg', 'ev']), facts, SOURCES)
    expect(r.detail).toContain('배경 사실')
    expect(r.detail).toContain('1건')
  })

  it('사건·수치·발언에는 면제가 없다 — 그것이 취재 성과다', () => {
    for (const kind of ['event', 'figure', 'utterance'] as const) {
      const facts = [fact('x', kind, ['s1'])]
      const r = checkSourceIndependence(draft(['x']), facts, SOURCES)
      expect(r.verdict, kind).toBe('FAIL')
    }
  })

  it('출처가 아예 없는 배경 사실은 통과시키지 않는다', () => {
    // 어디서 왔는지 못 대는 주장은 배경 지식이 아니라 그냥 지어낸 말이다.
    const facts = [fact('bg', 'background', [])]
    const r = checkSourceIndependence(draft(['bg']), facts, SOURCES)
    expect(r.verdict).toBe('FAIL')
  })

  it('면제가 없으면 문구도 예전 그대로다 — 정상 글의 보고가 바뀌지 않는다', () => {
    const facts = [fact('a', 'event', ['s1', 's2']), fact('b', 'figure', ['s1', 's2'])]
    const r = checkSourceIndependence(draft(['a', 'b']), facts, SOURCES)
    expect(r.verdict).toBe('PASS')
    expect(r.detail).toContain('전부 독립')
    expect(r.detail).not.toContain('배경 사실')
  })
})
