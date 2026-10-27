// apps/web/src/lib/csat/binding/__tests__/pdf-values.test.ts
// 학습자 PDF 탐색(실제 공식 PDF 좌표 파일)과 수치·조건 읽기.
import { describe, expect, it } from 'vitest'
import { auditAnchorFile, locateInPdf, type PdfAnchorFile } from '../pdf'
import { choiceKeys, readValues, valueAnchors } from '../values'
import ref2024 from '../../anchor-data/2024.json'
import index from '../../anchor-data/index.json'

const ref = ref2024 as unknown as PdfAnchorFile
const basis = { itemId: 't', inputHash: 'h', unitsVersion: null, unitsHash: null, analysisVersion: null }

describe('locateInPdf — 공식 PDF 해시가 같을 때만 좌표', () => {
  it('해시 일치 → 쪽·좌표·선지 표지 exact', () => {
    const r = locateInPdf(ref, '2024', 18, ref.sha256, 3)
    expect(r.status).toBe('exact')
    if (r.status === 'exact') {
      expect(r.page).toBeGreaterThanOrEqual(1)
      expect(r.choice?.n).toBe(3)
    }
  })
  it('다른 판본 PDF → 좌표 없이 번호로 찾기', () => {
    expect(locateInPdf(ref, '2024', 18, 'f'.repeat(64))).toEqual({ status: 'navigate_by_number', examId: '2024', no: 18, reason: 'hash_mismatch' })
  })
  it('해시 모름 · 정본 PDF 없는 회차 → 번호로 찾기', () => {
    expect(locateInPdf(ref, '2024', 18, null).status).toBe('navigate_by_number')
    expect(locateInPdf(null, 'H2403G3', 18, ref.sha256)).toEqual({ status: 'navigate_by_number', examId: 'H2403G3', no: 18, reason: 'no_reference_pdf' })
  })
  it('듣기(1–17번) 중 선지 표지가 없는 문항은 선지 위치를 단정하지 않는다', () => {
    const noMarks = ref.items.find((x) => x.marks.length === 0)!
    expect(locateInPdf(ref, '2024', noMarks.no, ref.sha256, 1)).toMatchObject({ status: 'no_anchor', reason: 'choice_mark_missing' })
  })
  it('좌표 파일 회차가 다르면 던진다(다른 회차 좌표를 쓰지 않는다)', () => {
    expect(() => locateInPdf(ref, '2023', 18, ref.sha256)).toThrow()
  })
  it('색인의 sha256 과 회차 파일의 sha256 이 같다', () => {
    const row = (index as { exams: { exam_id: string; sha256: string }[] }).exams.find((e) => e.exam_id === '2024')
    expect(row?.sha256).toBe(ref.sha256)
    expect(auditAnchorFile(ref)).toEqual([])
  })
})

describe('readValues', () => {
  it('퍼센트·배수·통화·시각·연도를 단위와 함께 읽는다', () => {
    const v = readValues('In 2012, 53% posted; three times higher; $10 fee; open 9:00 a.m. - 6:00 p.m.; eighteen percent')
    const pick = (u: string) => v.filter((x) => x.unit === u).map((x) => x.value)
    expect(pick('year')).toEqual([2012])
    expect(pick('percent')).toEqual([53, 18])
    expect(pick('times')).toEqual([3])
    expect(pick('currency')).toEqual([10])
    expect(pick('time')).toEqual([9, 18])
  })
  it('분석 글의 값이 원문에 없으면 imageOnly · unavailable, 있으면 exact span', () => {
    const passage = 'The graph shows 2006 and 2012 data. ④ Regarding emails, 2012 was three times higher than 2006.'
    const a = valueAnchors('2006년 29, 2012년 53 이다. 29×3=87', passage, basis)
    const year = a.find((x) => x.value === 2012)!
    expect(year.precision).toBe('exact')
    expect(passage.slice(year.span!.start, year.span!.end)).toBe('2012')
    expect(a.filter((x) => x.imageOnly).map((x) => x.value)).toEqual([29, 53, 29, 87])
  })
  it('①–⑤·[5] 같은 번호 참조는 수치 주장으로 세지 않는다', () => {
    expect(valueAnchors('[5]의 배수 주장 ③', 'x', basis)).toEqual([])
  })
})

describe('choiceKeys — 한국어 안내문 선지', () => {
  it('조건 단서와 수치를 읽는다', () => {
    const k = choiceKeys('12세 미만의 어린이는 입장료가 $5이다.')
    expect(k.cues).toEqual(expect.arrayContaining(['age', 'fee']))
    expect(k.values.map((v) => v.value)).toEqual(expect.arrayContaining([12, 5]))
  })
})
