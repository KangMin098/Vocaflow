// apps/web/src/app/(main)/dictate/setup/page.tsx
// Dictation Setup — /dictate/setup?resourceId=...

'use client';

import { Suspense } from 'react';
import { DictationSetupClient } from '@/components/dictation/DictationSetupClient';

export default function DictationSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-8 text-center font-body text-[14px] text-[var(--t3)]">
          준비 중...
        </div>
      }
    >
      <DictationSetupClient />
    </Suspense>
  );
}
