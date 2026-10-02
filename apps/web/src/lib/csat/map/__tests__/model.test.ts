// apps/web/src/lib/csat/map/__tests__/model.test.ts
//
// 모델 조립 — 라인 상태 · 집계 · 목표 변경 시 재계산 · 진단 없음 · 연결 문항 없음 · 과제 완료율 · 습관 신호.

import { describe, expect, it } from 'vitest'

import { buildMapModel, type MapNodeRow, type MapRaw } from '../model'
import { itemKey, type RefItem } from '../target'

const node = (code: string, kind: MapNodeRow['kind'], extra: Partial<MapNodeRow> = {}): MapNodeRow => ({
  code, kind, name: code, axis: null, track: null, summary: null, why: null, signal: null, evidence_status: 'pending', sort: 0, ...extra,
})

const item = (no: number, points: number, errorRate: number | null): RefItem => ({ examId: 'E', no, points, errorRate })
// 시험 E 의 문항: 1번 3점(오답률 .9) · 2번 3점(.8) · 3번 2점(.1) · 4번 2점(미관측)
const ITEMS = [item(1, 3, 0.9), item(2, 3, 0.8), item(3, 2, 0.1), item(4, 2, null)]
const K = (no: number) => itemKey({ examId: 'E', no })

function raw(over: Partial<MapRaw> = {}): MapRaw {
  return {
    nodes: [
      node('GOAL', 'goal'), node('A', 'axis'), node('D', 'axis'), node('T1', 'track'), node('P1', 'principle'),
      node('A1', 'line', { axis: 'A', track: 'T1' }), node('A2', 'line', { axis: 'A', track: 'T1' }), node('A3', 'line', { axis: 'A', track: 'T1' }),
      node('D1', 'line', { axis: 'D', track: 'T1' }),
    ],
    edges: [{ id: 1, from_code: 'A1', to_code: 'P1', kind: 'reason', basis: 'pending' }],
    tasks: [
      { id: 'D1-1', line_code: 'D1', ord: 1, title: 't', how: 'h', cadence: 'c', done_when: 'd', material: 'past', method_line: null },
      { id: 'D1-2', line_code: 'D1', ord: 2, title: 't', how: 'h', cadence: 'c', done_when: 'd', material: 'past', method_line: null },
    ],
    settings: { default_goal: 100, reference_exams: 6, status: { near: 0.9 }, min_coverage: 0.5, goal_presets: [100, 90] },
    goal: null,
    doneTaskIds: new Set(['D1-1']),
    selection: { exams: [{ id: 'E', label: 'E', held: 202606, itemCount: 45, pointsTotal: 100 }], shortfall: 0, skipped: [] },
    itemsByExam: { E: ITEMS },
    // A1 = 1·2번(6점) · A2 = 3·4번(4점) · A3 = 연결 문항 없음
    lineItems: { A1: [K(1), K(2)], A2: [K(3), K(4)], A3: [], D1: [] },
    habitLine: { listening: 'D1' },
    snapshot: {
      attributePoints: { A1: { n: 5, value: 1, status: 'ok' }, A2: { n: 5, value: 0.5, status: 'ok' } },
      lineAccuracy: {}, trapAvoidance: {}, habitCodes: ['listening'], currentScore: 71, examSessions: 2, responses: 90,
    },
    ...over,
  }
}

