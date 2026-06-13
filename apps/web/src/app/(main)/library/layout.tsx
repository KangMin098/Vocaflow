// apps/web/src/app/(main)/library/layout.tsx
//
// /library 공통 셸 (v06.38.2 iOS 정합):
//   · 캔버스는 (main)/layout.tsx 가 이미 bg-bg2 적용 → 자식 페이지의 <Screen> 이 책임
//   · 폭/패딩 제약 제거 → 각 페이지의 <Screen width="wide"> 가 일관 처리
//   · 상단 LibraryTabs 만 iOS 정합 컨테이너로 감쌈 (max-w-wide + 동일 패딩 grid)

import { LibraryTabs } from '@/components/library/LibraryTabs'

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-[var(--ios-content-wide-max)] px-4 pt-4 md:px-6 md:pt-5">
        <LibraryTabs />
      </div>
      {children}
    </>
  )
}
