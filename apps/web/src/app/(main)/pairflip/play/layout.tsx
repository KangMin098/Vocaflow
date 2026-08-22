// apps/web/src/app/(main)/pairflip/play/layout.tsx
//
// 이 화면의 이름. 페이지가 `'use client'` 라 `metadata` 를 못 내보내 형제 layout 이 붙인다.
// 허브·진행·결과가 같은 제목을 쓰면 탭에서 셋을 구별할 수 없다(실측 2026-08-23).

export const metadata = {
  title: 'PairFlip 진행',
  description: '짝을 맞추며 낱말을 공간으로 기억한다',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
