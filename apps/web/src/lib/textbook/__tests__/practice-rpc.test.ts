// apps/web/src/lib/textbook/__tests__/practice-rpc.test.ts
// v6.2 P-F7a — 교재 연습 조회는 권 단위 함수가 우선이고, 옛 V레벨 함수는 「함수 없음」일 때만 쓴다
import { describe, expect, it, vi } from 'vitest'

import { fetchVolumePracticeRows, isMissingFunction, type RpcResult } from '../practice-rpc'

const VOL = { series: 'vocab', step: 5, vLevel: 5 }
const ok = (data: unknown): RpcResult => ({ data, error: null })
const err = (code?: string): RpcResult => ({ data: null, error: { code, message: 'x' } })

function calls(volume: RpcResult, legacy: RpcResult = ok([{ id: 'legacy' }])) {
  return {
    volume: vi.fn<[string, number, number], Promise<RpcResult>>(async () => volume),
    legacy: vi.fn<[number, number], Promise<RpcResult>>(async () => legacy),
  }
}

describe('fetchVolumePracticeRows', () => {
  it('권 단위 함수가 있으면 (series, step) 만 넘기고 V레벨 함수는 부르지 않는다', async () => {
    const c = calls(ok([]))
    const r = await fetchVolumePracticeRows(c, VOL, 30)
    expect(r.path).toBe('volume')
    expect(c.volume).toHaveBeenCalledWith('vocab', 5, 30)
    expect(c.legacy).not.toHaveBeenCalled()
  })
  it('함수 없음(승인안 A 적용 전)일 때만 옛 V레벨 함수로 간다', async () => {
    for (const code of ['PGRST202', '42883']) {
      const c = calls(err(code))
      const r = await fetchVolumePracticeRows(c, VOL, 30)
      expect(r.path).toBe('legacy_v_level')
      expect(c.legacy).toHaveBeenCalledWith(5, 30)
    }
  })
  it('권한 · 기타 오류는 옛 함수로 우회하지 않고 그대로 실패한다(fail-closed)', async () => {
    for (const code of ['42501', 'PGRST301', undefined]) {
      const c = calls(err(code))
      const r = await fetchVolumePracticeRows(c, VOL, 30)
      expect(r.path).toBe('volume')
      expect(r.error).not.toBeNull()
      expect(c.legacy).not.toHaveBeenCalled()
    }
  })
  it('빈 결과(미발행 · 권 유형 없음)는 오류가 아니며 옛 함수로 메우지 않는다', async () => {
    const c = calls(ok([]))
    const r = await fetchVolumePracticeRows(c, VOL, 30)
    expect(r.data).toEqual([])
    expect(c.legacy).not.toHaveBeenCalled()
  })
  it('isMissingFunction 은 두 코드만', () => {
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true)
    expect(isMissingFunction({ code: '42883' })).toBe(true)
    expect(isMissingFunction({ code: '42501' })).toBe(false)
    expect(isMissingFunction(null)).toBe(false)
  })
})
