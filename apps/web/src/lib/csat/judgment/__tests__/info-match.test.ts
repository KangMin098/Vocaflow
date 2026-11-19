// apps/web/src/lib/csat/judgment/__tests__/info-match.test.ts
// R-NOTICE · R-FACT 정보 일치 모델 — 실제 픽스처 4문항(안내문 2 · 글 2)으로 성분 분해 · 근거 연결 · 표시 규칙 · 공개 대조를 본다.
import { describe, expect, it } from 'vitest'
import { leakedAnswerKeys } from '../evidence'
import { itemsOf, revealOf } from '../fixtures'
import {
  askPolarity,
  canMark,
  compareWithReveal,
  groupPending,
  initialState,
  ruleComponents,
  scopeMarkers,
  setMark,
  tally,
  tallySentence,
  toggleLink,
  togglePending,
} from '../info-match'

const notice = itemsOf('R-NOTICE')
const fact = itemsOf('R-FACT')
const texts = (c: string) => ruleComponents(c).map((x) => x.text)

describe('실제 문항 자료', () => {
  it('안내문 2 · 글 2 문항이 있고 발문 극성을 규칙으로 읽는다', () => {
    expect(notice.map((i) => i.id)).toEqual(['H2609G2#27', 'H2609G2#28'])
    expect(fact.map((i) => i.id)).toEqual(['H2609G2#26', 'H2609G1#26'])
    expect(askPolarity(notice[0].stem)).toBe('find-mismatch')
    expect(askPolarity(notice[1].stem)).toBe('find-match')
    expect(askPolarity(fact[0].stem)).toBe('find-mismatch')
    expect(askPolarity('다음 글의 제목은?')).toBe('unknown')
  })
})

describe('결정적 성분 분해', () => {
  it('수치와 그 뒤 범위·기간 표지를 한 성분으로 묶는다', () => {
    expect(texts(notice[1].choices[0])).toEqual(['13세 미만이다.'])
    expect(ruleComponents(notice[1].choices[0])[0].kinds.sort()).toEqual(['number', 'range'])
    expect(texts(notice[0].choices[1])).toEqual(['3시간 동안'])
    expect(texts(fact[1].choices[3])).toEqual(['동안', '10권이 넘는', '100편이 넘는'])
  })
  it('한글 수사 · 여러 어절 허용 표현 · 시점을 찾는다', () => {
    expect(texts(notice[0].choices[2])).toEqual(['다섯 그루를'])
    expect(texts(notice[0].choices[3])).toEqual(['당일', '수 있다.'])
    expect(texts(notice[1].choices[4])).toEqual(['유료로'])
    expect(texts(fact[1].choices[4])).toEqual(['생전에'])
  })
  it('규칙이 잡을 표지가 없으면 성분을 지어내지 않는다(학습자가 직접 고른다)', () => {
    expect(ruleComponents(fact[0].choices[4])).toEqual([])
    expect(ruleComponents(fact[1].choices[1])).toEqual([])
  })
  it('숫자 하나만 맞는 선지라도 품목 같은 나머지 말은 성분 밖에 남아 보인다', () => {
    const st = initialState(notice[0])
    const t = tally(st.choices[3], notice[0].choices[2], notice[0].units)
    expect(t.uncovered).toEqual(expect.arrayContaining(['티셔츠를', '받는다.']))
  })
})

describe('성분 단위 판단', () => {
  const item = notice[0]
  it('근거 없이 일치·어긋남을 표시할 수 없다', () => {
    const st = initialState(item)
    const c = st.choices[3].components[0]
    expect(canMark(c, 'match').ok).toBe(false)
    expect(setMark(st, 3, c.id, 'conflict')).toBe(st)
    expect(canMark(c, 'absent').ok).toBe(true)
  })
  it('연결한 근거가 있으면 언급 없음을 표시할 수 없다(반대 진술과 언급 없음을 구분)', () => {
    let st = initialState(item)
    const id = st.choices[3].components[0].id
    st = toggleLink(st, 3, id, 'u7')
    expect(canMark(st.choices[3].components[0], 'absent').ok).toBe(false)
    st = setMark(st, 3, id, 'match')
    expect(st.choices[3].components[0].mark).toBe('match')
    st = toggleLink(st, 3, id, 'u7')
    expect(st.choices[3].components[0].mark).toBeUndefined()
  })
  it('학습자가 고른 어절로 성분을 만들고 성분마다 따로 표시한다', () => {
    let st = initialState(item)
    st = togglePending(st, 3, 4)
    st = groupPending(st, 3, item.choices[2])
    const comps = st.choices[3].components
    expect(comps.map((c) => c.text)).toEqual(['다섯 그루를', '티셔츠를'])
    expect(comps[1].origin).toBe('learner')
    st = toggleLink(st, 3, 'r1', 'u7')
    st = setMark(st, 3, 'r1', 'match')
    st = toggleLink(st, 3, 'l4', 'u7')
    st = setMark(st, 3, 'l4', 'conflict')
    const t = tally(st.choices[3], item.choices[2], item.units)
    expect([t.match, t.conflict]).toEqual([1, 1])
    // 규칙 성분 어절은 다시 고를 수 없다
    expect(togglePending(st, 3, 1)).toBe(st)
  })
  it('일부 성분만 일치로 표시하면 선지 전체 일치로 요약하지 않는다', () => {
    let st = initialState(item)
    st = toggleLink(st, 3, 'r1', 'u7')
    st = setMark(st, 3, 'r1', 'match')
    const sentence = tallySentence(tally(st.choices[3], item.choices[2], item.units))
    expect(sentence).toContain('아직 말할 수 없다')
  })
  it('근거 속 범위·조건 표지(괄호 · each day · per · or more · but)를 확인 대상으로 보인다', () => {
    const u2 = notice[1].units.find((u) => u.id === 'u2')!.text
    const m = scopeMarkers(u2).map((x) => x.text)
    expect(m).toEqual(expect.arrayContaining(['(5 p.m.-8 p.m. each day)', 'per', 'each day']))
    expect(scopeMarkers(notice[0].units[7].text).map((x) => x.text)).toEqual(expect.arrayContaining(['or more', 'but']))
    expect(scopeMarkers(fact[0].units[2].text).map((x) => x.text)).toEqual(expect.arrayContaining(['but', 'could not']))
  })
  it('범위 표지가 있는 근거에 일치를 표시하면 확인 대상으로 남긴다', () => {
    let st = initialState(notice[1])
    st = toggleLink(st, 3, 'r5', 'u2')
    st = setMark(st, 3, 'r5', 'match')
    const t = tally(st.choices[3], notice[1].choices[2], notice[1].units)
    expect(t.scopeChecks.map((x) => x.compId)).toEqual(['r5'])
  })
})

