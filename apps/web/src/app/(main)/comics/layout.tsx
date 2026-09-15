// apps/web/src/app/(main)/comics/layout.tsx
//
// /comics 공통 셸 — 상단 ComicsTabs(Adapted · Restored).
// /library/layout.tsx 와 같은 형태: 탭만 iOS 정합 컨테이너로 감싸고, 폭/배경은 각 페이지의 <Screen> 이 책임.

import { ComicsTabs } from '@/components/comic/ComicsTabs'

export default function ComicsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-[var(--ios-content-wide-max)] px-4 pt-4 md:px-6 md:pt-5">
        <ComicsTabs />
      </div>
      {children}
    </>
  )
}
