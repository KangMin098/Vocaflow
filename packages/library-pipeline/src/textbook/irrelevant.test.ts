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

/**
 * 지문을 규격 안으로 늘린다.
 *
 * 완성본이 **90~200어**여야 문항이 만들어진다(실측 45개 중 5개가 규격을 넘겨 탈락했다).
 *
 * ⚠️ 꼬리는 **내용어를 하나도 들여오면 안 된다.** 처음엔 `according to the regional
 *   planning office …` 를 붙였다가 그 낱말들이 모든 문장에 공유되어 **결속도가 8로 치솟았고**,
 *   "결속이 약하면 만들지 않는다" 회귀가 반대 이유로 실패했다. `contentWords` 는 5자 이상만
 *   세므로 **전부 4자 이하인 꼬리**를 쓴다.
 */
const PAD = 'as of the same date in that town by the old mill site'
const long = (ss: readonly string[]): string[] => ss.map((s) => s.replace(/\.$/, ` ${PAD}.`))

// 결속이 뚜렷한 문단 — 낱말이 서로를 받는다.
const paragraph = long([
  'Coastal towns along the northern shore rebuilt their harbour walls after the storm.',
  'The harbour walls had stood since the fishing boom of the previous century.',
  'Engineers found that the older harbour walls rested on shifting sand.',
  'The rebuilt walls now reach three metres deeper into the seabed.',
  'Fishing crews returned to the harbour within a single season.',
])

// 후보도 같은 꼬리를 달아야 본문 문장들과 **낱말 수가 비슷해진다**(겉모습 규칙).
const candidates = long([
  // 좋은 무관 문장 — "storm" 하나만 겹쳐 주제 근처에 있되 논지에는 안 붙는다.
  'Another storm crossed the mountain valleys later that autumn evening.',
  // 한 낱말도 안 겹친다 — 읽지 않고도 골라낸다. 받으면 안 된다.
  'Russell formed his side project group with another singer that winter.',
  // 같은 글이다 — 써서는 안 된다.
  'The harbour lights burned through the fog every night that winter.',
]).map((text, i) => ({ text, ref: ['other-1', 'other-3', 'self'][i]! }))
// 너무 짧다 — 겉모습으로 골라낸다. 꼬리를 달지 않는다.
candidates.push({ text: 'Nobody moved.', ref: 'other-2' })

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
    const loose = long([
      'Coastal towns rebuilt their harbour walls after the storm.',
      'The harbour walls had stood for a century.',
      'Kettles whistled somewhere in an empty kitchen.', // 아무것도 안 받는다
      'Engineers found the walls rested on sand.',
      'Fishing crews returned to the harbour.',
    ])
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
    const weak = long([
      'Coastal towns rebuilt their harbour walls after the storm.',
      'The harbour walls had stood for a century.',
      'Engineers measured the seabed with sonar equipment.', // 하나만 걸린다
      'Fishing crews returned to the harbour within a season.',
      'The rebuilt walls reach deeper into the seabed.',
    ])
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
