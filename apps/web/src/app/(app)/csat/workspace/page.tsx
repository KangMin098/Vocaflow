// apps/web/src/app/(app)/csat/workspace/page.tsx
//
// 내 Workspace 목록은 메인 판의 **Workspace 탭**이다(2026-09-29 참조 3B 「Workflows」 탭 결).
// 옛 링크가 깨지지 않게 경로는 남기고 그 탭으로 보낸다.
import { redirect } from 'next/navigation'

export default function CsatWorkspaceListPage() {
  redirect('/csat?tab=workspace')
}
