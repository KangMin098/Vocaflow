// packages/library-pipeline/test/entity-decode.test.ts
//
// HTML 수치 엔티티 잔존 회귀 — v06.35.
//
// 실측 결함: opentextbc(Pressbooks) 본문은 곱슬 큰따옴표를 `&#8220;`/`&#8221;` 수치 엔티티로 쓰는데,
// pressbooks/standard-ebooks 의 decodeEntities 가 named(`&ldquo;`)만 열거하고 수치 fallback 이 없었다.
// → 엔티티가 본문에 그대로 남고, winkNLP 가 `&#8220;social` 을 한 토큰으로 물어 **첫 글자를 먹은**
//   조각(ocial · ociety · eople · bject)이 추출 어휘에 들어갔다.
//   Introduction to Sociology 2nd Cdn Ed. 815행 오염 · 미해결 어휘 142개 중 상당수가 이것.
//
// 이 스펙이 지키는 규칙: **entity 디코더는 named 열거 뒤에 generic 수치/hex fallback 을 둔다.**
import { describe, expect, it } from 'vitest'

import { htmlToPlainText as pressbooksToText } from '../src/ingest/pressbooks'
import { htmlToPlainText as standardEbooksToText } from '../src/ingest/standard-ebooks'

const CASES: Array<[string, (html: string) => string]> = [
  ['pressbooks', pressbooksToText],
  ['standard-ebooks', (h) => standardEbooksToText(h)],
]

describe.each(CASES)('%s htmlToPlainText — HTML entity', (_name, toText) => {
  it('수치 엔티티(&#8220; &#8221;)를 남기지 않는다', () => {
    const out = toText('<p>a concept of &#8220;society&#8221; and &#8220;social physics&#8221;</p>')
    expect(out).not.toMatch(/&#\d+;/)
    expect(out).toContain('society')
    expect(out).toContain('social physics')
  })

  it('hex 엔티티(&#x2019;)를 남기지 않는다', () => {
    const out = toText('<p>the learner&#x2019;s choice</p>')
    expect(out).not.toMatch(/&#x[0-9a-fA-F]+;/)
    expect(out).toContain('learner')
  })

  it('엔티티 바로 뒤 단어의 첫 글자를 먹지 않는다', () => {
    // 결함 재현 조건: 여는 따옴표 + 단어가 공백 없이 붙어 있는 형태.
    const out = toText('<p>&#8220;objects&#8221; and &#8220;people&#8221;</p>')
    expect(out).toContain('objects')
    expect(out).toContain('people')
    // 단어 경계 기준 — 'objects' 안의 'bject' 는 정상, 독립 토큰 'bject' 가 결함.
    expect(out).not.toMatch(/\bbject\b/)
    expect(out).not.toMatch(/\beople\b/)
  })

  it('named 엔티티는 기존대로 처리한다 (회귀 방지)', () => {
    const out = toText('<p>Tom &amp; Huck &mdash; &ldquo;raft&rdquo;&hellip;</p>')
    expect(out).toContain('Tom & Huck')
    expect(out).toContain('—')
    expect(out).toContain('“raft”')
    expect(out).toContain('…')
  })
})
