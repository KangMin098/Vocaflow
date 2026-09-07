// apps/web/src/app/admin/csat/sources/page.tsx
// 원문 적격 — 교재에 실을 수 있는 원문인가를 일곱 축으로 판정한 결과.
//
// **조작 버튼이 없다.** 판정은 재고 전체를 훑는 일이라 웹 요청 시간 안에 안 끝난다
// (실측 약 130초). 스캔은 Claude Code 로 돌리고 이 화면은 그 결과를 읽는다 —
// 절차는 화면 도움말(`lib/admin/help/textbook.ts` 의 `csat-sources`)에 있다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { buildSourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'

import { SourceEligibilityClient } from './SourceEligibilityClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatSourcesPage() {
  await requireAdmin('/admin/csat/sources')

  // 스냅샷을 읽어 화면 모양으로 만든다 — DB 를 치지 않는다(그 이유는 view 모듈 머리말).
  const panel = buildSourceEligibilityPanel()

  return <SourceEligibilityClient panel={panel} />
}
