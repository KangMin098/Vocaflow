// apps/web/src/components/library/vocab/__tests__/VocabSetCarousel.test.tsx
//
// **규격의 글자가 실제로 보이는 유일한 표면** — 히어로 캐러셀(270px 표지).
//
// 격자 타일(150px)은 네 귀퉁이가 이미 칩으로 차 있어 kicker·권 번호·계열 줄을 얹을 자리가
// 없다(`VocabSetCard.test.tsx` 의 그 블록). 그래서 규격의 **글자**는 여기서만 그린다 —
// 그리고 여기서도 안 그리면 kicker·volumeFormat·seriesLine 은 다시 「적재만 되고 안 읽히는 값」이
// 된다. 이 파일이 그 자리를 잠근다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
import { coverLockupOf } from '@/lib/vcb/covers/lockup'
import { VocabSetCarousel } from '../VocabSetCarousel'

// 캐러셀은 상세 시트에서 표본 단어를 받으려고 브라우저 클라이언트를 만든다.
// SSR 단언에는 필요 없고, 없으면 모듈 로드가 죽는다.
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

const LOCKUP = coverLockupOf({
  family: 'structure',
  seriesLine: 'STRUCTURE · 구조 계열',
  grain: '해부와 분해 — 조각으로 나눠 본 것',
  lockup: { kicker: 'VOCAFLOW VOCABULARY', volumeFormat: 'VOL. {n}', titleMaxLines: 4 },
  coverGrid: { ratio: '3:4', plateInset: 8, scrimStrength: 0.35 },
  palette: { ink: 'ink', paper: 'paper', accent: 'accent' },
  typography: { display: 'english', body: 'body', numerals: 'mono' },
  canvasUrl: null,
  designedAt: '2026-09-06T12:15:03.399Z',
  designedBy: 'claude-design',
})

function set(overrides: Partial<PublishedVocabSet> = {}): PublishedVocabSet {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: '어원으로 익히는 1,500',
    description: null,
    category: 'etymology',
    categoryNode: null,
    additionalCategoryIds: [],
    cefrLevel: 'B2',
    coverEmoji: '🏛️',
    sortOrder: 0,
    wordCount: 1500,
    subscriberCount: 0,
    createdAt: '2020-01-01T00:00:00.000Z',
    kind: null,
    coverImageUrl: null,
    coverImageMeta: null,
    brandFingerprint: null,
    // 5단 = 권 이름 `Vocaflow Vocabulary 4` — 둘이 한 칸 밀려 있는 그 자리다.
    ladderStep: 5,
    brandFamily: 'structure',
    brandLockup: LOCKUP,
    slug: 'cat-etymology-1500',
    imprintCode: null,
    qa: null,
    level: null,
    ...overrides,
  }
}

function render(s: PublishedVocabSet): string {
  return renderToString(
    <VocabSetCarousel
      sets={[s]}
      subscribedIds={new Set()}
      pendingId={null}
      isLoggedIn={false}
      onPreview={() => {}}
      onToggle={() => {}}
      onSelectCategory={() => {}}
    />,
  ).replace(/<!-- -->/g, '')
}

/*
  2026-09 — 히어로 표지(정사각 판형 · kicker · VOL.)는 3D 선반 + 시중 교재형 표지로 바뀌었다
  (add73d52 · 7f60b8a4). 표지는 이제 브라우저에서만 그리므로(WebGL · tradeCoverSvg) SSR 로는 표지 글자를 볼 수 없다.
  여기서는 SSR 이 지키는 것 — 선반의 키보드 안내 · 고른 권의 상세 자리 — 만 잠근다.
*/
describe('3D 선반 — 서버 렌더가 지키는 것', () => {
  it('선반은 키보드 안내가 붙은 무리로 선다', () => {
    expect(render(set())).toContain('aria-label="단어장 선반 — 화살표로 이동, Enter 로 열기"')
  })

  it('고른 권의 상세 자리가 그 권 이름으로 불린다', () => {
    expect(render(set())).toContain('aria-label="어원으로 익히는 1,500 상세"')
  })

  it('옛 히어로 표지(정사각 판형)는 다시 그려지지 않는다', () => {
    expect(render(set())).not.toContain('aspect-square w-[196px]')
  })
})
