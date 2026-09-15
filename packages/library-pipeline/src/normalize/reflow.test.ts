// packages/library-pipeline/src/normalize/reflow.test.ts
//
// 줄 끝 하이픈 결합이 **책에는 필요하고 기사에는 해롭다**는 것을 못 박는다.
// 실측 2026-08-20 (기사 322편 전수): 줄 끝 하이픈 11건이 전부 한 기사에서 나왔고
// 진짜 줄바꿈 하이픈은 0건이었다.

import { describe, expect, it } from 'vitest'

import { reflowSoftHyphens } from './reflow'

describe('reflowSoftHyphens — 책 기본값(결합 켬)', () => {
  it('PDF 줄바꿈 하이픈을 되돌린다', () => {
    expect(reflowSoftHyphens('an inter-\nnational treaty')).toBe('an international treaty')
  })

  it('CRLF 에서도 동작한다 — 이게 안 되면 구텐베르크 전권이 no-op 이었다', () => {
    expect(reflowSoftHyphens('inter-\r\nnational')).toBe('international')
  })

  it('U+2010·U+2011 하이픈 변종도 처리한다', () => {
    expect(reflowSoftHyphens('inter‐\nnational')).toBe('international')
    expect(reflowSoftHyphens('inter‑\nnational')).toBe('international')
  })

  it('soft hyphen 은 표시용이라 지운다', () => {
    expect(reflowSoftHyphens('inter­national')).toBe('international')
  })

  it('단순 줄바꿈은 공백이 된다', () => {
    expect(reflowSoftHyphens('one\ntwo')).toBe('one two')
  })
})

describe('reflowSoftHyphens — 기사(결합 끔)', () => {
  // VOA "Grow Your Vocabulary by Learning Root Words" 의 실제 원문 형태.
  //   HTML 표(Root | Meaning)가 텍스트로 납작해진 것이다.
  const rootTable = 'Root\nMeaning\nbio-\nlife\nauto-\nself\nphoto-\nlight\nport-\ncarry'

  it('어근표에서 없는 낱말을 만들지 않는다', () => {
    const out = reflowSoftHyphens(rootTable, { joinHyphenLineBreaks: false })
    for (const ghost of ['biolife', 'autoself', 'photolight', 'portcarry']) {
      expect(out, ghost).not.toContain(ghost)
    }
  })

  it('어근과 뜻이 따로 남는다 — 둘 다 실재하는 말이다', () => {
    const out = reflowSoftHyphens(rootTable, { joinHyphenLineBreaks: false })
    expect(out).toContain('bio-')
    expect(out).toContain('life')
  })

  it('기본값을 그대로 쓰면 예전처럼 붙는다 — 옵션을 안 주면 책 동작이다', () => {
    // 이 확인이 없으면 누군가 기본값을 바꿔도 아무도 모른다.
    expect(reflowSoftHyphens(rootTable)).toContain('biolife')
  })

  it('결합을 꺼도 나머지 정규화는 그대로 한다', () => {
    const opt = { joinHyphenLineBreaks: false }
    expect(reflowSoftHyphens('one\ntwo', opt)).toBe('one two')
    expect(reflowSoftHyphens('a­b', opt)).toBe('ab')
    expect(reflowSoftHyphens('a  \t b', opt)).toBe('a b')
    expect(reflowSoftHyphens('a\n\n\n\nb', opt)).toBe('a\n\nb')
  })

  it('쉼표로 이어진 어근 나열도 붙이지 않는다', () => {
    // `scrib-, script-\nwrite` — 하이픈 줄에 앞선 낱말이 있어서 "앞말이 있으면 진짜"
    //   같은 한쪽짜리 판별 규칙으로는 못 걸렀다. 그래서 규칙 대신 경로로 나눴다.
    const out = reflowSoftHyphens('scrib-, script-\nwrite', { joinHyphenLineBreaks: false })
    expect(out).not.toContain('scriptwrite')
  })
})
