// apps/web/src/lib/csat/map/v62/__tests__/learner-guide.test.ts
import { describe, expect, it } from 'vitest'

import { abilityNow, fallbackActions, PRINCIPLE_STEPS, principleItem, returnSummary, supplyBucket } from '../learner-guide'
import { SUPPLY_STEP_LABEL, type SupplyStep } from '../supply-ledger'

const check = (attempted: number, independent: number) => ({ taskKey: 'k', status: 'checking', independentItems: independent, attemptedItems: attempted, verifiedItems: [], wrongItems: [], unseen: [], examSeen: [], verifiedAt: null }) as never

describe('supplyBucket', () => {
  it('검수 전 자료를 정식 공급(qualified · delivered)으로 세지 않는다', () => {
    for (const s of ['read_now', 'open_unqualified', 'stock_review_wait', 'needs_review'] as SupplyStep[]) expect(supplyBucket(s)).toBe('unreviewed')
    expect(supplyBucket('learn_now')).toBe('qualified')
    expect(supplyBucket('release_wait')).toBe('release_wait')
    expect(supplyBucket('producing')).toBe('in_production')
    expect(supplyBucket('not_ready')).toBe('content_gap')
  })
  it('모든 공급 단계가 범주를 가진다', () => {
    for (const s of Object.keys(SUPPLY_STEP_LABEL) as SupplyStep[]) expect(supplyBucket(s)).toBeTruthy()
  })
})

describe('abilityNow', () => {
  it('기록이 없으면 측정 전 · 퍼센트 없음', () => {
    const a = abilityNow({ check: null, needed: true, goalSet: true, assessmentQualified: false })
    expect(a.progress).toEqual(['not_measured', 'goal_unconfirmable'])
    expect(a.lines.join(' ')).not.toMatch(/%/)
  })
  it('수행량과 독립 근거를 가른다', () => {
    const a = abilityNow({ check: check(3, 1), needed: true, goalSet: true, assessmentQualified: true })
    expect(a.progress).toEqual(['practice_done', 'independent_evidence'])
  })
})

describe('fallbackActions', () => {
  it('정식 공급이 있으면 null', () => {
    expect(fallbackActions([{ role: 'independent_check', bucket: 'qualified' }], true)).toBeNull()
  })
  it('정식 공급 0 이면 구체 행동 — 연습은 독립 근거 아님을 밝힌다', () => {
    const f = fallbackActions([{ role: 'independent_check', bucket: 'unreviewed' }], true)!
    expect(f.map((x) => x.kind)).toEqual(['read_explanation', 'practice_unqualified'])
    expect(f[1].text).toContain('독립 근거로는 세지 않아요')
  })
  it('아무것도 없으면 wait', () => {
    expect(fallbackActions([{ role: 'transfer', bucket: 'content_gap' }], false)!.map((x) => x.kind)).toEqual(['wait'])
  })
})

describe('principle path', () => {
  it('측정 → 관계 → 정답 → 오답 → 내 말 → 전이 순서', () => {
    expect(PRINCIPLE_STEPS.map((s) => s.id)).toEqual(['measures', 'relations', 'answer', 'distractor', 'explain', 'transfer'])
    expect(PRINCIPLE_STEPS.at(-1)!.query).toBeNull()
  })
  it('이미 푼 확인 문항을 연구 사례보다 먼저 고른다', () => {
    expect(principleItem([{ item: 'a#1', basis: 'research_case', research: 'direct' }, { item: 'b#2', basis: 'attempted_check_item', research: null }])!.item).toBe('b#2')
    expect(principleItem([])).toBeNull()
  })
})

const NO_RECAP = { latest: { state: 'none' as const }, transfer: { state: 'none' as const, done: 0, planned: 2 }, plan: null }

describe('returnSummary', () => {
  it('계획 그대로 · 제안과 확정 분리', () => {
    const out = returnSummary({ check: check(2, 0), taskDisplay: 'R5', recap: NO_RECAP, remaining: '확인 필요', nextLabel: '확인하기', notes: [], planVersion: 3, goalVersion: 7 })
    expect(out[0]).toContain('R5')
    expect(out[1]).toContain('독립 근거로 센 풀이는 없어요')
    expect(out.at(-1)).toContain('v3')
    expect(out.at(-1)).toContain('제안')
  })
  it('계획이 바뀐 경우 별도 안내(returnNotes)에 맡긴다', () => {
    const out = returnSummary({ check: null, taskDisplay: 'R5', recap: NO_RECAP, remaining: 'x', nextLabel: null, notes: [{ kind: 'goal_changed' }], planVersion: 3, goalVersion: 7 })
    expect(out.join(' ')).not.toContain('그대로예요')
  })
})

describe('supplyBucket — 유효 납품만 정식 공급(Codex P2)', () => {
  it('유효 수량 미확인 · 부분 납품은 「납품 완료」가 아니고 0건 대안을 숨기지 않는다', () => {
    expect(supplyBucket('delivered_count_unknown')).toBe('unreviewed')
    expect(supplyBucket('partially_delivered')).toBe('in_production')
    expect(supplyBucket('delivered')).toBe('delivered')
    const f = fallbackActions([{ role: 'transfer', bucket: supplyBucket('delivered_count_unknown') }], true)
    expect(f).not.toBeNull()
  })
})
