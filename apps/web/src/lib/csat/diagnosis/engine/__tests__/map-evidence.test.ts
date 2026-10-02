// apps/web/src/lib/csat/diagnosis/engine/__tests__/map-evidence.test.ts
//
// 학습 지도용 성취율 — B(유형) · A(역량) · C(함정)를 연결 문항 배점 가중으로. 시각은 고정 now.

import { describe, expect, it } from 'vitest'

import { computeMapEvidence, type MapLineInput } from '../map-evidence'
import type { EngineInput, EngineSettings, ExamMeta, ItemMeta, ResponseIn, SessionIn } from '../types'

const NOW = new Date('2026-10-01T00:00:00Z')
const TAKEN = '2026-10-01'

const SETTINGS: EngineSettings = {
  grade_cuts: [90, 80, 70, 60, 50, 40, 30, 20],
  half_life_days: 60,
  credit: { sure: 1, unsure: 0.7, guess: 0.3, timeout: 0.3 },
  retake_weight: 0.5,
  min_observations: 2,
  listening: { attribute: 'A7', weight: 2 },
  trap: { min_exposure: 2, vulnerable_ratio: 0.3 },
  habits: {
    time_collapse: { from_no: 41, to_no: 45, ratio: 1.5, timeout_count: 2 },
    guessing: { guess_ratio: 0.15, easy_error_rate: 0.2, easy_wrong_count: 2 },
    word_reuse: { family: 'C1', ratio: 0.4 },
    cutline_90: { sessions: 3, lo: 86, hi: 93 },
    ebs: { gap: 0.2 },
    listening: { to_no: 17, wrong_count: 2, consecutive: 2 },
  },
  reference_exam: null,
  scenario_exams: { hard: null, normal: null, easy: null },
  confidence: { high: { exams: 4, responses: 150 }, medium: { exams: 2, responses: 60 } },
  recommend: { weak_attributes: 2, vulnerable_traps: 1, max_lines: 3 },
  diagnostic_test: { size: 20 },
}

const meta = (examId: string, no: number, extra: Partial<ItemMeta> = {}): ItemMeta => ({
  itemId: `${examId}#${no}`,
  examId,
  no,
  errorRate: null,
  ebsLinked: null,
  attributes: { A3: 1 },
  optionTraps: { 1: 'T-A', 2: 'T-B' },
  ...extra,
})

const resp = (itemNo: number, isCorrect: boolean, extra: Partial<ResponseIn> = {}): ResponseIn => ({
  itemNo,
  itemId: itemNo >= 18 ? `E#${itemNo}` : null,
  chosen: isCorrect ? 5 : 1,
  isCorrect,
  confidence: 'sure',
  ...extra,
})

function build(opts: {
  ready?: boolean
  responses: ResponseIn[]
  mode?: SessionIn['mode']
  settings?: Partial<EngineSettings>
  extraSessions?: SessionIn[]
  extraItems?: Record<string, ItemMeta>
  items?: ItemMeta[]
}): EngineInput {
  const items = opts.items ?? [meta('E', 30), meta('E', 31), meta('E', 32)]
  const exam: ExamMeta = {
    id: 'E',
    ready: opts.ready ?? true,
    key: Array.from({ length: 45 }, (_, i) => ({ no: i + 1, answers: [5], points: i + 1 === 30 ? 3 : 2 })),
    items: Object.fromEntries(items.map((m) => [m.no, m])),
  }
  return {
    now: NOW,
    settings: { ...SETTINGS, ...opts.settings },
    sessions: [{ id: 's1', examId: 'E', mode: opts.mode ?? 'live', takenAt: TAKEN, rawScore: null, responses: opts.responses }, ...(opts.extraSessions ?? [])],
    exams: { E: exam },
    items: opts.extraItems ?? {},
    trapFamily: { 'T-A': 'C1', 'T-B': 'C2' },
    target: null,
  }
}

const POINTS: Record<string, number> = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`E#${i + 1}`, i + 1 === 30 ? 3 : 2]))

const LINES: MapLineInput = {
  byType: { 'R-GIST': 'B6', 'R-TITLE': 'B6' },
  byNo: { E: { 1: 'B1', 2: 'B1', 6: 'B3' } },
  typeOf: { 'E#30': 'R-GIST', 'E#31': 'R-TITLE', 'E#32': null },
  pointsOf: POINTS,
}

