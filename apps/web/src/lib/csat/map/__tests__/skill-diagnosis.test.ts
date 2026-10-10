// apps/web/src/lib/csat/map/__tests__/skill-diagnosis.test.ts
// 기능 단위 직접 확인 → CHECK → 재진단(계약 A · D-1 v1)
import { describe, expect, it } from 'vitest'

import { CHECK_ITEMS, EXPIRY_DAYS, skillDiagnosis, skillMessage, type SkillAttempt } from '../skill-diagnosis'

const T = ['a', 'b', 'c', 'd', 'e'].map((i) => ({ itemRef: i, taskKey: 'claim-support' }))
const now = new Date('2026-10-20T00:00:00Z')
const at = (d: number, h = 0) => new Date(Date.UTC(2026, 9, d, h)).toISOString()
const att = (item: string, ok: boolean, when: string, extra: Partial<SkillAttempt> = {}): SkillAttempt => ({
  userId: 'u', itemRef: item, taskKey: 'claim-support', phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent',
  afterViewedFirst: false, afterExplanation: false, answeredAt: when, ...extra,
})

describe('확정', () => {
  it('서로 다른 확인 문항 2개가 맞힌 것 없이 막히면 verified(처방 개방)', () => {
    const d = skillDiagnosis(T, [att('a', false, at(10)), att('b', false, at(11))], now)
    expect(d).toMatchObject({ status: 'verified', verified: true, verifiedAt: at(11), verifiedItems: ['a', 'b'] })
    expect(d.check.remaining).toEqual(['c', 'd', 'e'])
  })
  it('한 문항만 막히면 확정하지 않는다', () => {
    expect(skillDiagnosis(T, [att('a', false, at(10))], now).status).toBe('unverified')
  })
  it('먼저 맞힌 문항이 있으면 확정하지 않는다(섞인 결과는 원인 확정이 아니다)', () => {
    expect(skillDiagnosis(T, [att('a', true, at(9)), att('b', false, at(10)), att('c', false, at(11))], now).status).toBe('unverified')
  })
  it('독립이 아닌 시도는 세지 않는다 — 합성 · 해설 먼저 · 해설 뒤 · 시각 불확실', () => {
    const bad = [
      att('a', false, at(10), { synthetic: true }),
      att('b', false, at(10), { helpLevel: 'viewed_first' }),
      att('c', false, at(10), { afterExplanation: true }),
      att('d', false, at(10), { timingUncertain: true }),
    ]
    expect(skillDiagnosis(T, bad, now).status).toBe('unverified')
  })
  it('판단 시각이 없거나 다른 과제 · 단계의 시도는 쓰지 않는다', () => {
    expect(skillDiagnosis(T, [att('a', false, at(10)), att('b', false, '', { answeredAt: null })], now).status).toBe('unverified')
    expect(skillDiagnosis(T, [att('a', false, at(10)), att('b', false, at(11), { taskKey: 'cohesion-link' })], now).status).toBe('unverified')
    expect(skillDiagnosis(T, [att('a', false, at(10)), att('b', false, at(11), { phase: 'transfer' })], now).status).toBe('unverified')
  })
})

describe('CHECK · 재진단', () => {
  const base = [att('a', false, at(10)), att('b', false, at(11))]
  it(`확정 뒤 안 푼 문항 ${CHECK_ITEMS}개를 맞히면 resolved(처방 닫힘 · 다음 단계)`, () => {
    const d = skillDiagnosis(T, [...base, att('c', true, at(15)), att('d', true, at(16))], now)
    expect(d).toMatchObject({ status: 'resolved', verified: false, resolvedAt: at(16), check: { right: 2, wrong: 0 } })
  })
  it('CHECK 에서 하나라도 막히면 still_needed(처방 유지)', () => {
    const d = skillDiagnosis(T, [...base, att('c', true, at(15)), att('d', false, at(16))], now)
    expect(d).toMatchObject({ status: 'still_needed', verified: true, check: { right: 1, wrong: 1 } })
  })
  it('하나만 맞혔으면 아직 verified(확인 중)', () => {
    expect(skillDiagnosis(T, [...base, att('c', true, at(15))], now)).toMatchObject({ status: 'verified', check: { right: 1, wrong: 0, remaining: ['d', 'e'] } })
  })
  it('확정에 쓴 문항을 다시 푼 기록은 CHECK 가 아니다(미노출 문항만)', () => {
    expect(skillDiagnosis(T, [...base, att('a', true, at(15), { phase: 'practice' })], now).check.right).toBe(0)
  })
  it(`확정 뒤 ${EXPIRY_DAYS}일이 지나도 해소되지 않으면 expired(다시 확인)`, () => {
    const later = new Date(Date.UTC(2027, 2, 1))
    expect(skillDiagnosis(T, base, later)).toMatchObject({ status: 'expired', verified: false })
  })
  it('해소는 만료보다 앞선다(기한 뒤에 봐도 해소 기록은 그대로)', () => {
    const later = new Date(Date.UTC(2027, 2, 1))
    expect(skillDiagnosis(T, [...base, att('c', true, at(15)), att('d', true, at(16))], later).status).toBe('resolved')
  })
})

