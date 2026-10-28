// apps/web/src/lib/learner/__tests__/report-note.test.ts
import { describe, expect, it } from 'vitest'
import { composeActivityNote } from '../report-note'

const CLAIMS = /기억을 단단하게|실력이 돼요|실력이 늘|늘었어요|향상|전진|기억에 남았/

describe('composeActivityNote — 활동만 말한다', () => {
  it('활동 없음: 빈 상태 문구, 0 을 수치처럼 나열하지 않는다', () => {
    const s = composeActivityNote(0, 0, 0)
    expect(s).toContain('기록된 학습 활동이 없어요')
    expect(s).not.toMatch(/0분|0개|0번/)
    expect(s).not.toMatch(/쉬었|쉬어/) // 활동이 없는 이유를 추정하지 않는다
  })
  it('있는 활동만 나열하고 기억·실력 향상을 단정하지 않는다', () => {
    for (const [r, m, w] of [[5, 0, 12], [30, 95, 40], [200, 30, 80], [0, 15, 0]]) {
      const s = composeActivityNote(r, m, w)
      expect(s).not.toMatch(CLAIMS)
      expect(s).toContain('활동을 센 기록이라 기억·실력이 달라졌는지는 알 수 없어요')
      if (m > 0) expect(s).toContain(`${m}분`)
      else expect(s).not.toContain('0분')
      if (r > 0) expect(s).toContain(`복습 ${r}번`)
    }
  })
  it('잘못된 값(음수·NaN·소수)은 0 이상 정수로', () => {
    expect(composeActivityNote(-3, Number.NaN, 2.6)).toBe(
      '이번 주 기록: 단어 3개. 활동을 센 기록이라 기억·실력이 달라졌는지는 알 수 없어요. 이어서 복습하려면 단어장으로 가요.',
    )
  })
})
