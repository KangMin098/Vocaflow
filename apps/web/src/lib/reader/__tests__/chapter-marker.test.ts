// apps/web/src/lib/reader/__tests__/chapter-marker.test.ts
//
// 장 표식 줄 판정 — **정상 본문 첫 줄을 잘못 숨기지 않는가**가 핵심이다(사용자 지시 2026-10-19).
// 양성 표본은 DB 의 실제 형식(2026-10-19 조회 · 10,694장 전부 이 형식)을 그대로 옮겼다.

import { describe, expect, it } from 'vitest'

import { parseChapterMarker, stripLeadingChapterMarker } from '../chapter-marker'

const US = String.fromCharCode(0x1f)
const RS = String.fromCharCode(0x1e)
const HREF = 'https://standardebooks.org/ebooks/charles-dickens/a-christmas-carol/text/chapter-1'

describe('parseChapterMarker — 표식으로 알아보는 것', () => {
  it('제목 + RS + URL', () => {
    expect(parseChapterMarker(`CHAPTER 1. Marley's Ghost${RS}${HREF}`)).toEqual({
      number: '1', title: "Marley's Ghost", group: undefined, sourceHref: HREF,
    })
  })
  it('묶음(US) 이 있는 형식', () => {
    expect(parseChapterMarker(`CHAPTER 3. The Storm${US}Book II${RS}${HREF}`)).toEqual({
      number: '3', title: 'The Storm', group: 'Book II', sourceHref: HREF,
    })
  })
  it('로마 숫자 장 번호', () => {
    expect(parseChapterMarker(`CHAPTER IV. A Letter${RS}${HREF}`)?.number).toBe('IV')
  })
  it('앞뒤 공백은 무시한다', () => {
    expect(parseChapterMarker(`  CHAPTER 1. Title${RS}${HREF}\n`)?.title).toBe('Title')
  })
})

describe('parseChapterMarker — 정상 본문은 그대로 둔다', () => {
  it('RS 없는 장 제목 줄(DB 에 202개) — 숨기지 않는다', () => {
    expect(parseChapterMarker('CHAPTER 1. Marley’s Ghost')).toBeNull()
  })
  it('평범한 첫 문장', () => {
    expect(parseChapterMarker('Marley was dead, to begin with. There is no doubt whatever about that.')).toBeNull()
  })
  it('본문 안에 URL 이 있는 문장', () => {
    expect(parseChapterMarker(`See ${HREF} for the original text.`)).toBeNull()
  })
  it('RS 뒤가 URL 이 아니다', () => {
    expect(parseChapterMarker(`CHAPTER 1. Title${RS}not a url`)).toBeNull()
  })
  it('URL 뒤에 다른 글자가 붙는다(한 줄 전체가 표식이 아니다)', () => {
    expect(parseChapterMarker(`CHAPTER 1. Title${RS}${HREF} Marley was dead.`)).toBeNull()
  })
  it('여러 줄 문단(표식 뒤에 본문이 같은 문단에 있다)', () => {
    expect(parseChapterMarker(`CHAPTER 1. Title${RS}${HREF}\nMarley was dead.`)).toBeNull()
  })
  it('CHAPTER 로 시작하지 않는다', () => {
    expect(parseChapterMarker(`Prologue${RS}${HREF}`)).toBeNull()
  })
  it('제목이 비어 있다', () => {
    expect(parseChapterMarker(`CHAPTER 1. ${RS}${HREF}`)).toBeNull()
  })
  it('RS 가 둘', () => {
    expect(parseChapterMarker(`CHAPTER 1. A${RS}B${RS}${HREF}`)).toBeNull()
  })
})

describe('stripLeadingChapterMarker — 첫 줄만 걷어낸다(Echo 첫 문장)', () => {
  const RSx = String.fromCharCode(0x1e)
  const H = 'https://standardebooks.org/ebooks/x/y/text/chapter-1'
  it('표식 + 본문 첫 문장 한 덩어리 → 본문만', () => {
    const r = stripLeadingChapterMarker(`CHAPTER 1. Title${RSx}${H}\n\nMarley was dead, to begin with.`)
    expect(r.text).toBe('Marley was dead, to begin with.')
    expect(r.marker?.sourceHref).toBe(H)
  })
  it('표식만 → 빈 문자열(호출부가 그 항목을 뺀다)', () => {
    expect(stripLeadingChapterMarker(`CHAPTER 1. Title${RSx}${H}`).text).toBe('')
  })
  it('표식이 아닌 첫 줄은 그대로', () => {
    const t = 'CHAPTER 1. Title\nMarley was dead.'
    expect(stripLeadingChapterMarker(t)).toEqual({ text: t, marker: null })
  })
})