describe('Codex P1 회귀', () => {
  const base = [att('a', false, at(10)), att('b', false, at(11))]
  it('확정 전에 다른 단계로 본 문항은 CHECK 정답이어도 세지 않는다', () => {
    const d = skillDiagnosis(T, [att('c', true, at(9), { phase: 'transfer' }), ...base, att('c', true, at(15)), att('d', true, at(16))], now)
    expect(d.status).toBe('verified')
    expect(d.check.right).toBe(1)
    expect(d.check.remaining).toEqual(['e'])
  })
  it('서로 다른 과제 키의 오답을 합쳐 확정하지 않는다', () => {
    const mixed = [...T, { itemRef: 'x', taskKey: 'cohesion-link' }]
    const d = skillDiagnosis(mixed, [att('a', false, at(10)), att('x', false, at(11), { taskKey: 'cohesion-link' })], now)
    expect(d.status).toBe('unverified')
  })
  it('해소 뒤에 생긴 오답은 해소를 되돌리지 않는다(회차는 해소 시점에 끝)', () => {
    const d = skillDiagnosis(T, [...base, att('c', true, at(15)), att('d', true, at(16)), att('e', false, at(17))], now)
    expect(d).toMatchObject({ status: 'resolved', resolvedAt: at(16) })
  })
  it('다른 과제 키로 이미 본 문항도 CHECK 로 세지 않는다', () => {
    const d = skillDiagnosis(T, [att('c', true, at(9), { taskKey: 'cohesion-link' }), ...base, att('c', true, at(15)), att('d', true, at(16))], now)
    expect(d.status).toBe('verified')
    expect(d.check.right).toBe(1)
  })
  it('기한 뒤에 맞힌 CHECK 는 해소가 아니다(만료)', () => {
    const later = new Date(Date.UTC(2027, 4, 1))
    const lateOk = (item: string, m: number) => att(item, true, new Date(Date.UTC(2027, m, 1)).toISOString())
    expect(skillDiagnosis(T, [...base, lateOk('c', 3), lateOk('d', 3)], later).status).toBe('expired')
  })
  it('만료 뒤 새 문항 두 개에서 다시 막히면 새 회차로 다시 확정(재진단)', () => {
    const later = new Date(Date.UTC(2027, 4, 1))
    const lateBad = (item: string, d: number) => att(item, false, new Date(Date.UTC(2027, 3, d)).toISOString())
    const d = skillDiagnosis(T, [...base, lateBad('c', 1), lateBad('d', 2)], later)
    expect(d).toMatchObject({ status: 'verified', verified: true, verifiedItems: ['c', 'd'] })
  })
  it('CHECK 에서 막힌 뒤 다른 확인 문항 연속 2개를 맞히면 해소(누적 오답이 영구히 막지 않는다 · Codex P2)', () => {
    const T6 = ['a', 'b', 'c', 'd', 'e', 'f'].map((i) => ({ itemRef: i, taskKey: 'claim-support' }))
    const d = skillDiagnosis(T6, [...base, att('c', false, at(14)), att('d', true, at(15)), att('e', true, at(16))], now)
    expect(d).toMatchObject({ status: 'resolved', resolvedAt: at(16), check: { wrong: 1 } })
    expect(skillDiagnosis(T6, [...base, att('c', false, at(14)), att('d', true, at(15))], now).status).toBe('still_needed')
  })
  it('CHECK 에서 막혔어도 기한이 지나면 expired(처방 닫힘 · 다시 확인)', () => {
    const later = new Date(Date.UTC(2027, 2, 1))
    expect(skillDiagnosis(T, [...base, att('c', false, at(15))], later)).toMatchObject({ status: 'expired', verified: false })
  })
})

describe('문구', () => {
  it('약점 · 능력 단정 없이 이번 확인 기준으로만 말한다', () => {
    const v = skillMessage(skillDiagnosis(T, [att('a', false, at(10)), att('b', false, at(11))], now))
    expect(v).toMatch(/이번 확인 기준/)
    expect(v).not.toMatch(/약점|부족|취약|실력이 낮/)
    const r = skillMessage(skillDiagnosis(T, [att('a', false, at(10)), att('b', false, at(11)), att('c', true, at(15)), att('d', true, at(16))], now))
    expect(r).toMatch(/판정은 아니에요/)
  })
})
