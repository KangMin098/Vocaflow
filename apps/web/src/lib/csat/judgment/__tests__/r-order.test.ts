// apps/web/src/lib/csat/judgment/__tests__/r-order.test.ts
// R-ORDER 판단 모델 — 실제 기출 2문항(H2609G2#36·#37)으로 단락 분해 · 단서 후보 · 끊긴 연결 · 약한 단서 · 공개 뒤 이음매를 본다.
import { describe, expect, it } from 'vitest'
import { checkReveal, leakedAnswerKeys, refsOf } from '../evidence'
import { itemsOf, revealOf } from '../fixtures'
import {
  cautions, compareChoices, cueCandidates, junctions, makeLink, moveIn, parseChoiceOrder, parseOrder, revealNotes,
  type Arrangement, type Cue, type Link, type OrderModel,
} from '../r-order'

const [i36, i37] = itemsOf('R-ORDER')
const m36 = parseOrder(i36.units) as OrderModel
const m37 = parseOrder(i37.units) as OrderModel

const cueOf = (cues: Cue[], text: RegExp, para?: string) => {
  const c = cues.find((x) => text.test(x.text) && (!para || x.para === para))
  if (!c) throw new Error(`단서 없음 ${text}`)
  return c
}
const link = (c: Cue, unit: string, m: OrderModel) => makeLink(c, unit, m) as Link

describe('단락 분해', () => {
  it('#36: 주어진 글 u1 · (A) u2 · (B) u3–u4 · (C) u5', () => {
    expect(m36.given.unitIds).toEqual(['u1'])
    expect(m36.paras.A.unitIds).toEqual(['u2'])
    expect(m36.paras.B.unitIds).toEqual(['u3', 'u4'])
    expect(m36.paras.C.unitIds).toEqual(['u5'])
  })
  it('#37: 주어진 글 u1–u2 · (A) u3–u5 · (B) u6–u7 · (C) u8–u9', () => {
    expect(m37.given.unitIds).toEqual(['u1', 'u2'])
    expect(m37.paras.A.unitIds).toEqual(['u3', 'u4', 'u5'])
    expect(m37.paras.B.unitIds).toEqual(['u6', 'u7'])
    expect(m37.paras.C.unitIds).toEqual(['u8', 'u9'])
  })
  it('표지가 없거나 겹치면 구조를 지어내지 않는다', () => {
    expect(parseOrder([])).toBeNull()
    expect(parseOrder(i36.units.map((u) => ({ ...u, text: u.text.replace(/^\(C\)/, '(A)') })))).toBeNull()
    expect(parseOrder(i36.units.slice(1))).toBeNull()
  })
  it('선지 문자열은 세 표지가 한 번씩일 때만 순서로 읽는다', () => {
    expect(parseChoiceOrder('(C) - (A) - (B)')).toEqual(['C', 'A', 'B'])
    expect(parseChoiceOrder('(C) - (A)')).toBeNull()
    expect(parseChoiceOrder('(A) - (A) - (B)')).toBeNull()
  })
})

describe('단서 후보 — 각 단락 첫머리', () => {
  const c36 = cueCandidates(i36, m36)
  const c37 = cueCandidates(i37, m37)
  it('#36: For example(예시) · Later(시간) · though(대비) · the red spruce forest(정관사)', () => {
    expect(cueOf(c36, /^For example$/, 'A').kind).toBe('example')
    expect(cueOf(c36, /^Later$/, 'B').kind).toBe('time')
    expect(cueOf(c36, /^though$/, 'B').kind).toBe('contrast')
    expect(cueOf(c36, /^the red spruce forest$/, 'B').kind).toBe('definite')
  })
  it('#37: This phenomenon(지시어) · By contrast(대비) · They(대명사) · individualism(반복)', () => {
    expect(cueOf(c37, /^This phenomenon$/, 'A').kind).toBe('demonstrative')
    expect(cueOf(c37, /^By contrast$/, 'B').kind).toBe('contrast')
    expect(cueOf(c37, /^They$/, 'C').kind).toBe('pronoun')
    expect(cueOf(c37, /^individualism$/, 'A').kind).toBe('repeat')
  })
  it('후보는 단락 첫 단위에서만 — 단락 안쪽 문장은 이음매가 아니다', () => {
    const heads = new Set([m37.paras.A.unitIds[0], m37.paras.B.unitIds[0], m37.paras.C.unitIds[0]])
    expect(c37.every((c) => heads.has(c.unitId))).toBe(true)
  })
})

