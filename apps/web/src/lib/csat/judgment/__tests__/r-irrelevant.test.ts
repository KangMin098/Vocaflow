// apps/web/src/lib/csat/judgment/__tests__/r-irrelevant.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { leakedAnswerKeys, unitsAtIndex } from '../evidence'
import { itemsOf, revealOf } from '../fixtures'
import {
  compareWithAnswer, initialState, parseStructure, profileOf, setVerdict, toggleCue, toggleRemoved, toggleSuspect, toggleTopic, warningsOf,
} from '../r-irrelevant'
import type { JudgmentItem } from '../types'

const items = itemsOf('R-IRRELEVANT')

describe('R-IRRELEVANT 구조 해석(실제 문항 2개)', () => {
  it('두 문항이 있다', () => expect(items.map((i) => i.id)).toEqual(['H2609G2#35', 'H2609G1#35']))
  for (const item of items) {
    it(`${item.id}: 원문 단위의 ①~⑤ 위치로 선지 문장 5개를 찾는다`, () => {
      const st = parseStructure(item)
      expect(st.slots.map((x) => x.n)).toEqual([1, 2, 3, 4, 5])
      for (const sl of st.slots) {
        expect(item.units.find((u) => u.id === sl.unitId)?.text.startsWith('①②③④⑤'[sl.n - 1])).toBe(true)
        expect(item.choices[sl.n - 1].startsWith(sl.text.slice(0, 30))).toBe(true)
      }
      expect(st.lead.length).toBeGreaterThan(0)
      expect(st.slots[4].nextId).toBeNull()
      expect(st.slots[0].prevId).toBe(st.lead[st.lead.length - 1].id)
    })
    it(`${item.id}: ⑤ 선지 문자열에 붙은 각주를 결함으로 잡고 화면 문장은 단위에서 쓴다`, () => {
      const st = parseStructure(item)
      expect(st.choiceMismatch).toContain(5)
      expect(st.slots[4].text).not.toContain('*')
    })
    it(`${item.id}: 공개 자료의 정답 문장과 확인 근거가 해석한 슬롯·다리와 맞는다`, async () => {
      const r = await revealOf('R-IRRELEVANT', item.id)
      const st = parseStructure(item)
      const ans = st.slots[r.answer - 1]
      const c = r.choices.find((x) => x.n === r.answer)
      expect(c?.verdict).toBe('correct')
      const confirmed = unitsAtIndex(c?.verdict === 'correct' ? c.confirmed_at?.sentence_index : [], item.units)
      // 확인 근거 = 정답 문장을 뺐을 때 이어지는 앞·뒤 단위
      expect(confirmed).toEqual([ans.prevId, ans.nextId])
    })
  }
  it('연결사·지시 표지를 첫머리에서만 찾는다', () => {
    const st = parseStructure(items[0])
    expect(st.slots.map((x) => x.opener)).toEqual(['However', 'When', null, 'Similarly', 'For instance'])
  })
})

describe('판단 기능', () => {
  const item = items[0]
  const st = parseStructure(item)
  const s4 = st.slots[3]
  it('앞뒤가 끊기고 빼면 이어지는 표시는 끼어든 문장 모양이다', () => {
    let s = initialState()
    s = setVerdict(s, 4, 'back', 'breaks'); s = setVerdict(s, 4, 'forward', 'breaks'); s = setVerdict(s, 4, 'bridge', 'holds')
    expect(profileOf(s, s4)).toBe('intruder-shape')
  })
  it('같은 판단을 다시 누르면 해제된다', () => {
    const s = setVerdict(setVerdict(initialState(), 2, 'back', 'holds'), 2, 'back', 'holds')
    expect(s.marks[2].back.verdict).toBeNull()
  })
  it('연결사 하나만으로 결론 내리면 경고한다(Similarly 만 보고 판단 금지)', () => {
    let s = setVerdict(initialState(), 4, 'back', 'breaks')
    s = toggleCue(s, 4, 'back', 'connective')
    expect(warningsOf(s, s4).map((w) => w.code)).toContain('connective-only')
    s = toggleCue(s, 4, 'back', 'direction')
    expect(warningsOf(s, s4).map((w) => w.code)).not.toContain('connective-only')
  })
  it('화제어만으로 이어진다고 하면 경고한다', () => {
    let s = setVerdict(initialState(), 4, 'back', 'holds')
    s = toggleCue(s, 4, 'back', 'topic')
    expect(warningsOf(s, s4).map((w) => w.code)).toContain('topic-only-holds')
  })
  it('근거 종류 없이 판단하면 경고한다', () => {
    const s = setVerdict(initialState(), 4, 'back', 'breaks')
    expect(warningsOf(s, s4).map((w) => w.code)).toContain('no-cue')
  })
  it('원리 한계: 앞뒤가 이어지고 빼도 이어지면 무관이 아님을 알린다(③ 귀결 문장)', () => {
    let s = initialState()
    for (const seam of ['back', 'forward', 'bridge'] as const) s = toggleCue(setVerdict(s, 3, seam, 'holds'), 3, seam, 'direction')
    expect(profileOf(s, st.slots[2])).toBe('removable-but-linked')
    expect(warningsOf(s, st.slots[2]).map((w) => w.code)).toContain('limit-removable')
  })
  it('마지막 문장은 앞 이음매 하나로 끼어든 모양이라 하지 않는다', () => {
    const s = setVerdict(initialState(), 5, 'back', 'breaks')
    expect(profileOf(s, st.slots[4])).toBe('partial')
  })
  it('빼기·후보·화제 고정 토글', () => {
    let s = toggleRemoved(initialState(), 4); expect(s.removed).toBe(4)
    s = toggleRemoved(s, 4); expect(s.removed).toBeNull()
    s = toggleSuspect(s, 2); expect(s.suspect).toBe(2)
    s = toggleTopic(s, 'u1'); s = toggleTopic(s, 'u2'); s = toggleTopic(s, 'u1'); expect(s.topic).toEqual(['u2'])
  })
})

describe('공개 상태 · 자료 없음', () => {
  it('공개 전 모델 출력에 정답 키가 없다', () => {
    for (const item of items) {
      expect(leakedAnswerKeys(parseStructure(item))).toEqual([])
      expect(leakedAnswerKeys(initialState())).toEqual([])
    }
  })
  it('대조는 후보가 없으면 판정하지 않는다', () => {
    expect(compareWithAnswer(initialState(), 4).same).toBeNull()
    expect(compareWithAnswer(toggleSuspect(initialState(), 4), 4).same).toBe(true)
  })
  it('기호 없는 원문 · 빈 원문은 슬롯 0개', () => {
    const bare: JudgmentItem = { ...items[0], units: items[0].units.map((u) => ({ ...u, text: u.text.replace(/^[①②③④⑤]\s*/, '') })) }
    expect(parseStructure(bare).slots).toEqual([])
    expect(parseStructure({ ...items[0], units: [] }).slots).toEqual([])
  })
})
