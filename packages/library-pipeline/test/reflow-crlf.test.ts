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
