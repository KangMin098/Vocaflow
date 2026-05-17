// apps/web/src/app/(main)/my/layout.tsx
// IA Refactor v06.26 — /my 그룹 셸 (My 자산 hub)

import type { ReactNode } from 'react';
import { MyTabs } from '@/components/my/MyTabs';

export default function MyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--bg)] to-[var(--bg2)]">
      <div className="mx-auto max-w-6xl">
        <MyTabs />
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
