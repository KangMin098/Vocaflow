// apps/web/src/lib/admin/__tests__/curation-view-line.test.ts
import { describe, expect, it } from 'vitest'

import {
  CURATION_LINES,
  adminCurationReturn,
  curationLine,
  curationLineHref,
  curationLocation,
  storyHref,
  storyLocation,
} from '../curation-view'

const book = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const slot = '11111111-2222-3333-4444-555555555555'
const ORIGINAL = `view=review&method=bulk&q=alice&source=gutenberg&level=B1&status=ready&page=2&selected=${book}`

const query = (href: string) => new URL(href, 'https://internal.invalid').searchParams

describe('작업 라인 — 원본 도서 ↔ 이야기 판본', () => {
  it('라벨은 도움말 탭 키와 같은 문자열이다', () => {
    expect(CURATION_LINES.map((line) => line.label)).toEqual(['원본 도서', '이야기 판본'])
  })

  it('없거나 모르는 line 은 원본 라인이다', () => {
    expect(curationLine(new URLSearchParams(''))).toBe('original')
    expect(curationLine(new URLSearchParams('line=unknown'))).toBe('original')
    expect(curationLine(new URLSearchParams('line=story'))).toBe('story')
  })

  it('이야기 라인으로 갔다가 돌아오면 원본 URL 이 정확히 되살아난다', () => {
    const toStory = curationLineHref(new URLSearchParams(ORIGINAL), 'story')
    expect(query(toStory).get('line')).toBe('story')
    const back = curationLineHref(query(toStory), 'original')
    expect(back).toBe(`/admin/curation?${ORIGINAL}`)
    expect(curationLocation(query(back))).toEqual({ view: 'review', method: 'bulk' })
  })

  it('원본 라인으로 돌아가도 이야기 선택은 남아 다시 오면 그대로다', () => {
    const inStory = storyHref(new URLSearchParams(ORIGINAL), { slot, panel: 'files' })
    const back = curationLineHref(query(inStory), 'original')
    expect(query(back).get('line')).toBeNull()
    expect(storyLocation(query(curationLineHref(query(back), 'story')))).toEqual({ slot, panel: 'files' })
  })

  it('빈 질의는 물음표 없이 돌아간다', () => {
    expect(curationLineHref(new URLSearchParams('line=story'), 'original')).toBe('/admin/curation')
  })
})

describe('이야기 라인 상태', () => {
  it('uuid 가 아닌 자리 · 모르는 패널은 무시한다', () => {
    expect(storyLocation(new URLSearchParams('story_slot=bad&story_panel=x'))).toEqual({ slot: null, panel: null })
    expect(storyLocation(new URLSearchParams(`story_slot=${slot}&story_panel=files`))).toEqual({ slot, panel: 'files' })
  })

  it('storyHref 는 patch 에 적은 키만 바꾸고 원본 키를 보존한다', () => {
    const href = storyHref(new URLSearchParams(ORIGINAL), { slot })
    const params = query(href)
    expect(params.get('line')).toBe('story')
    expect(params.get('story_slot')).toBe(slot)
    for (const [key, value] of new URLSearchParams(ORIGINAL)) expect(params.get(key)).toBe(value)
    const panelOnly = query(storyHref(params, { panel: 'files' }))
    expect(panelOnly.get('story_slot')).toBe(slot)
    const cleared = query(storyHref(panelOnly, { slot: null, panel: null }))
    expect(cleared.get('story_slot')).toBeNull()
    expect(cleared.get('story_panel')).toBeNull()
  })

  it('uuid 가 아닌 slot 은 넣지 않는다', () => {
    expect(query(storyHref(new URLSearchParams(''), { slot: 'javascript:alert(1)' })).get('story_slot')).toBeNull()
  })

  it('본문 검수 복귀 계약은 이야기 키를 계속 무시한다', () => {
    const from = `/admin/curation?${ORIGINAL}&line=story&story_slot=${slot}&story_panel=files`
    const value = query(adminCurationReturn(from))
    expect(value.get('line')).toBeNull()
    expect(value.get('story_slot')).toBeNull()
    expect(value.get('story_panel')).toBeNull()
    expect(value.get('selected')).toBe(book)
  })
})
