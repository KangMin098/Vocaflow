// apps/web/src/lib/admin/__tests__/kice-list-state.test.ts
import { describe, expect, it } from 'vitest'
import { adminKiceReturn, filterKiceItems, kiceListHref, parseKiceListState } from '../kice-list-state'
describe('관리자 기출 목록 복귀', () => {
  it('문항 상세 뒤 검색·회차·쪽·집합·학년을 유지한다', () => {
    const href = kiceListHref('R-PURPOSE', { q: '수능 & 18', exam: '2026', page: 2 }, { set: 'hakpyeong', grade: 2 })
    expect(adminKiceReturn(href, '/admin/kice')).toBe(href)
  })
  it.each(['https://evil.test', '//evil.test', '/admin/users', '/csat/browse', '/admin/kice/R-X/extra', ['/admin/kice/R-X']])('허용되지 않은 복귀를 거부한다: %j', raw => {
    expect(adminKiceReturn(raw, '/admin/kice')).toBe('/admin/kice')
  })
  it('임의 query를 버리고 페이지·검색 입력을 정규화한다', () => {
    expect(adminKiceReturn('/admin/kice/R-PURPOSE?page=-3&extra=ignored&q=ok', '/admin/kice')).toBe('/admin/kice/R-PURPOSE?q=ok#items-h')
    expect(adminKiceReturn('/admin/kice/R-PURPOSE?next=https://evil.test', '/admin/kice')).toBe('/admin/kice')
    expect(parseKiceListState({ page: ['2'], q: ' hi ', exam: 'bad/value' })).toEqual({ page: 1, q: 'hi', exam: '' })
  })
  it('시험 회차와 검색을 함께 적용한다', () => {
    const rows = [{ id: '2026#18', exam_label: '2026 수능', no: 18 }, { id: '2025#18', exam_label: '2025 수능', no: 18 }]
    expect(filterKiceItems(rows, { q: '수능', exam: '2026', page: 1 })).toEqual([rows[0]])
  })
})
