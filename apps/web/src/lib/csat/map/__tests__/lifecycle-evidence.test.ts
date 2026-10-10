// apps/web/src/lib/csat/map/__tests__/lifecycle-evidence.test.ts
// 바로잡기 · 적용은 실제 수행 기록으로만 마침(MC-07 · Codex P2) — 회차(직접 확인 시각) 뒤 기록만 센다
import { describe, expect, it } from 'vitest'

import { lifecycleCells } from '../curriculum'
import { NO_EVIDENCE, lifecycleEvidence, nextLifecycleAction, type ActivityRow } from '../lifecycle-evidence'

const T = ['a', 'b', 'c', 'd'].map((itemRef) => ({ itemRef, taskKey: 'evidence-locate' }))
const skill = { verifiedAt: '2026-10-11T00:00:00Z', verifiedItems: ['a', 'b'] }
const row = (itemRef: string | null, isCorrect: boolean | null, at: string, extra: Partial<ActivityRow> = {}): ActivityRow => ({ itemRef, taskKey: 'evidence-locate', phase: 'practice', isCorrect, answeredAt: at, ...extra })

describe('수행 근거', () => {
  it('직접 확인 전에는 근거 없음', () => {
    expect(lifecycleEvidence(null, T, [row('a', true, '2026-10-12T00:00:00Z')])).toEqual(NO_EVIDENCE)
    expect(lifecycleEvidence({ verifiedAt: null, verifiedItems: [] }, T, [])).toEqual(NO_EVIDENCE)
  })
  it('바로잡기 = 확정 뒤 막혔던 문항을 다시 맞힘 · 틀린 재시도는 「바로잡는 중」', () => {
    const tried = lifecycleEvidence(skill, T, [row('a', false, '2026-10-12T00:00:00Z')])
    expect(tried).toMatchObject({ repairAt: null, repairTried: true })
    const done = lifecycleEvidence(skill, T, [row('a', false, '2026-10-12T00:00:00Z'), row('a', true, '2026-10-13T00:00:00Z')])
    expect(done.repairAt).toBe('2026-10-13T00:00:00Z')
  })
  it('확정 전 기록 · 다른 과제 키 · 막히지 않은 문항은 바로잡기가 아니다', () => {
    const ev = lifecycleEvidence(skill, T, [
      row('a', true, '2026-10-10T00:00:00Z'),
      row('a', true, '2026-10-12T00:00:00Z', { taskKey: 'claim-support' }),
      row('c', true, '2026-10-12T00:00:00Z'),
    ])
    expect(ev.repairAt).toBeNull()
    expect(ev.repairTried).toBe(false)
  })
  it('적용 = 확정 뒤 묶음 밖 문항 또는 전이 단계 시도(정오 무관) · 묶음 안 문항은 적용이 아니다', () => {
    expect(lifecycleEvidence(skill, T, [row('c', true, '2026-10-12T00:00:00Z')]).transferAt).toBeNull()
    expect(lifecycleEvidence(skill, T, [row('z', false, '2026-10-12T00:00:00Z')]).transferAt).toBe('2026-10-12T00:00:00Z')
    expect(lifecycleEvidence(skill, T, [row('c', null, '2026-10-12T00:00:00Z', { phase: 'transfer' })]).transferAt).toBe('2026-10-12T00:00:00Z')
  })
})

describe('지금 할 일 · 4칸', () => {
  const verified = { status: 'verified' as const, check: { right: 0, wrong: 0, need: 2 } }
  it('순서: 바로잡기 → 적용 → 다시 확인 · 처방이 열린 상태에서만', () => {
    expect(nextLifecycleAction('verified', NO_EVIDENCE)).toBe('repair')
    expect(nextLifecycleAction('verified', { repairAt: 'x', repairTried: true, transferAt: null })).toBe('transfer')
    expect(nextLifecycleAction('still_needed', { repairAt: 'x', repairTried: true, transferAt: 'y' })).toBe('check')
    expect(nextLifecycleAction('resolved', NO_EVIDENCE)).toBeNull()
    expect(nextLifecycleAction('unverified', NO_EVIDENCE)).toBeNull()
  })
  it('기록이 있는 단계만 마침 — 기록 없이 해소돼도 바로잡기 · 적용은 마침이 아니다', () => {
    const s = (c: ReturnType<typeof lifecycleCells>) => c.map((x) => `${x.stage}:${x.state}`).join(' ')
    expect(s(lifecycleCells(verified, true, { repairAt: 'x', repairTried: true, transferAt: null }))).toBe('FIND:done REPAIR:done TRANSFER:now CHECK:open')
    expect(s(lifecycleCells(verified, true, { repairAt: 'x', repairTried: true, transferAt: 'y' }))).toBe('FIND:done REPAIR:done TRANSFER:done CHECK:now')
    expect(s(lifecycleCells({ status: 'resolved', check: { right: 2, wrong: 0, need: 2 } }, true))).toBe('FIND:done REPAIR:open TRANSFER:open CHECK:done')
  })
})
