// apps/web/src/lib/csat/map/v4/__tests__/v4.test.ts
// rev4.0 2차 — As-Is · To-Be · Workspace 시험 입력 시나리오 8 · 불변식 8(지시서 §9). 고정 시각만 쓴다(시계를 읽지 않는다).

import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'

import { asIsDiff, asIsMap, ms, type AsIsInput, type AsIsSession, type AxisProxyState } from '../as-is'
import { CANON_EFFECTIVE_FROM, CANON_VERSION, DOMAINS, partsOf, tasks, type Domain } from '../definition'
import { currentAsOf, parseAsOf } from '../compose'
import { toBeMap, type ConfirmLink } from '../to-be'
import { planWorkspaces } from '../workspace'

const NOW = '2026-10-10T09:00:00.000Z'

const session = (id: string, takenAt: string, enteredAt: string, o: Partial<AsIsSession> = {}): AsIsSession => ({
  id, examId: `EX-${id}`, examLabel: `시험 ${id}`, takenAt, enteredAt, raw: 70, grade: 3, diagnosable: true, examReady: true, ...o,
})

const proxy = (state: AxisProxyState, over: Partial<Record<Domain, AxisProxyState>> = {}): NonNullable<AsIsInput['axisProxy']> => ({
  state: Object.fromEntries(DOMAINS.map((d) => [d, over[d] ?? state])) as Record<Domain, AxisProxyState>,
  contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number>,
})