describe('학습자 연결과 배열', () => {
  const c36 = cueCandidates(i36, m36)
  const forEx = link(cueOf(c36, /^For example$/), 'u5', m36)
  const later = link(cueOf(c36, /^Later$/), 'u2', m36)
  it('같은 단락 안 문장은 연결 대상으로 받지 않는다', () => {
    expect('error' in makeLink(cueOf(c36, /^Later$/), 'u4', m36)).toBe(true)
  })
  it('#36: For example→u5, Later→u2 이면 (C)-(A)-(B) 에서만 끊긴 연결 0', () => {
    const cmp = compareChoices(i36, ['A', 'B', 'C'], [forEx, later])
    expect(cmp.filter((c) => c.broken.length === 0).map((c) => c.label)).toEqual(['(C) - (A) - (B)'])
    expect(cmp.find((c) => c.label === '(B) - (A) - (C)')!.broken).toHaveLength(2)
  })
  it('이음매: 닫힘 · 떨어짐 · 끊김을 구분한다', () => {
    const j = junctions(m36, ['C', 'A', 'B'], [forEx, later])
    expect(j.map((x) => `${x.front}>${x.back}`)).toEqual(['G>C', 'C>A', 'A>B'])
    expect(j[1].links[0].status).toBe('closed')
    expect(j[1].frontUnit).toBe('u5')
    expect(j[2].backUnit).toBe('u3')
    const far = junctions(m36, ['C', 'B', 'A'], [later])
    expect(far[1].links[0].status).toBe('broken')
    const gap = link(cueOf(c36, /^For example$/), 'u1', m36)
    expect(junctions(m36, ['C', 'B', 'A'], [gap])[2].links[0].status).toBe('distant')
  })
  it('키보드 이동은 끝에서 멈춘다', () => {
    const a: Arrangement = ['A', 'B', 'C']
    expect(moveIn(a, 'C', -1)).toEqual(['A', 'C', 'B'])
    expect(moveIn(a, 'A', -1)).toEqual(a)
    expect(moveIn(a, 'C', 1)).toEqual(a)
  })
  it('연결이 없으면 어떤 선지도 끊긴 연결이 없다 — 근거 없는 판정을 만들지 않는다', () => {
    expect(compareChoices(i36, ['A', 'B', 'C'], []).every((c) => c.broken.length === 0)).toBe(true)
  })
})

describe('실패 조건 · 한계', () => {
  const c37 = cueCandidates(i37, m37)
  it('#37: 반복 낱말 individualism→u8 만으로 이은 이음매는 약한 단서로 표시되고 실패 조건이 붙는다', () => {
    const rep = link(cueOf(c37, /^individualism$/), 'u8', m37)
    const j = junctions(m37, ['C', 'A', 'B'], [rep])
    expect(j[1].weakOnly).toBe(true)
    expect(cautions([rep]).map((c) => c.kind)).toEqual(['failure'])
  })
  it('정관사 하나로 이은 연결도 실패 조건이 붙는다(#36 the red spruce forest)', () => {
    const c36 = cueCandidates(i36, m36)
    const def = link(cueOf(c36, /^the red spruce forest$/), 'u2', m36)
    expect(cautions([def])[0].text).toMatch(/정관사 하나로/)
  })
  it('서로를 전제하는 두 연결은 한계로 표시하고, 어느 배열에서도 둘 다 닫히지 않는다', () => {
    const a = link(cueOf(c37, /^This phenomenon$/), 'u6', m37)
    const b = link(cueOf(c37, /^By contrast$/), 'u3', m37)
    expect(cautions([a, b]).filter((c) => c.kind === 'limit')).toHaveLength(1)
    expect(compareChoices(i37, ['A', 'B', 'C'], [a, b]).every((c) => c.broken.length >= 1)).toBe(true)
  })
  it('지시어·대비·대명사(강한 단서)로 이은 #37 은 (C)-(B)-(A) 에서만 끊긴 연결 0', () => {
    const ls = [link(cueOf(c37, /^They$/), 'u2', m37), link(cueOf(c37, /^By contrast$/), 'u9', m37), link(cueOf(c37, /^This phenomenon$/), 'u7', m37)]
    expect(cautions(ls)).toEqual([])
    expect(compareChoices(i37, ['A', 'B', 'C'], ls).filter((c) => !c.broken.length).map((c) => c.label)).toEqual(['(C) - (B) - (A)'])
  })
})

describe('공개 상태', () => {
  it('공개 전 모델 출력에 정답 키가 없다', () => {
    const out = { m: m36, cues: cueCandidates(i36, m36), cmp: compareChoices(i36, ['A', 'B', 'C'], []), j: junctions(m36, ['A', 'B', 'C'], []) }
    expect(leakedAnswerKeys(out)).toEqual([])
  })
  it('공개 뒤: 오답 선지의 함정 이음매와 해설 근거가 원문 단위로 이어진다', async () => {
    for (const it of [i36, i37]) {
      const r = await revealOf('R-ORDER', it.id)
      expect(checkReveal(it, r).ok).toBe(true)
      const { answerOrder, notes } = revealNotes(it, r)
      expect(answerOrder).not.toBeNull()
      expect(notes[r.answer - 1].extra).toEqual([])
      for (const n of notes) {
        if (n.analysis.verdict !== 'distractor') continue
        expect(n.extra.length).toBeGreaterThan(0)
        expect(refsOf(n.analysis.how_to_reject, it.units).length).toBeGreaterThan(0)
      }
    }
  })
})
