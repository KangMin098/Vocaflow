// apps/web/src/lib/knowledge/__tests__/learning-decision.test.ts
// 작업 2 — 확인된 학습 요구가 다음 할 일을 바꾸는가 · 추천마다 관찰 근거 · 원리 · 방법 · 정책 버전 · 이유가 남는가
import { describe, expect, it } from 'vitest'

import { findOutcome, type FindAttemptRow } from '../find-outcome'
import { DECISION_POLICY_VERSION, decideStep, type DecisionInput, type StepChain } from '../learning-decision'

const CHAIN: StepChain = {
  task: { id: 't1', slug: 'task-claim-support-link', version: 1 },
  method: { id: 'm1', slug: 'method-claim-support-marking', version: 3 },
  principle: { id: 'p1', slug: 'claim-support-relation', version: 2 },
}
const CONFIRM = ['2022#20', '2025#20', '2016#20'].map((itemRef) => ({ itemRef, href: `/csat/item/${itemRef.replace('#', '-')}#principle`, label: itemRef }))
const row = (itemRef: string, isCorrect: boolean): FindAttemptRow => ({
  itemRef, taskKey: 'claim-support', userId: 'u', phase: 'practice', isCorrect, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false,
})
const input = (rows: FindAttemptRow[], extra: Partial<DecisionInput> = {}): DecisionInput => ({
  stepKey: 'structure',
  findTaskId: 'B6-3',
  outcome: findOutcome(CONFIRM.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows),
  chain: CHAIN,
  confirm: CONFIRM,
  triedItems: [...new Set(rows.map((r) => r.itemRef))],
  practiceHref: '/csat/practice/claim-support',
  ...extra,
})

describe('decideStep — 학습 요구가 다음 할 일을 바꾼다', () => {
  it('기록 없음 → 확인 문항부터(약점 단정 없음)', () => {
    const d = decideStep(input([]))
    expect(d.action).toBe('start_check')
    expect(d.href).toBe('/csat/item/2022-20#principle')
  })
  it('한 문항만 막힘 → 아직 안 푼 다른 확인 문항으로 더 확인', () => {
    const d = decideStep(input([row('2022#20', false)]))
    expect(d.action).toBe('check_more')
    expect(d.href).toBe('/csat/item/2025-20#principle')
  })
  it('서로 다른 두 문항 막힘 → 그 원리의 방법 과제 연습', () => {
    const d = decideStep(input([row('2022#20', false), row('2025#20', false)]))
    expect(d.action).toBe('practice_method')
    expect(d.href).toBe('/csat/practice/claim-support')
  })
  it('두 문항 모두 해냄 → 이 단계 연습을 처방하지 않고 다음 단계로', () => {
    const d = decideStep(input([row('2022#20', true), row('2025#20', true)]))
    expect(d.action).toBe('move_on')
    expect(d.href).toBeNull()
  })
  it('엇갈림 → 남은 확인 문항으로 더 확인', () => {
    expect(decideStep(input([row('2022#20', true), row('2025#20', false)])).action).toBe('check_more')
  })
  it('원리 사슬이 없으면 원리 기반 결정을 하지 않는다', () => {
    expect(decideStep(input([], { chain: { task: null, method: null, principle: null } })).action).toBe('no_principle')
  })
})

describe('추적 정보', () => {
  it('관찰 근거 · 원리 · 방법 · 과제 id · 버전 · 정책 버전 · 이유를 남긴다', () => {
    const d = decideStep(input([row('2022#20', false), row('2025#20', false)]))
    expect(d.trace).toMatchObject({
      policyVersion: DECISION_POLICY_VERSION,
      stepKey: 'structure',
      findTaskId: 'B6-3',
      observation: { state: 'confirmed_need', checked: 2, wrong: 2, right: 0, items: ['2022#20', '2025#20'] },
      principleId: 'p1', methodId: 'm1', taskId: 't1',
      versions: { principle: 2, method: 3, task: 1 },
    })
    expect(d.reason).toMatch(/claim-support-relation/)
    expect(d.reason).toMatch(/method-claim-support-marking/)
  })
  it('원리 개정(버전 변경)은 같은 행동이라도 다른 근거로 남는다', () => {
    const a = decideStep(input([row('2022#20', false), row('2025#20', false)]))
    const b = decideStep(input([row('2022#20', false), row('2025#20', false)], { chain: { ...CHAIN, method: { ...CHAIN.method!, version: 4 } } }))
    expect(a.action).toBe(b.action)
    expect(a.trace.versions.method).not.toBe(b.trace.versions.method)
  })
  it('학습자 문구에 관리자 항목 slug 를 넣지 않는다', () => {
    for (const rows of [[], [row('2022#20', false)], [row('2022#20', false), row('2025#20', false)], [row('2022#20', true), row('2025#20', true)]]) {
      expect(decideStep(input(rows)).message).not.toMatch(/claim-support|method-|task-/)
    }
  })
})

