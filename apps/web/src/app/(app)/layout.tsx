// apps/web/src/app/(app)/layout.tsx
//
// (app) 풀스크린 라우트 그룹 — Sidebar/FlowNav 없이 SessionFrame 만 적용.
// `/play/wordblitz`, `/play/pirate-quest` 등 게임 풀스크린 페이지가 이 layout 사용.
//
// (main)/layout.tsx 와 차이: Sidebar/FlowNav 없음 — 게임 본체에 viewport 100% 할당.

import { SessionFrame } from '@/components/layout/SessionFrame'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SessionFrame>{children}</SessionFrame>
}
