// apps/web/src/app/(main)/dictate/layout.tsx
//
// **이 화면 묶음의 이름.** `/dictate` 아래 네 화면(허브·설정·세션·결과)이 이 제목을
// 물려받는다 — 화면마다 같은 문자열을 네 번 적지 않으려고 layout 이 한 번만 붙인다.
// (허브 페이지가 `'use client'` 라 metadata 를 못 내보내서 시작된 자리지만,
//  2026-09-06 에 서버 컴포넌트가 된 지금도 여기 두는 이유는 위와 같다.)
//
// ⚠️ 실측 2026-08-23: 이름이 없으면 루트의 기본 제목을 쓰고, 그러면 **7개 화면의 탭 제목이
//    전부 같아진다.** 탭을 여러 개 열어 두고 공부하는 학습자는 어디가 어딘지 알 수 없다.
//    루트 template 이 ` | Vocaflow` 를 붙이므로 여기서는 화면 이름만 적는다.

export const metadata = {
  title: '받아쓰기',
  description: '들은 문장을 그대로 적어 완성으로 굳힌다',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
