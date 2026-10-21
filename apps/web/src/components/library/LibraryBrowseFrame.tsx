// apps/web/src/components/library/LibraryBrowseFrame.tsx
import type { ReactNode } from 'react'

import { Screen } from '@/components/ui/ios'
import { LibraryTabs } from '@/components/library/LibraryTabs'

/** 공개 서가의 PC 자료 유형 레일. 검색·조건·상태는 각 서가 부품이 계속 소유한다. */
export function LibraryBrowseFrame({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  return (
    <Screen width="wide" background="bg2" padX="md" className="catalog-reference-page">
      <div data-shelf-wide className="catalog-reference">
        <aside className="catalog-reference__rail hidden lg:block">
          {rail ?? <LibraryTabs variant="rail" />}
        </aside>
        <div className="catalog-reference__body">{children}</div>
      </div>
    </Screen>
  )
}
