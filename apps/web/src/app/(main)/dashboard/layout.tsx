// apps/web/src/app/(main)/dashboard/layout.tsx
// metadata 보유 server layout — 페이지가 'use client' 라 metadata export 불가능 → 여기서 정의

export const metadata = {
  title: '대시보드',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
