// apps/web/src/app/admin/csat/new/ProductOrderWorkbench.tsx
'use client'

import { useState } from 'react'
import { ProductPlanningForm } from './ProductPlanningForm'
import { ProductOrderRegistration, type PlanSelection } from './ProductOrderRegistration'

export function ProductOrderWorkbench({ canRegister }: { canRegister: boolean }) {
  const [selection, setSelection] = useState<PlanSelection>(null)
  return <>
    <ProductPlanningForm onPlanReady={setSelection} />
    {canRegister ? <ProductOrderRegistration selection={selection} /> : null}
  </>
}
