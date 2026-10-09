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
  const state: ProductRuntimeState = contract.state === 'PLANNED' || contract.state === 'UNSUPPORTED'
    ? 'NOT_SUPPORTED'
    : id === 'P03' ? 'SYNTHETIC_E2E_VALIDATED' : 'CONTRACT_ONLY'
  const evidence = id === 'P03'
    ? ['scripts/textbook/reading-promotion/preflight.test.mjs', 'scripts/textbook/atomic-production-run.test.mjs']
    : state === 'CONTRACT_ONLY' ? ['packages/library-pipeline/src/textbook/factory-order.ts'] : []
  const missing = state === 'NOT_SUPPORTED'
    ? ['family-specific passage/item/activity/layout adapter', 'synthetic end-to-end']
    : state === 'CONTRACT_ONLY'
      ? ['family-specific passage/item/activity/layout end-to-end']
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
