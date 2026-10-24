// apps/web/src/lib/csat/binding/__tests__/note-footnote.test.ts
// 안내문 문장형 각주(「* The museum is closed …」)와 어휘 풀이형 각주(「* term: 뜻」)를 가른다 — 2014A#29 공식 각주 기준.
// 정의가 정말 빠진 표지는 여전히 footnote_mark_without_gloss 로 잡혀야 한다(오탐만 고치고 누락 검출은 유지).
import { describe, expect, it } from 'vitest'
import { detectDefects, notesOf } from '../extraction'

const codes = (passage: string, typeId = 'R-NOTICE', choices = ['a', 'b', 'c', 'd', 'e']) => detectDefects({ typeId, passage, choices }).map((d) => d.code)

// 개발 DB 2014A#29 현재 지문(2026-10-25 각주 복원 뒤) — 공식 문제지 2014_영어A-홀수형 29번과 같은 각주 문장
const FIXED = 'Modern Pottery Museum The Modern Pottery Museum exhibits collections of artistic ceramic works. It also offers information about the history and development of modern pottery. Visitors can make their own plates or cups for an additional fee. Hours* Weekdays: 9:00 a.m. － 6:00 p.m. Weekends: 9:00 a.m. － 5:00 p.m. * The museum is closed on the first Monday of every month. Fees General Admission: $5 Children under 12: Free Pottery Experience: $10 Parking A parking discount is available to museum visitors. To receive the discount, visitors must have their parking tickets stamped at the visitor information desk.'
// 복원 전 — 각주 문장이 빠지고 「month.」 조각만 남았다(실제 누락)
const BROKEN = FIXED.replace('5:00 p.m. * The museum is closed on the first Monday of every month. Fees', '5:00 p.m. month. Fees')

