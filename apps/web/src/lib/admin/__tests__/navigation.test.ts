// apps/web/src/lib/admin/__tests__/navigation.test.ts
import { describe, expect, it, vi } from 'vitest'
import { adminCompatibilityHref, withFactoryContext, updateAdminUrl } from '../navigation'
import {
  curationHref,
  curationLocation,
  curationPage,
  curationViewHref,
  sortCurationRows,
} from '../curation-view'
import { HELP_REGISTRY } from '../help'

describe('관리자 작업 맥락', () => {
  it('검토 대기를 벗어나면 전용 필터·상세·페이지를 지우고 검색 조건은 보존한다', () => {
    const input = new URLSearchParams('view=review&status=ready&page=4&selected=b-1&q=fish')
    const target = new URLSearchParams(curationViewHref(input, 'library').split('?')[1])
    expect(target.get('view')).toBe('library')
    expect(target.get('q')).toBe('fish')
    for (const key of ['status', 'page', 'selected']) expect(target.has(key)).toBe(false)
    const review = new URLSearchParams(
      curationViewHref(new URLSearchParams('view=library&page=3'), 'review').split('?')[1]
    )
    expect(review.get('status')).toBe('ready')
    expect(review.has('page')).toBe(false)
    expect(input.get('selected')).toBe('b-1')
  })
  it('Next의 내부 history 플래그를 재사용해 화면 상태 동기화를 건너뛰지 않는다', () => {
    const replaceState = vi.fn(),
      pushState = vi.fn()
    vi.stubGlobal('window', { history: { state: { __NA: true }, replaceState, pushState } })
    try {
      updateAdminUrl('/admin/curation?view=collect&method=id')
      updateAdminUrl('/admin/curation?view=review', 'push')
      expect(replaceState).toHaveBeenCalledWith(null, '', '/admin/curation?view=collect&method=id')
      expect(pushState).toHaveBeenCalledWith(null, '', '/admin/curation?view=review')
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('공정 이동에 제작 기준만 전달하고 대상 보기 선택을 보존한다', () => {
    const current = new URLSearchParams('series=reading&band=4&type=theme&q=private&view=other')
    expect(withFactoryContext('/admin/csat/authoring?view=explanation', current)).toBe(
      '/admin/csat/authoring?view=explanation&series=reading&band=4&type=theme'
    )
    expect(withFactoryContext('/admin/csat/review?band=6', current)).toContain('band=6')
    expect(withFactoryContext('/admin/csat/review?band=6', current)).not.toContain('band=4')
  })
  it('옛 URL의 검색·선택·반복 파라미터와 대상 앵커를 보존한다', () => {
    const target = adminCompatibilityHref('/admin/curation?view=library', {
      q: 'a & b',
      selected: 'book-1',
      tag: ['one', 'two'],
    })
    const params = new URLSearchParams(target.split('?')[1])
    expect(params.get('q')).toBe('a & b')
    expect(params.get('selected')).toBe('book-1')
    expect(params.getAll('tag')).toEqual(['one', 'two'])
    expect(adminCompatibilityHref('/admin/settings#billing', { q: 'x' })).toBe(
      '/admin/settings?q=x#billing'
    )
  })
  it('도서의 소스별 입력을 보존하고 목록 상태를 잃지 않는다', () => {
    expect(curationLocation(new URLSearchParams('tab=wikibooks'))).toEqual({
      view: 'collect',
      method: 'wikibooks',
    })
    expect(curationLocation(new URLSearchParams('view=review&method=bad'))).toEqual({
      view: 'review',
      method: 'sources',
    })
    expect(
      curationHref(new URLSearchParams('q=fish&selected=b-1&status=ready'), 'collect', 'id')
    ).toBe('/admin/curation?q=fish&selected=b-1&status=ready&view=collect&method=id')
  })
  it('페이지 전체 선택의 대상은 한 페이지이며 마지막 페이지와 잘못된 값을 처리한다', () => {
    const rows = Array.from({ length: 73 }, (_, id) => ({ id }))
    expect(curationPage(rows, '1').rows.map((row) => row.id)).toEqual(
      Array.from({ length: 25 }, (_, id) => id)
    )
    expect(curationPage(rows, '999').rows).toEqual(rows.slice(50))
    expect(curationPage(rows, 'invalid').page).toBe(1)
    expect(curationPage(rows, '-2').page).toBe(1)
    expect(curationPage([], '5')).toEqual({ page: 1, totalPages: 1, rows: [] })
  })
  it('화면에서 바뀐 도서 작업과 운영 화면의 도움말을 제공한다', () => {
    for (const label of ['도서 목록', '수집', '검토 대기'])
      expect(HELP_REGISTRY.curation.tabs?.[label]?.summary).toBeTruthy()
    expect(HELP_REGISTRY.settings.screen.summary).toContain('저장·발송·청구')
    expect(HELP_REGISTRY.analytics.screen.summary).toContain('리텐션')
  })
  it('같은 시각에 수집한 도서의 입력 순서가 바뀌어도 페이지 구성이 바뀌지 않는다', () => {
    const rows = Array.from({ length: 73 }, (_, index) => ({
      id: String(index).padStart(3, '0'),
      updated_at: '2026-10-19T00:00:00Z',
    }))
    const forward = curationPage(sortCurationRows(rows), '2')
    const reverse = curationPage(sortCurationRows([...rows].reverse()), '2')
    expect(reverse).toEqual(forward)
    expect(rows[0].id).toBe('000')
  })
})