describe('관찰 근거는 적격 시도만', () => {
  it('해설을 먼저 본 시도는 풀었던 문항이어도 관찰 근거에 넣지 않는다', () => {
    const viewed = { ...row('2016#20', false), helpLevel: 'viewed_first' as const }
    const d = decideStep(input([row('2022#20', false), row('2025#20', false), viewed]))
    expect(d.trace.observation.items).toEqual(['2022#20', '2025#20'])
  })
})

describe('find-policy.v2 — 부분 정답을 구별한다(판정 기준은 그대로)', () => {
  const part = (itemRef: string, parts: Record<string, boolean>) => ({ ...row(itemRef, false), parts })
  it('주장은 맞고 근거만 누락 → 같은 「연습」이지만 초점 support · 이유에 막힌 부분', () => {
    const d = decideStep(input([part('2022#20', { claim: true, support: false, relation: true }), part('2025#20', { claim: true, support: false, relation: false })]))
    expect(d.action).toBe('practice_method')
    expect(d.trace.focus).toBe('support')
    expect(d.trace.observation.blockedParts).toMatchObject({ support: 2, relation: 1 })
    expect(d.message).toMatch(/주장은 찾았지만/)
    expect(d.reason).toMatch(/support 2/)
  })
  it('주장부터 틀린 학습자 → 초점 claim(뒤 단계가 따라 틀려도 주장이 우선)', () => {
    const d = decideStep(input([part('2022#20', { claim: false, support: false, relation: false }), part('2025#20', { claim: false, support: false, relation: true })]))
    expect(d.trace.focus).toBe('claim')
    expect(d.message).toMatch(/주장 문장을 찾는/)
  })
  it('세부가 없으면 초점 없음 — v1 과 같은 문구', () => {
    const d = decideStep(input([row('2022#20', false), row('2025#20', false)]))
    expect(d.trace.focus).toBeNull()
    expect(d.trace.observation.blockedParts.unknown).toBe(2)
  })
  it('부분 정답을 통과로 바꾸지 않는다 — 완전 정답 기준 유지', () => {
    const d = decideStep(input([part('2022#20', { claim: true, support: true, relation: false }), part('2025#20', { claim: true, support: true, relation: false })]))
    expect(d.trace.observation.state).toBe('confirmed_need')
  })
})

describe('find-policy.v2 — 따라 틀린 부분을 따로 세지 않는다', () => {
  it('주장이 틀린 문항의 근거 · 관계 실패는 주장 실패로만 센다(첫 문장 편향 학습자 → 초점 claim)', () => {
    const p = (itemRef: string, parts: Record<string, boolean>) => ({ ...row(itemRef, false), parts })
    const d = decideStep(input([
      p('2022#20', { claim: false, support: false, relation: false }),
      p('2025#20', { claim: false, support: false, relation: true }),
      p('2016#20', { claim: true, support: false, relation: true }),
    ]))
    expect(d.trace.observation.blockedParts).toMatchObject({ claim: 2, support: 1 })
    expect(d.trace.focus).toBe('claim')
  })
})