describe('안내문 문장형 각주', () => {
  it('2014A#29 복원 지문: Hours* 는 문장 각주와 짝 — 정의 없음으로 보지 않는다', () => {
    expect(notesOf(FIXED)).toEqual([expect.objectContaining({ mark: '*', note: 'The museum is closed on the first Monday of every month.' })])
    expect(codes(FIXED)).not.toContain('footnote_mark_without_gloss')
    expect(codes(FIXED)).not.toContain('orphan_fragment')
  })
  it('2014A#29 복원 전 지문: 각주 문장이 없으면 여전히 누락으로 잡는다', () => {
    expect(notesOf(BROKEN)).toEqual([])
    const c = codes(BROKEN)
    expect(c).toContain('footnote_mark_without_gloss')
    expect(c).toContain('orphan_fragment')
  })
  it('문장 각주는 첫 문장 끝에서 끊고, 낱말 안 마침표(a.m.)에서는 끊지 않는다', () => {
    expect(notesOf('Hours* Open daily. * The desk opens at 9 a.m. on weekends. Fees Adults: $5').map((n) => n.note)).toEqual(['The desk opens at 9 a.m. on weekends.'])
  })
  it('약어 마침표 뒤 대문자(U.S. Embassy · a.m. Monday)에서 끝나면 범위 미확정(ambiguous) — 짝은 맞지만 exact 가 아니다(T-0166 R1 P2)', () => {
    const us = notesOf('Tickets* Open daily. * Visitors from the U.S. Embassy enter for free.')
    expect(us).toEqual([expect.objectContaining({ note: 'Visitors from the U.S.', ambiguous: true })])
    const am = notesOf('Hours* Open daily. * The desk opens at 9 a.m. Monday through Friday.')
    expect(am).toEqual([expect.objectContaining({ ambiguous: true })])
    expect(codes('Tickets* Open daily. * Visitors from the U.S. Embassy enter for free.')).not.toContain('footnote_mark_without_gloss')
    expect(notesOf(FIXED)[0].ambiguous).toBe(false)
  })
  it('목록 밖 약어(Prof.)도 범위 미확정 · 숫자로 시작하는 다음 문장은 각주에 넣지 않는다 · 줄 넘김 각주 인식(T-0166 R2)', () => {
    expect(notesOf('Hours* Open daily. * Please contact Prof. Smith for details.')).toEqual([expect.objectContaining({ ambiguous: true })])
    expect(notesOf('Hours* Open daily. * The office is closed on holidays. 12 children may enter.').map((n) => n.note)).toEqual(['The office is closed on holidays.'])
    expect(notesOf('Hours* Open daily. * The office is closed\non holidays.').map((n) => n.note)).toEqual(['The office is closed\non holidays.'])
    expect(notesOf('Hours* Open daily. * The office is closed\n\non holidays.')).toEqual([])
  })
  it('소문자 약어(vol. · pp. · fig. · cf.)에서 끝나도 범위 미확정 · CRLF 줄 넘김 인식(T-0166 R3)', () => {
    for (const p of ['Hours* Open daily. * Please read vol. II for details.', 'Hours* Open daily. * Please see pp. 12 through 15.', 'Hours* Open daily. * Please see fig. 3 for details.', 'Hours* Open daily. * For details cf. Smith and Jones.'])
      expect(notesOf(p).every((n) => n.ambiguous)).toBe(true)
    expect(notesOf('Hours* Open daily. * The office is closed\r\non holidays.').map((n) => n.ambiguous)).toEqual([false])
    // 끝 낱말이 5자 이상 소문자일 때만 exact — 2014A#29 「month.」
    expect(notesOf('Hours* Open daily. * The office is closed on public holidays.')[0].ambiguous).toBe(false)
  })
  it('따옴표 · 괄호 · 숫자로 시작하는 문장 각주도 짝이다(T-0166 R1 P3)', () => {
    expect(notesOf('Hours* Open daily. * "The office is closed on holidays."').map((n) => n.note)).toEqual(['"The office is closed on holidays."'])
    expect(notesOf('Hours* Open daily. * (The office is closed on holidays.)').map((n) => n.note)).toEqual(['(The office is closed on holidays.)'])
    expect(notesOf('Admission* Open daily. * 12 children must accompany an adult.').map((n) => n.note)).toEqual(['12 children must accompany an adult.'])
    expect(notesOf('Open Hours* daily. * "Hours: 운영 시간"')).toEqual([])
  })
  it('표지보다 앞에 있는 문장 각주는 짝이 아니다', () => {
    expect(codes('* The office is closed on holidays. Hours* Weekdays: 9:00 a.m. － 6:00 p.m.')).toContain('footnote_mark_without_gloss')
  })
  it('별표 수가 다르면 짝이 아니다', () => {
    expect(codes('Hours** Weekdays: 9 a.m. to 6 p.m. * The office is closed on holidays.')).toContain('footnote_mark_without_gloss')
  })
  it('두 낱말 이하 · 소문자 시작 조각은 문장 각주가 아니다', () => {
    expect(notesOf('Hours* Open daily. * Closed.')).toEqual([])
    expect(notesOf('Hours* Open daily. * closed on the first Monday.')).toEqual([])
  })
  it('주소 속 별표는 표지도 각주도 아니다', () => {
    expect(codes('Visit www.wabu*.com for details. * Tickets are sold at the main gate only.')).not.toContain('footnote_mark_without_gloss')
  })
})

describe('어휘 풀이형 각주는 그대로', () => {
  it('풀이가 있으면 짝 — 「* term: 뜻」 은 문장 각주로 세지 않는다', () => {
    const p = 'The rules act as constraints* on design. * constraint: 제약'
    expect(notesOf(p)).toEqual([])
    expect(codes(p, 'R-BLANK')).not.toContain('footnote_mark_without_gloss')
  })
  it('대문자 용어 풀이(「* Hours: 운영 시간」)도 문장 각주가 아니다', () => {
    expect(notesOf('Open Hours* daily. * Hours: 운영 시간')).toEqual([])
  })
  it('풀이도 문장 각주도 없으면 누락', () => {
    expect(codes('The rules act as constraints* on design.', 'R-BLANK')).toContain('footnote_mark_without_gloss')
  })
  it('풀이 용어가 표지 낱말과 다르면 문장 각주가 있어도 풀이로 짝짓지 않는다 — 문장 각주로만 짝', () => {
    const p = 'Hours* Weekdays: 9 a.m. to 6 p.m. * constraint: 제약 * The office is closed on holidays.'
    expect(codes(p)).not.toContain('footnote_mark_without_gloss')
  })
})
