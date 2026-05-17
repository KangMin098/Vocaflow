// apps/web/src/app/(main)/my/texts/page.tsx
// IA Refactor v06.26 — TextVault (내가 입력한 텍스트)

import { TextHubContent } from '@/components/textviewer/TextHubContent';

export const metadata = {
  title: 'TextVault — Vocaflow',
  description: '내가 입력한 텍스트',
};

export default function MyTextsPage() {
  return <TextHubContent />;
}