describe('공개 상태', () => {
  it('공개 전 모델 출력에 정답 키가 없다', () => {
    for (const item of [...notice, ...fact]) {
      const st = initialState(item)
      expect(leakedAnswerKeys(st)).toEqual([])
      expect(JSON.stringify(st)).not.toMatch(/verdict|correct|answer/)
    }
  })
})

describe('공개 뒤 해설 대조', () => {
  it('안내문 ③: 해설 [u7][u8] 과 학습자 연결을 공유·누락·추가로 나눈다', async () => {
    const item = notice[0]
    const r = await revealOf('R-NOTICE', item.id)
    let st = initialState(item)
    st = toggleLink(st, 3, 'r1', 'u7')
    st = toggleLink(st, 3, 'r1', 'u2')
    const c = compareWithReveal(item, r, 3, st.choices[3])!
    expect(c.textMatches).toBe(false)
    expect(c.revealUnits).toEqual(['u7', 'u8'])
    expect(c.shared).toEqual(['u7'])
    expect(c.missed).toEqual(['u8'])
    expect(c.extra).toEqual(['u2'])
  })
  it('일치를 묻는 발문에서 정답 선지는 원문과 일치로 읽는다', async () => {
    const item = notice[1]
    const r = await revealOf('R-NOTICE', item.id)
    const st = initialState(item)
    expect(compareWithReveal(item, r, 4, st.choices[4])!.textMatches).toBe(true)
    expect(compareWithReveal(item, r, 5, st.choices[5])!.textMatches).toBe(false)
  })
  it('글 ②: 모든 성분을 일치로 표시했는데 해설이 어긋남이면 그 차이를 알린다', async () => {
    const item = fact[0]
    const r = await revealOf('R-FACT', item.id)
    let st = initialState(item)
    st = toggleLink(st, 2, 'r0', 'u3')
    st = setMark(st, 2, 'r0', 'match')
    const c = compareWithReveal(item, r, 2, st.choices[2])!
    expect(c.textMatches).toBe(false)
    expect(c.disagreement).toMatch(/어긋난다/)
    expect(c.revealUnits).toEqual(['u3', 'u4'])
  })
  it('글(Paul Farmer) ⑤ 와 오답 ① 의 근거 단위', async () => {
    const item = fact[1]
    const r = await revealOf('R-FACT', item.id)
    const st = initialState(item)
    expect(compareWithReveal(item, r, 5, st.choices[5])!.revealUnits).toEqual(['u8'])
    let s1 = toggleLink(st, 1, 'r4', 'u3')
    s1 = setMark(s1, 1, 'r4', 'conflict')
    const c1 = compareWithReveal(item, r, 1, s1.choices[1])!
    expect(c1.textMatches).toBe(true)
    expect(c1.disagreement).toMatch(/일치로 본다/)
  })
  it('해설 자료에 선지가 없으면 대조하지 않는다', async () => {
    const item = fact[1]
    const r = await revealOf('R-FACT', item.id)
    expect(compareWithReveal(item, { ...r, choices: [] }, 1, { components: [], pending: [] })).toBeNull()
  })
})

describe('자료 없음', () => {
  it('선지가 없는 문항은 빈 상태', () => {
    const st = initialState({ ...notice[0], choices: [] })
    expect(st.choices).toEqual({})
    expect(tallySentence(tally({ components: [], pending: [] }, '', []))).toMatch(/성분이 없다/)
  })
})
