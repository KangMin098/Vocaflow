// apps/web/src/lib/knowledge/rules.ts
// 학습 원리 등록부 쓰기 규칙 (순수). DB 제약이 막는 것(반려 이유·층 연결 방향)은 DB 가 최종 방어선이고,
// 여기서는 DB 가 모르는 규칙(상태 전이 순서·근거 없는 채택 금지)과 사람이 읽을 오류 문장을 만든다.
import { LAYER_RANK, type ItemStatus, type Layer } from './labels'

/** 허용 전이. 채택된 것도 근거가 바뀌면 「검토 중」으로 되돌릴 수 있다(재검토). */
export const TRANSITIONS: Record<ItemStatus, readonly ItemStatus[]> = {
  extracted: ['in_review', 'rejected'],
  in_review: ['adopted', 'rejected'],
  adopted: ['applied', 'in_review'],
  rejected: ['in_review'],
  applied: ['in_review'],
}

export type RuleResult = { ok: true } | { ok: false; error: string }

export function checkTransition(input: {
  from: ItemStatus
  to: ItemStatus
  reason: string
  evidenceCount: number
}): RuleResult {
  const { from, to, reason, evidenceCount } = input
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, error: `「${from}」에서 「${to}」로는 바로 갈 수 없습니다` }
  }
  if (to === 'rejected' && reason.trim().length === 0) {
    return { ok: false, error: '반려에는 이유가 필요합니다' }
  }
  if ((to === 'adopted' || to === 'applied') && evidenceCount === 0) {
    return { ok: false, error: '근거가 하나도 없는 항목은 채택할 수 없습니다 — 근거부터 연결하세요' }
  }
  return { ok: true }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/

export interface NewItemInput {
  layer: Layer
  slug: string
  title: string
  statement: string
  skillIds: string[]
  conditionIds: string[]
}

export function checkNewItem(input: NewItemInput): RuleResult {
  if (!SLUG_RE.test(input.slug)) {
    return { ok: false, error: '주소 이름은 영문 소문자·숫자·하이픈 2~81자입니다 (예: reading-argument-structure)' }
  }
  const title = input.title.trim()
  if (title.length === 0 || title.length > 120) return { ok: false, error: '제목은 1~120자입니다' }
  const statement = input.statement.trim()
  if (statement.length === 0 || statement.length > 1500) return { ok: false, error: '문장은 1~1500자입니다' }
  if (input.layer === 'essence' && input.skillIds.length !== 1) {
    return { ok: false, error: '본질은 영역 하나에 대해 씁니다 — 영역을 정확히 하나 고르세요' }
  }
  return { ok: true }
}

const CONDITION_DIMENSIONS = ['age', 'proficiency', 'exam', 'process', 'question'] as const

/**
 * 분류 ID 검증 — 영역(skill_ids)은 skill 차원, 조건(condition_ids)은 나머지 다섯 차원에 **실제로 있는** ID 만.
 * knowledge_items 의 text[] 는 FK 를 걸 수 없으니(스냅샷 분류는 batch 단위) 쓰기 전에 여기서 막는다.
 * 분류를 못 읽었으면(빈 목록) 통과시키지 않는다 — 검증할 수 없는 것을 검증된 것처럼 저장하지 않는다.
 */
export function checkTaxonomyIds(
  skillIds: string[],
  conditionIds: string[],
  taxonomy: { id: string; dimension: string }[]
): RuleResult {
  if (taxonomy.length === 0) return { ok: false, error: '분류 축을 읽지 못해 영역·조건을 검증할 수 없습니다' }
  const dimOf = new Map(taxonomy.map((t) => [t.id, t.dimension]))
  if (new Set(skillIds).size !== skillIds.length || new Set(conditionIds).size !== conditionIds.length) {
    return { ok: false, error: '같은 영역·조건을 두 번 골랐습니다' }
  }
  const badSkill = skillIds.find((id) => dimOf.get(id) !== 'skill')
  if (badSkill) return { ok: false, error: `영역이 아닌 값입니다: ${badSkill}` }
  const badCondition = conditionIds.find(
    (id) => !(CONDITION_DIMENSIONS as readonly string[]).includes(dimOf.get(id) ?? '')
  )
  if (badCondition) return { ok: false, error: `조건이 아닌 값입니다: ${badCondition}` }
  return { ok: true }
}

/** implements 는 한 층 위로만 (공부법→방법론→원리→본질). DB 트리거와 같은 규칙. */
export function checkImplements(from: Layer, to: Layer): RuleResult {
  return LAYER_RANK[from] === LAYER_RANK[to] + 1
    ? { ok: true }
    : { ok: false, error: '「구현」 연결은 바로 위 층으로만 잇습니다 (공부법→방법론→원리→본질)' }
}

export function checkExternalEvidence(input: { url: string; title: string; locator: string }): RuleResult {
  let parsed: URL
  try {
    parsed = new URL(input.url)
  } catch {
    return { ok: false, error: '링크 형식이 아닙니다' }
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'https 링크만 받습니다' }
  if (input.title.trim().length === 0) return { ok: false, error: '출처 제목이 필요합니다' }
  if (input.locator.length > 200) return { ok: false, error: '위치는 200자 이내입니다 (예: 03:12–04:05, §교재특징)' }
  return { ok: true }
}