describe('buildMapModel', () => {
  it('목표 100: 라인 목표율 100% — 성취가 같으면 달성, 낮으면 미달', () => {
    const m = buildMapModel(raw())
    expect(m.goal).toBe(100)
    expect(m.nodes.A1).toMatchObject({ target: 1, achieved: 1, status: 'met', n: 5 })
    expect(m.nodes.A2).toMatchObject({ target: 1, achieved: 0.5, status: 'short' })
  })

  it('목표를 낮추면(95) 오답률 높은 문항이 놓쳐도 됨 — 라인 목표율이 내려간다', () => {
    const m = buildMapModel(raw({ goal: 94 })) // L=6 → 1번(3점) · 2번(3점) 놓쳐도 됨
    expect(m.nodes.A1.target).toBe(0)
    expect(m.nodes.A1.mustItems).toEqual([])
    expect(m.nodes.A2.target).toBe(1) // 3번 · 4번은 반드시
    expect(m.goal).toBe(94)
  })

  it('연결 문항이 없는 라인은 「연결 문항 없음」 — 진단이 있어도 상태를 만들지 않는다', () => {
    expect(buildMapModel(raw()).nodes.A3).toMatchObject({ target: null, status: 'no_items', note: '연결 문항 없음' })
  })

  it('스냅샷이 없으면 진단 필요, 근거 부족이면 관측 부족', () => {
    expect(buildMapModel(raw({ snapshot: null })).nodes.A1).toMatchObject({ achieved: null, status: 'needs_diagnosis', note: '진단 필요' })
    const m = buildMapModel(raw({ snapshot: { ...raw().snapshot!, attributePoints: { A1: { n: 1, value: null, status: 'insufficient' } } } }))
    expect(m.nodes.A1).toMatchObject({ status: 'needs_diagnosis', note: '관측 부족', n: 1 })
  })

  it('영역 집계: 목표 눈금은 전체 라인 배점 가중, 채움은 진단된 라인', () => {
    const m = buildMapModel(raw())
    // A1(6점·목표 1) A2(4점·목표 1) A3(0점 제외) → 목표 1, 채움 = (6·1 + 4·.5)/10 = .8
    expect(m.nodes.A.target).toBeCloseTo(1)
    expect(m.nodes.A.achieved).toBeCloseTo(0.8)
    expect(m.nodes.A.coverage).toBe(1)
    expect(m.nodes.A.status).toBe('short') // 전부 진단 · 0.8 < 0.9
    expect(m.nodes.GOAL.target).toBeCloseTo(1)
  })

  it('과제 전용 노드(D 영역)는 진단 지표 없이 완료율 — 습관 신호는 활성/미관측', () => {
    const m = buildMapModel(raw())
    expect(m.nodes.D1).toMatchObject({ status: 'tasks_only', habit: 'active', tasks: { done: 1, total: 2, rate: 0.5 } })
    expect(m.nodes.D).toMatchObject({ status: 'tasks_only', target: null, tasks: { done: 1, total: 2 } })
    expect(buildMapModel(raw({ snapshot: null })).nodes.D1.habit).toBeNull()
  })

  it('습관 신호 3상태 — 신호 있음 · 해소됨(평가 가능 + 신호 없음) · 판단 불가(평가 불가 · 옛 스냅샷)', () => {
    const snap = (habitCodes: string[], habitEvaluable?: Record<string, { evaluable: boolean; n: number; need: number }>) => raw({ snapshot: { ...raw().snapshot!, habitCodes, habitEvaluable } })
    const ev = (evaluable: boolean) => ({ listening: { evaluable, n: 2, need: 2 } })
    expect(buildMapModel(snap(['listening'], ev(false))).nodes.D1.habit).toBe('active') // 신호가 있으면 평가 가능 여부와 무관
    expect(buildMapModel(snap([], ev(true))).nodes.D1).toMatchObject({ habit: 'resolved', habitBasis: { n: 2, need: 2 } })
    expect(buildMapModel(snap([], ev(false))).nodes.D1.habit).toBe('unknown')
    expect(buildMapModel(snap([], undefined)).nodes.D1.habit).toBe('unknown') // 키 없는 옛 스냅샷
    expect(buildMapModel(snap(['listening'], undefined)).nodes.D1.habit).toBe('active') // 옛 스냅샷의 활성 신호는 유지
  })

  it('집계 노드는 연결 라인이 저장한 관측 건수의 합을 가진다(중복 포함), 건수가 없으면 null', () => {
    const m = buildMapModel(raw())
    expect(m.nodes.A.n).toBe(10) // A1(5) + A2(5), A3 는 건수 없음
    expect(m.nodes.GOAL.n).toBe(10)
    expect(m.nodes.D.n).toBeNull() // 과제 전용 — 관측 건수 없음
  })

  it('1999/2000 처럼 만점에 못 미치는 성취율은 만점 목표에서 달성이 아니다', () => {
    const m = buildMapModel(raw({ snapshot: { ...raw().snapshot!, attributePoints: { A1: { n: 5, value: 1999 / 2000, status: 'ok' } } } }))
    expect(m.nodes.A1.target).toBe(1)
    expect(m.nodes.A1.status).toBe('near') // 99.95% — 달성(met)이 아니다
  })

  it('원리 집계는 reason 연결선으로 이어진 라인만', () => {
    const m = buildMapModel(raw())
    expect(m.nodes.P1.target).toBeCloseTo(1) // A1 만
    expect(m.nodes.P1.achieved).toBeCloseTo(1)
  })

  it('기준 시험 정보와 오답률 결측 · 과대 추정 표시를 싣는다', () => {
    const m = buildMapModel(raw({ goal: 90 }), { E: '2027학년도 6월 모의평가' })
    expect(m.reference.exams).toEqual([{ id: 'E', label: '2027학년도 6월 모의평가' }])
    expect(m.missingRate).toBe(1)
    expect(typeof m.mayOverstate).toBe('boolean')
    expect(m.currentScore).toBe(71)
  })
})
