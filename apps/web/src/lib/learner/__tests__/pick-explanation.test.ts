// apps/web/src/lib/learner/__tests__/pick-explanation.test.ts
//
// 해설 키가 둘로 갈려 화면에서 사라지던 것을 막는 회귀.

import { describe, expect, it } from 'vitest'

import { explanationFor, pickExplanationText } from '../dcp'

describe('pickExplanationText', () => {
  it('결정론·배치 해설(explanation_ko)을 읽는다 — 순서·삽입이 이 키를 쓴다', () => {
    expect(pickExplanationText({ explanation_ko: '정답은 ④ 다.' })).toBe('정답은 ④ 다.')
  })

  it('생성형 해설(rationale_ko)도 읽는다 — 선택지 유형이 이 키를 쓴다', () => {
    expect(pickExplanationText({ rationale_ko: '글은 …라고 못 박는다.' })).toBe('글은 …라고 못 박는다.')
  })

  it('둘 다 있으면 explanation_ko 가 이긴다 — 나중에 쓴 것이다', () => {
    expect(pickExplanationText({ explanation_ko: 'A', rationale_ko: 'B' })).toBe('A')
  })

  it('빈 문자열·공백은 해설이 아니다 — 있는 척하지 않는다', () => {
    expect(pickExplanationText({ explanation_ko: '   ', rationale_ko: '' })).toBeNull()
    expect(pickExplanationText({ explanation_ko: '  ', rationale_ko: '있다' })).toBe('있다')
  })

  it('키가 없거나 문자열이 아니면 null', () => {
    expect(pickExplanationText({})).toBeNull()
    expect(pickExplanationText(null)).toBeNull()
    expect(pickExplanationText({ explanation_ko: 42 })).toBeNull()
  })
})

describe('explanationFor — 저장된 해설이 없으면 규칙이 채운다', () => {
  // ⚠️ 이 블록이 생긴 이유(실측 2026-09-01): 조판기(`render-volume.mjs`)는 2026-08-31 에
  //    규칙 해설기를 배선받아 V7 한 권이 49/60 → 60/60 이 됐는데, **웹 학습 화면은 못 받았다.**
  //    `explainItem` 이 apps/web 어디에서도 안 불렸다. 그래서 같은 문항이
  //    인쇄물에는 해설이 있고 화면에는 없었다 — 저장 없는 22,062문항이 전부 V7 이다.
  //    `market-benchmark` A1 은 그 사이 "학습자가 받는 100.0%" 를 찍고 있었다.

  // ⚠️ **DB 에서 그대로 가져온 행이다**(csat_dcp_items · blank_word · V7 · 해설 없음, 2026-09-01).
  //    처음엔 payload 모양을 짐작해서 썼다가 규칙이 null 을 돌려줬다 — 짐작한 fixture 는
  //    코드가 아니라 테스트가 틀렸다는 것만 알려 준다. 정답은 `answer_key.text` 에 있다.
  const blankWord = {
    type: 'blank_word' as const,
    payload: {
      hint: 'o… (제안)',
      stem: 'While these solvers _____ high accuracy, they are computationally prohibitive for iterative optimization.',
      sentence_idx: 1,
    },
  }

  it('저장된 해설이 있으면 그것을 쓴다 — 규칙이 이기지 않는다', () => {
    const stored = { text: 'offer', explanation_ko: '배치가 쓴 해설이다.' }
    expect(explanationFor(blankWord, stored)).toBe('배치가 쓴 해설이다.')
  })

  it('저장된 해설이 없으면 규칙이 채운다 (이것이 안 되던 결함)', () => {
    const text = explanationFor(blankWord, { text: 'offer' })
    expect(text).toBeTruthy()
    expect(text).toContain('offer')
  })

  it('빈 문자열은 저장된 해설로 치지 않는다 — 규칙으로 넘어간다', () => {
    const text = explanationFor(blankWord, { text: 'offer', explanation_ko: '   ' })
    expect(text).toBeTruthy()
    expect(text).not.toBe('   ')
  })

  it('규칙도 재료가 없으면 null 이다 — 정답 낱말이 없으면 지어내지 않는다', () => {
    expect(explanationFor(blankWord, {})).toBeNull()
  })

  it('규칙이 못 쓰는 유형은 null 이다 — "해설 없음" 을 지어내지 않는다', () => {
    // order/insert 는 `explainItem` 이 안 맡는다 — 이음매 해설기(`explainOrderSeam`·
    // `explainInsertSeam`) 소관이라 payload 를 수능 인쇄 형식으로 바꿔야 부를 수 있다.
    // ⚠️ 여기 걸리는 실물은 **62건**뿐이다(해설 없는 22,062 중 22,000 은 규칙이 덮는다,
    //    실측 2026-09-01). 62건 때문에 `csat-format` 변환기를 클라이언트 번들에 넣지 않는다 —
    //    남겨 둔 것이지 못 본 것이 아니다.
    expect(explanationFor({ type: 'order', payload: { presented: ['a', 'b'] } }, {})).toBeNull()
  })

  it('item 이 없으면 저장된 것만 본다 — 규칙을 억지로 돌리지 않는다', () => {
    expect(explanationFor(null, { explanation_ko: '저장분' })).toBe('저장분')
    expect(explanationFor(null, {})).toBeNull()
  })
})
