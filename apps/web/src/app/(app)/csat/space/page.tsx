// apps/web/src/app/(app)/csat/space/page.tsx
//
// 옛 주소. 작업 공간이 기출 메인(`/csat`)이 됐다(2026-09-24) — 북마크·공유 링크를 살려 둔다.
import { redirect } from 'next/navigation'

export default function CsatSpaceRedirect() {
  redirect('/csat')
}
