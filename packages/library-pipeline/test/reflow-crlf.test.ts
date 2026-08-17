// packages/library-pipeline/test/reflow-crlf.test.ts
// reflowSoftHyphens 가 CRLF 입력에서 통째로 no-op 이던 회귀를 막는다.
//   Project Gutenberg 평문은 CRLF 라, `(\w)-\n(\w)` 가 `\r` 때문에 매치되지 않아
//   줄끝 하이픈 재결합과 하드랩 해제가 **구텐베르크 도서 전권에서** 일어나지 않았다.
import { describe, it, expect } from 'vitest'
import { reflowSoftHyphens } from '../src/normalize/reflow'

describe('reflowSoftHyphens — 개행 변종', () => {
  it('CRLF 에서도 줄끝 하이픈을 재결합한다 (회귀 방지)', () => {
    expect(reflowSoftHyphens('the rail-\r\nroad station')).toBe('the railroad station')
    expect(reflowSoftHyphens('he knelt to knea-\r\nd the dough')).toBe('he knelt to knead the dough')
  })

  it('CRLF 하드랩을 공백으로 푼다', () => {
    expect(reflowSoftHyphens('a quiet\r\nmorning')).toBe('a quiet morning')
  })

  it('LF 동작은 그대로다', () => {
    expect(reflowSoftHyphens('over-\nload')).toBe('overload')
    expect(reflowSoftHyphens('side\nlong')).toBe('side long')
  })

  it('CR 단독(구형 Mac)도 처리한다', () => {
    expect(reflowSoftHyphens('proof-\rread')).toBe('proofread')
  })

  it('하이픈 변종 U+2010 · U+2011 도 재결합한다', () => {
    expect(reflowSoftHyphens('re‐\r\nload')).toBe('reload')
    expect(reflowSoftHyphens('be‑\nhead')).toBe('behead')
  })

  it('soft hyphen(U+00AD)은 제거한다', () => {
    expect(reflowSoftHyphens('rail­road')).toBe('railroad')
  })

  it('행말 공백이 하이픈과 개행 사이에 있어도 재결합한다', () => {
    expect(reflowSoftHyphens('plea-  \r\n  ding')).toBe('pleading')
  })

  it('정상 하이픈 복합어는 붙이지 않는다', () => {
    expect(reflowSoftHyphens('a well-known author')).toBe('a well-known author')
  })

  it('빈 줄(문단 경계)은 유지한다', () => {
    expect(reflowSoftHyphens('first para.\r\n\r\nsecond para.')).toBe('first para.\n\nsecond para.')
  })
})

// 같은 결함이 병렬 구현에도 있었다 — 기사 경로(htmlToPlainText).
// HTTP 응답 HTML 은 CRLF 인 경우가 많아 `[ \t]+\n`·`\n{3,}` 규칙까지 함께 no-op 이 된다.
import { htmlToPlainText } from '../src/ingest-article/_helpers'

describe('htmlToPlainText — 개행 변종', () => {
  it('CRLF 하드랩의 줄끝 하이픈을 재결합한다', () => {
    expect(htmlToPlainText('<p>the rail-\r\nroad station</p>')).toBe('the railroad station')
  })

  it('CRLF 에서도 빈 줄 압축이 동작한다', () => {
    expect(htmlToPlainText('<p>a</p>\r\n\r\n\r\n\r\n<p>b</p>')).toBe('a\n\nb')
  })

  it('soft hyphen 을 제거한다', () => {
    expect(htmlToPlainText('<p>rail\u00ADroad</p>')).toBe('railroad')
  })

  it('정상 하이픈 복합어는 붙이지 않는다', () => {
    expect(htmlToPlainText('<p>a well-known author</p>')).toBe('a well-known author')
  })
})
