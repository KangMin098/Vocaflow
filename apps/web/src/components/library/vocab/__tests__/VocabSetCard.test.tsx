// apps/web/src/components/library/vocab/__tests__/VocabSetCard.test.tsx
//
// 카탈로그 카드가 **표지 도판과 유형을 실제로 그리는가**.
//
// 이 스펙이 필요한 이유는 두 번 겪었기 때문이다:
//   · 발행은 DB 에서 성공으로 보이는데 화면에는 없었다 (어드민 발행 컬렉션 32건 누락)
//   · 표지 URL 을 DB 에 다 채워 놓고도 카드가 그리지 않으면 아무 일도 일어나지 않는다
// 데이터가 있다는 것과 학습자가 본다는 것은 다른 사실이고, 뒤엣것은 렌더 단언으로만 잡힌다.
//
// dev 서버 없이 도는 것도 의도다 — `.next` 캐시가 깨져 있어도(멀티 세션 함정) 이 검증은 산다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FAMILY_GRAIN } from '@/lib/vcb/covers/design'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
import { VocabSetCard } from '../VocabSetCard'

function set(overrides: Partial<PublishedVocabSet> = {}): PublishedVocabSet {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: '어원으로 익히는 1,500',
    description: null,
    category: 'etymology',
    categoryNode: null,
    additionalCategoryIds: [],
    cefrLevel: 'B2',
    coverEmoji: '🏛️',
    sortOrder: 0,
    wordCount: 1500,
    subscriberCount: 3,
    createdAt: '2020-01-01T00:00:00.000Z',
    kind: { label: '어원', principle: '어근 하나에 딸린 단어를 한 묶음으로' },
    coverImageUrl: 'https://example.org/plate.jpg',
    coverImageMeta: {
      source: 'openverse',
      provider: 'wikimedia',
      license: 'pdm',
      license_url: null,
      creator: null,
      creator_url: null,
      page_url: null,
      query: 'root system botanical plate',
      family: 'structure',
    },
    ...overrides,
  }
}

function render(s: PublishedVocabSet): string {
  return renderToString(
    <VocabSetCard
      set={s}
      isSubscribed={false}
      isPending={false}
      errorMessage={null}
      onToggle={() => {}}
      onPreview={() => {}}
    />,
  )
}

describe('단어장 카드 — 표지와 유형', () => {
  it('표지 도판이 있으면 그림을 그린다', () => {
    const html = render(set())
    expect(html).toContain('https://example.org/plate.jpg')
    // 듀오톤은 흑백으로 눌러서 계열 색을 얹는 방식이다 — 이 필터가 빠지면 원본 채도가
    // 그대로 나와 29권이 스크랩북이 된다.
    expect(html).toMatch(/grayscale/)
  })

  // 색 값을 여기 적지 않는다 — 적으면 정본이 하나 더 늘어 드리프트가 생긴다.
  // 브랜드 규격에서 읽어 대조한다(그쪽은 다시 디자인 토큰을 읽는다).
  it('계열 색으로 듀오톤을 씌운다', () => {
    const html = render(set())
    expect(html).toContain(FAMILY_GRAIN.structure.ink)
  })

  it('계열이 다르면 다른 색이 나온다 — 색만 보고 계열을 안다', () => {
    const html = render(
      set({
        coverImageMeta: { ...set().coverImageMeta!, family: 'corpus' },
      }),
    )
    expect(html).toContain(FAMILY_GRAIN.corpus.ink)
    expect(html).not.toContain(FAMILY_GRAIN.structure.ink)
  })

  it('표지가 없으면 그라디언트 표지 + 이모지로 폴백한다 (공백 아님)', () => {
    const html = render(set({ coverImageUrl: null, coverImageMeta: null }))
    expect(html).not.toContain('example.org')
    expect(html).toContain('🏛️')
  })

  it('유형 라벨과 묶은 원리를 함께 적는다', () => {
    const html = render(set())
    expect(html).toContain('어원')
    expect(html).toContain('어근 하나에 딸린 단어를 한 묶음으로')
  })

  it('유형이 없는 레거시 세트는 그 줄을 생략한다 — 빈 칩을 남기지 않는다', () => {
    const html = render(set({ kind: null }))
    expect(html).not.toContain('어근 하나에 딸린')
  })
})