describe('find-policy.v3 — 연습 뒤 새 지문 재확인', () => {
  // 이 묶음은 확인 문항 4개 단계(2020#20 이 새 지문)
  const C4 = [...CONFIRM, { itemRef: '2020#20', href: '/csat/item/2020-20#principle', label: '2020#20' }]
  const input = (rows: FindAttemptRow[], extra: Partial<DecisionInput> = {}): DecisionInput => {
    const confirm = extra.confirm ?? C4
    return {
      stepKey: 'structure', findTaskId: 'B6-3', chain: CHAIN, confirm, practiceHref: '/csat/practice/claim-support',
      outcome: findOutcome(confirm.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows),
      triedItems: [...new Set(rows.filter((r) => (r as { activity?: string }).activity !== 'practice').map((r) => r.itemRef))],
      ...extra,
    }
  }
  const at = (r: ReturnType<typeof row>, answeredAt: string, activity: string) => ({ ...r, answeredAt, activity })
  const base3 = [at(row('2022#20', false), '2026-10-10T01:00:00Z', 'theater'), at(row('2025#20', false), '2026-10-10T01:05:00Z', 'theater')]
  const practiced = at(row('2016#20', true), '2026-10-10T02:00:00Z', 'practice')
  it('연습 화면 기록은 확인 근거가 아니다 — 연습에서 맞혀도 진단 판정을 바꾸지 않는다', () => {
    const d = decideStep(input([...base3, practiced]))
    expect(d.trace.observation.state).toBe('confirmed_need')
    expect(d.trace.observation.items).not.toContain('2016#20')
  })
  it('연습 뒤 → 풀지도 연습하지도 않은 새 지문으로 재확인(연습한 지문 2016 · 푼 지문은 제외)', () => {
    const d = decideStep(input([...base3, practiced]))
    expect(d.action).toBe('recheck_new')
    expect(d.href).toBe('/csat/item/2020-20#principle')
  })
  it('연습 뒤 새 지문에서 맞힘 → 다음 단계', () => {
    const d = decideStep(input([...base3, practiced, at(row('2020#20', true), '2026-10-10T03:00:00Z', 'theater')]))
    expect(d.action).toBe('recheck_passed')
    expect(d.href).toBeNull()
  })
  it('연습 뒤 새 지문에서 막힘 → 같은 초점으로 다시 연습(링크에 초점)', () => {
    const fail = { ...at(row('2020#20', false), '2026-10-10T03:00:00Z', 'theater'), parts: { claim: true, support: false, relation: true } }
    const b = base3.map((r) => ({ ...r, parts: { claim: true, support: false, relation: true } }))
    const d = decideStep(input([...b, practiced, fail]))
    expect(d.action).toBe('practice_method')
    expect(d.href).toBe('/csat/practice/claim-support?focus=support')
    expect(d.reason).toMatch(/재확인 실패/)
  })
  it('새 지문이 없으면 같은 지문으로 재확인하지 않는다', () => {
    const d = decideStep(input([...base3, practiced], { confirm: CONFIRM }))
    expect(d.action).toBe('recheck_new')
    expect(d.href).toBeNull()
  })
})

describe('find-policy.v3 — 확인 전에 연습부터 한 학습자', () => {
  it('연습이 확인보다 먼저면 그 뒤 확인은 재확인이 아니라 진단 근거다(진단이 선다)', () => {
    const C4 = [...CONFIRM, { itemRef: '2020#20', href: '/csat/item/2020-20#principle', label: '2020#20' }]
    const rows = [
      { ...row('2020#20', false), isCorrect: null as unknown as boolean, answeredAt: '2026-10-10T00:30:00Z', activity: 'practice' },
      { ...row('2022#20', false), answeredAt: '2026-10-10T01:00:00Z', activity: 'theater' },
      { ...row('2025#20', false), answeredAt: '2026-10-10T01:05:00Z', activity: 'theater' },
    ] as FindAttemptRow[]
    const o = findOutcome(C4.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows)
    expect(o.state).toBe('confirmed_need')
    expect(o.recheck.items).toEqual([])
  })
})

describe('find-policy.v3 — 확인 문항 밖 지문의 방법 연습', () => {
  it('골격 지문에서 연습해도 처방 뒤 연습으로 인정 → 새 지문 재확인으로 간다', () => {
    const C4 = [...CONFIRM, { itemRef: '2020#20', href: '/csat/item/2020-20#principle', label: '2020#20' }]
    const rows = [
      { ...row('2022#20', false), answeredAt: '2026-10-10T01:00:00Z', activity: 'theater' },
      { ...row('2025#20', false), answeredAt: '2026-10-10T01:05:00Z', activity: 'theater' },
      { ...row('2019#22', false), taskKey: 'claim-support-skeleton', isCorrect: null as unknown as boolean, answeredAt: '2026-10-10T02:00:00Z', activity: 'practice' },
    ] as unknown as FindAttemptRow[]
    const o = findOutcome(C4.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows)
    expect(o.practiceAfterPrescription).toBe(true)
    const d = decideStep({ stepKey: 'structure', findTaskId: 'B6-3', outcome: o, chain: CHAIN, confirm: C4, triedItems: ['2022#20', '2025#20'], practiceHref: '/csat/practice/claim-support' })
    expect(d.action).toBe('recheck_new')
    expect(['/csat/item/2016-20#principle', '/csat/item/2020-20#principle']).toContain(d.href)
  })
})

