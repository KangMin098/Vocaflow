// apps/web/src/app/admin/csat/new/fast/page.tsx
// 새 교재 만들기 → 빠른 학습지(FAST). 기존 제작 팩 하나를 고쳐 검수 초안 학습지로 내려받는다.
import { requireAdmin } from '@/lib/auth/require-admin'

import { FastWorksheet } from './FastWorksheet'

export const dynamic = 'force-dynamic'

export default async function AdminCsatFastPage() {
  await requireAdmin('/admin/csat/new/fast')
  return <FastWorksheet />
}
