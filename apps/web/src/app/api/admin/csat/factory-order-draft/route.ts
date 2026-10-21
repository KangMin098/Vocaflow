// apps/web/src/app/api/admin/csat/factory-order-draft/route.ts
// 저장된 Workspace 수요 한 줄 → 실제 교재공장 주문 초안(읽기 · 계산만, 쓰기 0). 계약: docs/ROUTES.md
import {
  createFactoryOrderDraftPost,
  supabaseFactoryOrderDraftReader,
} from '@/lib/admin/factory-order-draft'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const POST = createFactoryOrderDraftPost({
  guard: requireAdminApi,
  reader: () => supabaseFactoryOrderDraftReader(createAdminClient()),
  // 서버 경계에서 한 번 읽어 주입한다 — 서비스는 시계를 읽지 않는다
  now: () => new Date().toISOString(),
})
