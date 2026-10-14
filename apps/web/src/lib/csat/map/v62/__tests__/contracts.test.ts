// apps/web/src/lib/csat/map/v62/__tests__/contracts.test.ts
// 학습지도 v6.2 P-M0 계약 · 가드 — 합성 fixture(고정 시각). 실제 학습자의 능력 · 학습 효과의 증거가 아니다.
import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'

import { asIsMap, type AxisProxyState } from '../../v4/as-is'
import type { V4View } from '../../v4/compose'
import { DOMAINS, linesOfTask, tasks, type Domain } from '../../v4/definition'
import { allTaskPlans, workspacePlan } from '../../v4/plan'
import { toBeMap, type ConfirmLink } from '../../v4/to-be'
import { planWorkspaces } from '../../v4/workspace'

import { GAP_CODES, LEDGERS, goalCoverageLedger } from '../coverage'
import { domainTaskGraph, taskInspector } from '../graph'
import { CURRENT_ENGLISH_BLUEPRINT, coverageRatio, examInventoryCoverage } from '../inventory'
import { ranksOf } from '../rank'
import { makeLink, relevanceCounts, relevanceOf } from '../relevance'
import { savedTargetFields, targetSpecOf, unsavedTargetFields } from '../target-spec'

const KEY = 'claim-support'
const TASK = 'r.central_meaning'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}?check=1#principle`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const day = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString()
const att = (itemRef: string, ok: boolean, d: number): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: day(d), activity: 'theater' })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
// B6 · A5 만 기준 시험 문항과 연결 — 나머지 라인 TASK 는 「연결 없음 = 관련성 미확인」
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34) }

function view(attempts: FindAttemptRow[], asOfDay: number, goalSet = true): V4View {
  const asIs = asIsMap({ asOf: day(asOfDay), sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-08-20', enteredAt: '2026-08-21T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts })
  const toBe = toBeMap({ asIs, goal: { score: 80, set: goalSet }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs, toBe, confirmLinks: links, transferItems: { [KEY]: 4 }, transferTargets: { [KEY]: ['t1', 't2'].map((i) => ({ target: i, href: `/csat/practice/claim-support?item=${i}`, label: '다른 글에 적용' })) } })
  const plans = Object.fromEntries([plan.primary, ...plan.others].filter((w): w is NonNullable<typeof w> => !!w).map((w) => [w.id, workspacePlan(w, asIs, toBe, plan, [])]))
  return { asIs, toBe, plan, plans, taskPlans: allTaskPlans(asIs, toBe, plan, []) }
}
const verified = [att('i1', false, 10), att('i2', false, 11)]

describe('DomainTaskGraphDTO — 30 영구 TASK · 21 비보류(원자 18 · 통합 3) · 9 보류', () => {
  const g = domainTaskGraph()
  it('개수 · 영역', () => {
    expect(g.counts).toEqual({ tasks: 30, nonHold: 21, hold: 9, atomicNonHold: 18, integratedNonHold: 3 })
    expect(g.domains.map((d) => d.id)).toEqual(['V', 'S', 'R', 'E', 'L', 'X'])
    expect(g.domains.filter((d) => d.hold).map((d) => d.id)).toEqual(['L', 'X'])
  })
  it('영구 slug 를 바꾸지 않았다 — 정의와 같은 순서 · 같은 id', () => {
    expect(g.tasks.map((t) => t.id)).toEqual(tasks().map((t) => t.id))
  })
  it('관계는 승인 · 제안을 구분해 그대로 — 제안을 승인으로 올리지 않는다', () => {
    expect(g.edges.length).toBe(34)
    expect(g.edges.filter((e) => e.approval === 'approved').length).toBe(14)
  })
  it('연구 표지(독립성 보류 등)는 표시 주석 — 보류 TASK 와 별개', () => {
    expect(g.tasks.find((t) => t.id === 's.chunk_boundary')).toMatchObject({ researchFlag: 'independence_hold', hold: false })
    expect(g.tasks.find((t) => t.id === 'r.central_meaning')?.researchFlag).toBeNull()
  })
})

