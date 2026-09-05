// apps/web/src/app/admin/textbook/page.tsx
// TBP(교재) 콘솔 — 학령 사다리 · 문항 건강 · 시중 대비 평가 우위.
//
// **조작 버튼이 없다.** 교재 생성은 사전·재고 전체를 훑는 일이라 웹 요청 시간 안에 안 끝나고,
// 규칙이 바뀌면 이미 넣은 것까지 다시 재야 한다 — 그래서 Claude Code 드레인이다.
// 절차는 화면 도움말(`lib/admin/help/textbook.ts`)에 있다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { getTextbookConsoleStats } from '@/lib/textbook/console-stats'
import { getKidSourcePanel } from '@/lib/textbook/kid-source-stats'

import { TextbookConsoleClient } from './TextbookConsoleClient'

export const dynamic = 'force-dynamic'

export default async function AdminTextbookPage() {
  await requireAdmin('/admin/textbook')

  // 둘은 서로 다른 표를 읽는다 — 한쪽이 늦다고 다른 쪽을 기다릴 이유가 없다.
  const [stats, kidSource] = await Promise.all([getTextbookConsoleStats(), getKidSourcePanel()])

  return <TextbookConsoleClient stats={stats} kidSource={kidSource} />
}
