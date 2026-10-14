// apps/web/src/lib/csat/map/v62/__tests__/order-spec.test.ts
// v6.2 P-F3(dry-run) — 부족 수요 → 기존 공장 공정 명세. 생산 가능 ≠ 학습자 공급 가능
import { describe, expect, it } from 'vitest'

import type { DemandLine } from '../demand'
import { factoryTypesFor, orderSpecFor } from '../order-spec'

const line = (o: Partial<DemandLine>): DemandLine => ({ role: 'guided_practice', task: 'v.contextual_sense', taskKeys: [], csatTypes: ['R-VOCAB'], quantity: { n: 1, unit: '문항' }, requires: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false }, reuse: true, reason: 'stage_repair', ...o })

describe('공장 명세(dry-run)', () => {
  it('V2(R-VOCAB) → vocab_choice · S5(R-GRAMMAR) → grammar_choice — CSAT_BACKING 을 뒤집은 값', () => {
    expect(factoryTypesFor(['R-VOCAB'])).toEqual(['vocab_choice'])
    expect(factoryTypesFor(['R-GRAMMAR'])).toEqual(['grammar_choice'])
  })
  it('V2 지도 연습 — 기존 드레인 명령은 있으나 단위 불일치 · 권리 · TASK 적합 · 실행 화면 공백과 승인이 함께 나온다', () => {
    const s = orderSpecFor(line({}))
    expect(s.factoryTypes).toEqual(['vocab_choice'])
    expect(s.commands.length).toBeGreaterThan(0)
    expect(s.unitSupported).toBe(false)
    expect(s.gaps).toEqual(expect.arrayContaining(['unit_mismatch', 'item_level_rights', 'task_fit_review', 'workspace_runner']))
    expect(s.approvals).toContain('bulk_generation_cost')
  })
  it('독립 확인 수요는 공장 문항으로 대신하지 않는다(Gold · 평가 자격 공백)', () => {
    const s = orderSpecFor(line({ role: 'independent_check', requires: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true } }))
    expect(s.gaps).toEqual(expect.arrayContaining(['gold_rubric', 'assessment_not_from_factory']))
  })
  it('평가원 유형 조건이 없으면 공장 유형도 명령도 없다', () => {
    const s = orderSpecFor(line({ task: 's.chunk_boundary', csatTypes: [] }))
    expect(s.factoryTypes).toEqual([])
    expect(s.commands).toEqual([])
    expect(s.gaps).toContain('no_factory_type')
  })
})
