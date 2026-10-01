// apps/web/src/lib/csat/diagnosis/engine/__tests__/exam-report.test.ts
//
// 시험 기록만으로 나오는 진단 — 점수 흐름 · 유형별 정답률 · 최근 변화 · 오답 함정 · 다시 푼 기출 제외.

import { describe, expect, it } from 'vitest'

import { buildExamReport, LISTENING_TYPE, type ReportItem, type ReportSession } from '../exam-report'

function items(examId: string): Record<number, ReportItem> {
  const out: Record<number, ReportItem> = {}
  for (let no = 18; no <= 45; no++) {
    out[no] = { no, itemId: `${examId}#${no}`, typeId: no <= 31 ? 'R-BLANK' : 'R-ORDER', traps: { 1: '인과 역전', 2: '어휘 함정' } }
  }
  return out
}

function session(id: string, examId: string, takenAt: string, wrong: number[], mode: 'live' | 'retake' = 'live', chosenWrong = 1): ReportSession {
  return {
    id,
    examId,
    examLabel: examId,
    takenAt,
    createdAt: `${takenAt}T00:00:00Z`,
    mode,
    raw: 100 - wrong.length * 2,
    grade: null,
    answers: Array.from({ length: 45 }, (_, i) => ({ no: i + 1, chosen: wrong.includes(i + 1) ? chosenWrong : 3, correct: !wrong.includes(i + 1) })),
  }
}

const FAM = { '인과 역전': 'C4', '어휘 함정': 'C1' }

describe('buildExamReport', () => {
  it('점수 흐름은 응시일 순, 최신 시험과 직전 live 의 차이를 낸다', () => {
    const r = buildExamReport(
      [session('b', 'B', '2026-09-01', [20]), session('a', 'A', '2026-06-01', [20, 21, 22])],
      { A: items('A'), B: items('B') },
      FAM,
    )
    expect(r.trend.map((t) => t.sessionId)).toEqual(['a', 'b'])
    expect(r.latest).toMatchObject({ sessionId: 'b', raw: 98, delta: 4 })
  })

  it('유형별 정답률과 최근/이전 비교, 듣기는 1~17 로 센다', () => {
    const r = buildExamReport(
      [session('a', 'A', '2026-06-01', [32, 33, 34, 35]), session('b', 'B', '2026-09-01', [32, 1])],
      { A: items('A'), B: items('B') },
      FAM,
    )
    const order = r.types.find((t) => t.typeId === 'R-ORDER')!
    expect(order).toMatchObject({ answered: 28, correct: 23, before: Math.round((10 / 14) * 1000) / 1000, latest: Math.round((13 / 14) * 1000) / 1000 })
    expect(r.weakest[0].typeId).toBe('R-ORDER')
    expect(r.types.find((t) => t.typeId === LISTENING_TYPE)?.answered).toBe(34)
    expect(r.sections.listening).toBe(Math.round((33 / 34) * 1000) / 1000)
  })

  it('다시 푼 기출은 점수 흐름에만 있고 유형 진단에서는 빠진다', () => {
    const r = buildExamReport([session('a', 'A', '2026-06-01', [32], 'retake')], { A: items('A') }, FAM)
    expect(r.trend).toHaveLength(1)
    expect(r.types).toEqual([])
    expect(r.totalAnswered).toBe(0)
  })

  it('틀린 답이 끌려간 함정 계열을 센다(계열 없는 라벨은 뺀다)', () => {
    const r = buildExamReport([session('a', 'A', '2026-06-01', [20, 21, 22], 'live', 1)], { A: items('A') }, FAM)
    expect(r.traps).toEqual([{ family: 'C4', count: 3 }])
    expect(r.wrongLatest.map((w) => w.no)).toEqual([20, 21, 22])
    expect(r.wrongLatest[0]).toMatchObject({ itemId: 'A#20', trap: '인과 역전', chosen: 1 })
  })

  it('응답이 적은 유형은 약점으로 부르지 않는다', () => {
    const one: Record<number, ReportItem> = { 18: { no: 18, itemId: 'A#18', typeId: 'R-PURPOSE', traps: {} } }
    const r = buildExamReport([session('a', 'A', '2026-06-01', [18])], { A: one }, FAM, 3)
    expect(r.weakest.find((t) => t.typeId === 'R-PURPOSE')).toBeUndefined()
  })

  it('유형 정보가 없는 독해 문항도 독해 정답률에 넣는다(빼면 정답률이 부풀려진다)', () => {
    const partial: Record<number, ReportItem> = { 18: { no: 18, itemId: 'A#18', typeId: 'R-PURPOSE', traps: {} } }
    const r = buildExamReport([session('a', 'A', '2026-06-01', [19, 20, 21])], { A: partial }, FAM)
    expect(r.sections.reading).toBe(Math.round((25 / 28) * 1000) / 1000)
  })
})
