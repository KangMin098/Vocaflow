// apps/web/src/app/admin/csat/press/page.tsx
// ⑧ 조판·발행 — 권으로 나온 것과 그 검수 기록.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadPressView } from '@/lib/csat/factory-line-views'

import { PressClient } from './PressClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatPressPage() {
  await requireAdmin('/admin/csat/press')
  const view = await loadPressView()
  return <PressClient {...view} />
}
