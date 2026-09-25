// apps/web/src/components/textviewer/EmptyState.tsx
//
// TextViewer 허브 빈 상태 — 첫 방문 사용자용
// 두 가지 출발점 제시: 직접 입력 / 라이브러리에서 고르기

'use client'

import { SpotState } from '@/components/ui/SpotState'
import { MODULE_TONE, TINT_CLASS } from '@/lib/design/tone'

// DD-68 · tines-mapping §14 — 참조 빈 결과 문법(가운데 소품 · 세리프 제목 · 알약 두 개), 읽기 범주 색(초록) 면.
export function EmptyState() {
  return (
    <section aria-label="첫 스크립트 시작" className={`${TINT_CLASS[MODULE_TONE.read.tint]} rounded-[var(--r-2xl)] px-6 py-8 md:px-12 md:py-12`}>
      <SpotState
        art="empty-page"
        title="나만의 영어 스크립트 라이브러리, 여기서 시작합니다"
        body="좋아하는 책, 강연, 기사를 직접 입력하거나 라이브러리에서 고르세요. AI가 핵심 단어를 추출해 학습 단어장을 만들어 드립니다."
        primary={{ href: '/text/new', label: '직접 입력하기' }}
        secondary={{ href: '/library', label: '라이브러리 둘러보기' }}
      />
    </section>
  )
}
