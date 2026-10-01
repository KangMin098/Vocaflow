// apps/web/src/lib/csat/diagnosis/engine/__tests__/rule-v1.test.ts
//
// 진단 엔진 rule-v1 의 규칙을 잠근다 — 지시문 「진단 엔진」 1~8 + 미태깅 시험은 점수만.
// 시각은 고정 now 를 넘긴다(시계를 직접 읽지 않는다).

import { describe, expect, it } from 'vitest'

import {
  attributeMastery,
  currentAbility,
  diagnose,
  habitFlags,
  trapVulnerability,
} from '../rule-v1'
import { adjustScore, expectedScore, gradeOf, scoreAnswers } from '../scoring'
import type { EngineInput, EngineSettings, ExamMeta, ItemMeta, KeyRow, ResponseIn, SessionIn } from '../types'

const NOW = new Date('2026-10-01T00:00:00Z')

const SETTINGS: EngineSettings = {
  grade_cuts: [90, 80, 70, 60, 50, 40, 30, 20],
  half_life_days: 60,
  credit: { sure: 1, unsure: 0.7, guess: 0.3, timeout: 0.3 },
  retake_weight: 0.5,
  min_observations: 5,
  listening: { attribute: 'A7', weight: 2 },
  trap: { min_exposure: 5, vulnerable_ratio: 0.3 },
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

/** 45문항 · 1~17 듣기 · 18~45 독해. 3점 문항 10개로 배점 합 100 */
function key(): KeyRow[] {
  return Array.from({ length: 45 }, (_, i) => ({ no: i + 1, answers: [((i % 5) + 1)], points: [20, 21, 29, 30, 32, 33, 34, 37, 38, 39].includes(i + 1) ? 3 : 2 }))
}

function exam(id: string, opts: { ready?: boolean; errorRate?: (no: number) => number | null; traps?: Record<number, string> } = {}): ExamMeta {
  const items: Record<number, ItemMeta> = {}
  for (let no = 18; no <= 45; no++) {
    items[no] = {
      itemId: `${id}#${no}`,
      examId: id,
      no,
      errorRate: opts.errorRate ? opts.errorRate(no) : null,
      ebsLinked: null,
      attributes: { A3: 2, A4: 1 },
      optionTraps: opts.traps ?? {},
    }
  }
  return { id, ready: opts.ready ?? true, key: key(), items }
}

function responses(wrongNos: number[] = [], flags: Record<number, ResponseIn['confidence']> = {}, chosenWrong = 0): ResponseIn[] {
  return key().map((k) => {
    const wrong = wrongNos.includes(k.no)
    const right = k.answers[0]
    return {
      itemNo: k.no,
      itemId: k.no >= 18 ? `X#${k.no}` : null,
      chosen: wrong ? (chosenWrong || (right % 5) + 1) : right,
      isCorrect: !wrong,
      confidence: flags[k.no] ?? 'sure',
    }
  })
}

function session(id: string, examId: string | null, takenAt: string, rs: ResponseIn[], mode: SessionIn['mode'] = 'live'): SessionIn {
  const k = key()
  const raw = rs.reduce((s, r) => s + (r.isCorrect ? k[r.itemNo - 1].points : 0), 0)
  return { id, examId, mode, takenAt, rawScore: examId ? raw : null, responses: rs }
}

function input(over: Partial<EngineInput>): EngineInput {
  return { now: NOW, settings: SETTINGS, sessions: [], exams: {}, items: {}, trapFamily: {}, target: null, ...over }
}

describe('1. 채점 · 등급', () => {
  it('비운 문항은 오답, 표시는 점수를 바꾸지 않는다', () => {
    const k = key()
    const choices: Record<number, number | null> = {}
    for (const r of k) choices[r.no] = r.answers[0]
    choices[1] = null
    choices[20] = 4 // 20번 정답은 5
    const s = scoreAnswers(k, choices, { 2: 'guess' })
    expect(s.max).toBe(100)
    expect(s.raw).toBe(100 - 2 - 3)
    expect(s.answers[1].confidence).toBe('guess')
    expect(s.answers[1].isCorrect).toBe(true)
  })
  it('복수 정답 문항은 어느 정답이든 맞다', () => {
    const s = scoreAnswers([{ no: 1, answers: [2, 4], points: 2 }], { 1: 4 })
    expect(s.raw).toBe(2)
  })
  it('고정 컷 90/80/…/20', () => {
    expect(gradeOf(90, SETTINGS.grade_cuts)).toBe(1)
    expect(gradeOf(89, SETTINGS.grade_cuts)).toBe(2)
    expect(gradeOf(19, SETTINGS.grade_cuts)).toBe(9)
    expect(gradeOf(null, SETTINGS.grade_cuts)).toBeNull()
  })
})

describe('2. 난이도 보정', () => {
  it('오답률이 없는 문항은 시험 평균으로 채운다', () => {
    const e = exam('E', { errorRate: (no) => (no === 18 ? 0.5 : null) })
    // 모든 문항이 0.5 로 채워진다 → E = 100 × 0.5
    expect(expectedScore(e)).toBeCloseTo(50)
  })
  it('오답률이 하나도 없으면 보정하지 않는다(adjusted=false)', () => {
    expect(expectedScore(exam('E'))).toBeNull()
    expect(adjustScore(80, exam('E'), exam('R', { errorRate: () => 0.3 }))).toEqual({ value: 80, adjusted: false })
  })
  it('보정 점수 = 원점수 − E(시험) + E(기준)', () => {
    const hard = exam('H', { errorRate: () => 0.4 }) // E = 60
    const ref = exam('R', { errorRate: () => 0.3 }) // E = 70
    expect(adjustScore(75, hard, ref)).toEqual({ value: 85, adjusted: true })
  })
  it('현재 능력은 live 보정 점수의 시간 가중 평균(반감기 60일)', () => {
    const exams = { A: exam('A'), B: exam('B') }
    const sessions = [
      { ...session('s1', 'A', '2026-08-02', responses()), rawScore: 60 }, // 60일 전 → 가중 0.5
      { ...session('s2', 'B', '2026-10-01', responses()), rawScore: 90 }, // 오늘 → 가중 1
    ]
    const a = currentAbility(input({ exams, sessions }))
    expect(a.ability).toBeCloseTo((60 * 0.5 + 90) / 1.5, 1)
    expect(a.adjusted).toBe(false)
  })
  it('보정된 회차와 안 된 회차를 섞어 평균하지 않는다 — 하나라도 안 되면 전부 원점수', () => {
    const exams = { R: exam('R', { errorRate: () => 0.3 }), H: exam('H', { errorRate: () => 0.5 }), N: exam('N') }
    const settings = { ...SETTINGS, reference_exam: 'R' }
    const sessions = [
      { ...session('a', 'H', '2026-10-01', responses()), rawScore: 80 }, // 보정하면 100
      { ...session('b', 'N', '2026-10-01', responses()), rawScore: 80 }, // 오답률 없음
    ]
    const a = currentAbility(input({ exams, settings, sessions }))
    expect(a).toEqual({ ability: 80, adjusted: false, fromDiagnostic: false })
    const r = diagnose(input({ exams, settings, sessions }))
    expect(r.trend.find((t) => t.sessionId === 'b')?.adjusted).toBeNull()
  })
  it('진단 테스트만 있으면 정답률로 추정한다', () => {
    const item: ItemMeta = { itemId: 'P#1', examId: 'P', no: 30, errorRate: null, ebsLinked: null, attributes: { A1: 2 }, optionTraps: {} }
    const rs: ResponseIn[] = Array.from({ length: 4 }, (_, i) => ({ itemNo: i + 1, itemId: 'P#1', chosen: 1, isCorrect: i < 3, confidence: 'sure' }))
    const a = currentAbility(input({ items: { 'P#1': item }, sessions: [session('d', null, '2026-10-01', rs, 'diagnostic')] }))
    expect(a).toEqual({ ability: 75, adjusted: false, fromDiagnostic: true })
  })
})

describe('3. 역량 숙달도', () => {
  it('credit 와 retake 가중치를 반영하고, 관측 5건 미만은 데이터 부족', () => {
    const e = exam('A')
    const rs = responses([18], { 19: 'unsure', 20: 'guess' })
    const m = attributeMastery(input({ exams: { A: e }, sessions: [session('s', 'A', '2026-10-01', rs)] }))
    // 18~45 28문항: 18 오답(0) · 19 unsure(0.7) · 20 guess(0.3) · 나머지 25문항 1.0
    expect(m.A3.value).toBeCloseTo((0 + 0.7 + 0.3 + 25) / 28, 3)
    expect(m.A3.status).toBe('ok')
    expect(m.A7.n).toBe(17) // 듣기는 설정의 A7 가중치로 들어간다
    expect(m.A1).toEqual({ value: null, n: 0, status: 'insufficient' })
  })
  it('diagnosis_ready 가 아닌 시험은 역량에서 빠진다(점수는 남는다)', () => {
    const inp = input({ exams: { A: exam('A', { ready: false }) }, sessions: [session('s', 'A', '2026-10-01', responses([18]))] })
    const r = diagnose(inp)
    expect(r.attributeMastery.A3.status).toBe('insufficient')
    expect(r.rawScore).toBe(98)
    expect(r.gradeEst).toBe(1)
    expect(r.evidence.scoreOnlySessions).toBe(1)
  })
  it('retake 는 0.5 배로 센다', () => {
    const e = exam('A')
    const live = session('l', 'A', '2026-10-01', responses())
    const retake = session('r', 'A', '2026-10-01', responses(Array.from({ length: 28 }, (_, i) => i + 18)), 'retake')
    const m = attributeMastery(input({ exams: { A: e }, sessions: [live, retake] }))
    expect(m.A3.value).toBeCloseTo(1 / 1.5, 3)
  })
})

describe('4. 함정 취약도', () => {
  it('노출 5회 이상 · 비율 0.3 이상이면 취약', () => {
    const traps = { 1: '인과 역전', 2: '어휘 함정' }
    const e = exam('A', { traps })
    // 18~45 중 10문항을 1번(인과 역전)으로 틀린다
    const rs = responses([18, 19, 20, 21, 22, 23, 24, 25, 26, 27], {}, 1).map((r) => (r.isCorrect || r.itemNo < 18 ? r : { ...r, chosen: 1 }))
    // 정답이 1번인 문항은 1번을 고르면 맞으므로 제외된다 — 오답 표시는 isCorrect 로 판정
    const t = trapVulnerability(input({ exams: { A: e }, sessions: [session('s', 'A', '2026-10-01', rs)], trapFamily: { '인과 역전': 'C4', '어휘 함정': 'C1' } }))
    expect(t.C4?.exposure).toBe(28)
    expect(t.C4?.picked).toBe(10)
    expect(t.C4?.vulnerable).toBe(true)
    expect(t.C1?.picked).toBe(0)
    expect(t.C4?.items).toContain('A#18')
  })
  it('계열이 없는 라벨은 세지 않는다', () => {
    const e = exam('A', { traps: { 1: '국소 어색함' } })
    const t = trapVulnerability(input({ exams: { A: e }, sessions: [session('s', 'A', '2026-10-01', responses())], trapFamily: { '국소 어색함': null } }))
    expect(t).toEqual({})
  })
})

describe('5. 습관 신호', () => {
  const run = (sessions: SessionIn[], exams: Record<string, ExamMeta> = { A: exam('A'), B: exam('B'), C: exam('C') }, trapFamily = {}) =>
    habitFlags(input({ sessions, exams, trapFamily })).map((f) => f.code)

  it('시간 붕괴 — 41~45 오답률이 전체의 1.5배 이상', () => {
    expect(run([session('s', 'A', '2026-10-01', responses([41, 42, 43, 20]))])).toContain('time_collapse')
    expect(run([session('s', 'A', '2026-10-01', responses([18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 41]))])).not.toContain('time_collapse')
  })
  it('시간 붕괴 — timeout 2개 이상', () => {
    expect(run([session('s', 'A', '2026-10-01', responses([], { 30: 'timeout', 31: 'timeout' }))])).toContain('time_collapse')
  })
  it('추측 풀이 — guess 15% 이상', () => {
    const flags = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 18, 'guess' as const]))
    expect(run([session('s', 'A', '2026-10-01', responses([], flags))])).toContain('guessing')
  })
  it('추측 풀이 — 쉬운 문항(오답률 20% 미만) 오답 2개 이상', () => {
    const e = { A: exam('A', { errorRate: () => 0.1 }) }
    expect(run([session('s', 'A', '2026-10-01', responses([18, 19]))], e)).toContain('guessing')
  })
  it('90점 커트라인 — 최근 live 3회 모두 86~93', () => {
    const s = (id: string, d: string, raw: number) => ({ ...session(id, 'A', d, responses()), rawScore: raw })
    expect(run([s('1', '2026-07-01', 88), s('2', '2026-08-01', 91), s('3', '2026-09-01', 86)])).toContain('cutline_90')
    expect(run([s('1', '2026-07-01', 88), s('2', '2026-08-01', 95), s('3', '2026-09-01', 86)])).not.toContain('cutline_90')
  })
  it('듣기 소홀 — 1~17 오답 2개 이상이 2회 연속', () => {
    expect(run([session('1', 'A', '2026-08-01', responses([1, 2])), session('2', 'B', '2026-09-01', responses([3, 4]))])).toContain('listening')
    expect(run([session('1', 'A', '2026-08-01', responses([1, 2])), session('2', 'B', '2026-09-01', responses([3]))])).not.toContain('listening')
  })
  it('단어 재활용 편중 — 오답 중 C1 비율 40% 이상', () => {
    const e = { A: exam('A', { traps: { 1: '어휘 함정', 2: '어휘 함정', 3: '어휘 함정', 4: '어휘 함정', 5: '어휘 함정' } }) }
    expect(run([session('s', 'A', '2026-10-01', responses([18, 19, 20, 21, 22]))], e, { '어휘 함정': 'C1' })).toContain('word_reuse')
  })
  it('EBS 의존 — 연계 정답률 − 비연계 정답률 ≥ 20%p', () => {
    const e = exam('A')
    for (let no = 18; no <= 45; no++) e.items[no].ebsLinked = no <= 31
    const wrongUnlinked = [32, 33, 34, 35, 36, 37, 38]
    expect(run([session('s', 'A', '2026-10-01', responses(wrongUnlinked))], { A: e })).toContain('ebs')
  })
})

