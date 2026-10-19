// apps/web/src/lib/admin/__tests__/curation-return.test.ts
import { describe, expect, it } from 'vitest'
import { adminCurationReturn, curationPreviewHref } from '../curation-view'
const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
describe('도서 본문 검수의 허용된 목록 복귀', () => {
  it('목록 보기·회차 대신 도서 필터·쪽·선택을 검수 URL 왕복에 유지한다', () => {
    const from = `/admin/curation?view=review&source=gutenberg&level=B1&status=ready&q=alice&page=2&selected=${id}`
    const review = new URL(curationPreviewHref(id, from), 'https://internal.invalid')
    expect(review.pathname).toBe(`/admin/curation/preview/${id}`)
    expect(adminCurationReturn(review.searchParams.get('returnTo'))).toBe(from)
  })
  it.each(['https://evil.test','//evil.test','/admin/users','/admin/curation/preview/book','/admin/curation?next=https://evil.test', ['x'], undefined])('외부·다른 경로·배열 복귀를 허용하지 않는다: %j', raw => {
    expect(adminCurationReturn(raw)).toBe('/admin/curation')
  })
  it('임의 query와 잘못된 선택·쪽을 제거하고 긴 검색을 제한한다', () => {
    const value = new URL(adminCurationReturn(`/admin/curation?view=unknown&page=-1&selected=bad&action=publish&q=${'a'.repeat(120)}`),'https://internal.invalid')
    expect([...value.searchParams.keys()]).toEqual(['view','q'])
    expect(value.searchParams.get('view')).toBe('library')
    expect(value.searchParams.get('q')).toHaveLength(100)
  })
})
