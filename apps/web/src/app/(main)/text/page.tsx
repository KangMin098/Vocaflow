// apps/web/src/app/(main)/text/page.tsx
//
// TextViewer 허브 — Server Component (metadata + 정적 wrapper)
// 실 데이터 페치는 TextHubContent (Client Component) 에 위임

import { TextHubContent } from '@/components/textviewer/TextHubContent'

export const metadata = {
  title: '스크립트 · Vocaflow',
  description: '내가 쌓아온 영어 스크립트 라이브러리',
}

export default function TextViewerHubPage() {
  return <TextHubContent />
}
