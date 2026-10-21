// apps/web/src/lib/admin/__tests__/factory-scope.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { factoryScopeDescription, parseFactoryScope } from '../factory-scope'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { LadderFill } from '@/app/admin/csat/press/LadderFill'

const state = vi.hoisted(() => ({ filters: {} as Record<string, unknown>, fail: false, creates: 0 }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => {
  state.creates++
  return { from: () => {
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: (key: string, value: unknown) => { state.filters[key] = value; return chain },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: state.fail ? null : [
          { band: 11, series: 'reading', step: 2, items: 1, explained_batch: 1, explained_rule: 0 },
          { band: 32, series: 'vocab', step: 2, items: 1, explained_batch: 1, explained_rule: 0 },
        ].filter(row => Object.entries(state.filters).every(([key, value]) => row[key as keyof typeof row] === value)),
        error: state.fail ? { message: 'read failed' } : null,
      }).then(resolve),
    }
    return chain
  } }
} }))
import { loadPressView, loadReviewView } from '@/lib/csat/factory-line-views'

beforeEach(() => { state.filters = {}; state.fail = false; state.creates = 0 })
describe('제작 기준과 실제 조판 조회 범위', () => {
  it.each(['series=other&band=1', 'series=reading', 'band=1', 'series=reading&band=999', 'series=reading&band=1x'])('잘못된 기준을 전체 재고로 바꾸지 않는다: %s', query => {
    expect(parseFactoryScope(new URLSearchParams(query))).toEqual({ kind: 'invalid' })
  })
  it('URL band는 카탈로그 step이며 render band로 필터링하지 않는다', async () => {
    const scope = parseFactoryScope(new URLSearchParams('series=vocab&band=2'))
    expect(scope).toEqual({ kind: 'volume', series: 'vocab', step: 2 })
    const view = await loadPressView(scope)
    expect(state.filters).toEqual({ series: 'vocab', step: 2 })
    expect(view.volumes.map(row => row.band)).toEqual([32])
    expect(view.rungs).toBe(1)
    expect(view.selectedStep).toBe(2)
  })
  it('검수도 같은 시리즈·단계만 읽고 식별자를 남긴다', async () => {
    const view = await loadReviewView({ kind: 'volume', series: 'reading', step: 2 })
    expect(view.volumes.map(row => [row.series, row.step, row.band])).toEqual([['reading', 2, 11]])
  })
  it('선택한 2단계를 1단계 빈 칸으로 바꾸지 않는다', async () => {
    const view = await loadPressView({ kind: 'volume', series: 'reading', step: 2 })
    const html = renderToStaticMarkup(createElement(LadderFill, { volumes: view.volumes, rungs: view.rungs, selectedStep: view.selectedStep }))
    expect(html).toContain('1단 중 1단 조판됨')
    expect(html).toContain('2단')
    expect(html).not.toContain('비어 있음')
  })
  it('조회 실패와 실제 빈 결과를 구분한다', async () => {
    state.fail = true
    const failed = await loadReviewView()
    expect(failed.loadError).toContain('read failed')
    expect(failed.layers.every(layer => layer.passed === null)).toBe(true)
    state.fail = false
    const empty = await loadReviewView({ kind: 'volume', series: 'reading', step: 999 })
    expect(empty.volumes).toEqual([])
    expect(empty.loadError).toBeNull()
  })
  it('잘못된 기준의 발행 조회는 DB 전에 거부한다', async () => {
    await expect(loadPressView({ kind: 'invalid' })).rejects.toThrow('잘못된 제작 기준')
    expect(state.creates).toBe(0)
  })
  it('집필 공유 재고를 선택 권 또는 Product Order 진행률로 표시하지 않는다', () => {
    expect(factoryScopeDescription({ kind: 'volume', series: 'reading', step: 1 }, false)).toContain('필터링되지 않습니다')
    expect(factoryScopeDescription({ kind: 'volume', series: 'reading', step: 1 }, true)).toContain('Product Order별 진척은 아닙니다')
  })
})
