// apps/web/src/app/(main)/wordvault/layout.tsx
//
// **이 화면의 이름 — 여기가 단일 소유자다.**
//
// ⚠️ 실측 2026-08-23: 이름이 없으면 루트의 기본 제목을 쓰고, 그러면 **7개 화면의 탭 제목이
//    전부 같아진다.** 탭을 여러 개 열어 두고 공부하는 학습자는 어디가 어딘지 알 수 없다.
//    루트 template 이 ` | Vocaflow` 를 붙이므로 여기서는 화면 이름만 적는다.
//
// ⚠️ **`page.tsx` 에 `metadata` 를 다시 두지 말 것** (실측 2026-09-06).
//    원래 이 파일이 생긴 이유는 "페이지가 `'use client'` 라 metadata 를 못 내보낸다" 였다.
//    허브를 서버 컴포넌트로 내리면서 그 제약이 풀렸고, 페이지에도 같은 제목을 달았더니
//    `app/__tests__/page-titles.test.ts` 가 **제목 중복**으로 잡았다 — 두 곳이 같은 값을
//    들면 한쪽만 고쳐질 때 조용히 갈라진다. 하위 3면(browse·review·study)은 각자 제목을
//    가지므로, 이 파일이 덮는 것은 `/wordvault` 하나뿐이다.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WordVault',
  description: '내 단어장 — 모은 낱말과 오늘 볼 것',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
