// apps/web/src/app/(main)/library/layout.tsx
//
// /library 공통 셸 (v06.38.2 iOS 정합):
//   · 캔버스는 (main)/layout.tsx 가 이미 bg-bg2 적용 → 자식 페이지의 <Screen> 이 책임
//   · 폭/패딩 제약 제거 → 각 페이지의 <Screen width="wide"> 가 일관 처리
//   · 상단 LibraryTabs 만 iOS 정합 컨테이너로 감쌈 (max-w-wide + 동일 패딩 grid)

import { ModuleBanner } from '@/components/layout/ModuleBanner'
import { LibraryTabs } from '@/components/library/LibraryTabs'
import '@/components/library/detail-reference.css'

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 서가 탐색 폭을 쓰는 화면(data-shelf-wide)이면 구역 머리도 같은 폭으로 맞춘다. */}
      <div data-area-layout className="mx-auto w-full max-w-[var(--ios-content-wide-max)] px-4 pt-4 md:px-6 md:pt-5 [body:has([data-shelf-wide])_&]:max-w-[var(--content-shelf-max)] lg:[body:has([data-shelf-wide])_&]:px-10">
        <LibraryTabs />
        <div className="mt-4">
          <ModuleBanner slot="library" />
        </div>
      </div>
      {children}
    </>
  )
}
