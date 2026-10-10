// apps/web/src/lib/csat/synthetic-production.ts
import { runSyntheticMasterProduction } from '../../../../../scripts/textbook/synthetic-master-production.mjs'

export const SYNTHETIC_PRODUCTION_ORDERS = ['m1', 'h1', 'm1-m2'] as const
export type SyntheticProductionOrder = (typeof SYNTHETIC_PRODUCTION_ORDERS)[number]

export async function runAdminSyntheticProduction(order: SyntheticProductionOrder) {
  return runSyntheticMasterProduction(order)
}
