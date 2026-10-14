// apps/web/src/lib/textbook/__tests__/practice-rpc.test.ts
// v6.2 P-F7a — 교재 연습 조회는 권 단위 함수가 우선이고, 옛 V레벨 함수는 「함수 없음」일 때만 쓴다
import { describe, expect, it, vi } from 'vitest'

import { fetchVolumePracticeRows, isMissingFunction, type Rpc } from '../practice-rpc'

const VOL = { series: 'vocab', step: 5, vLevel: 5 }

describe('fetchVolumePracticeRows', () => {
  it('권 단위 함수가 있으면 (series, step) 만 넘기고 V레벨은 넘기지 않는다', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null })) as unknown as Rpc & ReturnType<typeof vi.fn>
    const r = await fetchVolumePracticeRows(rpc, VOL, 30)
    expect(r.path).toBe('volume')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('textbook_practice_items_for', { p_series: 'vocab', p_step: 5, p_limit: 30 })
  })
  it('함수 없음(승인안 A 적용 전)일 때만 옛 V레벨 함수로 간다', async () => {
    const rpc = vi.fn(async (fn: string) => (fn === 'textbook_practice_items_for' ? { data: null, error: { code: 'PGRST202' } } : { data: [{ id: 'x' }], error: null })) as unknown as Rpc & ReturnType<typeof vi.fn>
    const r = await fetchVolumePracticeRows(rpc, VOL, 30)
    expect(r.path).toBe('legacy_v_level')
    expect(rpc).toHaveBeenLastCalledWith('textbook_practice_items', { p_v_level: 5, p_limit: 30 })
  })
  it('권한 · 기타 오류는 옛 함수로 우회하지 않고 그대로 실패한다(fail-closed)', async () => {
    for (const code of ['42501', 'PGRST301', undefined]) {
      const rpc = vi.fn(async () => ({ data: null, error: { code, message: 'x' } })) as unknown as Rpc & ReturnType<typeof vi.fn>
      const r = await fetchVolumePracticeRows(rpc, VOL, 30)
      expect(r.path).toBe('volume')
      expect(r.error).not.toBeNull()
      expect(rpc).toHaveBeenCalledTimes(1)
    }
  })
  it('빈 결과(미발행 · 권 유형 없음)는 오류가 아니며 옛 함수로 메우지 않는다', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null })) as unknown as Rpc & ReturnType<typeof vi.fn>
    const r = await fetchVolumePracticeRows(rpc, VOL, 30)
    expect(r.data).toEqual([])
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('isMissingFunction 은 두 코드만', () => {
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true)
    expect(isMissingFunction({ code: '42883' })).toBe(true)
    expect(isMissingFunction({ code: '42501' })).toBe(false)
    expect(isMissingFunction(null)).toBe(false)
  })
})
