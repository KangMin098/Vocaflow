// apps/web/src/lib/csat/reflow/__tests__/crop-mark-view.test.ts
//
// F08 — 고른 선지 → 그릴 밑줄 · 이유 한 줄. 대응이 확실할 때만 그린다.
import { describe, expect, it } from 'vitest'

import { cropMarkView, markerOfChoice } from '../crop-mark-view'
import type { CropMarks } from '../read-paper'

const R = [{ left: 0.1, top: 0.2, width: 0.1, height: 0.02 }]
const circled: CropMarks = { kind: 'circled', byMarker: { 1: R, 3: R }, implied: null, issues: { 2: 'ambiguous_underline', 4: 'no_underline' }, itemIssues: [] }
const letters: CropMarks = { kind: 'letters', byMarker: { 2: R }, implied: null, issues: {}, itemIssues: [] }
const implied: CropMarks = { kind: 'none', byMarker: {}, implied: R, issues: {}, itemIssues: [] }
const SET_CHOICES = ['(a)', '(b)', '(c)', '(d)', '(e)']

describe('markerOfChoice — 선지 번호 ↔ 지문 기호', () => {
  it('①~⑤ 유형은 번호 그대로', () => expect(markerOfChoice(circled, 3, [])).toBe(3))
  it('세트는 선지 글이 정확히 (x) 일 때만 그 순번', () => {
    expect(markerOfChoice(letters, 2, SET_CHOICES)).toBe(2)
    expect(markerOfChoice(letters, 2, ['(b)', '(a)', '(c)', '(d)', '(e)'])).toBe(1)
    expect(markerOfChoice(letters, 2, ['(A)-(C)-(B)', '', '', '', ''])).toBeNull()
    expect(markerOfChoice(letters, 6, SET_CHOICES)).toBeNull()
  })
})

describe('cropMarkView', () => {
  it('요청이 없으면 아무것도', () => expect(cropMarkView(circled, null, [])).toEqual({ rects: [], state: 'none', label: null }))
  it('대응 확정 선지만 그린다', () => {
    expect(cropMarkView(circled, { kind: 'choice', n: 1 }, [])).toMatchObject({ rects: R, state: 'shown' })
    expect(cropMarkView(letters, { kind: 'choice', n: 2 }, SET_CHOICES)).toMatchObject({ rects: R, state: 'shown' })
  })
  it('모호 · 미대응 · 선지 구조 불일치는 그리지 않고 이유', () => {
    expect(cropMarkView(circled, { kind: 'choice', n: 2 }, [])).toMatchObject({ rects: [], state: 'unavailable', label: expect.stringContaining('하나로 정할 수 없어') })
    expect(cropMarkView(circled, { kind: 'choice', n: 4 }, [])).toMatchObject({ rects: [], label: expect.stringContaining('찾지 못해') })
    expect(cropMarkView(letters, { kind: 'choice', n: 2 }, ['x', 'y', 'z', 'w', 'v'])).toMatchObject({ rects: [], label: expect.stringContaining('선지 구조') })
  })
  it('함축 밑줄은 함축 문항에서만 — 다른 유형의 평가 과제 장면에서는 조용히', () => {
    expect(cropMarkView(implied, { kind: 'implied' }, [])).toMatchObject({ rects: R, state: 'shown' })
    expect(cropMarkView(circled, { kind: 'implied' }, [])).toEqual({ rects: [], state: 'none', label: null })
    expect(cropMarkView({ ...implied, implied: null }, { kind: 'implied' }, [])).toMatchObject({ rects: [], state: 'unavailable' })
  })
  it('도표 · 밑줄 유형 아님은 조용히(도표 영역 강조 금지)', () => {
    const chart: CropMarks = { kind: 'none', byMarker: {}, implied: null, issues: {}, itemIssues: ['not_underline_type'] }
    expect(cropMarkView(chart, { kind: 'choice', n: 2 }, [])).toEqual({ rects: [], state: 'none', label: null })
    expect(cropMarkView(chart, { kind: 'implied' }, [])).toEqual({ rects: [], state: 'none', label: null })
  })
  it('여러 쪽 문항 · 위치 계산 없음은 이유만', () => {
    expect(cropMarkView({ ...circled, itemIssues: ['multi_page'] }, { kind: 'choice', n: 1 }, [])).toMatchObject({ rects: [], label: expect.stringContaining('여러 쪽') })
    expect(cropMarkView(null, { kind: 'choice', n: 1 }, [])).toMatchObject({ rects: [], state: 'unavailable' })
  })
})
