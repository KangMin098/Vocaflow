// packages/library-pipeline/src/textbook/factory-order-stage.ts
// Browser-safe mapping: the nine-stage factory reads this without importing crypto or Zod.
export const FACTORY_STATES = [
  'source_candidate', 'direct_use_reviewed', 'adaptation_candidate', 'adaptation_reviewed', 'benchmark_pending',
  'benchmark_validated', 'gold_candidate', 'gold_review_ready', 'gold_certified',
  'seed_eligible', 'queued', 'promotion_ready', 'ready', 'item_ready',
  'explanation_ready', 'editorial_ready', 'unit_ready', 'volume_ready', 'rendered',
  'published', 'stale', 'hold', 'reject', 'invalidated', 'retired',
] as const
export type FactoryState = (typeof FACTORY_STATES)[number]
export type FactoryMeasurement = 'not_measured' | 'not_applicable' | 'blocked' | 'insufficient_evidence' | 'measured'
export type FactoryStageId = 'evidence' | 'market' | 'blueprint' | 'source' | 'author' | 'explain' | 'review' | 'press' | 'operate'
export const FACTORY_STATE_STAGE: Record<FactoryState, FactoryStageId> = {
  source_candidate: 'source', direct_use_reviewed: 'source', adaptation_candidate: 'source', adaptation_reviewed: 'source',
  benchmark_pending: 'market', benchmark_validated: 'market', gold_candidate: 'review',
  gold_review_ready: 'review', gold_certified: 'review', seed_eligible: 'source',
  queued: 'source', promotion_ready: 'source', ready: 'author', item_ready: 'author',
  explanation_ready: 'explain', editorial_ready: 'review', unit_ready: 'press',
  volume_ready: 'press', rendered: 'press', published: 'operate', stale: 'source',
  hold: 'source', reject: 'source', invalidated: 'source', retired: 'operate',
}
