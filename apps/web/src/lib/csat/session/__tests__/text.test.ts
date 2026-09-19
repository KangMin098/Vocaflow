// apps/web/src/lib/csat/session/__tests__/text.test.ts
//
// 세션 화면의 「짧게 내놓기」 규칙 — 자르되 뜻이 남는가.
// 입력은 DB 유형 리포트의 실제 첫 절차 모양(2026-09-17 실측)을 본뜬 것이다.

import { describe, expect, it } from 'vitest'

import { firstSentences, oneLiner, splitKoSentences } from '../text'

describe('oneLiner — 「다음에 이 유형」 한 줄', () => {
  it('괄호에서 자르지 않고 괄호만 걷는다 (R-PURPOSE 가 「수신자 표기」로 잘렸던 것)', () => {
    expect(
      oneLiner('수신자 표기(Dear 뒤)와 서명·자기소개로 발신자 지위를 먼저 정한다 — 개인→기관이면 요구형'),
    ).toBe('수신자 표기와 서명·자기소개로 발신자 지위를 먼저 정한다')
  })

  it('긴 줄표 뒤 세부는 버린다', () => {
    expect(oneLiner('주어진 문장에서 두 가지만 표시한다 — (1) 앞을 가리키는 말 (2) 처음 등장하는 명사.')).toBe(
      '주어진 문장에서 두 가지만 표시한다',
    )
  })

  it('강조 표시(**)를 걷는다', () => {
    expect(oneLiner("'I' 라면 **타인의 말을 근거에서 뺀다**")).toBe("'I' 라면 타인의 말을 근거에서 뺀다")
  })

  it('70자를 넘으면 낱말 경계에서 줄이고 말줄임표를 단다', () => {
    const long = '지문을 읽기 전에 빈칸 문장만 읽고 빈칸의 문법 자리를 한 마디로 규정하고 선지의 품사와 맞춰 보고 다시 지문으로 돌아가 앞뒤 문장을 확인한다'
    const out = oneLiner(long)!
    expect(out.length).toBeLessThanOrEqual(71)
    expect(out.endsWith('…')).toBe(true)
  })

  it('비면 null', () => {
    expect(oneLiner(null)).toBeNull()
    expect(oneLiner('')).toBeNull()
  })
})

describe('firstSentences — 설명 한 단락 ≤ 3문장', () => {
  it('세 문장까지 자르고 잘렸음을 알린다', () => {
    const r = firstSentences('첫째다. 둘째다. 셋째다. 넷째다.', 3)
    expect(r.text).toBe('첫째다. 둘째다. 셋째다.')
    expect(r.cut).toBe(true)
  })

  it('영어 인용이 섞여도 마침표 뒤 대문자에서 가른다', () => {
    expect(splitKoSentences('근거는 이 문장이다. Please turn this in 이 마감이다.')).toHaveLength(2)
  })
})