describe('B — 유형(배점 가중 정답률)', () => {
  it('듣기는 승인된 번호표(byNo), 독해는 문항 유형(byType)으로 라인을 정한다', () => {
    const ev = computeMapEvidence(build({ responses: [resp(1, true), resp(2, false), resp(6, true), resp(30, true), resp(31, false)] }), LINES)
    expect(ev.lineAccuracy.B1).toMatchObject({ n: 2, value: 0.5, status: 'ok' }) // 2점·2점 중 1
    expect(ev.lineAccuracy.B6.value).toBeCloseTo(3 / 5) // 30번(3점) 맞음 · 31번(2점) 틀림
    expect(ev.lineAccuracy.B3).toMatchObject({ n: 1, value: null, status: 'insufficient' }) // 관측 1 < min 2
  })

  it('diagnosis_ready 가 아닌 시험 기록에서도 B 는 채워지고 A · C 는 비어 있다', () => {
    const ev = computeMapEvidence(build({ ready: false, responses: [resp(30, true), resp(31, true)] }), LINES)
    expect(ev.lineAccuracy.B6.n).toBe(2)
    expect(ev.attributePoints).toEqual({})
    expect(ev.trapAvoidance).toEqual({})
  })

  it('번호표에 없는 회차의 듣기 번호는 어떤 B 라인에도 넣지 않는다', () => {
    const input = build({ responses: [resp(1, true), resp(2, true)] })
    const ev = computeMapEvidence(input, { ...LINES, byNo: {} })
    expect(ev.lineAccuracy).toEqual({})
  })

  it('진단 테스트 응답은 itemNo 가 아니라 문항 메타의 번호로 라인을 정한다(itemNo=1 이 듣기로 새지 않음)', () => {
    const diag: SessionIn = {
      id: 'd1',
      examId: null,
      mode: 'diagnostic',
      takenAt: TAKEN,
      rawScore: null,
      responses: [
        { itemNo: 1, itemId: 'E#30', chosen: 5, isCorrect: true, confidence: 'sure' },
        { itemNo: 2, itemId: 'E#31', chosen: 5, isCorrect: true, confidence: 'sure' },
      ],
    }
    const input = build({ responses: [], extraSessions: [diag], extraItems: { 'E#30': meta('E', 30), 'E#31': meta('E', 31) } })
    const ev = computeMapEvidence(input, LINES)
    expect(ev.lineAccuracy.B1).toBeUndefined()
    expect(ev.lineAccuracy.B6).toMatchObject({ n: 2, value: 1 })
  })

  it('배점을 못 찾은 응답은 가중에서 빠지고 unweighted 로 센다', () => {
    const ev = computeMapEvidence(build({ responses: [resp(30, true), resp(31, true), resp(31, false)] }), { ...LINES, pointsOf: { 'E#30': 3 } })
    expect(ev.lineAccuracy.B6).toMatchObject({ n: 1, unweighted: 2, status: 'insufficient' })
  })

  it('retake_weight=0 인 재응시는 관측 건수에서도 빠진다 — 재응시로 부족분을 채우지 못한다', () => {
    const retake: SessionIn = { id: 'r1', examId: 'E', mode: 'retake', takenAt: TAKEN, rawScore: null, responses: [resp(30, true), resp(31, true)] }
    const input = build({ responses: [resp(30, true)], extraSessions: [retake], settings: { retake_weight: 0 } })
    expect(computeMapEvidence(input, LINES).lineAccuracy.B6).toMatchObject({ n: 1, status: 'insufficient' })
  })
})

describe('A — 역량(연결 문항 배점 가중)', () => {
  it('weight>0 로 연결된 문항의 배점 가중 정답률이다', () => {
    const ev = computeMapEvidence(build({ responses: [resp(30, true), resp(31, false), resp(32, true)] }), LINES)
    expect(ev.attributePoints.A3).toMatchObject({ n: 3, status: 'ok' })
    expect(ev.attributePoints.A3.value).toBeCloseTo(5 / 7) // 3점 맞음 + 2점 틀림 + 2점 맞음
  })

  it('듣기는 설정이 가리키는 역량에만, weight=0 이면 어디에도 안 간다', () => {
    const on = computeMapEvidence(build({ responses: [resp(1, true), resp(2, true)] }), LINES)
    expect(on.attributePoints.A7).toMatchObject({ n: 2, value: 1 })
    const off = computeMapEvidence(build({ responses: [resp(1, true), resp(2, true)], settings: { listening: { attribute: 'A7', weight: 0 } } }), LINES)
    expect(off.attributePoints.A7).toBeUndefined()
  })
})

describe('C — 함정 비선택률', () => {
  it('그 계열 함정 선지가 있는 문항에서 그 함정을 고르지 않은 배점 비율', () => {
    // 30번(3점): 함정 T-A(C1) 선택 오답 · 31번(2점): 정답 · 32번(2점): T-B(C2) 선택 오답
    const ev = computeMapEvidence(
      build({ responses: [resp(30, false, { chosen: 1 }), resp(31, true), resp(32, false, { chosen: 2 })] }),
      LINES,
    )
    expect(ev.trapAvoidance.C1.value).toBeCloseTo(4 / 7) // 30번(3점)에서 걸림, 31번(2점) 정답 · 32번(2점)은 C2 를 골라 C1 은 피함
    expect(ev.trapAvoidance.C2.value).toBeCloseTo(5 / 7)
  })

  it('무응답 · 시간 초과로 비운 답은 피한 것으로 세지 않는다(빈 답안만 제출해도 성취율이 오르지 않음)', () => {
    const blanks = [resp(30, false, { chosen: null }), resp(31, false, { chosen: null }), resp(32, false, { chosen: 1, confidence: 'timeout' })]
    const ev = computeMapEvidence(build({ responses: blanks }), LINES)
    expect(ev.trapAvoidance).toEqual({})
  })

  it('노출이 trap.min_exposure 미만이면 값 대신 근거 부족', () => {
    const ev = computeMapEvidence(build({ responses: [resp(30, true)] }), LINES)
    expect(ev.trapAvoidance.C1).toMatchObject({ n: 1, value: null, status: 'insufficient' })
  })
})
