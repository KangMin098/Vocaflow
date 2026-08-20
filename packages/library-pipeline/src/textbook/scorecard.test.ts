// packages/library-pipeline/src/textbook/scorecard.test.ts
//
// 채점표의 계약. 핵심은 **못 재는 것에 점수를 붙이지 않는 것**이다 —
// 이 저장소는 근거 없는 임계값을 세웠다 지운 적이 두 번 있다.

import { describe, expect, it } from 'vitest'

import { scoreVolume, UNIT_MINUTES } from './scorecard'
import { type PoolItem, type Unit } from './compose-unit'

let seq = 0
const item = (ref: string, words = 114): PoolItem => ({
  id: `i${seq++}`,
  type: 'order',
  ref_id: ref,
  ref_title: `글 ${ref}`,
  v_level: 5,
  passage_text: 'Clean prose.',
  passage_words: words,
  body_sentences: 5,
  payload: {},
  answer_key: {},
})

const unit = (no: number, refs: string[], words: string[], minutes = 17): Unit => ({
  no,
  band: 5,
  items: refs.map((r) => item(r)),
  vocabulary: words.map((w) => ({
    word: w,
    meaning_ko: '뜻',
    v_level: 5,
    first_sentence: null,
    frequency_in_article: 1,
  })),
  estimated_minutes: minutes,
  sources: refs.map((r) => `글 ${r}`),
})

const words = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`)

describe('scoreVolume', () => {
  it('정상 권은 자동 항목을 모두 통과한다', () => {
    const units = Array.from({ length: 20 }, (_, i) =>
      unit(i + 1, ['a', 'b', 'c', 'd'], words(`u${i}w`, 20)),
    )
    const s = scoreVolume(units)
    expect(s.auto.every((c) => c.pass), s.auto.filter((c) => !c.pass).map((c) => c.label).join(', ')).toBe(true)
    expect(s.autoPassRate).toBe(1)
  })

  it('단원 간 어휘 중복을 잡는다', () => {
    const dup = words('same', 20)
    const s = scoreVolume([unit(1, ['a', 'b'], dup), unit(2, ['c', 'd'], dup)])
    const c = s.auto.find((x) => x.label.includes('두 번 외우게'))!
    expect(c.pass).toBe(false)
    expect(c.detail).toContain('중복 20')
  })

  it('한 단원 안 같은 글 반복을 잡는다', () => {
    const s = scoreVolume([unit(1, ['a', 'a', 'b', 'c'], words('w', 20))])
    expect(s.auto.find((x) => x.label.includes('같은 글이 반복'))!.pass).toBe(false)
  })

  it('한 권이 한 밴드로 묶여 있는지 본다', () => {
    const u1 = unit(1, ['a', 'b'], words('x', 20))
    const u2 = { ...unit(2, ['c', 'd'], words('y', 20)), band: 6 }
    expect(scoreVolume([u1, u2]).auto.find((x) => x.label.includes('한 레벨'))!.pass).toBe(false)
  })

  it('20단원 미만은 시중 분량에 못 닿았다고 말한다', () => {
    const s = scoreVolume([unit(1, ['a', 'b'], words('w', 20))])
    const c = s.auto.find((x) => x.label.includes('시중 교재 분량'))!
    expect(c.pass).toBe(false)
    expect(c.detail).toBe('1/20단원')
  })

  it('분량이 한 자리에서 끝낼 범위를 벗어나면 잡는다', () => {
    const s = scoreVolume([unit(1, ['a', 'b'], words('w', 20), UNIT_MINUTES.max + 1)])
    expect(s.auto.find((x) => x.label.includes('한 자리에서'))!.pass).toBe(false)
  })

  it('**못 재는 것에는 점수를 붙이지 않는다** — human 은 통과율 분모 밖', () => {
    const units = Array.from({ length: 20 }, (_, i) =>
      unit(i + 1, ['a', 'b', 'c', 'd'], words(`u${i}w`, 20)),
    )
    const s = scoreVolume(units)
    expect(s.human.length).toBeGreaterThan(0)
    // human 이 있어도 자동 통과율은 1.0 이다 — 섞으면 점수가 거짓이 된다.
    expect(s.autoPassRate).toBe(1)
    for (const h of s.human) {
      expect(h.question).toMatch(/\?$/)
      expect(h.evidence.length).toBeGreaterThan(10)
    }
  })

  it('세 관점이 모두 항목을 갖는다', () => {
    const s = scoreVolume([unit(1, ['a', 'b'], words('w', 20))])
    for (const a of ['learner', 'teacher', 'parent'] as const) {
      expect([...s.auto, ...s.human].some((c) => c.audience === a), a).toBe(true)
    }
  })
})
