// apps/web/src/lib/csat/map/__tests__/core.test.ts
//
// 핵심 지도 의미론 — proxy 를 숙달도처럼 말하지 않는다 · 목표와 무관한 후보 · A7 데이터 없음 · 진단을 처방 · Route 미선택.

import { describe, expect, it } from 'vitest'

import { CORE_AXES, CORE_STATUS_LABEL, CURRENT_BASIS, FORBIDDEN_WORDS, NO_DATA_ATTRIBUTES, coreSummary } from '../core'
import { buildMapModel, type MapNodeRow, type MapRaw, type NodeValue } from '../model'

const SETTINGS = { core: { weak: 0.6, watch: 0.8 }, min_coverage: 0.5 }
const v = (achieved: number | null, points = 10, n: number | null = 5): NodeValue => ({
  target: 1, achieved, status: achieved === null ? 'needs_diagnosis' : 'short', coverage: null, n, points,
  tasks: { done: 0, total: 0, rate: null }, habit: null, habitBasis: null, mustItems: [], note: null,
})

describe('coreSummary', () => {
  it('임시 대응 V=A1 · S=A2+A8 · R=A3+A6 · E=A4+A5 · L=A7 · X=A9', () => {
    expect(Object.fromEntries(CORE_AXES.map((a) => [a.code, a.lines]))).toEqual({ V: ['A1'], S: ['A2', 'A8'], R: ['A3', 'A6'], E: ['A4', 'A5'], L: ['A7'], X: ['A9'] })
  })

  it('L(듣기)은 이번 단계에서 관찰값이 있어도 「데이터 없음」 — 0 이나 취약으로 계산하지 않는다', () => {
    expect(NO_DATA_ATTRIBUTES).toContain('A7')
    const s = coreSummary({ nodes: { A7: v(0.1) } }, SETTINGS)
    const L = s.axes.find((a) => a.code === 'L')!
    expect(L.status).toBe('no_data')
    expect(L.observed).toBeNull()
    expect(s.candidates).not.toContain('L')
  })

  it('관찰 수준(낮음 · 중간 · 높음) — 판정 어휘가 아니다 · 근거가 없으면 진단 근거 부족', () => {
    const s = coreSummary({ nodes: { A1: v(0.3), A2: v(0.7), A8: v(null), A3: v(0.9), A6: v(0.9), A4: v(null), A5: v(null) } }, SETTINGS)
    const st = Object.fromEntries(s.axes.map((a) => [a.code, a.status]))
    expect(st).toMatchObject({ V: 'obs_low', S: 'obs_mid', R: 'obs_high', E: 'insufficient', X: 'insufficient' })
  })

  it('진단된 라인 배점이 min_coverage 미만이면 근거 부족', () => {
    const s = coreSummary({ nodes: { A2: v(0.1, 10), A8: v(null, 30) } }, SETTINGS)
    expect(s.axes.find((a) => a.code === 'S')!.status).toBe('insufficient')
  })

  it('우선 확인 후보는 최대 2개(관찰값 낮은 순)이고, V+S 면 둘 중 실제 병목을 구분하는 진단을 처방한다', () => {
    const s = coreSummary({ nodes: { A1: v(0.2), A2: v(0.3), A8: v(0.3), A3: v(0.1), A6: v(0.1) } }, SETTINGS)
    expect(s.candidates).toEqual(['R', 'V'])
    const s2 = coreSummary({ nodes: { A1: v(0.2), A2: v(0.3), A8: v(0.3) } }, SETTINGS)
    expect(s2.candidates).toEqual(['V', 'S'])
    expect(s2.nextDiagnosis).toBe('어휘 · 표현과 문장 이해 중 실제 원인을 구분하기 위한 추가 진단 필요')
  })

  it('근거가 모두 없으면 시험 기록을 더하라는 진단, 후보가 없으면 후보 없음', () => {
    expect(coreSummary({ nodes: {} }, SETTINGS).nextDiagnosis).toContain('진단 근거가 부족')
    expect(coreSummary({ nodes: { A1: v(0.95) } }, SETTINGS).nextDiagnosis).toContain('후보가 없어요')
  })

  it('Route 는 고르지 않는다 — verified_diagnosis 전에는 미정', () => {
    const s = coreSummary({ nodes: { A1: v(0.2) } }, SETTINGS)
    expect(s.route.chosen).toBeNull()
    expect(s.basis).toBe('rule_proxy')
    expect(CURRENT_BASIS).toBe('rule_proxy')
  })

  it('금지 어휘가 상태 라벨 · 진단 문구에 없다', () => {
    for (const label of Object.values(CORE_STATUS_LABEL)) expect(label).not.toMatch(FORBIDDEN_WORDS)
    const texts = ([{},{ A1: v(0.2) }, { A1: v(0.2), A2: v(0.3), A8: v(0.3) }, { A1: v(0.95) }] as Record<string, NodeValue>[]).map((nodes) => coreSummary({ nodes }, SETTINGS).nextDiagnosis)
    for (const t of texts) expect(t).not.toMatch(FORBIDDEN_WORDS)
    expect(Object.values(CORE_STATUS_LABEL)).toEqual(['관찰 낮음', '관찰 중간', '관찰 높음', '진단 근거 부족', '데이터 없음 · 진단 필요'])
  })
})

