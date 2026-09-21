// apps/web/src/components/wordvault/hub/WordVaultEmptyState.tsx
//
// WordVault 허브 빈 상태 — 단어가 아직 0개인 사용자용
// 두 가지 출발점 제시:
//   - 새 스크립트 추가 (TextViewer 진입)
//   - 라이브러리에서 고르기

'use client'

import { SpotState } from '@/components/ui/SpotState'
import { MODULE_TONE, TINT_CLASS } from '@/lib/design/tone'

// DD-68 · tines-mapping §14 — 참조 빈 결과 문법(가운데 소품 · 세리프 제목 · 알약 두 개)을 보관함 범주 색(분홍) 면 위에.
//   예전 제목 「스크립트을」은 조사를 손으로 붙인 오류였다 — 「스크립트를」.
export function WordVaultEmptyState() {
  return (
    <section aria-label="첫 단어 시작" className={`${TINT_CLASS[MODULE_TONE.wordvault.tint]} rounded-[var(--r-2xl)] px-6 py-8 md:px-12 md:py-12`}>
      <SpotState
        art="empty-vault"
        title="스크립트를 추가하면 단어장이 시작됩니다"
        body="좋아하는 책, 강연, 기사를 추가하면 AI가 핵심 단어를 추출해 학습 단어장을 만들어 드립니다."
        primary={{ href: '/text/new', label: '스크립트 추가하기' }}
        secondary={{ href: '/library', label: '라이브러리 둘러보기' }}
      />
    </section>
  )
}
