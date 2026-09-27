// scripts/textbook/source-policy-batch.mjs
import { isDeepStrictEqual } from 'node:util'
import { evaluateSource, ELIGIBILITY_SPEC_VERSION } from '../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { SOURCE_USES } from '../csat/gate-rules.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validateProjection(row, now = Date.now()) {
  if (!row || !UUID.test(row.article_id ?? '')) throw new Error('Invalid article ID')
  const measured = Date.parse(row.measured_at), revision = Date.parse(row.source_updated_at)
  if (!Number.isFinite(measured) || measured > now || now - measured > 86400000) throw new Error('Projection requires a valid measurement within the past 24 hours')
  if (!Number.isFinite(revision) || revision > measured) throw new Error('Invalid source revision')
  if (row.policy_version !== ELIGIBILITY_SPEC_VERSION || !row.input || !isDeepStrictEqual(row.result, evaluateSource(row.input))) throw new Error('Projection does not match canonical policy')
  if (!Number.isInteger(row.linked_items) || row.linked_items < 0 || row.input.hasItems !== (row.linked_items > 0)) throw new Error('Invalid linked item evidence')
  if (!Array.isArray(row.quality_flags) || row.quality_flags.some(x => typeof x !== 'string') || !row.excerpt_evidence || typeof row.source !== 'string') throw new Error('Incomplete projection evidence')
  // 교재 재료 태그. null(아직 판정 안 실림)과 []( 반려라 재료 없음)는 **다른 뜻**이라 둘 다 통과시킨다.
  // undefined 만 막는다 — 키 자체가 빠지면 upsert 가 옛 값을 그대로 두고 조회가 낡은 답을 낸다.
  if (row.uses !== null && !(Array.isArray(row.uses) && row.uses.every(x => typeof x === 'string' && SOURCE_USES.has(x)))) throw new Error('Invalid source use tags')
}

export function changedFields(before, after) {
  // ⚠️ 여기 빠진 컬럼은 **조용히 안 써진다** — 그 값만 바뀐 행이 「변경 없음」으로 걸러진다.
  return ['source', 'source_updated_at', 'policy_version', 'input', 'result', 'quality_flags', 'excerpt_evidence', 'linked_items', 'uses'].filter(key => {
    if (!before) return true
    if (key === 'source_updated_at') return Date.parse(before[key]) !== Date.parse(after[key])
    return !isDeepStrictEqual(before[key], after[key])
  })
}

export function assertCurrentProjection(row, source, linkedItems) {
  if (!source || Date.parse(source.updated_at) !== Date.parse(row.source_updated_at)) throw new Error(`Source revision changed: ${row.article_id}; export again`)
  if (linkedItems !== row.linked_items) throw new Error(`Item references changed: ${row.article_id}; export again`)
}
