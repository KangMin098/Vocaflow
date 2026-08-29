// apps/web/src/app/(app)/play/connections/layout.tsx
//
// 이 게임의 **브라우저 제목**만 담당한다.
//
// page.tsx 는 `'use client'` 다(`next/dynamic` + `ssr:false` 로 게임을 늦게 싣는다) —
// 클라이언트 컴포넌트는 `metadata` 를 내보낼 수 없어, 게임 19종이 전부 루트 기본 제목
// "Vocaflow — 영어 스크립트 기반 종합 학습" 을 달고 있었다(실측 2026-08-30 ·
// `28-screen-identity` 가 제목 중복 19곳으로 잡았다). 탭·히스토리·북마크가 모두 같은
// 이름이라 학습자는 무엇을 열어 뒀는지 구별할 수 없었다.
//
// 이름은 `GAME_CATALOG` 가 소유한다 — 여기서 짓지 않는다.
// 카탈로그와 어긋나거나 새 게임에 이 파일이 빠지면 `play-titles.test.ts` 가 잡는다.

export const metadata = {
  title: "Connections 플레이 · Vocaflow",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
