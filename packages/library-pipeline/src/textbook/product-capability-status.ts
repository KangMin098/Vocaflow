// packages/library-pipeline/src/textbook/product-capability-status.ts
import { PRODUCT_FAMILIES } from './academic-reading'
import { PRODUCT_CAPABILITIES } from './factory-order'

export const PRODUCT_RUNTIME_STATES = [
  'NOT_SUPPORTED', 'CONTRACT_ONLY', 'IMPLEMENTED',
  'SYNTHETIC_E2E_VALIDATED', 'PRODUCTION_E2E_VALIDATED',
] as const
export type ProductRuntimeState = (typeof PRODUCT_RUNTIME_STATES)[number]

/** A family contract or generic reading renderer is not a family-specific production adapter. */
type RuntimeEvidence = Record<keyof typeof PRODUCT_FAMILIES, {
  state: ProductRuntimeState
  evidence: readonly string[]
  missing: readonly string[]
}>

export const PRODUCT_RUNTIME_EVIDENCE: RuntimeEvidence = Object.fromEntries(Object.keys(PRODUCT_FAMILIES).map(family => {
  const id = family as keyof typeof PRODUCT_FAMILIES
  const contract = PRODUCT_CAPABILITIES[id]
  const specialized = ['P13', 'P14', 'P18', 'P20'].includes(id)
  // Every supported family now has a structural adapter plus the family semantic review drain
  // (family-semantic-review.ts). IMPLEMENTED means executable gates exist, not validated teaching quality.
  const state: ProductRuntimeState = contract.state === 'PLANNED' || contract.state === 'UNSUPPORTED'
    ? 'NOT_SUPPORTED' : id === 'P03' ? 'SYNTHETIC_E2E_VALIDATED' : 'IMPLEMENTED'
  const evidence = id === 'P03'
    ? ['scripts/textbook/reading-promotion/preflight.test.mjs', 'scripts/textbook/atomic-production-run.test.mjs',
      'packages/library-pipeline/src/textbook/family-semantic-review.ts']
    : state === 'IMPLEMENTED' ? [
      specialized ? 'packages/library-pipeline/src/textbook/specialized-reading-unit.ts'
        : 'packages/library-pipeline/src/textbook/reading-family-unit.ts',
      'packages/library-pipeline/src/textbook/family-semantic-review.ts',
      'packages/library-pipeline/src/textbook/family-semantic-review.test.ts',
      'packages/library-pipeline/src/textbook/order-production-run.test.ts',
      ...(specialized ? [] : ['scripts/textbook/run-atomic-bridge.test.mjs']),
    ] : []
  const missing = state === 'NOT_SUPPORTED'
    ? ['family-specific passage/item/activity/layout adapter', 'synthetic end-to-end']
    : state === 'IMPLEMENTED'
      ? [...(specialized ? ['atomic production (DB gate pending migration)'] : ['live DB promotion to atomic publication end-to-end']),
        'family semantic review run on real content for this family', 'real-content operational end-to-end']
      : ['live DB promotion to atomic publication end-to-end', 'real-content operational end-to-end']
  return [id, { state, evidence, missing }]
})) as unknown as RuntimeEvidence

export function productRuntimeCapability(family: keyof typeof PRODUCT_FAMILIES) {
  return {
    family,
    name: PRODUCT_FAMILIES[family].name,
    contract_state: PRODUCT_CAPABILITIES[family].state,
    ...PRODUCT_RUNTIME_EVIDENCE[family],
  }
}
