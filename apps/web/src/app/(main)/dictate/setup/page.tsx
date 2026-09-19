// apps/web/src/app/(main)/dictate/setup/page.tsx
// Dictation Setup — /dictate/setup?resourceId=...

'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DictationSetupClient } from '@/components/dictation/DictationSetupClient';

export default function DictationSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-16 font-body text-[14px] text-[var(--t2)]">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          준비하고 있어요
        </div>
      }
    >
      <DictationSetupClient />
    </Suspense>
  );
}
