// apps/web/src/lib/knowledge/__tests__/prior-help.test.ts
// 세션을 건너온 도움 — 읽을 때 M8 규칙으로 판정(두 Codex P1 이 서로를 다시 열던 경우를 함께 묶어 둔다)
import { describe, expect, it } from 'vitest'

import { crossSessionHelp, type CrossSession } from '../prior-help'

const S = (over: Partial<CrossSession>): CrossSession => ({ id: 'other', item_ref: 'A', help_received_at: null, explanation_viewed_at: null, help_server_at: null, explanation_server_at: null, ...over })
const A = (answeredAt: string, receivedAt: string | null = answeredAt, sessionId: string | null = 'mine') => ({ sessionId, itemId: 'A', answeredAt, receivedAt })

describe('crossSessionHelp', () => {
  it('다른 세션(새로고침 · 극장)에서 판단 2분 넘게 전에 해설을 봤으면 도움받음', () => {
    expect(crossSessionHelp(A('2026-10-09T10:10:00Z'), [S({ explanation_viewed_at: '2026-10-09T10:00:00Z', explanation_server_at: '2026-10-09T10:00:01Z' })])).toBe('helped')
  })
  it('먼저 판단하고 늦게 도착했어도, 도움이 판단 뒤였으면 도움받음으로 세지 않는다(쓰기 때 덮기 P1)', () => {
    // 판단 10:00(수신 10:01) · 다른 세션 해설 열람 10:30 → 판단이 먼저
    expect(crossSessionHelp(A('2026-10-09T10:00:00Z', '2026-10-09T10:01:00Z'), [S({ explanation_viewed_at: '2026-10-09T10:30:00Z', explanation_server_at: '2026-10-09T10:30:01Z' })])).toBe('independent')
  })
  it('다른 기기 시계가 앞서 도움 시각이 판단보다 늦게 찍혔어도, 서버가 도움을 먼저 받았으면 보류(시각 비교 P1)', () => {
    // 도움: 실제 10:00 · 기기 시계 +10분 → 10:10 으로 기록, 서버 10:00 수신 / 판단: 10:05 · 서버 10:05 수신
    expect(crossSessionHelp(A('2026-10-09T10:05:00Z', '2026-10-09T10:05:01Z'), [S({ explanation_viewed_at: '2026-10-09T10:10:00Z', explanation_server_at: '2026-10-09T10:00:01Z' })])).toBe('uncertain')
  })
  it('도움과 판단이 2분 안이면 보류 · 도움 기기 시계 의심 세션이면 보류', () => {
    expect(crossSessionHelp(A('2026-10-09T10:01:00Z'), [S({ help_received_at: '2026-10-09T10:00:00Z' })])).toBe('uncertain')
    expect(crossSessionHelp(A('2026-10-09T09:00:00Z'), [S({ help_received_at: '2026-10-09T10:00:00Z', help_clock_suspect: true })])).toBe('uncertain')
  })
  it('판단 기기 지연 폭 안의 도움은 보류 · 폭 밖(오프라인 2시간 · 도움은 그 뒤 하루)은 독립', () => {
    expect(crossSessionHelp(A('2026-10-09T10:00:00Z', '2026-10-09T10:20:00Z'), [S({ explanation_viewed_at: '2026-10-09T10:10:00Z' })])).toBe('uncertain')
    expect(crossSessionHelp(A('2026-10-09T08:00:00Z', '2026-10-09T10:00:00Z'), [S({ explanation_viewed_at: '2026-10-10T10:00:00Z', explanation_server_at: '2026-10-10T10:00:00Z' })])).toBe('independent')
  })
  it('같은 세션의 도움 · 다른 문항의 도움은 여기서 보지 않는다(같은 세션은 M8 첫 시도 뷰가 가른다)', () => {
    expect(crossSessionHelp(A('2026-10-09T10:10:00Z'), [S({ id: 'mine', explanation_viewed_at: '2026-10-09T10:00:00Z' }), S({ item_ref: 'B', explanation_viewed_at: '2026-10-09T10:00:00Z' })])).toBe('independent')
  })
})
