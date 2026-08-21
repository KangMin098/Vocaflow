// packages/library-pipeline/src/textbook/irrelevant.test.ts
//
// 흐름 무관(35번) 회귀. 지키려는 것은 **답이 하나로 갈리는가** 다.

import { describe, expect, it } from 'vitest'
import {
  buildIrrelevant,
  cohesionWith,
  IRRELEVANT_SLOTS,
  MIN_FOREIGN_COHESION,
  MIN_NATIVE_COHESION,
} from './irrelevant'

// 결속이 뚜렷한 문단 — 낱말이 서로를 받는다.
const paragraph = [
  'Coastal towns along the northern shore rebuilt their harbour walls after the storm.',
  'The harbour walls had stood since the fishing boom of the previous century.',
  'Engineers found that the older harbour walls rested on shifting sand.',
  'The rebuilt walls now reach three metres deeper into the seabed.',
  'Fishing crews returned to the harbour within a single season.',
]

const candidates = [
  // 좋은 무관 문장 — 겉모습이 맞고, "storm" 하나만 겹쳐 주제 근처에 있되 논지에는 안 붙는다.
  { text: 'Another storm crossed the mountain valleys later that same autumn evening.', ref: 'other-1' },
  // 한 낱말도 안 겹친다 — 읽지 않고도 골라낸다. 받으면 안 된다.
  { text: 'Russell formed his side project group with another singer that winter.', ref: 'other-3' },
  // 너무 짧다 — 겉모습으로 골라낸다.
  { text: 'Nobody moved.', ref: 'other-2' },
  // 같은 글이다 — 써서는 안 된다.
  { text: 'The harbour lights burned through the fog every night that winter.', ref: 'self' },
]

describe('흐름 무관 문항', () => {
  it('다섯 자리에 남의 문장 하나가 들어가고 그것이 정답이다', () => {
    const item = buildIrrelevant(paragraph, candidates, 'self')
    expect(item).not.toBeNull()
    expect(item!.sentences).toHaveLength(IRRELEVANT_SLOTS)
    expect(item!.answer).toBeGreaterThanOrEqual(1)
    expect(item!.answer).toBeLessThanOrEqual(IRRELEVANT_SLOTS)
    expect(item!.sentences[item!.answer - 1]).toBe(item!.foreign.text)
  })

  it('본문 네 문장은 원문 그대로 남는다', () => {
    const item = buildIrrelevant(paragraph, candidates, 'self')!
    const rest = item.sentences.filter((_, i) => i !== item.answer - 1)
    expect(rest).toEqual(paragraph.slice(1))
  })

  it('자기 글의 문장은 후보에서 빠진다', () => {
    const item = buildIrrelevant(paragraph, candidates, 'self')!
    expect(item.foreign.ref).not.toBe('self')
  })

  it('겉모습으로 못 고르게 한다 — 낱말 수가 본문 범위 밖이면 안 쓴다', () => {
    const item = buildIrrelevant(paragraph, candidates, 'self')!
    const w = (s: string) => s.split(/\s+/).length
    const natives = paragraph.slice(1).map(w)
    expect(w(item.foreign.text)).toBeGreaterThanOrEqual(Math.min(...natives))
    expect(w(item.foreign.text)).toBeLessThanOrEqual(Math.max(...natives))
  })

  it('무관 문장이 본문 어느 문장보다 덜 붙어 있다 — 답이 갈리지 않는다', () => {
    const item = buildIrrelevant(paragraph, candidates, 'self')!
    expect(item.overlapGap).toBeGreaterThan(0)
  })

  it('멱등하다', () => {
    expect(buildIrrelevant(paragraph, candidates, 'self')).toEqual(
      buildIrrelevant(paragraph, candidates, 'self'),
    )
  })

  it('본문에 이미 동떨어진 문장이 있으면 만들지 않는다', () => {
    const loose = [
      'Coastal towns rebuilt their harbour walls after the storm.',
      'The harbour walls had stood for a century.',
      'Kettles whistled somewhere in an empty kitchen.', // 아무것도 안 받는다
      'Engineers found the walls rested on sand.',
      'Fishing crews returned to the harbour.',
    ]
    expect(buildIrrelevant(loose, candidates, 'self')).toBeNull()
  })

  it('문장이 다섯 개보다 적으면 만들지 않는다', () => {
    expect(buildIrrelevant(paragraph.slice(0, 4), candidates, 'self')).toBeNull()
  })

  it('쓸 만한 후보가 없으면 만들지 않는다 — 억지로 만들지 않는다', () => {
    expect(buildIrrelevant(paragraph, [{ text: 'Nobody moved.', ref: 'x' }], 'self')).toBeNull()
  })

  it('한 낱말도 안 겹치는 후보는 쓰지 않는다 — 읽지 않고도 골라낸다', () => {
    const item = buildIrrelevant(paragraph, candidates, 'self')!
    expect(item.foreign.ref).toBe('other-1')
    expect(cohesionWith(item.foreign.text, paragraph.join(' '))).toBeGreaterThanOrEqual(
      MIN_FOREIGN_COHESION,
    )
  })

  it('본문 최소 결속이 2 미만이면 만들지 않는다 — 산술로 따라 나온다', () => {
    expect(MIN_NATIVE_COHESION).toBe(MIN_FOREIGN_COHESION + 1)
    const weak = [
      'Coastal towns rebuilt their harbour walls after the storm.',
      'The harbour walls had stood for a century.',
      'Engineers measured the seabed with sonar equipment.', // 하나만 걸린다
      'Fishing crews returned to the harbour within a season.',
      'The rebuilt walls reach deeper into the seabed.',
    ]
    const rest = (i) => weak.filter((_, j) => j !== i).join(' ')
    const minNative = Math.min(...weak.slice(1).map((s, i) => cohesionWith(s, rest(i + 1))))
    expect(minNative).toBeLessThan(MIN_NATIVE_COHESION)
    expect(buildIrrelevant(weak, candidates, 'self')).toBeNull()
  })

  it('결속도는 내용어 공유 개수다', () => {
    expect(cohesionWith('The harbour walls fell.', 'They rebuilt the harbour walls.')).toBeGreaterThan(0)
    expect(cohesionWith('Kettles whistled.', 'They rebuilt the harbour walls.')).toBe(0)
  })
})