const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5']
const checks = [{ taskKey: KEY, items: ITEMS }]
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}`, label: t })) }

const attempt = (itemRef: string, isCorrect: boolean, answeredAt: string, o: Partial<FindAttemptRow> = {}): FindAttemptRow => ({
  userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect, synthetic: false, helpLevel: 'independent',
  afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt, activity: 'theater', ...o,
})

const base = (o: Partial<AsIsInput> = {}): AsIsInput => ({ asOf: NOW, sessions: [session('s1', '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z')], axisProxy: proxy('observed'), checks, attempts: [], ...o })

// 목표 계산 기준 — 한 시험 · 45문항 · 배점 합 100(2점 × 35 + 3점 × 10). B6 문항(18–24)은 오답률이 높다
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => {
  const no = i + 1
  return { examId: 'REF', no, points: no <= 10 ? 3 : 2, errorRate: no >= 18 && no <= 24 ? 0.6 - no / 1000 : 0.1 + no / 1000 }
})
const lineRefItems: Record<string, RefItem[]> = {
  B6: REF.filter((i) => i.no >= 18 && i.no <= 24),
  A5: REF.filter((i) => i.no >= 29 && i.no <= 34),
  A1: REF.filter((i) => i.no >= 35 && i.no <= 40),
}
const goal = (score: number, set = true) => ({ score, set })

describe('정의 — 정적 import · 30 TASK · 버전', () => {
  it('TASK 30 그대로(36 으로 늘리지 않는다) · 보류 9 · 정의 버전을 결과에 싣는다', () => {
    expect(tasks()).toHaveLength(30)
    expect(tasks().filter((t) => t.status === 'hold')).toHaveLength(9)
    expect(asIsMap(base()).canonVersion).toBe(CANON_VERSION)
  })
  it('승인된 PART_OF 로만 통합 관찰을 분해한다 — X 는 정본이 구성 원자를 명시하지 않아 비어 있다', () => {
    expect(partsOf('s.o.sentence_meaning_model')).toHaveLength(5)
    expect(partsOf('r.o.global_meaning_model')).toHaveLength(6)
    expect(partsOf('e.o.final_judgment')).toHaveLength(3)
    expect(partsOf('x.o.whole_test_stability')).toEqual([])
  })
})

describe('시험 입력 시나리오 8', () => {
  it('① 최신 시험 1회 — 축 기록은 TASK 에 「축 proxy」로만, 확정 없음', () => {
    const m = asIsMap(base())
    expect(m.mode).toBe('current')
    expect(m.exact).toBe(true)
    expect(m.tasks['r.central_meaning'].status).toBe('observed')
    expect(m.tasks['r.central_meaning'].basis).toBe('axis_proxy')
    expect(Object.values(m.tasks).some((t) => t.status === 'verified_need')).toBe(false)
    expect(m.scores).toHaveLength(1)
  })

  it('② 과거 시험 1회 — 시행일을 그대로 싣고, 분석할 수 없는 시험은 「분석 준비 중」(능력 부족 아님)', () => {
    const m = asIsMap(base({ sessions: [session('old', '2024-06-04T00:00:00Z', '2026-10-01T00:00:00Z', { examReady: false })] }))
    expect(m.scores[0].takenAt).toBe('2024-06-04T00:00:00Z')
    expect(m.sessions[0].excluded).toBe('exam_not_ready')
    expect(m.domains.R.state).toBe('analysis_pending')
    expect(m.tasks['r.central_meaning'].status).toBe('analysis_pending')
    expect(m.tasks['r.central_meaning'].reason).toBe('exam_not_analyzable')
  })

  it('③ 과거 여러 회 — 시험별 나열만, 원점수를 합치거나 평균하지 않는다', () => {
    const m = asIsMap(base({ sessions: [session('a', '2025-03-01T00:00:00Z', '2025-03-02T00:00:00Z', { raw: 60 }), session('b', '2025-06-01T00:00:00Z', '2025-06-02T00:00:00Z', { raw: 80 })] }))
    expect(m.scores.map((s) => s.raw)).toEqual([60, 80])
    expect(new Set(m.scores.map((s) => s.examId)).size).toBe(2)
    expect(Object.keys(m)).not.toContain('averageScore')
  })

  it('④ 최신 · 과거 누적 — 시행일 순 · 입력 신뢰도 미통과 기록은 칸으로 남기고 근거에서 뺀다', () => {
    const m = asIsMap(base({ sessions: [session('new', '2026-09-20T00:00:00Z', '2026-09-21T00:00:00Z'), session('old', '2025-09-01T00:00:00Z', '2026-09-21T00:00:00Z', { diagnosable: false })] }))
    expect(m.sessions.map((s) => s.id)).toEqual(['old', 'new'])
    expect(m.sessions[0].excluded).toBe('not_diagnosable')
    expect(m.tasks['r.central_meaning'].sources).toEqual([{ kind: 'exam_sessions', count: 1 }])
  })

  it('⑤ 새 시험 추가 — 바뀐 것을 diff 로 보인다(계획을 말없이 덮지 않는다)', () => {
    const before = asIsMap(base({ axisProxy: proxy('insufficient') }))
    const after = asIsMap(base({ sessions: [...base().sessions, session('s2', '2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z')], axisProxy: proxy('observed', { R: 'check_first' }) }))
    const d = asIsDiff(before, after)
    expect(d.newSessions).toEqual(['s2'])
    expect(d.changed.find((c) => c.task === 'r.central_meaning')).toEqual({ task: 'r.central_meaning', from: 'insufficient', to: 'check_first' })
  })

  it('⑤-2 새 기록이 아직 축 관찰(스냅샷)에 반영되지 않았으면 「반영 중」 — 기록 없음 · 능력 판정으로 보이지 않는다', () => {
    const m = asIsMap(base({
      sessions: [...base().sessions, session('fresh', '2026-10-10T00:00:00Z', '2026-10-10T08:59:00Z')],
      axisProxy: { ...proxy('observed'), covers: ['s1'] },
    }))
    expect(m.domains.R.state).toBe('proxy_pending')
    expect(m.tasks['r.central_meaning'].status).toBe('analysis_pending')
    expect(m.tasks['r.central_meaning'].reason).toBe('record_being_analyzed')
    expect(m.scores.map((s) => s.sessionId)).toEqual(['s1', 'fresh'])
  })

  it('⑥ 과거 기준 분석 — 기준 뒤 기록 제외 · 저장 스냅샷(축 proxy) 미사용 · 정확한 재현으로 표시하지 않는다', () => {
    const m = asIsMap(base({
      asOf: '2026-09-15T00:00:00.000Z',
      sessions: [session('s1', '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z'), session('later', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'), session('late-entry', '2026-09-10T00:00:00Z', '2026-09-20T00:00:00Z')],
      attempts: [attempt('i1', false, '2026-09-20T00:00:00Z'), attempt('i2', false, '2026-09-21T00:00:00Z')],
    }))
    expect(m.mode).toBe('past_reanalysis')
    expect(m.exact).toBe(false)
    expect(m.limits).toContain('snapshot_after_as_of')
    expect(m.scores.map((s) => s.sessionId)).toEqual(['s1'])
    expect(m.excluded).toEqual({ sessionsAfterAsOf: 2, attemptsAfterAsOf: 2, syntheticAttempts: 0 })
    // 기준 뒤 두 오답으로 확정되지 않는다
    expect(m.tasks['r.central_meaning'].status).not.toBe('verified_need')
    expect(m.tasks['r.central_meaning'].reason).toBe('past_proxy_unavailable')
  })

  it('⑥-3 날짜만 있는 시행일(taken_at)도 시각으로 비교 — 같은 날을 「기준 뒤」 · 「정의 전」으로 잘못 보지 않는다', () => {
    const m = asIsMap(base({ asOf: '2026-10-10T09:00:00.000Z', sessions: [session('today', '2026-10-10', '2026-10-10T08:00:00Z')] }))
    expect(m.sessions[0].excluded).toBeNull()
    expect(ms('2026-10-10') < ms(CANON_EFFECTIVE_FROM)).toBe(false)
    const past = asIsMap(base({ asOf: '2026-10-09T23:59:59.999+09:00', sessions: [session('today', '2026-10-10', '2026-10-10T08:00:00Z')] }))
    expect(past.sessions[0].excluded).toBe('after_as_of')
  })

  it('⑥-4 지금 분석은 시계가 어긋나도 방금 넣은 기록을 「기준 뒤」로 빼지 않는다(currentAsOf)', () => {
    const now = '2026-10-10T13:00:00.000Z'
    const sessions = [session('fresh', '2026-10-10', '2026-10-10T13:00:04.500Z')] // DB 시계가 4.5초 앞섬
    const at = currentAsOf(now, sessions, [{ answeredAt: '2026-10-10T12:00:00Z' }])
    expect(at).toBe('2026-10-10T13:00:04.500Z')
    const m = asIsMap(base({ asOf: at, sessions }))
    expect(m.mode).toBe('current')
    expect(m.sessions[0].excluded).toBeNull()
    // 과거 기준(명시)은 그대로 엄격 — parseAsOf 는 지금 이후 날짜를 버린다
    expect(parseAsOf('2026-10-09', now)).toBe('2026-10-09T14:59:59.999Z')
    expect(parseAsOf('2026-10-11', now)).toBeUndefined()
    expect(parseAsOf('10/09', now)).toBeUndefined()
  })

  it('⑥-2 정의가 생기기 전 시점은 기록이 그 뒤에 없어도 정확한 재현이 아니다', () => {
    const m = asIsMap(base({ asOf: '2026-09-30T00:00:00.000Z' }))
    expect(m.mode).toBe('current')
    expect(m.limits).toEqual(['definition_newer_than_as_of'])
    expect(m.exact).toBe(false)
  })

  it('⑦ 목표 미설정 — As-Is 는 계산 · To-Be 없음 · Workspace 는 As-Is 로 하나 제안', () => {
    const a = asIsMap(base())
    expect(toBeMap({ asIs: a, goal: goal(100, false), refItems: REF, lineRefItems, confirmLinks: links })).toBeNull()
    expect(toBeMap({ asIs: a, goal: null, refItems: REF, lineRefItems, confirmLinks: links })).toBeNull()
    const plan = planWorkspaces({ asIs: a, toBe: null, confirmLinks: links, transferItems: {} })
    expect(plan.primary?.id).toBe('ws.central-meaning')
    expect(plan.reason).toBe('available')
  })

  it('⑧ 목표 설정 · 변경 — 관련도와 순서만 바뀐다', () => {
    const a = asIsMap(base())
    const t100 = toBeMap({ asIs: a, goal: goal(100), refItems: REF, lineRefItems, confirmLinks: links })!
    const t60 = toBeMap({ asIs: a, goal: goal(60), refItems: REF, lineRefItems, confirmLinks: links })!
    const rel = (t: typeof t100, id: string) => t.needs.find((n) => n.task === id)?.relevance.items ?? 0
    expect(rel(t100, 'r.central_meaning')).toBe(7)
    // 목표 60 = 40점까지 놓쳐도 되는 문항 — 오답률 높은 B6 문항이 먼저 빠진다
    expect(rel(t60, 'r.central_meaning')).toBeLessThan(7)
    expect(t60.unrelated.length + t60.needs.length).toBe(t100.unrelated.length + t100.needs.length)
  })
})

describe('불변식 8', () => {
  const verifiedAttempts = [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z')]

  it('1 목표 변경은 As-Is 근거를 바꾸지 않는다', () => {
    const a = asIsMap(base({ attempts: verifiedAttempts }))
    const snap = JSON.stringify(a)
    for (const g of [100, 90, 80, 60, 0]) toBeMap({ asIs: a, goal: goal(g), refItems: REF, lineRefItems, confirmLinks: links })
    expect(JSON.stringify(a)).toBe(snap)
    const t = toBeMap({ asIs: a, goal: goal(60), refItems: REF, lineRefItems, confirmLinks: links })!
    for (const n of t.needs) expect(n.evidence).toBe(a.tasks[n.task].status)
  })

  it('2 proxy 만으로 verified 가 되지 않는다 — 축이 「먼저 확인」이어도 확인 요구일 뿐', () => {
    const m = asIsMap(base({ axisProxy: proxy('check_first') }))
    for (const t of Object.values(m.tasks)) if (t.basis === 'axis_proxy') expect(['verified_need', 'resolved']).not.toContain(t.status)
    const tb = toBeMap({ asIs: m, goal: goal(80), refItems: REF, lineRefItems, confirmLinks: links })!
    expect(tb.needs.every((n) => n.type !== 'REPAIR')).toBe(true)
  })

  it('3 직접 확인(서로 다른 2문항 독립 실패)만 확정 — 합성 · 도움 받은 시도는 세지 않는다', () => {
    expect(asIsMap(base({ attempts: verifiedAttempts })).tasks['r.central_meaning'].status).toBe('verified_need')
    const synth = asIsMap(base({ attempts: verifiedAttempts.map((a) => ({ ...a, synthetic: true })) }))
    expect(synth.tasks['r.central_meaning'].status).toBe('observed')
    expect(synth.excluded.syntheticAttempts).toBe(2)
    const helped = asIsMap(base({ attempts: verifiedAttempts.map((a) => ({ ...a, helpLevel: 'viewed_first' })) }))
    expect(helped.tasks['r.central_meaning'].status).toBe('observed')
  })

  it('4 한 시도를 여러 Workspace 의 독립 증거로 두 번 세지 않는다', () => {
    const a = asIsMap(base({ attempts: verifiedAttempts }))
    const plan = planWorkspaces({ asIs: a, toBe: null, confirmLinks: links, transferItems: {} })
    const views = [plan.primary!, ...plan.others]
    // r.central_meaning 은 central-meaning(중심) · option-match(보조) 두 곳에 있다 — 확인 판정은 중심 Workspace 하나에서만 단계로 쓰인다
    expect(views.filter((v) => v.stages.repair.ready)).toHaveLength(1)
    expect(views.find((v) => v.id === 'ws.option-match')?.stages.repair.ready).toBe(false)
    expect(a.tasks['r.central_meaning'].check?.independentItems).toBe(2)
  })

  it('5 보류 TASK 에는 요구 · 실행 가능한 진단이 없다', () => {
    const a = asIsMap(base({ axisProxy: proxy('check_first') }))
    const tb = toBeMap({ asIs: a, goal: goal(80), refItems: REF, lineRefItems: { ...lineRefItems, A9: REF.slice(0, 10), J1: REF.slice(0, 5) }, confirmLinks: links })!
    const hold = new Set(tasks().filter((t) => t.status === 'hold').map((t) => t.id))
    for (const id of hold) expect(a.tasks[id].status).toBe('unmeasurable')
    expect(tb.needs.some((n) => hold.has(n.task))).toBe(false)
    expect(tb.deferred).toEqual([{ type: 'EXAM_PRACTICE', reason: 'x_execution_model_deferred' }])
    const plan = planWorkspaces({ asIs: a, toBe: tb, confirmLinks: links, transferItems: {} })
    expect(plan.preparing.find((p) => p.id === 'ws.timed')).toBeTruthy()
    expect([plan.primary, ...plan.others].some((v) => v?.id === 'ws.timed')).toBe(false)
  })

  it('6 준비되지 않은 콘텐츠는 실행 가능으로 표시하지 않는다', () => {
    const a = asIsMap(base())
    const tb = toBeMap({ asIs: a, goal: goal(100), refItems: REF, lineRefItems, confirmLinks: links })!
    for (const n of tb.needs.filter((x) => x.content === 'content_needed')) expect(n.executable).toBeNull()
    const plan = planWorkspaces({ asIs: a, toBe: tb, confirmLinks: links, transferItems: {} })
    // 확인 문항 연결이 없는 live 템플릿(option · evidence — 이 픽스처엔 claim-support 만 연결)은 실행 단계가 없다
    const opt = [plan.primary, ...plan.others].find((v) => v?.id === 'ws.option-match')!
    expect(Object.values(opt.stages).every((s) => !s.ready)).toBe(true)
    expect(opt.stages.check.blocked).toBe('no_check_link')
    expect(plan.preparing.map((p) => p.id)).toEqual(expect.arrayContaining(['ws.sentence-core', 'ws.vocab-context', 'ws.grammar-scope', 'ws.inference']))
  })

  it('7 승인되지 않은 관계를 구조적 연결로 쓰지 않는다', () => {
    const plan = planWorkspaces({ asIs: asIsMap(base()), toBe: null, confirmLinks: links, transferItems: {} })
    const cm = plan.primary!
    // central-meaning 의 관계 rel-022 · rel-023 은 SUPPORTS(proposed) — 구조적 연결이 아니다
    expect(cm.relations.structural).toEqual([])
    expect(cm.relations.proposed).toEqual(['rel-022', 'rel-023'])
  })

  it('8 학습량을 점수로 바꾸지 않는다 — 요구 · 단계에 점수 칸이 없고, 학습량은 실제 문항 수뿐', () => {
    const a = asIsMap(base({ attempts: verifiedAttempts }))
    const tb = toBeMap({ asIs: a, goal: goal(80), refItems: REF, lineRefItems, confirmLinks: links })!
    for (const n of tb.needs) expect(Object.keys(n).some((k) => /score|gain|expected/i.test(k))).toBe(false)
    const plan = planWorkspaces({ asIs: a, toBe: tb, confirmLinks: links, transferItems: { [KEY]: 0 } })
    const cm = [plan.primary!, ...plan.others].find((v) => v.id === 'ws.central-meaning')!
    expect(cm.stages.repair).toEqual({ ready: true, count: 2, blocked: null })
    expect(cm.stages.transfer).toEqual({ ready: false, count: null, blocked: 'no_transfer_items' })
    expect(cm.stages.recheck).toEqual({ ready: true, count: 2, blocked: null }) // 미노출 i3 · i4 · i5 중 기준 2
    expect(cm.next?.target).toBe('i3')
  })
})

describe('리뷰 수정 회귀(2차)', () => {
  it('시각 없는 시도는 근거 · 「확인 진행 중」에 쓰지 않는다(skill-diagnosis 와 같은 자격)', () => {
    const m = asIsMap(base({ attempts: [attempt('i1', false, '2026-09-10T00:00:00Z', { answeredAt: null })] }))
    expect(m.tasks['r.central_meaning'].status).toBe('observed')
    expect(m.tasks['r.central_meaning'].check?.independentItems).toBe(0)
  })
  it('ready(공개 승인 전) 템플릿은 확인 링크가 있어도 실행 단계 · 다음 행동이 없다', () => {
    const coh = { 'cohesion-link': [{ target: 'c1', href: '/x', label: 'c1' }, { target: 'c2', href: '/y', label: 'c2' }] }
    const a = asIsMap(base({ checks: [...checks, { taskKey: 'cohesion-link', items: ['c1', 'c2'] }] }))
    const plan = planWorkspaces({ asIs: a, toBe: null, confirmLinks: { ...links, ...coh }, transferItems: {} })
    const v = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.cohesion')!
    expect(Object.values(v.stages).every((s) => !s.ready && s.blocked === 'awaiting_release')).toBe(true)
    expect(v.next).toBeNull()
  })
})

describe('Workspace 대표 선정 · 단계', () => {
  it('목표가 있으면 우선순위 1위 요구의 TASK 를 중심으로 하는 live Workspace', () => {
    const a = asIsMap(base({ attempts: [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z')] }))
    const tb = toBeMap({ asIs: a, goal: goal(80), refItems: REF, lineRefItems, confirmLinks: links })!
    expect(tb.needs[0]).toMatchObject({ task: 'r.central_meaning', type: 'REPAIR', priority: 1 })
    const plan = planWorkspaces({ asIs: a, toBe: tb, confirmLinks: links, transferItems: { [KEY]: 12 } })
    expect(plan.primary?.id).toBe('ws.central-meaning')
    expect(plan.reason).toBe('goal_need')
    expect(plan.primary?.stages.transfer).toEqual({ ready: true, count: 12, blocked: null })
  })

  it('확인 전에는 확인만 열리고 나머지는 이유와 함께 닫힌다', () => {
    const plan = planWorkspaces({ asIs: asIsMap(base()), toBe: null, confirmLinks: links, transferItems: { [KEY]: 12 } })
    const s = plan.primary!.stages
    expect(s.check).toEqual({ ready: true, count: 5, blocked: null })
    expect(s.repair.blocked).toBe('after_check')
    expect(s.transfer.blocked).toBe('after_repair')
    expect(s.recheck.blocked).toBe('after_check')
  })

  it('다시 확인 통과(resolved) 뒤 — 적용은 실제 문항이 있으면 열리고 To-Be 는 TRANSFER', () => {
    const at = [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z'), attempt('i3', true, '2026-09-20T00:00:00Z'), attempt('i4', true, '2026-09-21T00:00:00Z')]
    const a = asIsMap(base({ attempts: at }))
    expect(a.tasks['r.central_meaning'].status).toBe('resolved')
    const tb = toBeMap({ asIs: a, goal: goal(90), refItems: REF, lineRefItems, confirmLinks: links })!
    expect(tb.needs.find((n) => n.task === 'r.central_meaning')?.type).toBe('TRANSFER')
    const tb2 = toBeMap({ asIs: a, goal: goal(90), refItems: REF, lineRefItems, confirmLinks: links, transferredKeys: [KEY] })!
    expect(tb2.needs.find((n) => n.task === 'r.central_meaning')?.type).toBe('MAINTAIN')
  })
})
