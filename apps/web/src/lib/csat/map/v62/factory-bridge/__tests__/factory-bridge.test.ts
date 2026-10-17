// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/factory-bridge.test.ts
//
// I0 — 학습지도 × 교재공장 연결 계약 반례 S01–S16 + golden vectors(순수 · CONTRACT_ONLY). fixture PASS 는 실제 생산 · 공급 PASS 가 아니다.
import { describe, expect, it } from 'vitest'

import type { DemandLine, MaterialRole, WorkspaceDemand } from '../../demand'
import { buildFactoryRequests, reconcileRequest } from '../../factory-integration'
import type { Axis, AxisState, FqResult, ReleaseApproval } from '../../qualification'
import { CROSSWALK, crosswalkFor, crosswalkUsable, FACTORY_SKILL_NAME } from '../crosswalk'
import { cellIdOf, verifyLineage, type ArtifactRef, type CellRef, type DemandOrderLink } from '../lineage'
import { projectUnits } from '../material-unit'
import { groupSharedNeeds, productionNeed, PRODUCT_BRIEF_FIELDS, type BriefDraft } from '../production-need'
import { resolveStock, type StockCandidate } from '../stock-resolver'

const H = (c: string) => c.repeat(64)
function demand(task: string, csat: string[], lines: { role: MaterialRole; n?: number; gold?: boolean }[], o: Partial<WorkspaceDemand> = {}): WorkspaceDemand {
  return {
    key: `wd-${task}`, template: 'ws.x', workspaceId: 'ws-1', goalVersion: 7, planVersion: 2, definitionVersion: 'v6.2', asOf: '2026-10-17T00:00:00Z',
    core: task as WorkspaceDemand['core'], support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: lines.map((l): DemandLine => ({ role: l.role, task: task as DemandLine['task'], taskKeys: [], csatTypes: csat, quantity: { n: l.n ?? 2, unit: '문항' }, requires: { rightsUsable: true, gold: !!l.gold, unseenByLearner: !!l.gold, noExplanationBefore: !!l.gold }, reuse: true, reason: 'stage_repair' })),
    ...o,
  } as WorkspaceDemand
}
const fq = (id: string, rev: string, task: string, role: MaterialRole, axes: Partial<Record<Axis, AxisState>> = {}): FqResult => ({
  content: { id, revision: rev }, task, role, eligibleRoles: [], publicQualified: true, assessmentQualified: true,
  axes: Object.fromEntries((['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as Axis[]).map((k) => [k, { state: axes[k] ?? 'pass' }])) as FqResult['axes'],
})
const approve = (q: string, scope: 'public' | 'assessment', revoked = false): ReleaseApproval => ({ id: `${q}-${scope}`, qualificationId: q, scope, approverRole: 'admin', revoked })
const csatCand = (ref: string, task: string, role: MaterialRole, o: Partial<StockCandidate> = {}, axes: Partial<Record<Axis, AxisState>> = {}): StockCandidate => ({
  artifact: { kind: 'csat_item', ref, contentType: 'check_task' }, currentRevision: `rev-${ref}`, passage: `p-${ref}`,
  fq: fq(ref, `rev-${ref}`, task, role, axes), qualificationId: `q-${ref}`, approvals: [approve(`q-${ref}`, 'public'), approve(`q-${ref}`, 'assessment')], exposure: 'none', ...o,
})
const FULL_BRIEF: BriefDraft = { grade_scope: { mode: 'single_grade', grades: ['high_2'] }, purpose: 'vocabulary_in_context', domain_weights: { science: 1 }, genre_weights: { expository: 1 }, duration_days: 10, units_per_chapter: 5, difficulty: { start: 5, end: 6 }, passage_words: { start: 150, end: 200 }, source_strategy: 'balanced' }

describe('Crosswalk(I0-1)', () => {
  it('학습지도 R5(중심 의미)는 공장 R4(Main Idea)에 후보 — 공장 R5(Function)와 잇지 않는다', () => {
    expect(crosswalkFor('r.central_meaning').map((c) => c.factorySkillId)).toEqual(['R4'])
    expect(FACTORY_SKILL_NAME.R5).toBe('Function')
    expect(CROSSWALK.every((c) => c.status === 'candidate' && c.claimScope === 'search_only' && !c.validationEvidenceId)).toBe(true)
  })
  it('후보는 검색만 — 공급 적합 · 주문 봉인 · 평가 불가', () => {
    const c = crosswalkFor('v.contextual_sense')[0]!
    expect(crosswalkUsable(c, 'search').ok).toBe(true)
    for (const u of ['supply_fit', 'seal_order', 'assessment'] as const) expect(crosswalkUsable(c, u).ok).toBe(false)
    expect(crosswalkUsable({ ...c, status: 'validated', validationEvidenceId: 'ev', reviewer: 'r' }, 'assessment').ok).toBe(false)
  })
  it('평가 역할은 어떤 대응에도 없다', () => {
    expect(CROSSWALK.every((c) => c.materialRole.every((r) => r === 'guided_practice' || r === 'source_analysis' || r === 'model_explanation'))).toBe(true)
  })
})

describe('MaterialUnitProjection(I0-2)', () => {
  it('같은 단위는 항등 · 문항→지문 · 해설→문항은 변환 금지 · 근거 없는 cell 은 UNKNOWN_UNIT', () => {
    expect(projectUnits({ demandUnit: '문항', requested: 3, eligible: 1, productionUnit: 'item' })).toMatchObject({ shortfall: 2, productionQuantity: 2, conversion: { status: 'IDENTITY' } })
    expect(projectUnits({ demandUnit: '문항', requested: 2, eligible: 0, productionUnit: 'passage' })).toMatchObject({ productionQuantity: null, conversion: { status: 'NOT_CONVERTIBLE' } })
    expect(projectUnits({ demandUnit: '문항', requested: 2, eligible: 0, productionUnit: 'cell' })).toMatchObject({ shortfall: 2, productionQuantity: null, conversion: { status: 'UNKNOWN_UNIT', why: 'no_conversion_evidence' } })
    expect(projectUnits({ demandUnit: '지문', requested: 2, eligible: 0, productionUnit: 'item' }).conversion.status).toBe('UNKNOWN_UNIT')
  })
  it('근거 규칙이 있을 때만 환산(올림)', () => {
    expect(projectUnits({ demandUnit: '문항', requested: 7, eligible: 0, productionUnit: 'cell', rules: [{ from: 'item', to: 'cell', factor: 3, evidenceId: 'ev-1' }] })).toMatchObject({ productionQuantity: 3, conversion: { status: 'CONVERTED', evidenceId: 'ev-1' } })
  })
})

describe('반례 S01–S16', () => {
  const T = 'r.central_meaning'
  it('S01 · R5 적격 기존 자료가 충분하면 신규 생산 0', () => {
    const r = resolveStock({ task: T, role: 'independent_check', requested: 2 }, 'ok', [csatCand('a', T, 'independent_check'), csatCand('b', T, 'independent_check')])
    expect(r).toMatchObject({ line: 'satisfied', eligible: ['a', 'b'], newProductionNeeded: 0 })
    const [req] = buildFactoryRequests('u', demand(T, ['R-MAIN'], [{ role: 'independent_check', gold: true }]))
    expect(productionNeed(req!, r).state).toBe('NOT_NEEDED')
  })
  it('S02 · V2 주석 · 출시 0 → 평가 자료 부족 유지 · 공장 평가 생산 아님', () => {
    const r = resolveStock({ task: 'v.contextual_sense', role: 'independent_check', requested: 2 }, 'ok', [])
    expect(r.newProductionNeeded).toBe(2)
    const [req] = buildFactoryRequests('u', demand('v.contextual_sense', ['R-VOCAB'], [{ role: 'independent_check', gold: true }]))
    expect(productionNeed(req!, r)).toMatchObject({ state: 'ASSESSMENT_NOT_FROM_FACTORY' })
  })
  it('S03 · DCP 어휘 재고(밑줄 고르기)는 V2 독립 확인으로 공급 안 됨', () => {
    const dcp: StockCandidate = { ...csatCand('d1', 'v.contextual_sense', 'independent_check'), artifact: { kind: 'dcp_item', ref: 'd1', contentType: 'vocab_choice' } }
    const r = resolveStock({ task: 'v.contextual_sense', role: 'independent_check', requested: 1 }, 'ok', [dcp])
    expect(r.verdicts[0]!.state).toBe('blocked_runner')
    expect(r.newProductionNeeded).toBe(1)
  })
  it('S04 · S5 어법 정답 자료(P06)는 의미 범위로 승격 안 됨 — 대응은 related · 검색 전용', () => {
    const c = crosswalkFor('s.form_scope')[0]!
    expect(c.relation).toBe('related')
    expect(crosswalkUsable(c, 'supply_fit').ok).toBe(false)
  })
  it('S05 · 같은 자료라도 역할별 자격 — 연습 자격은 독립 확인 자격이 아니다(역할 결속)', () => {
    const c = csatCand('a', T, 'guided_practice')
    expect(resolveStock({ task: T, role: 'guided_practice', requested: 1 }, 'ok', [c]).eligible).toEqual(['a'])
    expect(resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [c]).verdicts[0]).toMatchObject({ state: 'candidate_unreviewed', missing: ['role_mismatch'] })
    // 교수 적합성(D) 미확인은 지도 연습 적격이 아니다(supplyFor 「available」 과 다르다)
    expect(resolveStock({ task: T, role: 'model_explanation', requested: 1 }, 'ok', [csatCand('m', T, 'model_explanation', {}, { D: 'unknown' })]).verdicts[0]!.state).toBe('candidate_unreviewed')
  })
  it('S06 · 목표 · PLAN 버전이 바뀌면 새 요청 키 — 옛 요청은 그대로(덮지 않음)', () => {
    const a = buildFactoryRequests('u', demand(T, ['R-MAIN'], [{ role: 'guided_practice' }]))[0]!
    const b = buildFactoryRequests('u', demand(T, ['R-MAIN'], [{ role: 'guided_practice' }], { goalVersion: 8, planVersion: 3 }))[0]!
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
    expect(reconcileRequest(a, b).action).toBe('create')
    expect(productionNeed(a, resolveStock({ task: T, role: 'guided_practice', requested: 2 }, 'ok', [])).origin.versions).toEqual({ goal: 7, plan: 2, definition: 'v6.2' })
  })
  it('S07 · 부분 검수 실패 → 적격만 세고 부족량 보존', () => {
    const r = resolveStock({ task: T, role: 'guided_practice', requested: 3 }, 'ok', [csatCand('a', T, 'guided_practice'), csatCand('b', T, 'guided_practice', {}, { C: 'fail' })])
    expect(r).toMatchObject({ eligible: ['a'], newProductionNeeded: 2, line: 'insufficient_quantity' })
  })
  it('S08 · 원문/Gold/revision/권리 변경 → 현재 자격 무효', () => {
    expect(resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [csatCand('a', T, 'independent_check', { currentRevision: 'rev-new' })]).verdicts[0]).toMatchObject({ state: 'candidate_unreviewed', missing: ['revision_mismatch'] })
    expect(resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [csatCand('a', T, 'independent_check', {}, { F: 'fail' })]).verdicts[0]!.state).toBe('blocked_rights')
    expect(resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [csatCand('a', T, 'independent_check', {}, { E: 'fail' })]).verdicts[0]!.state).toBe('blocked_gold')
    expect(resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [csatCand('a', T, 'independent_check', { approvals: [approve('q-a', 'public'), approve('q-a', 'assessment', true)] })]).verdicts[0]!.state).toBe('awaiting_release')
  })
  it('S09 · 같은 지문의 다른 문항 · 지문 미확인은 평가 자료 두 번째로 세지 않음 · 공유 지문 노출 차단', () => {
    const r = resolveStock({ task: T, role: 'independent_check', requested: 3 }, 'ok', [csatCand('a', T, 'independent_check', { passage: 'P' }), csatCand('b', T, 'independent_check', { passage: 'P' }), csatCand('c', T, 'independent_check', { passage: null })])
    expect(r.eligible).toEqual(['a'])
    expect(r.counts.blocked_exposure).toBe(2)
    expect(resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [csatCand('a', T, 'independent_check', { exposure: 'shared_passage_seen' })]).verdicts[0]!.state).toBe('blocked_exposure')
    expect(resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [csatCand('a', T, 'independent_check', { exposure: null })]).verdicts[0]!.state).toBe('blocked_exposure')
  })
  it('S10 · 같은 요청 키 같은 본문 = 재사용 · 다른 본문 = 충돌', () => {
    const a = buildFactoryRequests('u', demand(T, ['R-MAIN'], [{ role: 'guided_practice' }]))[0]!
    expect(reconcileRequest(a, { ...a }).action).toBe('reuse')
    expect(reconcileRequest(a, { ...a, quantity: { ...a.quantity, n: 9 } })).toEqual({ action: 'reject', why: 'same_key_different_body' })
  })
  it('S11 · 실행기 · 채점기 미지원은 「차단(실행기)」 — 학생 오답 · 부족 판정 아님', () => {
    const c: StockCandidate = { ...csatCand('t', T, 'guided_practice'), artifact: { kind: 'textbook_activity', ref: 't', contentType: null } }
    expect(resolveStock({ task: T, role: 'guided_practice', requested: 1 }, 'ok', [c]).verdicts[0]).toMatchObject({ state: 'blocked_runner', missing: ['runner:none'] })
  })
  it('S12 · 공용 생산 키 · 묶음에 학습자 · Workspace · PLAN 정보가 없다', () => {
    const mk = (uid: string, ws: string) => productionNeed(buildFactoryRequests(uid, demand('v.contextual_sense', ['R-VOCAB'], [{ role: 'guided_practice' }], { workspaceId: ws }))[0]!, resolveStock({ task: 'v.contextual_sense', role: 'guided_practice', requested: 2 }, 'ok', []), { brief: FULL_BRIEF })
    const g = groupSharedNeeds([mk('u1', 'ws-1'), mk('u2', 'ws-2')])
    const s = JSON.stringify(g)
    expect(s).not.toMatch(/u1|u2|ws-1|ws-2|plan|goal/)
  })
  it('S13 · not_installed · error · 정상 0건을 구별 — 앞의 둘은 신규 생산량 null', () => {
    expect(resolveStock({ task: T, role: 'guided_practice', requested: 2 }, 'not_installed', []).newProductionNeeded).toBeNull()
    expect(resolveStock({ task: T, role: 'guided_practice', requested: 2 }, 'error', []).line).toBe('read_error')
    expect(resolveStock({ task: T, role: 'guided_practice', requested: 2 }, 'ok', []).newProductionNeeded).toBe(2)
    const [req] = buildFactoryRequests('u', demand(T, ['R-MAIN'], [{ role: 'guided_practice' }]))
    expect(productionNeed(req!, resolveStock({ task: T, role: 'guided_practice', requested: 2 }, 'error', [])).state).toBe('UNKNOWN_STOCK')
  })
  it('S14 · 여러 학생의 같은 공용 요구는 한 공유 키로 묶임(요청 id 만 남김)', () => {
    const mk = (uid: string) => productionNeed(buildFactoryRequests(uid, demand('v.contextual_sense', ['R-VOCAB'], [{ role: 'guided_practice' }]))[0]!, resolveStock({ task: 'v.contextual_sense', role: 'guided_practice', requested: 2 }, 'ok', []), { brief: FULL_BRIEF })
    const g = groupSharedNeeds([mk('u1'), mk('u2'), mk('u3')])
    expect(g).toHaveLength(1)
    expect(g[0]!.requestIds).toHaveLength(3)
  })
  it('S15 · 신규 생산 없이 적격 기존 자료 조합 — 역할별로 따로 충족', () => {
    const check = resolveStock({ task: T, role: 'independent_check', requested: 1 }, 'ok', [csatCand('a', T, 'independent_check')])
    const prac = resolveStock({ task: T, role: 'guided_practice', requested: 1 }, 'ok', [csatCand('b', T, 'guided_practice')])
    expect([check.newProductionNeeded, prac.newProductionNeeded]).toEqual([0, 0])
  })
  it('S16 · 목표일 · 점수로 학년 · 난도 · 기간을 추정하지 않음 — 브리프 없으면 NEEDS_PRODUCT_BRIEF', () => {
    const [req] = buildFactoryRequests('u', demand('v.contextual_sense', ['R-VOCAB'], [{ role: 'guided_practice' }]))
    const n = productionNeed(req!, resolveStock({ task: 'v.contextual_sense', role: 'guided_practice', requested: 2 }, 'ok', []))
    expect(n.state).toBe('NEEDS_PRODUCT_BRIEF')
    expect(n.missingBrief).toEqual([...PRODUCT_BRIEF_FIELDS])
    expect(JSON.stringify(n)).not.toMatch(/duration_days":\d|grade_scope":\{/)
  })
})

