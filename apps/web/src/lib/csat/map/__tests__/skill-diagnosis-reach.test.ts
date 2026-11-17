// apps/web/src/lib/csat/map/__tests__/skill-diagnosis-reach.test.ts
// T-0096 — 직접 확인 판정이 코드북 도달 조건 · 관찰 제한을 따른다(T-0088 D4-1 · N2 · N3 · T-0092 D4-DEC-01 · T-0095 설계 메모의 회귀 이름).
// 채점(isCorrect)은 바꾸지 않는다 — 진단 자격에서만 확정을 막는다. 합성 fixture · 고정 시각.
import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import { reachPolicyOf, skillDiagnosis, type SkillTarget } from '../skill-diagnosis'
import { asIsMap } from '../v4/as-is'
import { taskOf, DOMAINS, type Domain } from '../v4/definition'
import { toBeMap } from '../v4/to-be'

const day = (n: number, h = 0) => new Date(Date.UTC(2026, 8, 1, h) + n * 86_400_000).toISOString()
const att = (taskKey: string, itemRef: string, ok: boolean, at: string): FindAttemptRow => ({ userId: 'u', itemRef, taskKey, phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: at, activity: 'theater', sessionId: 's', contentHash: 'h', expectedContentHash: 'h' })
const targets = (taskKey: string, items: string[], passage = true): SkillTarget[] => items.map((itemRef) => ({ itemRef, taskKey, passageKey: passage ? `p-${itemRef}` : null }))
const NOW = new Date(day(60))

describe('정책은 코드북 문장에서 나온다', () => {
  it('R5 · E2 · E3 · R2', () => {
    expect(reachPolicyOf(taskOf('r.central_meaning').criterion)).toEqual({ distinctPassages: true, differentDay: true, observationOnly: false })
    expect(reachPolicyOf(taskOf('e.evidence_location').criterion)).toMatchObject({ differentDay: true, observationOnly: false })
    expect(reachPolicyOf(taskOf('e.option_correspondence').criterion).observationOnly).toBe(true)
    expect(reachPolicyOf(taskOf('r.relation').criterion).observationOnly).toBe(true)
  })
})

describe('N3 — E3 · R2 관찰 제한', () => {
  const E3 = reachPolicyOf(taskOf('e.option_correspondence').criterion)
  it('skillDiagnosis_E3_two_lure_observations_do_not_verify', () => {
    const d = skillDiagnosis(targets('option-restate', ['a', 'b', 'c']), [att('option-restate', 'a', false, day(1)), att('option-restate', 'b', false, day(2))], NOW, E3)
    expect(d.status).toBe('unverified')
    expect(d.verified).toBe(false)
  })

  it('skillDiagnosis_E3_existing_boolean_only_history_does_not_open_repair — 저장된 정오 기록도 조회 때 다시 판정', () => {
    // 같은 기록을 정책 없이(옛 판정) 읽으면 확정되던 것 — 정책이 있으면 확정하지 않는다(isCorrect 는 그대로 false)
    const hist = [att('option-restate', 'a', false, day(1)), att('option-restate', 'b', false, day(2))]
    expect(skillDiagnosis(targets('option-restate', ['a', 'b']), hist, NOW).status).toBe('verified')
    expect(skillDiagnosis(targets('option-restate', ['a', 'b']), hist, NOW, E3).status).toBe('unverified')
    expect(hist.every((h) => h.isCorrect === false)).toBe(true)
  })

  const proxy = { state: Object.fromEntries(DOMAINS.map((d) => [d, 'observed'])) as Record<Domain, 'observed'>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> }
  const map = (attempts: FindAttemptRow[]) => asIsMap({ asOf: day(30), sessions: [], axisProxy: proxy, checks: [{ taskKey: 'option-restate', items: ['a', 'b', 'c'] }, { taskKey: 'cohesion-link', items: ['x', 'y', 'z'] }], attempts })

  it('asIs_E3_observation_kept_without_confirmed_need', () => {
    const a = map([att('option-restate', 'a', false, day(1)), att('option-restate', 'b', false, day(2))])
    const t = a.tasks['e.option_correspondence']
    expect(t.status).not.toBe('verified_need')
    expect(t.check?.independentItems).toBe(2) // 관찰(독립 시도 수)은 남는다
  })

  it('asIs_R2_facet_observation_does_not_confirm_weakness_or_disable_R1', () => {
    const a = map([att('cohesion-link', 'x', false, day(1)), att('cohesion-link', 'y', false, day(2))])
    expect(a.tasks['r.relation'].status).not.toBe('verified_need')
    expect(a.tasks['r.relation'].check?.independentItems).toBe(2)
    expect(a.tasks['r.reference'].status).not.toBe('unmeasurable') // R1 은 R2 제한으로 막지 않는다
  })

  it('replan_E3_lure_only_history_does_not_propose_repair — To-Be 에 바로잡기 요구가 생기지 않는다', () => {
    const a = map([att('option-restate', 'a', false, day(1)), att('option-restate', 'b', false, day(2))])
    const tb = toBeMap({ asIs: a, goal: { score: 90, set: true }, refItems: [], lineRefItems: {}, confirmLinks: {} })
    expect(tb?.needs.find((n) => n.task === 'e.option_correspondence')?.type).not.toBe('REPAIR')
  })
})

