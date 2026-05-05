// apps/web/src/app/(main)/library/layout.tsx
//
// /library 공통 셸 — gradient 배경 + max-w-6xl 컨테이너 + LibraryTabs 헤더.

import { LibraryTabs } from '@/components/library/LibraryTabs'

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--bg)] to-[var(--bg2)]">
      <div className="mx-auto max-w-6xl p-4 md:p-8 lg:px-10">
        <LibraryTabs />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
