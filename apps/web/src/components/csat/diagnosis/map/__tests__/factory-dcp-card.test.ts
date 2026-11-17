// apps/web/src/components/csat/diagnosis/map/__tests__/factory-dcp-card.test.ts
// 2B — 받은 공장 연습 목록 응답은 닫힌 모양만 받는다. 미상 수치를 0 으로, 모르는 줄을 학습 가능으로 바꾸지 않는다.
import { describe, expect, it } from 'vitest'

import { readFactoryList } from '../FactoryDcpCard'

const S = '003946dd-f5e6-4efe-9254-b7a69ca39e61'
const row = (o: Record<string, unknown> = {}) => ({ deliveryId: '00000000-0000-4000-8000-000000000001', dcpItemId: '00000000-0000-4000-8000-000000000002',
  sourceId: S, type: 'main_point', deliveredAt: '2026-10-21T00:00:00Z', state: 'ok', attempts: 0, lastCorrect: null, ...o })

describe('readFactoryList', () => {
  it('정상 — 같은 원문 3문항은 지문 1개', () => {
    const r = readFactoryList({ status: 'installed', sources: 1, rows: [row(), row({ type: 'title' }), row({ type: 'topic' })] })
    expect(r?.rows.length).toBe(3)
    expect(r?.sources).toBe(1)
  })
  it.each([
    [{ rows: [row()] }], [{ rows: [row()], sources: '1' }], [{ rows: [row()], sources: null }], [{ rows: [row()], sources: 2 }],
    [{ rows: [row({ attempts: null })], sources: 1 }], [{ rows: [row({ attempts: '0' })], sources: 1 }], [{ rows: [row({ type: 'blank' })], sources: 1 }],
    [{ rows: [row({ lastCorrect: 'yes' })], sources: 1 }], [{ rows: [row({ deliveryId: 'x' })], sources: 1 }], [{ rows: 'x', sources: 0 }],
  ])('모양이 다르면 null — %j', (j) => expect(readFactoryList(j)).toBeNull())
})
