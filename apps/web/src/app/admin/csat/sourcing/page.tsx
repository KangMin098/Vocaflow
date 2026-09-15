// apps/web/src/app/admin/csat/sourcing/page.tsx
// ④ 소재 — 단계 밴드별 지문 재고와 소스 타겟.
//
// 집계는 DB 가 6시간마다 떠 둔 스냅샷에서 읽는다(`loadSourceConsole`). 방문마다 10만 행을
// 훑지 않고, 화면은 **언제 잰 값인지**를 함께 낸다. 여기 있던 `loadSourceView()` 는
// 발행분 562편을 「지문 재고」라 부르고 있었다 — 그 경위는 `factory-line-views.ts` 의 묘비명.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadSourceConsole } from '@/lib/csat/source-console'
import { getKidSourcePanel } from '@/lib/textbook/kid-source-stats'

import { retakeSourceSnapshotAction } from './actions'
import { SourceClient } from './SourceClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatSourcePage() {
  await requireAdmin('/admin/csat/sourcing')
  // 초·중 원문 재고는 TBP 콘솔에 있던 것이다(2026-09-06 이관). 지문 수급이 곧 이 공정이라
  // 여기가 제자리다 — 별도 화면에 두면 "지문이 모자란다" 와 "원문이 모자란다" 를 두 곳에서 읽는다.
  const [view, kidSource] = await Promise.all([loadSourceConsole(), getKidSourcePanel()])
  // 액션은 여기서 내린다 — 화면이 직접 import 하면 렌더 테스트가 인증 경로까지 끌고 온다.
  return <SourceClient view={view} kidSource={kidSource} onRetake={retakeSourceSnapshotAction} />
}