describe('ExamInventoryCoverage — 분모 혼합 금지', () => {
  const full = Array.from({ length: 45 }, (_, i) => ({ no: i + 1, points: i < 17 ? (i < 14 ? 2 : 3) : 0 }))
  // 실제 배점과 무관하게 합이 맞는 45문항 카탈로그(듣기 37 · 독해 63)
  const listening = Array.from({ length: 17 }, (_, i) => ({ no: i + 1, points: i < 14 ? 2 : 3 })) // 28 + 9 = 37
  const reading = Array.from({ length: 28 }, (_, i) => ({ no: i + 18, points: i < 7 ? 3 : 2 })) // 21 + 42 = 63
  void full
  it('FAIL fixture — 독해 28문항 · 63점만 갖춘 카탈로그는 45 · 100 시험의 100 % 가 아니다', () => {
    const c = examInventoryCoverage('2026', CURRENT_ENGLISH_BLUEPRINT, reading)
    expect(c.covered).toEqual({ items: 28, points: 63 })
    expect(c.status).toBe('partial')
    expect(coverageRatio(c)).toBe(63)
    expect(c.sections.find((s) => s.id === 'reading')).toMatchObject({ items: 28, expectedItems: 28, points: 63, expectedPoints: 63 })
    expect(c.issues.filter((i) => i.kind === 'missing').length).toBe(17)
  })
  it('전 문항 · 배점 합 100 이면 supported', () => {
    const c = examInventoryCoverage('2026', CURRENT_ENGLISH_BLUEPRINT, [...listening, ...reading])
    expect(c.status).toBe('supported')
    expect(coverageRatio(c)).toBe(100)
  })
  it('체제 미확인 = unknown · 분모 null(0 % 아님)', () => {
    const c = examInventoryCoverage('2012-A', null, reading)
    expect(c.status).toBe('unknown')
    expect(c.denominator).toBeNull()
    expect(coverageRatio(c)).toBeNull()
  })
  it('중복 · 배점 불일치는 완전 지원을 막는다', () => {
    expect(examInventoryCoverage('x', CURRENT_ENGLISH_BLUEPRINT, [...listening, ...reading, { no: 20, points: 2 }]).status).toBe('partial')
    const off = [...listening, ...reading.map((r, i) => (i === 0 ? { ...r, points: 2 } : r))]
    const c = examInventoryCoverage('x', CURRENT_ENGLISH_BLUEPRINT, off)
    expect(c.status).toBe('partial')
    expect(c.issues.some((i) => i.kind === 'score_mismatch')).toBe(true)
  })
})

describe('관련성 — unknown ≠ not_applicable · 후보는 검토 링크가 아니다', () => {
  it('검토되지 않은 출처가 relevance 를 정하면 거절', () => {
    expect(() => makeLink({ task: TASK, item: '2026-22', source: 'research_ai_candidate', candidateRelevance: 'direct', analysisVersion: null, relevance: 'direct' })).toThrow()
    expect(() => makeLink({ task: TASK, item: '2026-22', source: 'research_ai_reviewed', candidateRelevance: 'direct', analysisVersion: 'v1.2', tier: 'R2' })).toThrow()
  })
  it('후보 링크는 relevance=unknown 으로만 들어가고 검토 수에 더해지지 않는다', () => {
    const l = [
      makeLink({ task: TASK, item: 'a', source: 'research_ai_candidate', candidateRelevance: 'direct', analysisVersion: 'v1.2' }),
      makeLink({ task: TASK, item: 'b', source: 'research_ai_reviewed', candidateRelevance: 'indirect', analysisVersion: 'v1.2' }),
      makeLink({ task: TASK, item: 'c', source: 'human_review', candidateRelevance: null, analysisVersion: 'v3', relevance: 'direct' }),
    ]
    const c = relevanceCounts(l, 786, 30)
    expect(c.pairs).toBe(23_580)
    expect(c.reviewed).toEqual({ direct: 1, indirect: 0, not_applicable: 0 })
    expect(c.candidates).toEqual({ direct: 1, indirect: 1 })
    expect(c.unknown).toBe(23_579)
    expect(l[1].tier).toBe('R1')
  })
  it('링크가 없는 조합은 unknown', () => {
    expect(relevanceOf([], TASK, 'zzz')).toBe('unknown')
  })
  it('To-Be — 기준 시험 연결이 없는 TASK 는 relevanceUnknown(무관 unrelated 와 분리)', () => {
    const v = view([], 12)
    const unknown = v.toBe!.relevanceUnknown
    expect(unknown.length).toBeGreaterThan(0)
    for (const id of unknown) expect(linesOfTask(id).every((l) => !(l in lineRefItems))).toBe(true)
    expect(unknown.some((id) => v.toBe!.unrelated.includes(id))).toBe(false)
  })
})

describe('NeedRank / ActionRank 분리', () => {
  it('콘텐츠 없는 TASK 를 NeedRank 에서 지우지 않고, ActionRank 는 실행 가능한 것만', () => {
    const v = view([], 12)
    const r = ranksOf(v)
    const need = new Set(r.needRank.map((e) => e.task))
    for (const e of r.actionRank) expect(need.has(e.task)).toBe(true)
    // NeedRank = ActionRank + notActionable(빠짐 없음 · 중복 없음)
    expect(r.actionRank.length + r.notActionable.length).toBe(r.needRank.length)
    expect(r.notActionable.some((n) => n.reason === 'content_gap' || n.reason === 'relevance_unknown')).toBe(true)
  })
  it('근거 부족은 확정 약점이 아니다 — confirmed=false', () => {
    const r = ranksOf(view([], 12))
    expect(r.needRank.filter((e) => e.need === 'CONFIRM').every((e) => !e.confirmed)).toBe(true)
  })
  it('목표가 없으면 NeedRank 없음 · 탐색은 가능(그래프는 그대로)', () => {
    expect(ranksOf(view([], 12, false)).needRank).toEqual([])
    expect(domainTaskGraph().counts.tasks).toBe(30)
  })
})

