// apps/web/src/app/(main)/pairflip/results/layout.tsx
//
// 이 화면의 이름. 페이지가 `'use client'` 라 `metadata` 를 못 내보내 형제 layout 이 붙인다.
// 허브·진행·결과가 같은 제목을 쓰면 탭에서 셋을 구별할 수 없다(실측 2026-08-23).

export const metadata = {
  title: 'PairFlip 결과',
  description: '맞춘 짝과 다음에 볼 것',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
