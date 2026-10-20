// apps/web/src/components/csat/diagnosis/map/__tests__/supply-outcome.test.ts
// T-0067 — 공급 결과 표시가 응답 사실과 일치하는가(문구가 아니라 의미: 받은 수 · 접수 여부 · 확인된 이유 · 다시 확인)
import { describe, expect, it } from 'vitest'

import { supplyOutcome } from '../AuthoredSupplyCard'

const line = (o: Record<string, unknown>) => ({ role: 'independent_check', requested: 2, delivered: [], rejected: [], orderOpened: false, ...o })
const text = (raw: unknown) => supplyOutcome(raw).lines.map((l) => l.text).join(' ')

describe('supplyOutcome', () => {
  it('완전 공급 — 받은 수 그대로 · 주문 · 부족 문구 없음 · 다시 확인 없음', () => {
    const o = supplyOutcome({ status: 'ok', lines: [line({ delivered: ['a', 'b'] })] })
    expect(o.lines).toEqual([{ role: 'independent_check', kind: 'full', text: expect.stringContaining('2개') }])
    expect(text({ lines: [line({ delivered: ['a', 'b'] })] })).not.toMatch(/제작|모자/)
    expect(o.retry).toBe(false)
  })
  it('공급 0 · orderOpened false — 제작 요청 성공이나 제작 중이라 말하지 않는다 · 다시 확인', () => {
    const o = supplyOutcome({ lines: [line({})] })
    expect(o.lines[0].kind).toBe('none')
    expect(o.lines[0].text).toContain('0 / 2')
    expect(o.lines[0].text).toContain('접수됐는지 확인하지 못했어요')
    expect(o.lines[0].text).not.toMatch(/요청해 두었|요청을 접수했어요|제작 중/)
    expect(o.retry).toBe(true)
  })
  it('부분 공급 · orderOpened false — 부분과 미확인을 그대로', () => {
    const o = supplyOutcome({ lines: [line({ delivered: ['a'] })] })
    expect(o.lines[0].kind).toBe('partial')
    expect(o.lines[0].text).toContain('1 / 2')
    expect(o.lines[0].text).toContain('확인하지 못했어요')
    expect(o.retry).toBe(true)
  })
  it('orderOpened true 는 「접수」뿐 — 완료 · 일정을 지어내지 않는다', () => {
    const t = text({ lines: [line({ delivered: ['a'], orderOpened: true })] })
    expect(t).toContain('제작 요청을 접수했어요')
    expect(t).toContain('완료 시각은 정해지지 않았어요')
    expect(t).not.toMatch(/준비됐|완료됐|며칠|내일/)
  })
  it('서버가 확인한 거절 이유만 · 모르는 코드는 확인 불가 · 빈 재고를 권리 · Gold 로 추정하지 않는다', () => {
    expect(text({ lines: [line({ rejected: [{ ref: 'x', reason: 'exposure' }] })] })).toContain('이미 본 자료')
    expect(text({ lines: [line({ rejected: [{ ref: 'x', reason: 'human_decision' }] })] })).toContain('사람 검수 결정')
    expect(text({ lines: [line({ rejected: [{ ref: 'x', reason: 'weird' }] })] })).toContain('이유를 확인하지 못했어요')
    const empty = text({ lines: [line({})] })
    expect(empty).not.toMatch(/권리|정답|Gold/)
  })
  it('여러 역할 — 하나의 성공으로 뭉개지 않고 역할마다 따로', () => {
    const o = supplyOutcome({ lines: [line({ role: 'guided_practice', requested: 1, delivered: ['g'] }), line({ role: 'transfer', requested: 2, delivered: ['t'], orderOpened: true }), line({ role: 'delayed_check', requested: 1 })] })
    expect(o.lines.map((l) => [l.role, l.kind])).toEqual([['guided_practice', 'full'], ['transfer', 'partial'], ['delayed_check', 'none']])
    expect(o.retry, '한 역할이라도 미확인이면 다시 확인').toBe(true)
  })
  it('모양이 다른 응답 · 줄 누락은 결과 확인 불가(성공 아님)', () => {
    expect(supplyOutcome(null)).toMatchObject({ unknown: true, retry: true })
    expect(supplyOutcome({ status: 'ok' })).toMatchObject({ unknown: true, retry: true })
    expect(supplyOutcome({ lines: [{ role: 'independent_check' }] }).lines[0].text).toContain('확인하지 못했어요')
  })
})
