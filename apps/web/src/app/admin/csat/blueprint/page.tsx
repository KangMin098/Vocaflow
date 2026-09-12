// apps/web/src/app/admin/csat/blueprint/page.tsx
// 공정 ③ 설계 — 이원목적분류표(연령 × 수준 × 유형)와 단계 게이트 임계.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadBlueprintView } from '@/lib/csat/factory-views'

import { BlueprintClient } from './BlueprintClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatBlueprintPage() {
  await requireAdmin('/admin/csat/blueprint')
  const view = await loadBlueprintView()
  return <BlueprintClient {...view} />
}
