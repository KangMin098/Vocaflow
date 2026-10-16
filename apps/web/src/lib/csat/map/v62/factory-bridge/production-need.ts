// apps/web/src/lib/csat/map/v62/factory-bridge/production-need.ts
//
// I0-4 — FactoryRequest(vf.factory-request/1) → ProductionNeed(순수). 공장 Product Order(textbook-product-order/1)를 **봉인할 수 있는지**와
// 무엇이 빠졌는지를 정확히 적는다. 주문 · 생산을 실행하지 않는다.
// 학습자 목표 점수 · 등급에서 학년 · 난도 · 지문 길이 · 기간 · 영역/장르 비율을 추정하지 않는다 — 그 값은 사람(큐레이터)이 쓰는 ProductBrief 에서만 온다.
// 공장 정본: origin/feat/textbook-factory-main 663f2eee8 · product-planning.ts productBriefSchema · factory-order.ts productOrderSchema.

import { createHash } from 'node:crypto'

import { canonicalJson } from '../canonical-json'
import type { MaterialRole } from '../demand'
import type { FactoryRequest } from '../factory-integration'
import { ASSESSMENT_ROLES } from '../qualification'

import { crosswalkFor, crosswalkUsable, type ProductFamily, type TaskFactoryCrosswalk } from './crosswalk'
import { projectUnits, type ConversionRule, type MaterialUnitProjection } from './material-unit'
import type { StockResolution } from './stock-resolver'

export const PRODUCTION_NEED_SCHEMA = 'vf.production-need/1' as const

/** 공장 ProductBrief(textbook-product-brief/1) 필수 필드 — 학습자 수요에서 나오지 않는다 */
export const PRODUCT_BRIEF_FIELDS = ['grade_scope', 'purpose', 'domain_weights', 'genre_weights', 'duration_days', 'units_per_chapter', 'difficulty', 'passage_words', 'source_strategy'] as const
/** 봉인 주문에 더 필요한 정책 버전 · 해시(structuredOrderDraftSchema.policies) */
export const ORDER_POLICY_FIELDS = ['source', 'rights', 'adaptation', 'benchmark', 'evidence', 'trust'] as const

export type ProductionNeedState =
  | 'NOT_NEEDED' // 적격 기존 자료로 충족
  | 'UNKNOWN_STOCK' // 원장 미설치 · 읽기 실패 — 0 으로 두지 않는다
  | 'ASSESSMENT_NOT_FROM_FACTORY' // 평가 역할 — 공장 산출물로 공급하지 않는다
  | 'UNMAPPED_TASK'
  | 'NEEDS_PRODUCT_BRIEF'
  | 'UNSUPPORTED_PRODUCTION_UNIT'
  | 'READY_TO_SEAL'
  | 'RUN_PENDING'
  | 'RUN_RECORDED'
  | 'ARTIFACT_CANDIDATE'

/** 큐레이터가 쓴 ProductBrief(부분일 수 있다) — 학습자 · PLAN 정보가 들어가면 안 된다 */
export type BriefDraft = Partial<Record<(typeof PRODUCT_BRIEF_FIELDS)[number], unknown>> & { product_family?: ProductFamily }

export interface ProductionNeed {
  schema: typeof PRODUCTION_NEED_SCHEMA
  /** 원래 요청(학습자별)의 결속 — requestId · 멱등 키 · 수요 키 · 버전 */
  origin: { requestId: string; idempotencyKey: string; demandKey: string; versions: FactoryRequest['versions'] }
  task: string
  role: MaterialRole
  crosswalk: TaskFactoryCrosswalk[]
  units: MaterialUnitProjection | null
  /** 생산 가능한 공장 문항 유형 후보(대응 후보의 허용 유형 합) */
  itemTypes: string[]
  familyCandidates: ProductFamily[]
  missingBrief: string[]
  missingPolicies: string[]
  requirements: { rightsUsable: true; gold: boolean; unseenByLearner: boolean; noExplanationBefore: boolean; versionBinding: 'exact_revision' }
  state: ProductionNeedState
  blockers: string[]
  approvalsNeeded: string[]
  /** 여러 학습자의 같은 공용 생산 요구를 묶을 수 있는 키 — 학습자 · Workspace · PLAN 정보를 넣지 않는다 */
  shareKey: string | null
  provenance: { crosswalkVersion: string; factoryTaxonomyVersion: string | null; factoryHead: '663f2eee8'; connection: 'CONTRACT_ONLY' }
}

/** 공장 생산 최소 단위 — cell(학년 × 일) 하나에 지문 1 + 문항 여러 개. 수요의 「문항」과 같은 단위가 아니다 */
const FACTORY_PRODUCTION_UNIT = 'cell' as const