// ── 목표 점수를 바꿔도 후보가 그대로 · A7 은 모델 단계에서 막힌다 ──
const node = (code: string, kind: MapNodeRow['kind'], extra: Partial<MapNodeRow> = {}): MapNodeRow => ({ code, kind, name: code, axis: null, track: null, summary: null, why: null, signal: null, evidence_status: 'pending', sort: 0, ...extra })
const raw = (goal: number): MapRaw => ({
  nodes: [node('GOAL', 'goal'), node('A', 'axis'), node('A1', 'line', { axis: 'A' }), node('A7', 'line', { axis: 'A' })],
  edges: [],
  tasks: [],
  settings: { default_goal: 100, reference_exams: 6, status: { near: 0.9 }, min_coverage: 0.5, goal_presets: [100], core: { weak: 0.6, watch: 0.8 } },
  goal,
  doneTaskIds: new Set(),
  selection: { exams: [{ id: 'E', label: 'E', held: 1, itemCount: 45, pointsTotal: 100 }], shortfall: 0, skipped: [] },
  itemsByExam: { E: [{ examId: 'E', no: 1, points: 3, errorRate: 0.9 }, { examId: 'E', no: 2, points: 2, errorRate: null }] },
  lineItems: { A1: ['E#1', 'E#2'], A7: ['E#2'] },
  habitLine: {},
  snapshot: { attributePoints: { A1: { n: 9, value: 0.4, status: 'ok' }, A7: { n: 9, value: 0.05, status: 'ok' } }, lineAccuracy: {}, trapAvoidance: {}, habitCodes: [], currentScore: 30, examSessions: 1, responses: 45 },
  noData: ['A7'],
})

describe('모델 연동', () => {
  it('목표 점수를 바꿔도 핵심 후보 · 상태가 그대로(목표율과 무관)', () => {
    const a = coreSummary(buildMapModel(raw(100)), SETTINGS)
    const b = coreSummary(buildMapModel(raw(60)), SETTINGS)
    expect(b.candidates).toEqual(a.candidates)
    expect(b.axes.map((x) => x.status)).toEqual(a.axes.map((x) => x.status))
    expect(a.candidates).toEqual(['V'])
  })

  it('A7 은 모델에서 관찰값 없음 · 「데이터 없음 · 진단 필요」 — 영역 집계에도 안 들어간다', () => {
    const m = buildMapModel(raw(100))
    expect(m.nodes.A7).toMatchObject({ achieved: null, note: '데이터 없음 · 진단 필요' })
    expect(m.nodes.A.achieved).toBeCloseTo(0.4) // A1 만
    expect(m.diagnosisBasis).toBe('rule_proxy')
  })
})