describe('find-policy.v3 — 반복 회차(진단 → 연습 → 재확인 실패 → 재연습 → 재확인)', () => {
  // 반복 지적 원인: 경계를 「마지막 연습」 하나로 잡아, 재확인 실패 뒤 재연습이 오면 앞 재확인이 진단으로 섞였다 — 이 경로를 못 시험했다
  const C5 = [...CONFIRM, { itemRef: '2020#20', href: '/csat/item/2020-20#principle', label: '2020#20' }, { itemRef: '2021#20', href: '/csat/item/2021-20#principle', label: '2021#20' }]
  const T5 = C5.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' }))
  const at = (itemRef: string, ok: boolean | null, t: string, activity: string, taskKey = 'claim-support') =>
    ({ ...row(itemRef, false), isCorrect: ok, answeredAt: `2026-10-10T${t}:00Z`, activity, taskKey }) as unknown as FindAttemptRow
  const diag = [at('2022#20', false, '01:00', 'theater'), at('2025#20', false, '01:05', 'theater')]
  const p1 = at('2019#22', null, '02:00', 'practice', 'claim-support-skeleton')
  const r1 = at('2016#20', false, '03:00', 'theater')
  const p2 = at('2018#22', null, '04:00', 'practice', 'claim-support-skeleton')
  const r2 = at('2020#20', true, '05:00', 'theater')
  const dec = (rows: FindAttemptRow[]) => {
    const o = findOutcome(T5, rows)
    return { o, d: decideStep({ stepKey: 'structure', findTaskId: 'B6-3', outcome: o, chain: CHAIN, confirm: C5, triedItems: [...new Set(rows.filter((r) => r.activity !== 'practice').map((r) => r.itemRef))], practiceHref: '/csat/practice/claim-support' }) }
  }
  it('재확인 실패 → 같은 초점 재연습, 진단은 그대로 2문항', () => {
    const { o, d } = dec([...diag, p1, r1])
    expect(o.items).toEqual(['2022#20', '2025#20'])
    expect(o.recheck.items).toEqual(['2016#20'])
    expect(d.action).toBe('practice_method')
  })
  it('재연습 뒤 → 앞 재확인은 재확인으로 남고(진단에 섞이지 않음) 새 지문 재확인 차례', () => {
    const { o, d } = dec([...diag, p1, r1, p2])
    expect(o.state).toBe('confirmed_need')
    expect(o.items).toEqual(['2022#20', '2025#20'])
    expect(o.recheck.items).toEqual(['2016#20'])
    expect(o.recheck.pending).toBe(true)
    expect(d.action).toBe('recheck_new')
    expect(d.href).not.toMatch(/2016|2022|2025/)
  })
  it('두 번째 재확인 통과 → 다음 단계(최신 사건 기준)', () => {
    const { o, d } = dec([...diag, p1, r1, p2, r2])
    expect(o.recheck.items).toEqual(['2016#20', '2020#20'])
    expect(d.action).toBe('recheck_passed')
  })
})

describe('find-policy.v3 — 재확인한 지문을 나중에 연습해도', () => {
  it('앞 재확인은 재확인으로 남는다(진단으로 옮겨 가지 않는다)', () => {
    const C5 = [...CONFIRM, { itemRef: '2020#20', href: '/csat/item/2020-20#principle', label: '2020#20' }]
    const at = (itemRef: string, ok: boolean | null, t: string, activity: string, taskKey = 'claim-support') =>
      ({ ...row(itemRef, false), isCorrect: ok, answeredAt: `2026-10-10T${t}:00Z`, activity, taskKey }) as unknown as FindAttemptRow
    const rows = [at('2022#20', false, '01:00', 'theater'), at('2025#20', false, '01:05', 'theater'), at('2019#22', null, '02:00', 'practice', 'claim-support-skeleton'),
      at('2016#20', false, '03:00', 'theater'), at('2016#20', null, '04:00', 'practice')]
    const o = findOutcome(C5.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows)
    expect(o.items).toEqual(['2022#20', '2025#20'])
    expect(o.recheck.items).toEqual(['2016#20'])
    expect(o.recheck.pending).toBe(true)
  })
})
