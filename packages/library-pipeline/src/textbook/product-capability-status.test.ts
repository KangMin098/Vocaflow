// packages/library-pipeline/src/textbook/product-capability-status.test.ts
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCT_FAMILIES } from './academic-reading'
import { PRODUCT_CAPABILITIES } from './factory-order'
import { PRODUCT_RUNTIME_EVIDENCE, productRuntimeCapability } from './product-capability-status'

describe('runtime capability claims', () => {
  it('covers every P01–P20 family and names files that actually exist', () => {
    expect(Object.keys(PRODUCT_RUNTIME_EVIDENCE).sort()).toEqual(Object.keys(PRODUCT_FAMILIES).sort())
    for (const family of Object.keys(PRODUCT_FAMILIES) as (keyof typeof PRODUCT_FAMILIES)[]) {
      const result = productRuntimeCapability(family)
      expect(result.contract_state).toBe(PRODUCT_CAPABILITIES[family].state)
      for (const file of result.evidence)
        expect(existsSync(resolve(__dirname, '../../../../', file)), file).toBe(true)
    }
  })

  it('does not promote a contract or planned layout to verified production', () => {
    expect(productRuntimeCapability('P03').state).toBe('SYNTHETIC_E2E_VALIDATED')
    expect(productRuntimeCapability('P09').state).toBe('CONTRACT_ONLY')
    for (const family of ['P13', 'P14', 'P18', 'P20'] as const)
      expect(productRuntimeCapability(family).state).toBe('NOT_SUPPORTED')
    expect(Object.values(PRODUCT_RUNTIME_EVIDENCE).some(value => value.state === 'PRODUCTION_E2E_VALIDATED')).toBe(false)
  })
})