export function productionNeed(req: FactoryRequest, stock: StockResolution, opts: { brief?: BriefDraft | null; policies?: Partial<Record<(typeof ORDER_POLICY_FIELDS)[number], { version: string; hash: string }>>; rules?: readonly ConversionRule[]; run?: { recorded: boolean; artifacts: number } | null } = {}): ProductionNeed {
  const xw = crosswalkFor(req.task as never)
  const brief = opts.brief ?? null
  const missingBrief = PRODUCT_BRIEF_FIELDS.filter((f) => brief?.[f] === undefined || brief?.[f] === null)
  const missingPolicies = ORDER_POLICY_FIELDS.filter((p) => !opts.policies?.[p]?.version || !/^[0-9a-f]{64}$/.test(opts.policies[p]!.hash))
  const itemTypes = [...new Set(xw.flatMap((c) => c.itemType))]
  const familyCandidates = [...new Set(xw.map((c) => c.productFamily))]
  const units = stock.newProductionNeeded === null ? null : projectUnits({ demandUnit: req.quantity.unit, requested: stock.requested, eligible: stock.eligible.length, productionUnit: FACTORY_PRODUCTION_UNIT, rules: opts.rules })
  const blockers: string[] = []
  const base = {
    schema: PRODUCTION_NEED_SCHEMA,
    origin: { requestId: req.requestId, idempotencyKey: req.idempotencyKey, demandKey: req.demandKey, versions: { ...req.versions } },
    task: req.task, role: req.role, crosswalk: xw, units, itemTypes, familyCandidates, missingBrief: [...missingBrief], missingPolicies: [...missingPolicies],
    requirements: { rightsUsable: true as const, ...req.constraints },
    approvalsNeeded: ['bulk_generation_cost', 'db_schema_orders', 'content_release'],
    provenance: { crosswalkVersion: xw[0]?.effectiveRevision ?? 'vf.task-factory-crosswalk/1#0', factoryTaxonomyVersion: xw[0]?.factoryTaxonomyVersion ?? null, factoryHead: '663f2eee8' as const, connection: 'CONTRACT_ONLY' as const },
  }
  // 공용 생산 키 — 학습자 요청 id · 수요 키 · 버전을 빼고 TASK · 역할 · 제품군 · 문항 유형 · 브리프만
  const shareKey = (s: ProductionNeedState) => (s === 'READY_TO_SEAL' || s === 'NEEDS_PRODUCT_BRIEF' || s === 'UNSUPPORTED_PRODUCTION_UNIT')
    ? createHash('sha256').update(canonicalJson({ task: req.task, role: req.role, families: familyCandidates, itemTypes, brief: brief ?? null })).digest('hex').slice(0, 32)
    : null
  const done = (state: ProductionNeedState): ProductionNeed => ({ ...base, state, blockers, shareKey: shareKey(state) })

  if (stock.newProductionNeeded === null) { blockers.push(`stock_${stock.line}`); return done('UNKNOWN_STOCK') }
  if (stock.newProductionNeeded === 0) return done('NOT_NEEDED')
  if (ASSESSMENT_ROLES.has(req.role)) { blockers.push('assessment_not_from_factory', 'gold_rubric', 'learner_exposure_ledger'); return done('ASSESSMENT_NOT_FROM_FACTORY') }
  if (xw.length === 0) { blockers.push('no_crosswalk'); return done('UNMAPPED_TASK') }
  if (opts.run?.recorded) return done(opts.run.artifacts > 0 ? 'ARTIFACT_CANDIDATE' : 'RUN_RECORDED')
  if (!xw.some((c) => crosswalkUsable(c, 'seal_order').ok)) blockers.push('crosswalk_not_validated')
  if (missingBrief.length) blockers.push('product_brief_incomplete')
  if (missingPolicies.length) blockers.push('order_policies_missing')
  if (missingBrief.length) return done('NEEDS_PRODUCT_BRIEF')
  if (!units || units.conversion.status === 'UNKNOWN_UNIT' || units.conversion.status === 'NOT_CONVERTIBLE') { blockers.push(`unit_${units?.conversion.why ?? 'unknown'}`); return done('UNSUPPORTED_PRODUCTION_UNIT') }
  if (blockers.length) return done('NEEDS_PRODUCT_BRIEF')
  return done(opts.run ? 'RUN_PENDING' : 'READY_TO_SEAL')
}

/** 같은 공용 키의 요구를 묶는다(학습자 수 · 요청 id 만 남긴다 — 이메일 · PLAN 메모 · Workspace id 는 넣지 않는다) */
export function groupSharedNeeds(needs: readonly ProductionNeed[]): { shareKey: string; requestIds: string[]; task: string; role: MaterialRole }[] {
  const m = new Map<string, { shareKey: string; requestIds: string[]; task: string; role: MaterialRole }>()
  for (const n of needs) {
    if (!n.shareKey) continue
    const g = m.get(n.shareKey) ?? { shareKey: n.shareKey, requestIds: [], task: n.task, role: n.role }
    g.requestIds.push(n.origin.requestId)
    m.set(n.shareKey, g)
  }
  return [...m.values()]
}
