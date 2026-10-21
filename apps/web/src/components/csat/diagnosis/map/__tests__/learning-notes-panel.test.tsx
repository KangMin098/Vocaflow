// apps/web/src/components/csat/diagnosis/map/__tests__/learning-notes-panel.test.tsx
// T-0071 — 노트 패널: 처음 접힘 · 그리기만으로는 조회하지 않음 · 처음/고친 계보 · 유효 교수 납품만 같은 지도 문맥 이어 보기 ·
// 미확인 · 철회 · 지난 기준은 노트만 · 빈 목록 ≠ 확인 못 함
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { notesForTask, type NotesState } from '@/lib/csat/map/v62/learning-notes'

import { LearningNotesPanel, NotesBody } from '../LearningNotesPanel'

const ctx = { mapTask: 'e.option_correspondence', ws: 'ws.option-match', mapWs: null, mapPlan: '2', mapGoal: '1', mapItem: 'stale-item', mapAttempt: '99' }
const D = '11111111-1111-4111-8111-111111111111'
const rows = [{ ref: 'authored:opt-guided-1', deliveryId: D, role: 'guided_practice', current: true as boolean | null }]
const n = (id: string, o: Record<string, unknown> = {}) => ({ id, item: 'authored:opt-guided-1', pairIds: [], binding: { analysisVersion: null }, statement: `${id} 설명`, grounds: '근거', applicability: '', limit: '', evidence: [], afterExplanation: true as const, comparedWithModel: false, authored: { deliveryId: D, annotationHash: 'h' }, at: 1, updatedAt: 1, ...o })
const ok = (r = rows): NotesState => ({ status: 'ok', groups: notesForTask([n('n1'), n('n2', { at: 2, revisionOf: 'n1' })], r) })
const html = (state: NotesState, past = false) => renderToStaticMarkup(<NotesBody state={state} past={past} ctx={ctx} />)

afterEach(() => { vi.unstubAllGlobals() })

describe('LearningNotesPanel', () => {
  it('처음엔 접힌 한 줄 · 그리기만으로는 서버를 읽지 않는다', () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const h = renderToStaticMarkup(<LearningNotesPanel task="e.option_correspondence" rows={rows} listed="installed" past={false} ctx={ctx} />)
    expect(h).toMatch(/^<details[^>]*data-testid="ws-notes"/)
    expect(h).not.toContain('open=""')
    expect(h).toContain('내 원리 노트')
    expect(f).not.toHaveBeenCalled()
  })
})

describe('NotesBody', () => {
  it('처음 → 고친 설명 계보 · 설명 뒤 기록 안내 · 대조 완료를 주장하지 않음', () => {
    const h = html(ok())
    expect(h).toContain('data-count="2"')
    expect(h.indexOf('처음 쓴 설명')).toBeLessThan(h.indexOf('고쳐 쓴 설명 1'))
    expect(h).toContain('실력 판정이나 계획 진전으로 세지 않아요')
    expect(h).toContain('여기서는 대조했다고 보지 않아요')
  })
  it('유효(current=true) 교수 납품 = 같은 지도 문맥 이어 보기 · 옛 map_item/map_attempt 를 넘기지 않음', () => {
    const tag = /<a[^>]*data-testid="ws-notes-open"[^>]*>/.exec(html(ok()))?.[0] ?? ''
    const u = new URL((/href="([^"]+)"/.exec(tag)?.[1] ?? '').replace(/&amp;/g, '&'), 'http://x')
    expect(u.pathname).toBe('/csat/learn/opt-guided-1')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ d: D, from: 'map', map_task: 'e.option_correspondence', ws: 'ws.option-match', map_plan: '2', map_goal: '1' })
    expect(u.searchParams.has('map_item') || u.searchParams.has('map_attempt')).toBe(false)
  })
  it('현재 유효함 미확인 · 철회 · 지난 기준 = 링크 없이 노트만', () => {
    for (const [current, past, text] of [[null, false, '확인하지 못했어요'], [false, false, '지금 열 수 없어요'], [true, true, '지난 기준']] as const) {
      const h = html(ok([{ ...rows[0], current }]), past)
      expect(h).not.toContain('ws-notes-open')
      expect(h).toContain(text)
      expect(h).toContain('n2 설명')
    }
  })
  it('빈 목록(성공) ≠ 확인 못 함(로그아웃 · 보류 · 오류 · 공급 미설치)', () => {
    expect(html({ status: 'ok', groups: [] })).toContain('data-testid="ws-notes-empty"')
    for (const reason of ['unauthenticated', 'held', 'error', 'not_installed'] as const) {
      const h = html({ status: 'unknown', reason })
      expect(h).toContain(`data-reason="${reason}"`)
      expect(h).not.toContain('ws-notes-empty')
    }
    expect(html({ status: 'unknown', reason: 'error' })).toContain('노트가 없다는 뜻이 아니에요')
  })
})

// T0071-P1-1 — 화면 상태는 최신 납품 범위 · 상태로만: 다른 범위에서 읽은 노트 · 이전 링크를 쓰지 않는다
describe('notesView(범위 · 최신 납품)', async () => {
  const { notesView } = await import('../LearningNotesPanel')
  const notes = [n('n1')]
  const SC = `A|t|${D}`
  it('같은 범위 · installed = 최신 rows 로 묶고 링크 자격도 최신 current', () => {
    expect(notesView({ status: 'ok', scope: SC, notes }, SC, 'installed', rows)).toMatchObject({ status: 'ok', groups: [{ current: true }] })
    expect(notesView({ status: 'ok', scope: SC, notes }, SC, 'installed', [{ ...rows[0], current: false }])).toMatchObject({ status: 'ok', groups: [{ current: false }] })
  })
  it('납품 목록 오류 · 미설치 · 준비 중 = 확인 못 함(이전 노트 · 링크 없음)', () => {
    expect(notesView({ status: 'ok', scope: SC, notes }, SC, 'error', rows)).toEqual({ status: 'unknown', reason: 'error' })
    expect(notesView({ status: 'ok', scope: SC, notes }, SC, 'loading', rows)).toEqual({ status: 'unknown', reason: 'error' })
    expect(notesView({ status: 'ok', scope: SC, notes }, SC, 'not_installed', rows)).toEqual({ status: 'unknown', reason: 'not_installed' })
  })
  it('범위(보는 사람 · 납품)가 바뀌면 이전 범위 노트를 쓰지 않는다', () => {
    expect(notesView({ status: 'ok', scope: SC, notes }, `B|t|${D}`, 'installed', rows)).toEqual({ status: 'loading' })
    expect(notesView({ status: 'idle' }, SC, 'installed', rows)).toEqual({ status: 'idle' })
  })
})
