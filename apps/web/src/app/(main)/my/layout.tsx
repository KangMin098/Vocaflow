// apps/web/src/app/(main)/my/layout.tsx
// /my 그룹 셸 (v06.38.2 iOS 정합) — 자식 페이지의 <Screen> 이 폭/패딩 책임.

import type { ReactNode } from 'react';
import { MyTabs } from '@/components/my/MyTabs';

export default function MyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-[var(--ios-content-wide-max)] px-4 pt-4 md:px-6 md:pt-5">
        <MyTabs />
      </div>
      {children}
    </>
  );
}
