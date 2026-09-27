// apps/web/src/app/admin/csat/explain/page.tsx
// ⑥ 해설 — 유형 × 수준 해설 보유. 이 화면은 2026-09-23 에 처음 생겼다(DD-74).
//
// 그전까지 메뉴의 ⑥ 칸은 `href` 가 부모를 가리키고 「준비 중」 배지가 붙어 있었다 —
// 갈 곳이 없는 칸이었고, 그것이 ⑥ 을 파이프라인 최저점(9/22)으로 만든 첫 번째 이유다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadExplainView } from '@/lib/csat/factory-line-views'

import { ExplainClient } from './ExplainClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatExplainPage() {
  await requireAdmin('/admin/csat/explain')
  const view = await loadExplainView()
  return <ExplainClient {...view} />
}