describe('단일 계산 — MAP(As-Is) · PLAN · Inspector · Rank 가 같은 상태를 말한다', () => {
  it('확정 직후', () => {
    const v = view(verified, 12)
    const r = ranksOf(v)
    const ledger = goalCoverageLedger({ view: v, exams: [], confirmItems: { [KEY]: ITEMS.length }, transferItems: { [KEY]: 4 } })
    const ins = taskInspector(TASK, v, r, ledger)
    const plan = v.taskPlans.find((p) => p.task === TASK)!
    expect(v.asIs.tasks[TASK].status).toBe('verified_need')
    expect(ins.now.evidence).toBe('need_confirmed')
    expect(ins.now.need).toBe('REPAIR')
    expect(plan.need).toBe('REPAIR')
    expect(ins.next?.href ?? null).toBe(plan.next?.href ?? null)
    // 분모는 As-Is 확인 판정의 값 그대로(Inspector 가 다시 세지 않는다)
    expect(ins.now.observed?.independent).toBe(v.asIs.tasks[TASK].check!.independentItems)
  })
  it('해소 — 운영 정책 통과(passed_current_policy) · 일반 숙달 · 지연 유지로 바꾸지 않는다', () => {
    const v = view([...verified, att('i3', true, 20), att('i4', true, 21)], 22)
    const ins = taskInspector(TASK, v, ranksOf(v), null)
    expect(v.asIs.tasks[TASK].status).toBe('resolved')
    expect(ins.now.evidence).toBe('passed_current_policy')
    expect(ins.coverage).toBeNull()
  })
})

describe('GoalCoverageLedger — 6 Ledger · 8 공백 · 상향 금지선', () => {
  const v = view([], 12)
  const l = goalCoverageLedger({ view: v, exams: [], confirmItems: { [KEY]: ITEMS.length }, transferItems: { [KEY]: 4 } })
  it('Ledger · 공백 코드 집합', () => {
    expect(LEDGERS.length).toBe(6)
    expect(GAP_CODES.length).toBe(8)
    expect(l.tasks.length).toBe(30)
  })
  it('시험 카탈로그 대조가 없으면 unknown(0 · 100 아님)', () => {
    expect(l.examInventory).toBe('unknown')
  })
  it('정적 live 를 평가 검증 완료로 올리지 않는다 — Assessment 는 최대 partial', () => {
    expect(l.tasks.every((t) => t.ledgers.AssessmentCoverage.status !== 'supported')).toBe(true)
    expect(l.tasks.find((t) => t.task === TASK)!.ledgers.AssessmentCoverage.status).toBe('partial')
  })
  it('보류 TASK 는 unsupported(학생 0점 아님) · 효과 미측정 공백은 모든 TASK 에', () => {
    const hold = l.tasks.filter((t) => t.hold)
    expect(hold.length).toBe(9)
    expect(hold.every((t) => t.ledgers.GoalSupportCoverage.status === 'unsupported')).toBe(true)
    expect(l.tasks.every((t) => t.gaps.includes('VERIFICATION_GAP') && t.gaps.includes('LEVEL_GAP'))).toBe(true)
    expect(l.dimensions).toEqual({ researchUnverified: true, learningEffectUnmeasured: true })
  })
  it('라인 수준 연결은 문항 검토 링크가 아니다 — TaskLink 최대 partial', () => {
    expect(l.tasks.every((t) => t.ledgers.TaskLinkCoverage.status !== 'supported')).toBe(true)
  })
})

describe('TargetSpec — 저장되는 것은 점수뿐', () => {
  it('점수 외 필드는 persisted=false · 저장된 목표로 보이지 않는다', () => {
    const s = targetSpecOf({ score: 80, set: true }, 3, { grade: 2, targetDate: '2026-11-19', examKinds: ['csat'], minutesPerWeek: 300 })
    expect(savedTargetFields(s)).toEqual(['score'])
    expect(unsavedTargetFields(s)).toEqual(['examScope', 'grade', 'targetDate', 'timeBudget'])
    expect(s.goalVersion).toBe(3)
  })
  it('목표 미설정이면 점수 · 목표 버전 없음(기본값을 목표로 쓰지 않는다)', () => {
    const s = targetSpecOf({ score: 80, set: false }, 3)
    expect(s.score).toBeNull()
    expect(s.goalVersion).toBeNull()
  })
})
