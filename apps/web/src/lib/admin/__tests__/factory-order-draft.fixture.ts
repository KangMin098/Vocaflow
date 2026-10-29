// apps/web/src/lib/admin/__tests__/factory-order-draft.fixture.ts
// 시험 대역은 DB 조회(reader)뿐이다. 정책 hash 는 합성 시험값 — 정책 승인 · 생산 가능 주문이 아니다.
import { createHash } from 'node:crypto'

import { planProductBrief } from '@vocaflow/library-pipeline/product-planning'

import type {
  CurrentPlanRow,
  DemandLineRow,
  DemandRow,
  FactoryOrderDraftReader,
  WorkspaceRow,
} from '@/lib/admin/factory-order-draft'
import { canonicalJson } from '@/lib/csat/map/v62/canonical-json'
import { CANON_VERSION } from '@/lib/csat/map/v4/definition'

export const USER = '11111111-1111-4111-8111-111111111111'
export const WORKSPACE = '22222222-2222-4222-8222-222222222222'
export const DEMAND = '33333333-3333-4333-8333-333333333333'
export const LINE = '44444444-4444-4444-8444-444444444444'
export const OTHER = '55555555-5555-4555-8555-555555555555'
export const NOW = '2026-10-21T00:00:00.000Z'

const requires = (assessment: boolean) => ({ rightsUsable: true, gold: assessment, unseenByLearner: assessment, noExplanationBefore: assessment })
const line = (role: string, n: number) => ({
  role, task: 'r.central_meaning', n, types: ['R-CLAIM', 'R-GIST', 'R-TITLE', 'R-TOPIC'], keys: [] as string[],
  requires: requires(!['source_analysis', 'model_explanation', 'guided_practice'].includes(role)), reason: 'stage_repair',
})

/** 저장 정본 v2 — demand.ts canonicalDemand 와 같은 모양(repair 단계 세 줄 + 독립 확인 한 줄) */
export function canonicalBody(overrides: Record<string, unknown> = {}) {
  return canonicalJson({
    v: 2, user: USER, template: 'ws.test', workspaceId: WORKSPACE, goalVersion: 7, planVersion: 3,
    definitionVersion: CANON_VERSION, core: 'r.central_meaning', support: [],
    lines: [line('source_analysis', 1), line('model_explanation', 1), line('guided_practice', 1), line('independent_check', 2)],
    ...overrides,
  })
}
export const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

export interface FixtureState {
  line: DemandLineRow | null
  demand: DemandRow | null
  workspace: WorkspaceRow | null
  goal: number | null
  plan: CurrentPlanRow | null
}
export function fixtureState(): FixtureState {
  const canonical = canonicalBody()
  return {
    line: { id: LINE, demand_id: DEMAND, user_id: USER, workspace_id: WORKSPACE, line_no: 2, role: 'guided_practice', task_id: 'r.central_meaning', quantity: 1 },
    demand: { id: DEMAND, user_id: USER, workspace_id: WORKSPACE, goal_version_id: 7, plan_version: 3, definition_version: CANON_VERSION, core_task: 'r.central_meaning', canonical, signature: sha(canonical) },
    workspace: { id: WORKSPACE, user_id: USER, status: 'active' },
    goal: 7,
    plan: { plan_version: 3, goal_version_id: 7 },
  }
}

/** 조회만 대신한다. 호출 기록으로 「가드 전 DB 0회」를 확인한다. 쓰기 메서드는 존재하지 않는다 */
export function stubReader(state: FixtureState, failOn?: keyof FactoryOrderDraftReader) {
  const calls: string[] = []
  const run = <T>(name: keyof FactoryOrderDraftReader, value: T) => {
    calls.push(name)
    if (failOn === name) return Promise.reject(new Error('connection reset'))
    return Promise.resolve(structuredClone(value))
  }
  const reader: FactoryOrderDraftReader = {
    demandLine: () => run('demandLine', state.line),
    demand: () => run('demand', state.demand),
    workspace: () => run('workspace', state.workspace),
    currentGoalVersionId: () => run('currentGoalVersionId', state.goal),
    currentPlan: () => run('currentPlan', state.plan),
  }
  return { reader, calls }
}

const brief = () => ({
  schema: 'textbook-product-brief/1',
  grade_scope: { mode: 'single_grade', grades: ['middle_1'] },
  purpose: 'knowledge_reading',
  product_family: 'P07',
  domain_weights: { science: 1, social: 1 },
  genre_weights: { explanation: 1 },
  duration_days: 10,
  units_per_chapter: 5,
  difficulty: { start: 2, end: 4 },
  passage_words: { start: 150, end: 220 },
  source_strategy: 'balanced',
})
const policy = (version: string, digit: string) => ({ version, hash: digit.repeat(64) })
export function draftInput(briefOverride: Record<string, unknown> = {}) {
  const b = { ...brief(), ...briefOverride }
  return {
    brief: b, plan_hash: planProductBrief(b).plan_hash, grade: 'middle_1',
    product_order_id: 'TPO-1a-main-idea', order_revision: 1, series_id: 'main-idea', edition_id: 'first',
    product_variant: 'guided', language_band: 'middle', passage_v_level: 3, share_alike: false,
    unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1',
    layout_profile: 'reading-v1', policies: {
      source: policy('source-v1', '1'), rights: policy('rights-v1', '2'),
      adaptation: policy('adapt-v1', '3'), benchmark: policy('benchmark-v1', '4'),
      evidence: policy('evidence-v1', '5'), trust: policy('trust-v1', '6'),
    },
  }
}
export const requestBody = (state: FixtureState = fixtureState(), draft: unknown = draftInput()) => ({
  demand_line_id: LINE, expected_signature: state.demand!.signature, draft,
})