describe('6~8. 시나리오 · 추천 · 신뢰도', () => {
  it('시나리오는 기준 시험 대비 보정해 등급과 목표 충족을 낸다', () => {
    const exams = {
      R: exam('R', { errorRate: () => 0.3 }), // E 70
      H: exam('H', { errorRate: () => 0.45 }), // E 55
      N: exam('N', { errorRate: () => 0.3 }),
      Y: exam('Y', { errorRate: () => 0.2 }), // E 80
    }
    const settings = { ...SETTINGS, reference_exam: 'R', scenario_exams: { hard: 'H', normal: 'N', easy: 'Y' } }
    const sessions = [{ ...session('s', 'R', '2026-10-01', responses()), rawScore: 85 }]
    const r = diagnose(input({ exams, settings, sessions, target: { grade: 2 } }))
    expect(r.ability).toBe(85)
    expect(r.forecast.hard).toMatchObject({ expected: 70, grade: 3, meetsTarget: false, adjusted: true })
    expect(r.forecast.normal).toMatchObject({ expected: 85, grade: 2, meetsTarget: true })
    expect(r.forecast.easy).toMatchObject({ expected: 95, grade: 1, meetsTarget: true })
  })
  it('기준·시나리오 시험의 기대점수가 없으면 난이도별 예측을 하지 않는다(능력을 그대로 베끼지 않는다)', () => {
    const r = diagnose(input({ exams: { A: exam('A') }, sessions: [{ ...session('s', 'A', '2026-10-01', responses()), rawScore: 80 }], target: { grade: 2 } }))
    expect(r.forecast.hard).toEqual({ examId: null, expected: null, grade: null, meetsTarget: null, adjusted: false })
  })
  it('100 을 넘는 보정 능력도 시나리오 역변환에서 원래 값으로 돌아온다(일찍 자르지 않는다)', () => {
    const exams = { E: exam('E', { errorRate: () => 0.5 }), R: exam('R', { errorRate: () => 0.2 }) } // E 50 · R 80
    const settings = { ...SETTINGS, reference_exam: 'R', scenario_exams: { hard: 'E', normal: 'R', easy: 'R' } }
    const r = diagnose(input({ exams, settings, sessions: [{ ...session('s', 'E', '2026-10-01', responses()), rawScore: 90 }], target: { grade: 1 } }))
    expect(r.ability).toBe(100) // 표시는 자른다(내부 120)
    expect(r.forecast.hard).toMatchObject({ expected: 90, grade: 1, meetsTarget: true })
  })
  it('추천은 최대 3개, 약한 역량 → 취약 함정 → 습관 순', () => {
    const traps = { 1: '인과 역전' }
    const e = exam('A', { traps })
    for (let no = 18; no <= 45; no++) e.items[no].attributes = no < 32 ? { A1: 2 } : { A2: 2 }
    const wrong = [18, 19, 20, 21, 22, 23, 24, 41, 42, 43]
    const rs = responses(wrong).map((r) => (wrong.includes(r.itemNo) ? { ...r, chosen: 1 } : r))
    const r = diagnose(input({ exams: { A: e }, sessions: [session('s', 'A', '2026-10-01', rs)], trapFamily: { '인과 역전': 'C4' } }))
    expect(r.recommendedLines.length).toBe(3)
    expect(r.recommendedLines[0].code).toBe('ATTR:A1')
    expect(r.recommendedLines[1].code).toBe('TRAP:C4')
    expect(r.recommendedLines[2].code).toBe('HABIT:time_collapse')
  })
  it('신뢰도 — 진단 테스트만 있으면 낮음, 시험 4회·150응답 이상이면 높음', () => {
    const item: ItemMeta = { itemId: 'P#1', examId: 'P', no: 30, errorRate: null, ebsLinked: null, attributes: { A1: 2 }, optionTraps: {} }
    const d = diagnose(input({ items: { 'P#1': item }, sessions: [session('d', null, '2026-10-01', [{ itemNo: 1, itemId: 'P#1', chosen: 1, isCorrect: true, confidence: 'sure' }], 'diagnostic')] }))
    expect(d.confidence).toBe('low')
    const exams = { A: exam('A'), B: exam('B'), C: exam('C'), D: exam('D') }
    const sessions = ['A', 'B', 'C', 'D'].map((x, i) => session(x, x, `2026-09-0${i + 1}`, responses()))
    const h = diagnose(input({ exams, sessions }))
    // A1·A2·A5·A6·A8·A9 가 관측 0 → 9개 중 6개 부족이라 높음에서 보통으로 내린다
    expect(h.confidence).toBe('medium')
  })
})
