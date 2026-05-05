// apps/web/src/app/(main)/wordvault/browse/page.tsx
// WordVault Browse 풀스크린 세션 (v06.21.6)
//
// SessionFrame 셸이 자동 주입 (isFullScreenRoute 등록).
// 워크스페이스에서 빠르게 접근 가능 — 사이드바·FlowNav 자동 숨김.

import { WordVaultBrowseClient } from '@/components/wordvault/WordVaultBrowseClient'

export const metadata = {
  title: 'WordVault — 둘러보기 · Vocaflow',
}

export default function WordVaultBrowsePage() {
  return <WordVaultBrowseClient />
}
