// apps/web/src/lib/design/__tests__/story-routes.test.ts
//
// LCP Story S5 라우트의 셸 결정 — 서가는 Library 하위 면으로 머리띠 · 범주 색을 받고, 독서 화면은 읽기 본문이라
// 도서 한 권(`/library/books/[id]`) · `/text/[id]` 와 같이 머리띠를 넣지 않는다. 계측 화면 id 는 닫힌 이름이고
// 발행 키가 들어가지 않는다. 기존 Library 면의 결정이 바뀌지 않았는지도 함께 본다.

import { describe, expect, it } from 'vitest'

import { screenIdOf } from '@/lib/framework/learner-routes'
import { LIBRARY_TABS, STORY_LABEL } from '@/lib/library/tabs'

import { getLearnerColorRole } from '../learner-palette'
import { routeArt, wantsBanner } from '../route-art'

const KEY = 'lsr_0123456789abcdef0123456789abcdef'

describe('LCP Story 라우트 셸 결정', () => {
  it('Stories 탭은 Decks 뒤 · Textbooks 앞이고, Textbooks 는 끝에 남는다(DiscoveryFooter 인덱스 참조)', () => {
    const hrefs = LIBRARY_TABS.map((t) => t.href)
    expect(hrefs).toEqual(['/library/books', '/library/scripts', '/library/vocab', '/library/stories', '/library/textbooks'])
    expect(LIBRARY_TABS[3].label).toBe(STORY_LABEL)
    // DiscoveryFooter 가 쓰는 위치(0 · 1)는 그대로다.
    expect(LIBRARY_TABS[0].href).toBe('/library/books')
    expect(LIBRARY_TABS[1].href).toBe('/library/scripts')
  })

  it('계측 화면 id 는 닫힌 이름 — 발행 키 · 쿼리가 실리지 않는다', () => {
    expect(screenIdOf('/library/stories')).toBe('library-stories')
    expect(screenIdOf(`/library/stories/${KEY}`)).toBe('library-story')
    expect(screenIdOf(`/library/stories/${KEY}?unit=3`)).toBe('library-story')
  })

  it('서가는 Library 범주 그림 · 머리띠를 받고, 독서 화면은 머리띠를 넣지 않는다', () => {
    expect(routeArt('/library/stories')).not.toBeNull()
    expect(wantsBanner('/library/stories', 'library')).toBe(true)
    expect(wantsBanner(`/library/stories/${KEY}`, 'library')).toBe(false)
    // 셸(main) 쪽은 서가 하위를 원래대로 건너뛴다.
    expect(wantsBanner('/library/stories', 'main')).toBe(false)
  })

  it('기존 Library 면의 머리띠 결정은 그대로다', () => {
    for (const p of ['/library/books', '/library/scripts', '/library/vocab', '/library/textbooks']) {
      expect(wantsBanner(p, 'library'), p).toBe(false)
    }
    expect(wantsBanner('/library/books/abc', 'library')).toBe(false)
  })

  it('팔레트는 Library 기본(자료 · 둘러보기)으로 떨어진다 — 별도 색을 만들지 않았다', () => {
    expect(getLearnerColorRole('/library/stories')).toEqual(getLearnerColorRole('/library/books'))
    expect(getLearnerColorRole(`/library/stories/${KEY}`)).toEqual(getLearnerColorRole('/library/books'))
  })
})
