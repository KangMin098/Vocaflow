// apps/web/src/app/(main)/dictate/results/page.tsx
// Dictation Results — /dictate/results?sessionId=...

'use client';

import { Suspense } from 'react';
import { DictationResultsClient } from '@/components/dictation/DictationResultsClient';

export default function DictationResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-12 text-center font-body text-[14px] text-[var(--t3)]">
          결과를 불러오는 중...
        </div>
      }
    >
      <DictationResultsClient />
    </Suspense>
  );
}
