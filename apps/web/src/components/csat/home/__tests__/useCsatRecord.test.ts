// apps/web/src/components/csat/home/__tests__/useCsatRecord.test.ts
//
// 셸(CsatShell)은 기록을 **쓰는 화면** 위에 얹힌다. 셸이 마운트 때 읽은 기록을 압축해 늦게 저장하면
// 그 사이 화면이 쓴 세션 · 예측을 옛 사본으로 덮는다(Codex P1 · 2026-10-10). 읽기 전용이면 저장하지 않는다.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/csat/session/store', () => ({ loadSyncedDissectionRecord: vi.fn(), saveDissectionRecord: vi.fn() }))

import { emptyDissectionRecord, type DissectionRecord } from '@/lib/csat/dissect'
import { settleRecord } from '../useCsatRecord'

const NOW = Date.UTC(2026, 9, 10, 12)
const DAY = 86_400_000
const overdue: DissectionRecord = {
  ...emptyDissectionRecord(),
  queue: Array.from({ length: 9 }, (_, i) => ({ tag: `t${i}`, source: `s${i}`, due: NOW - (9 - i) * DAY })),
} as DissectionRecord

describe('settleRecord — 밀린 복습 압축의 저장', () => {
  it('목록 화면(기본)은 압축본을 저장한다', async () => {
    const save = vi.fn(async () => undefined)
    const out = await settleRecord(overdue, NOW, { readOnly: false, save })
    expect(save).toHaveBeenCalledTimes(1)
    expect(out.dueBefore).toBe(9)
  })
  it('셸(읽기 전용)은 압축해 보여 주기만 하고 저장하지 않는다', async () => {
    const save = vi.fn(async () => undefined)
    const out = await settleRecord(overdue, NOW, { readOnly: true, save })
    expect(save).not.toHaveBeenCalled()
    expect(out.record).not.toBe(overdue)
  })
})
