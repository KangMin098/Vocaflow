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
    // 기본 fixture 는 **컴포저가 계단을 안 정한** 레거시 세트다 — 그래야 카드가
    // 카테고리·CEFR 추정 경로를 타는지 확인할 수 있다. 저작된 계단은 따로 넘겨 시험한다.
    brandFingerprint: null,
    ladderStep: null,
    imprintCode: null,
    qa: null,
    level: null,
    ...overrides,
  }
}

function render(s: PublishedVocabSet): string {
  const html = renderToString(
    <VocabSetCard
      set={s}
      isSubscribed={false}
      isPending={false}
      errorMessage={null}
      onToggle={() => {}}
      onPreview={() => {}}
    />,
  )
  // ⚠️ SSR 은 인접한 텍스트 노드 사이에 `<!-- -->` 를 끼워 넣는다(하이드레이션 경계 표시).
  //    그래서 화면에 `7단` 으로 보이는 것이 HTML 에는 `7<!-- -->단` 으로 들어간다 —
  //    문자열 단언이 **화면과 다른 이유로** 깨진다. 마커는 내용이 아니므로 걷어내고 본다.
  return html.replace(/<!-- -->/g, '')
}

describe('단어장 카드 — 표지와 유형', () => {
  /*
    2026-09-07 — 표지는 **수집한 사진이 아니라 그린 도판**이다(`VocabCoverArt`).
    옛 계약(원본 URL 이 마크업에 있고 흑백 필터가 걸린다)은 사라졌고, 그 자리를
    "늘 그려진다 · 권마다 다르다 · 같은 권은 같다" 가 대신한다.
  */
  it('표지를 **그린다** — 수집 도판이 없어도 선화가 나온다', () => {
    const html = render(set({ coverImageUrl: null, coverImageMeta: null }))
    expect(html).toContain('<svg')
    expect(html).toMatch(/<path[^>]+d="/)
    // 옛 방식의 흔적이 남아 있으면 두 경로가 공존한다는 뜻이다.
    expect(html).not.toContain('example.org')
    expect(html).not.toMatch(/grayscale/)
  })

  it('권이 다르면 도판도 다르다 — 같은 계열 스물여덟 권이 한 그림이 되지 않는다', () => {
    const a = render(set({ slug: 'cat-root-a' }))
    const b = render(set({ slug: 'cat-root-b' }))
    const pathsOf = (html: string): string => (html.match(/<path[^>]+d="[^"]+"/g) ?? []).join('|')
    expect(pathsOf(a)).not.toBe(pathsOf(b))
  })

  it('같은 권은 언제나 같은 도판 — 표지는 손잡이라 변하면 안 된다', () => {
    const pathsOf = (html: string): string => (html.match(/<path[^>]+d="[^"]+"/g) ?? []).join('|')
    expect(pathsOf(render(set({ slug: 'cat-root-a' })))).toBe(
      pathsOf(render(set({ slug: 'cat-root-a' }))),
    )
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

  // 표지 배지는 **우리 사다리**를 말한다 — 시중 단어장이 CEFR 대신 자기 눈금을 적는 것과 같다.
  it('사다리 계단과 학령을 배지로 적는다', () => {
    // etymology + B2 → V7 → 7단 고3/수능 상위
    const html = render(set())
    expect(html).toContain('7단')
    expect(html).toContain('고3 / 수능 상위')
  })

  it('CEFR 을 버리지 않고 툴팁으로 남긴다', () => {
    expect(render(set())).toContain('CEFR B2')
  })

  it('학교급 카테고리는 CEFR 보다 세다 — 초등이면 1단이다', () => {
    const html = render(set({ category: 'elementary', cefrLevel: 'B2' }))
    expect(html).toContain('1단')
    expect(html).toContain('초등 저학년')
  })

  it('계단을 못 정하면 종전대로 CEFR 을 보인다 — 자리를 비우지 않는다', () => {
    // C2 = 성인 수준이라 학교 사다리 밖이다.
    const html = render(set({ category: 'themed', cefrLevel: 'C2' }))
    expect(html).not.toContain('단</span>')
    expect(html).toContain('C2')
  })

  it('계단도 CEFR 도 없으면 배지 자체를 그리지 않는다', () => {
    const html = render(set({ category: 'themed', cefrLevel: null }))
    expect(html).not.toContain('CEFR')
  })

  /*
    이모지 폴백은 **도판을 못 받은 권의 대타**였다. 이제 모든 권이 도판을 그리므로 대타가
    필요 없고, 두면 선화 위에 이모지가 겹친다. 폴백이 되살아나면 이 검사가 잡는다.
  */
  it('이모지 폴백을 쓰지 않는다 — 모든 권이 도판을 갖기 때문이다', () => {
    const html = render(set({ coverImageUrl: null, coverImageMeta: null }))
    expect(html).not.toContain('🏛️')
    expect(html).toContain('<svg')
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
