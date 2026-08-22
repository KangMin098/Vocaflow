// apps/web/src/app/(main)/dictate/session/layout.tsx
//
// **이 화면의 이름.** 페이지가 `'use client'` 라 `metadata` 를 못 내보낸다 —
// 형제 layout 이 대신 붙인다.
//
// ⚠️ 실측 2026-08-23: 이름이 없으면 루트의 기본 제목을 쓰고, 그러면 **7개 화면의 탭 제목이
//    전부 같아진다.** 탭을 여러 개 열어 두고 공부하는 학습자는 어디가 어딘지 알 수 없다.
//    루트 template 이 ` | Vocaflow` 를 붙이므로 여기서는 화면 이름만 적는다.

export const metadata = {
  title: '받아쓰기 진행',
  description: '한 문장씩 듣고 적는다',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
