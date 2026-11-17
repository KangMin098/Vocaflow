// apps/web/src/lib/csat/listening/fixtures/__tests__/analysis.test.ts
// 제출 뒤 분석 열기(서버 액션 본체): 화이트리스트 · 제출 구조 검증 · 판정 재실행 · 'open' 일 때만 전체.
import { describe, expect, it, vi } from 'vitest'

import { resolveListeningAnalysis } from '../analysis'
import { FIXTURE_2023_L07 } from '..'

const VALID = {
  work: { verdict: 'eliminated', utteranceId: '2023-L07-u6' },
  exam: { verdict: 'eliminated', utteranceId: '2023-L07-u8' },
  sister: { verdict: 'remaining', utteranceId: '2023-L07-u10' },
  canada: { verdict: 'eliminated', utteranceId: '2023-L07-u12' },
}

describe('resolveListeningAnalysis', () => {
  it("완전한 제출 + 'open' 이면 전체 픽스처, 판정은 그 문항의 회차로 다시 묻는다", async () => {
    const decide = vi.fn().mockResolvedValue('open')
    expect(await resolveListeningAnalysis('2023-L07', VALID, decide)).toEqual({ status: 'open', fixture: FIXTURE_2023_L07 })
    expect(decide).toHaveBeenCalledWith('2023')
  })

  it('판단이 틀려도(채점 아님) 구조가 완전하면 연다', async () => {
    const wrong = { ...VALID, sister: { verdict: 'eliminated', utteranceId: '2023-L07-u1' }, work: { verdict: 'remaining', utteranceId: '2023-L07-u2' } }
    expect((await resolveListeningAnalysis('2023-L07', wrong, async () => 'open')).status).toBe('open')
  })

  it('보류 · 실패 · 예외는 정답 없이 상태만', async () => {
    expect(await resolveListeningAnalysis('2023-L07', VALID, async () => 'embargo')).toEqual({ status: 'held' })
    expect(await resolveListeningAnalysis('2023-L07', VALID, async () => 'failure')).toEqual({ status: 'failure' })
    expect(await resolveListeningAnalysis('2023-L07', VALID, () => Promise.reject(new Error('db')))).toEqual({ status: 'failure' })
  })

  it('제출 없음 · 부분 · 위조 모양은 판정을 부르지 않고 invalid', async () => {
    const decide = vi.fn().mockResolvedValue('open')
    const { canada: _drop, ...partial } = VALID
    void _drop
    const bad: unknown[] = [
      undefined,
      null,
      {},
      [],
      'all',
      partial,
      { ...VALID, ghost: { verdict: 'eliminated', utteranceId: '2023-L07-u1' } }, // 모르는 후보
      { ...VALID, work: { verdict: 'eliminated', utteranceId: '2023-L10-u4' } }, // 다른 문항 발화
      { ...VALID, work: { verdict: 'eliminate', utteranceId: '2023-L07-u6' } }, // 잘못된 판정
      { ...VALID, work: { verdict: 'eliminated', utteranceId: '2023-L07-u6', extra: 1 } }, // 모르는 키
      { ...VALID, work: { verdict: 'eliminated' } },
      { ...VALID, sister: { verdict: 'eliminated', utteranceId: '2023-L07-u10' } }, // 하나도 안 남김
      Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, { verdict: 'remaining', utteranceId: '2023-L07-u1' }])),
    ]
    for (const s of bad) expect(await resolveListeningAnalysis('2023-L07', s, decide)).toEqual({ status: 'invalid' })
    expect(decide).not.toHaveBeenCalled()
  })

  it('모르는 id · 문자열 아닌 값은 판정 없이 거부', async () => {
    const decide = vi.fn().mockResolvedValue('open')
    for (const id of ['2023-L99', '../x', '', null, 7, { key: '2023-L07' }, 'x'.repeat(500)]) {
      expect(await resolveListeningAnalysis(id, VALID, decide)).toEqual({ status: 'invalid' })
    }
    expect(decide).not.toHaveBeenCalled()
  })
})
