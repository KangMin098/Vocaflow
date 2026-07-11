// packages/library-pipeline/src/ingest-article/_helpers.test.ts
// decodeEntities 회귀 잠금 — 특히 hex 수치 엔티티(&#x27; 등). v06.208 이전엔 hex 미처리로 제목에 잔존했음.

import { describe, expect, it } from 'vitest'

import { decodeEntities } from './_helpers'

describe('decodeEntities', () => {
  it('hex 수치 엔티티(&#x27;)를 아포스트로피로 디코드 (회귀: owid/voa 제목 잔존 버그)', () => {
    expect(decodeEntities('How to &#x27;Dish Up&#x27; Something Good')).toBe("How to 'Dish Up' Something Good")
    expect(decodeEntities('doesn&#x27;t reflect that')).toBe("doesn't reflect that")
  })

  it('십진 수치 엔티티 + named 엔티티', () => {
    expect(decodeEntities('a &amp; b')).toBe('a & b')
    expect(decodeEntities('&lt;tag&gt;')).toBe('<tag>')
    expect(decodeEntities('it&#39;s')).toBe("it's")
    expect(decodeEntities('&quot;quote&quot;')).toBe('"quote"')
  })

  it('hex 대문자/다바이트 코드포인트도 처리', () => {
    expect(decodeEntities('&#x2019;')).toBe('’') // right single quote
    expect(decodeEntities('caf&#xE9;')).toBe('café')
  })

  it('엔티티 없으면 원문 유지', () => {
    expect(decodeEntities('plain text')).toBe('plain text')
  })
})
