// apps/web/src/app/admin/csat/press/page.tsx
// ⑧ 조판 · 발행. 공정의 끝 — 여기까지 와야 학습자가 손에 쥐는 것이 생긴다.
//
// ⚠️ 이 화면은 교재 공장에서 **쓰기 경로가 있는 둘 중 하나**다(다른 하나는 ④ 소재의
//   「지금 다시 잰다」). 승인은 사람의 판단 자체라 스크립트로 대신할 것이 없고,
//   터미널로 밀면 기록이 안 남는다 — 실측 2026-09-23 에 승인 컬럼이 파이프라인 전체에
//   0개였고, 그래서 3인 검수 1/60 인 권이 카탈로그에 「냈음」으로 서 있었다(DD-74).

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadPressView } from '@/lib/csat/factory-line-views'

import { decideVolumeAction } from './actions'
import { PressClient } from './PressClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatPressPage() {
  await requireAdmin('/admin/csat/press')
  const view = await loadPressView()
  // 액션은 여기서 내린다 — 화면이 직접 import 하면 렌더 테스트가 인증 경로까지 끌고 온다.
  return <PressClient {...view} onDecide={decideVolumeAction} />
}
