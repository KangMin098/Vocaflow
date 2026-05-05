// apps/web/src/app/(main)/dictate/session/page.tsx
// Dictation Session — /dictate/session?sessionId=...

'use client';

import { Suspense } from 'react';
import { DictationSessionClient } from '@/components/dictation/DictationSessionClient';

export default function DictationSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-center font-body text-[14px] text-[var(--t3)]">
          세션을 불러오는 중...
        </div>
      }
    >
      <DictationSessionClient />
    </Suspense>
  );
}
