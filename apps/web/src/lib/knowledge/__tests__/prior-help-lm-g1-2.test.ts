// apps/web/src/lib/knowledge/__tests__/prior-help-lm-g1-2.test.ts
//
// LM-G1.2 — 근접 해설 노출 · 시각 불확실성 반례 A–H. **현행 정책(M8 · 2분 보호)을 바꾸지 않고** 지금 판정을 고정한다.
//   불확실(uncertain)은 독립으로 세지 않는다(보류). 이 파일은 정책을 완화하지 않는다 — 과잉 보류로 보이는 경우(C2)는 관찰로만 남기고
//   정책 변경 제안은 docs/csat-learner/v62/LM-G1.2_R5_VERTICAL_INTEGRATION.md §3 에 버전 · 영향과 함께 둔다.

import { describe, expect, it } from 'vitest'

import { crossSessionHelp, type CrossAttempt, type CrossSession } from '../prior-help'

const T0 = Date.parse('2026-10-16T09:00:00.000Z')
const iso = (ms: number) => new Date(T0 + ms).toISOString()
const MIN = 60_000
const attempt = (o: Partial<CrossAttempt> = {}): CrossAttempt => ({ sessionId: 'sA', itemId: '2022#20', answeredAt: iso(0), receivedAt: iso(1_000), ...o })
const session = (o: Partial<CrossSession> = {}): CrossSession => ({ id: 'sB', item_ref: '2022#20', help_received_at: null, explanation_viewed_at: null, help_server_at: null, explanation_server_at: null, help_clock_suspect: false, ...o })

describe('crossSessionHelp — 반례 A–H(현행 정책 고정)', () => {
  it('A 독립 제출 뒤 충분히 늦게(5분) 다른 세션에서 해설 → 독립', () => {
    expect(crossSessionHelp(attempt(), [session({ explanation_viewed_at: iso(5 * MIN), explanation_server_at: iso(5 * MIN + 500) })])).toBe('independent')
  })

  it('B 다른 세션에서 해설을 2분 넘게 먼저 봄 → 도움받음', () => {
    expect(crossSessionHelp(attempt(), [session({ explanation_viewed_at: iso(-3 * MIN), explanation_server_at: iso(-3 * MIN + 500) })])).toBe('helped')
  })

  it('C1 제출과 해설이 2분 안(해설이 30초 먼저) → 불확실(보류)', () => {
    expect(crossSessionHelp(attempt(), [session({ explanation_viewed_at: iso(-30_000), explanation_server_at: iso(-29_000) })])).toBe('uncertain')
  })

  it('C2 제출 뒤 60초에 다른 세션에서 해설(서버도 제출을 먼저 받음) → 지금 규칙은 불확실 — 과잉 보류 후보(관찰 · 정책 불변)', () => {
    // 서버 수신 순서(제출 1초 · 해설 61초)가 「제출이 먼저」를 보여도 2분 근접 규칙이 먼저 보류한다
    expect(crossSessionHelp(attempt(), [session({ explanation_viewed_at: iso(60_000), explanation_server_at: iso(61_000) })])).toBe('uncertain')
  })

  it('C3 같은 세션 안의 제출 → 해설은 이 규칙의 대상이 아니다(M8 첫 시도 뷰가 가른다) → 독립', () => {
    expect(crossSessionHelp(attempt(), [session({ id: 'sA', explanation_viewed_at: iso(30_000), explanation_server_at: iso(31_000) })])).toBe('independent')
  })

  it('D 다른 탭 · 세션에서 2분 넘게 먼저 해설 → 도움받음 · 근접이면 보류', () => {
    expect(crossSessionHelp(attempt(), [session({ id: 'tab2', explanation_viewed_at: iso(-10 * MIN) })])).toBe('helped')
    expect(crossSessionHelp(attempt(), [session({ id: 'tab2', explanation_viewed_at: iso(-MIN) })])).toBe('uncertain')
  })

  it('E 도움 기기 시계 의심(help_clock_suspect) → 그 세션 순서를 믿지 않는다(보류)', () => {
    expect(crossSessionHelp(attempt(), [session({ explanation_viewed_at: iso(10 * MIN), help_clock_suspect: true })])).toBe('uncertain')
  })

  it('E2 판단 기기 시계가 늦음 — 서버는 해설을 먼저 받았는데 판단이 해설보다 이르다고 주장 → 보류', () => {
    expect(crossSessionHelp(attempt({ answeredAt: iso(0), receivedAt: iso(10 * MIN) }), [session({ explanation_viewed_at: iso(5 * MIN), explanation_server_at: iso(5 * MIN) })])).toBe('uncertain')
  })

  it('F 서버 수신 지연(수신 − 판단 > 2분) 폭 안의 해설 → 보류', () => {
    expect(crossSessionHelp(attempt({ answeredAt: iso(0), receivedAt: iso(6 * MIN) }), [session({ explanation_viewed_at: iso(4 * MIN) })])).toBe('uncertain')
  })

  it('G 같은 지문의 **다른 문항**에서 먼저 본 해설 — 지금 규칙은 문항 단위라 보지 않는다 → 독립(관찰 · 정책 공백 후보)', () => {
    expect(crossSessionHelp(attempt({ itemId: '2022#42' }), [session({ item_ref: '2022#41', explanation_viewed_at: iso(-10 * MIN) })])).toBe('independent')
  })

  it('H 해설 기록 없음 · 시각 불명 → 그 세션은 판정에 쓰지 않는다(독립) · 원장 조회 실패는 로더가 보류로 둔다(load.ts)', () => {
    expect(crossSessionHelp(attempt(), [session({ explanation_viewed_at: null, help_received_at: null })])).toBe('independent')
    expect(crossSessionHelp(attempt(), [session({ explanation_viewed_at: 'not-a-date' })])).toBe('independent')
  })
})