describe('handoff-1 · D4-DEC-01 — R5 · E2 도달 조건', () => {
  const R5 = reachPolicyOf(taskOf('r.central_meaning').criterion)
  const E2 = reachPolicyOf(taskOf('e.evidence_location').criterion)
  const K = 'claim-support'
  const verify = [att(K, 'i1', false, day(1)), att(K, 'i2', false, day(2))]

  it('R5_same_passage_cannot_resolve', () => {
    const t = targets(K, ['i1', 'i2', 'i3', 'i4', 'i5']).map((x) => (x.itemRef === 'i4' ? { ...x, passageKey: 'p-i3' } : x))
    expect(skillDiagnosis(t, [...verify, att(K, 'i3', true, day(3)), att(K, 'i4', true, day(4))], NOW, R5).status).toBe('verified')
  })

  it('R5_same_day_cannot_resolve', () => {
    expect(skillDiagnosis(targets(K, ['i1', 'i2', 'i3', 'i4', 'i5']), [...verify, att(K, 'i3', true, day(3)), att(K, 'i4', true, day(4)), att(K, 'i5', true, day(4, 3))], NOW, R5).status).toBe('pending_delayed')
  })

  it('R5_distinct_passages_and_required_later_day_resolve', () => {
    const d = skillDiagnosis(targets(K, ['i1', 'i2', 'i3', 'i4', 'i5']), [...verify, att(K, 'i3', true, day(3)), att(K, 'i4', true, day(4)), att(K, 'i5', true, day(5))], NOW, R5)
    expect(d.status).toBe('resolved')
    expect(d.resolvedAt).toBe(day(5))
  })

  it('missing_passage_or_role_metadata_stays_unestablished', () => {
    expect(skillDiagnosis(targets(K, ['i1', 'i2', 'i3', 'i4', 'i5'], false), [...verify, att(K, 'i3', true, day(3)), att(K, 'i4', true, day(4)), att(K, 'i5', true, day(5))], NOW, R5).status).toBe('verified')
  })

  it('E2_required_other_day_not_bypassed', () => {
    const k = 'evidence-locate'
    const base = [att(k, 'a', false, day(1)), att(k, 'b', false, day(2)), att(k, 'c', true, day(3)), att(k, 'd', true, day(3, 1))]
    expect(skillDiagnosis(targets(k, ['a', 'b', 'c', 'd', 'e']), base, NOW, E2).status).toBe('pending_delayed')
    expect(skillDiagnosis(targets(k, ['a', 'b', 'c', 'd', 'e']), [...base, att(k, 'e', true, day(4, 6))], NOW, E2).status).toBe('resolved')
  })

  it('조건 없는 · E2 TASK 는 지문 키가 같아도 서로 다른 문항으로 센다(Codex F1 반례)', () => {
    const same = (k: string, items: string[]) => items.map((itemRef) => ({ itemRef, taskKey: k, passageKey: 'same-passage' }))
    const k = 'evidence-locate'
    const base = [att(k, 'a', false, day(1)), att(k, 'b', false, day(2)), att(k, 'c', true, day(3)), att(k, 'd', true, day(4))]
    expect(skillDiagnosis(same(k, ['a', 'b', 'c', 'd', 'e']), base, NOW).status).toBe('resolved')
    expect(skillDiagnosis(same(k, ['a', 'b', 'c', 'd', 'e']), [...base, att(k, 'e', true, day(5))], NOW, E2).status).toBe('resolved')
  })

  it('R5 지연 재확인 정답의 지문 정체를 모르면 세지 않는다(Codex ④)', () => {
    const t = targets(K, ['i1', 'i2', 'i3', 'i4', 'i5']).map((x) => (x.itemRef === 'i5' ? { ...x, passageKey: null } : x))
    expect(skillDiagnosis(t, [...verify, att(K, 'i3', true, day(3)), att(K, 'i4', true, day(4)), att(K, 'i5', true, day(5))], NOW, R5).status).toBe('pending_delayed')
  })

  it('조건 없는 TASK 는 기존 판정 그대로(연속 2 정답 → resolved)', () => {
    expect(skillDiagnosis(targets(K, ['i1', 'i2', 'i3', 'i4']), [...verify, att(K, 'i3', true, day(3)), att(K, 'i4', true, day(3, 1))], NOW).status).toBe('resolved')
  })
})

describe('N2 — 확인 키별 판정 분리', () => {
  it('R5_different_task_keys_one_failure_each_do_not_verify', () => {
    const t = [...targets('claim-support', ['k1', 'k2']), ...targets('r5-central-meaning', ['a1', 'a2'])]
    expect(skillDiagnosis(t, [att('claim-support', 'k1', false, day(1)), att('r5-central-meaning', 'a1', false, day(2))], NOW).status).toBe('unverified')
  })
})
