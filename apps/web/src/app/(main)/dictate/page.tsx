// apps/web/src/app/(main)/dictate/page.tsx
// Dictation Hub — /dictate

'use client';

import { Screen } from '@/components/ui/ios';
import { DictationHubClient } from '@/components/dictation/DictationHubClient';

export default function DictationHubPage() {
  return (
    <Screen width="content" background="bg2" padX="md">
      <DictationHubClient />
    </Screen>
  );
}
