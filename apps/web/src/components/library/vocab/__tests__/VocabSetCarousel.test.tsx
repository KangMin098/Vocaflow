// apps/web/src/components/library/vocab/__tests__/VocabSetCarousel.test.tsx
//
// 실제 표지/상세의 SSR 노출과 반응형 격자에서 상하 이동의 경계 조건.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
import { coverLockupOf } from '@/lib/vcb/covers/lockup'
import { VocabSetCarousel, nearestCatalogRow } from '../VocabSetCarousel'

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

describe('Tines 단어장 목록 — SSR와 반응형 키보드 이동', () => {
  it('선반은 키보드 안내가 붙은 무리로 선다', () => {
    expect(render(set())).toContain('aria-label="단어장 목록 — 화살표로 이동, Enter 로 열기"')
  })

  it('고른 권의 상세 자리가 그 권 이름으로 불린다', () => {
    expect(render(set())).toContain('aria-label="어원으로 익히는 1,500 상세"')
  })

  it('옛 히어로 표지(정사각 판형)는 다시 그려지지 않는다', () => {
    expect(render(set())).not.toContain('aspect-square w-[196px]')
  })

  it('WebGL을 기다리지 않고 실제 표지와 상세 버튼을 서버에서 제공한다', () => {
    const html = render(set())
    expect(html).toContain('<svg')
    expect(html).toContain('어원으로 익히는 1,500 · 1,500 단어 — 상세 열기')
    expect(html).toContain('tabindex="0"')
  })

  it('2열과 마지막 짧은 행에서도 가장 가까운 열로 이동한다', () => {
    const rects = [{ top: 0, left: 0 }, { top: 0, left: 200 }, { top: 300, left: 0 }, { top: 300, left: 200 }, { top: 600, left: 0 }]
    expect(nearestCatalogRow(rects, 1, 1)).toBe(3)
    expect(nearestCatalogRow(rects, 3, 1)).toBe(4)
    expect(nearestCatalogRow(rects, 3, -1)).toBe(1)
    expect(nearestCatalogRow(rects, 0, -1)).toBe(0)
    expect(nearestCatalogRow(rects, 4, 1)).toBe(4)
  })
})
