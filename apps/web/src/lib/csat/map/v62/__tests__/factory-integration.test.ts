// apps/web/src/lib/csat/map/v62/__tests__/factory-integration.test.ts
// v6.2 — 학습지도 × Workspace × 교재공장 연계 계약: 요청 · 응답 형식 · 자격 연결 · 결속 · mock 수직 시나리오 A~H
import { describe, expect, it } from 'vitest'

import type { DemandLine, MaterialRole, WorkspaceDemand } from '../demand'
import {
  bindToWorkspace, buildFactoryRequests, existingAssetManifest, FACTORY_CONNECTION, qualifyArtifact, reconcileRequest,
  reportableStatus, runnerFor, validateManifest, type FactoryRequest, type FactoryResultManifest,
} from '../factory-integration'
import { mockFactory } from '../factory-mock'
import type { Axis, AxisState, FqResult } from '../qualification'
import type { SupplyLine } from '../supply'

const USER = 'user-1'
const req = (role: MaterialRole, quantity = 3, gold = false) =>
  ({ role, quantity, gold })
function demand(task: string, csat: string[], lines: { role: MaterialRole; quantity?: number; gold?: boolean }[], o: Partial<WorkspaceDemand> = {}): WorkspaceDemand {
  return {
    key: `wd-${task}`, template: 'ws.reading', workspaceId: 'ws-1', goalVersion: 7, planVersion: 2, definitionVersion: 'v6.2', asOf: '2026-10-15T00:00:00Z',
    core: task as WorkspaceDemand['core'], support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: lines.map((l): DemandLine => ({
      role: l.role, task: task as DemandLine['task'], taskKeys: [], csatTypes: csat, quantity: { n: l.quantity ?? 3, unit: '문항' },
      requires: { rightsUsable: true, gold: l.gold ?? false, unseenByLearner: !!l.gold, noExplanationBefore: !!l.gold }, reuse: true, reason: 'stage_repair',
    })),
    ...o,
  } as WorkspaceDemand
}
const fq = (id: string, rev: string, task: string, role: MaterialRole, axes: Partial<Record<Axis, AxisState>> = {}): FqResult => ({
  content: { id, revision: rev }, task, role, eligibleRoles: [], publicQualified: false, assessmentQualified: false,
  axes: Object.fromEntries((['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as Axis[]).map((k) => [k, { state: axes[k] ?? 'pass' }])) as FqResult['axes'],
})
const real = (m: FactoryResultManifest): FactoryResultManifest => ({
  ...m, mode: 'REAL', runId: 'run-1', artifacts: m.artifacts.map((a) => ({ ...a, provenance: { runId: 'run-1', mock: false }, lifecycle: 'product', quality: 'passed', rights: 'cleared' })),
})

describe('공장 연결 상태 — 실제 지원 범위를 그대로', () => {
  it('주문 API · 활동 단위 · manifest 반환은 미지원, 권 단위는 수동 드레인, 연계는 MOCK_ONLY', () => {
    expect(FACTORY_CONNECTION).toEqual({ orderApi: 'UNSUPPORTED', activityUnit: 'UNSUPPORTED', volumeUnit: 'MANUAL_DRAIN', manifest: 'UNSUPPORTED', mode: 'MOCK_ONLY' })
  })
})

describe('WorkspaceDemand → FactoryRequest', () => {
  const d = demand('v.contextual_sense', ['R-VOCAB'], [req('guided_practice', 4), req('independent_check', 2, true), req('model_explanation', 2)])
  const rs = buildFactoryRequests(USER, d)
  it('줄마다 요청 · 교육 명세 · 계획량 근거 · 버전 · 연결 모드', () => {
    expect(rs).toHaveLength(3)
    const g = rs[0]!
    expect(g.education.teachingStage).toBe('지도 연습')
    expect(g.quantity).toEqual({ n: 4, unit: '문항', basis: 'plan_stage_quantity' })
    expect(g.versions).toEqual({ goal: 7, plan: 2, definition: 'v6.2' })
    expect(g.connection).toBe('MOCK_ONLY')
    expect(g.constraints.versionBinding).toBe('exact_revision')
  })
  it('B — V2 지도 연습: 공장 어휘 유형(vocab_choice)에 대응 · 권 단위로만 변환 가능(활동 단위 미지원)', () => {
    expect(rs[0]!.content.factoryTypes).toContain('vocab_choice')
    expect(rs[0]!.productionUnit.support).toBe('convertible_to_volume')
    expect(rs[0]!.productionUnit.why).toBe('activity_unit_unsupported')
    expect(rs[0]!.postReview).toEqual(expect.arrayContaining(['unit_mismatch', 'task_fit_review', 'item_level_rights', 'workspace_runner']))
  })
  it('평가 역할은 공장 산출물로 공급하지 않는다 · 설명 활동은 별도 단위 필요', () => {
    expect(rs[1]!.productionUnit).toMatchObject({ support: 'unsupported', why: 'assessment_not_from_factory', commands: [] })
    expect(rs[2]!.productionUnit.support).toBe('unit_support_needed')
  })
  it('기출 유형 미확인이면 unconfirmed(무관으로 바꾸지 않는다) · 재고 유무와 무관하게 수요 줄 보존', () => {
    const u = buildFactoryRequests(USER, demand('r.flow_order', [], [req('guided_practice')]))
    expect(u).toHaveLength(1)
    expect(u[0]!.productionUnit.support).toBe('unconfirmed')
  })
  it('G — 같은 수요 revision → 같은 요청 id · 키(재사용) · 같은 키 다른 본문은 거절 · PLAN 개정은 새 키', () => {
    const again = buildFactoryRequests(USER, d)
    expect(again.map((r) => r.requestId)).toEqual(rs.map((r) => r.requestId))
    expect(reconcileRequest(rs[0]!, again[0]!)).toEqual({ action: 'reuse' })
    const tampered: FactoryRequest = { ...again[0]!, quantity: { ...again[0]!.quantity, n: 9 } }
    expect(reconcileRequest(rs[0]!, tampered)).toEqual({ action: 'reject', why: 'same_key_different_body' })
    const revised = buildFactoryRequests(USER, demand('v.contextual_sense', ['R-VOCAB'], [req('guided_practice', 4)], { planVersion: 3 }))
    expect(revised[0]!.idempotencyKey).not.toBe(rs[0]!.idempotencyKey)
    expect(buildFactoryRequests('user-2', d)[0]!.idempotencyKey).not.toBe(rs[0]!.idempotencyKey)
  })
})

describe('FactoryResultManifest 형식', () => {
  const r = buildFactoryRequests(USER, demand('v.contextual_sense', ['R-VOCAB'], [req('guided_practice')]))[0]!
  it('mock 응답은 형식은 통과하되 보고 상태는 MOCK_ONLY — 실제 생산 완료로 보이지 않는다', () => {
    const m = mockFactory(r, 'produced_unreviewed')
    expect(validateManifest(m, r)).toEqual([])
    expect(reportableStatus(m)).toBe('MOCK_ONLY:review_pending')
  })
  it('H — 실제 실행 기록 없는 REAL 주문 계열 상태는 오류 · 보고는 요청 명세 단계로 내린다', () => {
    const m: FactoryResultManifest = { ...real(mockFactory(r, 'produced_unreviewed')), runId: null }
    expect(validateManifest(m, r)).toContain('real_status_without_run')
    expect(reportableStatus(m)).toBe('spec_created')
  })
  it('다른 요청 · 해시 없는 산출물 · 수량 불일치 · 이유 없는 실패 · 공장의 공급 허가는 오류', () => {
    const m = mockFactory(r, 'produced_unreviewed')
    expect(validateManifest({ ...m, requestId: 'x' }, r)).toContain('request_mismatch')
    expect(validateManifest({ ...m, artifacts: [{ ...m.artifacts[0]!, sha256: 'abc' }], producedCount: 1 }, r)).toContain(`artifact_without_hash:${m.artifacts[0]!.id}`)
    expect(validateManifest({ ...m, producedCount: 99 }, r)).toContain('count_mismatch')
    expect(validateManifest({ ...mockFactory(r, 'factory_failed'), failure: null }, r)).toContain('failure_without_reason')
    expect(validateManifest({ ...m, status: 'supply_allowed' as never }, r)).toContain('factory_cannot_grant_supply')
    expect(validateManifest({ ...m, artifacts: m.artifacts.map((a) => ({ ...a, provenance: { runId: 'x', mock: false } })) }, r)).toContain('mock_artifact_claims_real')
  })
  it('지원 안 하는 단위는 mock 도 「미지원」으로 답한다', () => {
    const a = buildFactoryRequests(USER, demand('v.contextual_sense', ['R-VOCAB'], [req('independent_check', 2, true)]))[0]!
    const m = mockFactory(a, 'produced_unreviewed')
    expect(m.status).toBe('unsupported')
    expect(m.failure?.code).toBe('production_unit_unsupported')
  })
})

describe('자격 연결 · 결속 — 시나리오', () => {
  const v2 = buildFactoryRequests(USER, demand('v.contextual_sense', ['R-VOCAB'], [req('guided_practice')]))[0]!
  const APPROVED = { public: true, assessment: true }

  it('D — 테스트 교재는 제품 콘텐츠로 자동 공급되지 않는다(test_fixture 유지 · 보류)', () => {
    const m = mockFactory(v2, 'test_fixture')
    for (const a of m.artifacts) {
      expect(a.lifecycle).toBe('test_fixture')
      expect(qualifyArtifact(a, v2, fq(a.id, a.revision, v2.task, v2.role), APPROVED)).toEqual({ state: 'review_pending', reasons: ['test_fixture'] })
    }
  })
  it('E — 원천 · 권리 · Gold · 실행 미확정은 목적별 보류 이유 · fail 축은 부적격 · 공장 검수 실패는 부적격', () => {
    const m = real(mockFactory(v2, 'produced_unreviewed'))
    const a = m.artifacts[0]!
    expect(qualifyArtifact(a, v2, null, APPROVED)).toEqual({ state: 'review_pending', reasons: ['no_qualification_record'] })
    expect(qualifyArtifact(a, v2, fq(a.id, a.revision, v2.task, v2.role, { A: 'unknown', H: 'unknown' }), APPROVED))
      .toEqual({ state: 'review_pending', reasons: ['axis_unknown:content', 'axis_unknown:runnable'] })
    expect(qualifyArtifact(a, v2, fq(a.id, a.revision, v2.task, v2.role, { B: 'fail' }), APPROVED)).toEqual({ state: 'ineligible', reasons: ['axis_fail:content'] })
    expect(qualifyArtifact(a, v2, fq(a.id, a.revision, v2.task, v2.role), { public: false, assessment: false })).toEqual({ state: 'review_pending', reasons: ['axis_unknown:rights'] })
    const failed = real(mockFactory(v2, 'review_failed')).artifacts[0]!
    expect(qualifyArtifact({ ...failed, quality: 'failed' }, v2, fq(failed.id, failed.revision, v2.task, v2.role), APPROVED).state).toBe('ineligible')
  })
  it('F — revision 이 바뀌면 이전 검수를 상속하지 않는다', () => {
    const a = real(mockFactory(v2, 'produced_unreviewed')).artifacts[0]!
    expect(qualifyArtifact({ ...a, revision: 'r2' }, v2, fq(a.id, a.revision, v2.task, v2.role), APPROVED)).toEqual({ state: 'review_pending', reasons: ['revision_mismatch'] })
  })
  it('C — S5: 공장 유형 대응(grammar_choice)이 있어도 TASK 적합성은 자동 PASS 아님(검수 기록 없으면 보류 · TASK 다른 기록은 상속 안 함)', () => {
    const s5 = buildFactoryRequests(USER, demand('s.form_scope', ['R-GRAMMAR'], [req('guided_practice')]))[0]!
    expect(s5.content.factoryTypes).toContain('grammar_choice')
    expect(s5.postReview).toContain('task_fit_review')
    const a = real(mockFactory(s5, 'produced_unreviewed')).artifacts[0]!
    expect(qualifyArtifact(a, s5, null, APPROVED).state).toBe('review_pending')
    // 형태 선택(다른 TASK)으로 받은 자격을 의미 범위 수행(s.form_scope)에 쓰지 않는다
    expect(qualifyArtifact(a, s5, fq(a.id, a.revision, 's.chunk_boundary', 'guided_practice'), APPROVED)).toEqual({ state: 'review_pending', reasons: ['task_mismatch'] })
  })
  it('B — 적격이어도 실행기가 없는 교재 유형은 공급 0(어댑터 필요) · vocab_choice 는 개발 화면 전용', () => {
    const m = real(mockFactory(v2, 'produced_unreviewed'))
    const verdicts = Object.fromEntries(m.artifacts.map((a) => [a.id, qualifyArtifact(a, v2, fq(a.id, a.revision, v2.task, v2.role), APPROVED)]))
    expect(Object.values(verdicts).every((v) => v.state === 'accept')).toBe(true)
    const b = bindToWorkspace(v2, m, verdicts, 'stage_repair')
    expect(b.suppliable).toBe(0)
    expect(b.blockedReasons).toContain('runner:dcp_underline_dev_only')
    expect(runnerFor({ kind: 'dcp_item', contentType: 'unit_vocab' })).toBe('adapter_needed')
    expect(runnerFor({ kind: 'dcp_item', contentType: 'topic' })).toBe('dcp_existing')
  })
  it('H — mock manifest 는 산출물이 accept 여도 공급 수 0 · 막힌 이유 mock_only', () => {
    const r = buildFactoryRequests(USER, demand('r.central_meaning', ['R-TOPIC'], [req('guided_practice')]))[0]!
    const m = { ...mockFactory(r, 'produced_unreviewed'), artifacts: mockFactory(r, 'produced_unreviewed').artifacts.map((a) => ({ ...a, contentType: 'topic' })) }
    const verdicts = Object.fromEntries(m.artifacts.map((a) => [a.id, { state: 'accept' as const, reasons: [] }]))
    const b = bindToWorkspace(r, m, verdicts, 'stage_repair')
    expect(b.suppliable).toBe(0)
    expect(b.blockedReasons).toContain('mock_only')
    expect(b.fulfillment).toBe('not_supplied')
  })
  it('실제 실행 기록 · 적격 · 실행기 있는 산출물만 공급 수에 든다(계약상 · 실제 공장 응답은 아직 없음)', () => {
    const r = buildFactoryRequests(USER, demand('r.central_meaning', ['R-TOPIC'], [req('guided_practice', 2)]))[0]!
    const m0 = real(mockFactory(r, 'produced_unreviewed'))
    const m = { ...m0, artifacts: m0.artifacts.map((a) => ({ ...a, contentType: 'topic' })) }
    const verdicts = Object.fromEntries(m.artifacts.map((a) => [a.id, qualifyArtifact(a, r, fq(a.id, a.revision, r.task, r.role), APPROVED)]))
    const b = bindToWorkspace(r, m, verdicts, 'stage_repair')
    expect(b.suppliable).toBe(2)
    expect(b.fulfillment).toBe('fully_supplied')
    expect(b.learnerGate).toBe('check_at_delivery')
    expect(b.returnTo).toEqual({ planVersion: 2, task: 'r.central_meaning' })
  })
})

describe('A — R5 기존 자산', () => {
  it('출시된 확인 과제는 EXISTING manifest 로 결속 · 기존 실행 화면 · 같은 PLAN · TASK 로 복귀', () => {
    const r = buildFactoryRequests(USER, demand('r.central_meaning', ['R-TOPIC'], [req('independent_check', 2, true)]))[0]!
    expect(r.productionUnit.support).toBe('unsupported') // 공장에는 주문하지 않는다
    const supply: SupplyLine = {
      role: 'independent_check', state: 'available', delivered: [{ ref: '2022-20', source: 'check_task' }, { ref: '2025-20', source: 'check_task' }],
      shortfall: 0, reason: '', qualification: { producible: true, rights: true, content: true, teaching: true, assessment: true, learner: true, runnable: true },
    }
    const { manifest, verdicts } = existingAssetManifest(r, supply, (ref) => 'f'.repeat(63) + String(ref.length % 10))
    expect(validateManifest(manifest, r)).toEqual([])
    const b = bindToWorkspace(r, manifest, verdicts, 'stage_check')
    expect(b.suppliable).toBe(2)
    expect(b.items.every((i) => i.runner === 'csat_item_screen')).toBe(true)
    expect(b.learnerGate).toBe('check_at_delivery')
    expect(b.returnTo).toEqual({ planVersion: 2, task: 'r.central_meaning' })
    expect(manifest.artifacts.every((a) => a.lifecycle === 'product' && !a.provenance.mock)).toBe(true)
  })
  it('기존 자산이 지금 쓸 수 없으면(모두 풀었음 등) 결속하지 않는다', () => {
    const r = buildFactoryRequests(USER, demand('r.central_meaning', ['R-TOPIC'], [req('independent_check', 2, true)]))[0]!
    const supply: SupplyLine = { role: 'independent_check', state: 'unsupported', delivered: [], shortfall: 2, reason: '', qualification: { producible: null, rights: null, content: null, teaching: null, assessment: null, learner: null, runnable: null } }
    const { manifest, verdicts } = existingAssetManifest(r, supply, () => 'a'.repeat(64))
    expect(bindToWorkspace(r, manifest, verdicts, 'stage_check').suppliable).toBe(0)
  })
})
