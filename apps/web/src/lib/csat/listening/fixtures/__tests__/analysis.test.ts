// apps/web/src/lib/csat/listening/fixtures/__tests__/analysis.test.ts
// 제출 뒤 분석 열기(서버 액션 본체): 화이트리스트 · 판정 재실행 · 'open' 일 때만 전체.
import { describe, expect, it, vi } from 'vitest'

import { resolveListeningAnalysis } from '../analysis'
import { FIXTURE_2023_L07 } from '..'

describe('resolveListeningAnalysis', () => {
  it("'open' 일 때만 전체 픽스처, 판정은 그 문항의 회차로 다시 묻는다", async () => {
    const decide = vi.fn().mockResolvedValue('open')
    const r = await resolveListeningAnalysis('2023-L07', decide)
    expect(decide).toHaveBeenCalledWith('2023')
    expect(r).toEqual({ status: 'open', fixture: FIXTURE_2023_L07 })
  })

  it('보류 · 실패 · 예외는 정답 없이 상태만', async () => {
    expect(await resolveListeningAnalysis('2023-L07', async () => 'embargo')).toEqual({ status: 'held' })
    expect(await resolveListeningAnalysis('2023-L07', async () => 'failure')).toEqual({ status: 'failure' })
    expect(await resolveListeningAnalysis('2023-L07', () => Promise.reject(new Error('db')))).toEqual({ status: 'failure' })
  })

  it('모르는 id · 문자열 아닌 값은 판정도 하지 않고 거부', async () => {
    const decide = vi.fn().mockResolvedValue('open')
    for (const id of ['2023-L99', '../x', '', null, 7, { key: '2023-L07' }]) {
      expect(await resolveListeningAnalysis(id, decide)).toEqual({ status: 'invalid' })
    }
    expect(decide).not.toHaveBeenCalled()
  })
})
