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

describe('히어로 표지 — 규격의 글자', () => {
  it('kicker 를 표지 맨 위에 찍는다', () => {
    expect(render(set())).toContain('VOCAFLOW VOCABULARY')
  })

  it('계열 줄을 찍는다 — 색이 무엇을 뜻하는지 말하는 유일한 글자다', () => {
    expect(render(set())).toContain('STRUCTURE · 구조 계열')
  })

  /*
    ⚠️ 교재 표지가 여기서 값을 치렀다 — 5단 표지에 `5` 를 찍었는데 제목은 `… Reading 4` 였다.
    계단(1~7)과 권 이름(Starter·1~6)이 한 칸 밀려 있어서다. 단어장은 같은 사다리를 탄다.
  */
  it('권 번호는 계단이 아니라 **권 이름**이다 — 5단 권에 VOL. 4', () => {
    const html = render(set())
    expect(html).toContain('VOL. 4')
    expect(html).not.toContain('VOL. 5')
  })

  it('시리즈를 두 번 말하지 않는다 — kicker 가 있으면 중앙 시리즈 줄을 뺀다', () => {
    expect(render(set())).not.toContain('Vocaflow Vocabulary 4')
  })

  it('계단을 못 정한 권은 번호 자리를 비운다 — 없는 수를 지어내지 않는다', () => {
    const html = render(set({ ladderStep: null, cefrLevel: null, level: null, category: 'etymology' }))
    expect(html).toContain('VOCAFLOW VOCABULARY')
    expect(html).not.toContain('VOL.')
  })

  it('각인이 없는 권은 종전 그대로 — kicker 없이 시리즈 줄', () => {
    const html = render(set({ brandLockup: null }))
    expect(html).not.toContain('VOCAFLOW VOCABULARY')
    expect(html).toContain('Vocaflow Vocabulary 4')
  })

  it('판형·스크림·도판 여백이 규격 값이다', () => {
    const html = render(set())
    expect(html).toContain('aspect-ratio:3 / 4')
    expect(html).toContain('rgba(0,0,0,0.35) 62%')
    // 코드 하한(hero 0.34)이 아니라 캔버스 값이어야 한다.
    expect(html).not.toContain('rgba(0,0,0,0.34) 62%')
    expect(html).toContain('padding:8% 8% 33%')
  })

  /*
    구독 배지는 **아래로 내렸다** — 예전 자리(오른쪽 위)는 이제 권 번호가 쓴다.
    되돌아오면 구독한 권만 번호가 가려지는데, 그건 구독하지 않으면 안 보이는 결함이다.
  */
  it('구독 배지가 권 번호 자리를 다시 차지하지 않는다', () => {
    const html = renderToString(
      <VocabSetCarousel
        sets={[set()]}
        subscribedIds={new Set([set().id])}
        pendingId={null}
        isLoggedIn
        onPreview={() => {}}
        onToggle={() => {}}
        onSelectCategory={() => {}}
      />,
    )
    expect(html).toContain('absolute bottom-3 right-3')
    expect(html).not.toContain('absolute right-3 top-3')
  })
})
