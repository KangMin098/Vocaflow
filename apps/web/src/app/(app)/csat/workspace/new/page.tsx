// apps/web/src/app/(app)/csat/workspace/new/page.tsx
//
// 만들기는 **팝업**이다(2026-09-29 참조 3B 결) — 메인의 Workspace 탭으로 보내고 팝업을 연다.
// 옛 링크 · 북마크가 깨지지 않게 경로는 남긴다.
import { redirect } from 'next/navigation'

export default function CsatWorkspaceNewPage() {
  redirect('/csat?tab=workspace&new=1')
}
