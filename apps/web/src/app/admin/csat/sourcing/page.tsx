// apps/web/src/app/admin/csat/sourcing/page.tsx
// ④ 소재 — 단계 밴드별 지문 재고와 저작권 등급.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadSourceView } from '@/lib/csat/factory-line-views'
import { getKidSourcePanel } from '@/lib/textbook/kid-source-stats'

import { SourceClient } from './SourceClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatSourcePage() {
  await requireAdmin('/admin/csat/sourcing')
  // 초·중 원문 재고는 TBP 콘솔에 있던 것이다(2026-09-06 이관). 지문 수급이 곧 이 공정이라
  // 여기가 제자리다 — 별도 화면에 두면 "지문이 모자란다" 와 "원문이 모자란다" 를 두 곳에서 읽는다.
  const [view, kidSource] = await Promise.all([loadSourceView(), getKidSourcePanel()])
  return <SourceClient {...view} kidSource={kidSource} />
}
