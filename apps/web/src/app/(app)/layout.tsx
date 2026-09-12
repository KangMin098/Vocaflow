// apps/web/src/app/(app)/layout.tsx
//
// (app) 풀스크린 라우트 그룹 — Sidebar/FlowNav 없이 SessionFrame 만 적용.
// `/play/wordblitz`, `/play/pirate-quest` 등 게임 풀스크린 페이지가 이 layout 사용.
//
// (main)/layout.tsx 와 차이: Sidebar/FlowNav 없음 — 게임 본체에 viewport 100% 할당.

import { ScreenViewTracker } from '@/components/layout/ScreenViewTracker'
import { SessionFrame } from '@/components/layout/SessionFrame'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 화면 진입 계측(D2) — (main) 과 같은 한 줄. 게임 19종이 분모 밖에 있지 않게. */}
      <ScreenViewTracker group="app" />
      <SessionFrame>{children}</SessionFrame>
    </>
  )
}
