// apps/web/src/app/(main)/my/texts/page.tsx
// IA Refactor v06.26 — TextVault (내가 입력한 텍스트)

import { Screen } from '@/components/ui/ios';
import { TextHubContent } from '@/components/textviewer/TextHubContent';

export const metadata = {
  title: 'TextVault — Vocaflow',
  description: '내가 입력한 텍스트',
};

export default function MyTextsPage() {
  return (
    <Screen width="wide" background="bg2" padX="md">
      <TextHubContent />
    </Screen>
  );
}
