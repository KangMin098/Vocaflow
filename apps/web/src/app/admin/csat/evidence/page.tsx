// apps/web/src/app/admin/csat/evidence/page.tsx
// 기출 원천 — 회차별 독해 실점 0 커버리지 · 유형별 진행 · 가이드 원천. 듣기는 다루지 않는다.
//
// 공장의 **첫 공정**이다(시중 출판사의 「출제경향 분석」). 여기서 나온 유형 리포트가
// 설계(이원목적분류표)의 근거가 되므로, 이 화면이 비면 아래 공정 전부가 짐작 위에 선다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadCsatOverview } from '@/lib/csat/client'

import { CsatConsoleClient } from './CsatConsoleClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatEvidencePage() {
  await requireAdmin('/admin/csat/evidence')
  const overview = await loadCsatOverview()
  return <CsatConsoleClient {...overview} />
}