describe('ProductionNeed 상태 사다리 · golden vectors', () => {
  const [req] = buildFactoryRequests('u', demand('v.contextual_sense', ['R-VOCAB'], [{ role: 'guided_practice' }]))
  const short = resolveStock({ task: 'v.contextual_sense', role: 'guided_practice', requested: 2 }, 'ok', [])
  it('브리프가 다 있어도 단위 근거 없음 → UNSUPPORTED_PRODUCTION_UNIT(대응 검증 · 정책도 blocker)', () => {
    const n = productionNeed(req!, short, { brief: FULL_BRIEF })
    expect(n.state).toBe('UNSUPPORTED_PRODUCTION_UNIT')
    expect(n.units?.conversion.status).toBe('UNKNOWN_UNIT')
    expect(n.blockers).toEqual(expect.arrayContaining(['crosswalk_not_validated', 'order_policies_missing', 'unit_no_conversion_evidence']))
  })
  it('단위 근거가 있어도 대응 미검증 · 정책 없음이면 READY_TO_SEAL 아님', () => {
    expect(productionNeed(req!, short, { brief: FULL_BRIEF, rules: [{ from: 'item', to: 'cell', factor: 3, evidenceId: 'ev' }] }).state).toBe('NEEDS_PRODUCT_BRIEF')
  })
  it('대응 없는 TASK → UNMAPPED_TASK', () => {
    const [r2] = buildFactoryRequests('u', demand('v.core_meaning', ['R-VOCAB'], [{ role: 'guided_practice' }]))
    expect(productionNeed(r2!, resolveStock({ task: 'v.core_meaning', role: 'guided_practice', requested: 2 }, 'ok', [])).state).toBe('UNMAPPED_TASK')
  })
  it('자기보고 실행 flag/수량은 브리프·검증 조건을 건너뛰지 못함', () => {
    for (const artifacts of [0, 4]) {
      const n = productionNeed(req!, short, { run: { recorded: true, artifacts } })
      expect(n.state).toBe('NEEDS_PRODUCT_BRIEF')
      expect(n.blockers).toEqual(expect.arrayContaining(['crosswalk_not_validated', 'product_brief_incomplete', 'order_policies_missing']))
    }
  })
  it('golden — 요청 id · 공유 키는 결정적', () => {
    const a = productionNeed(req!, short, { brief: FULL_BRIEF })
    const b = productionNeed(buildFactoryRequests('u', demand('v.contextual_sense', ['R-VOCAB'], [{ role: 'guided_practice' }]))[0]!, short, { brief: FULL_BRIEF })
    expect(a.origin.requestId).toBe(b.origin.requestId)
    expect(a.shareKey).toBe(b.shareKey)
    expect(a.shareKey).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('계보(I0-5 · CONTRACT_ONLY)', () => {
  const order = { productOrderId: 'po-1', orderRevision: 2, orderHash: H('a') }
  const cell = (day: number, o = order): CellRef => ({ ...o, cellId: cellIdOf(o, day), cellHash: H('b'), grade: 'high_2', day })
  const links: DemandOrderLink[] = [{ requestId: 'r1', shareKey: 's', order }, { requestId: 'r2', shareKey: 's', order }]
  const art = (id: string, c: CellRef, o: Partial<ArtifactRef> = {}): ArtifactRef => ({ id, kind: 'item', hash: H('c'), cellId: c.cellId, productOrderId: c.productOrderId, orderRevision: c.orderRevision, orderHash: c.orderHash, ...o })
  it('N:M — 두 요청 · 한 주문 · 두 cell · 산출물 → ok, 공급 승인은 언제나 false', () => {
    const c1 = cell(1), c2 = cell(2)
    expect(verifyLineage(links, { drainHash: H('d'), manifestHash: null, cells: [c1, c2] }, [art('i1', c1), art('i2', c2)])).toEqual({ ok: true, errors: [], supplyApproved: false, verification: 'STRUCTURAL_ONLY', contentVerified: false })
  })
  it('낡은 주문 해시 · 다른 주문 cell · cell 없는 산출물 · 중복 cell 을 거절', () => {
    const c1 = cell(1)
    const stale = { ...c1, orderHash: H('e') }
    const foreign = cell(1, { productOrderId: 'po-9', orderRevision: 1, orderHash: H('a') })
    const r = verifyLineage(links, { drainHash: H('d'), manifestHash: null, cells: [stale, foreign, c1] }, [art('x', cell(5))])
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual(expect.arrayContaining([`cell_stale_order:${c1.cellId}`, `cell_foreign_order:${foreign.cellId}`, `cell_duplicate:${c1.cellId}`, 'artifact_without_cell:x']))
  })
})
