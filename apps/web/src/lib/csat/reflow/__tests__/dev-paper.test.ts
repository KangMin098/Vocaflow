// apps/web/src/lib/csat/reflow/__tests__/dev-paper.test.ts
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localPaperPath, matchesExam } from '../dev-paper'

const EXAMS = [
  '2014A', '2014B', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026',
  'M1809', 'M2006', 'M2106', 'M2109', 'M2206', 'M2209', 'M2306', 'M2309', 'M2406', 'M2409', 'M2506', 'M2509',
  'M2606', 'M2609', 'M2706',
]

describe('로컬 문제지 파일 이름 대응', () => {
  it('정답표는 문제지로 잡지 않는다', () => {
    expect(matchesExam('2026', '2026영어영역_정답표.pdf')).toBe(false)
    expect(matchesExam('M2506', '202506_영어영역_정답표.pdf')).toBe(false)
  })
  it('수능 · A/B형 · 모의평가 이름을 가른다', () => {
    expect(matchesExam('2026', '2026_영어영역_문제지.pdf')).toBe(true)
    expect(matchesExam('2014A', '2014_영어A-홀수형_문제.pdf')).toBe(true)
    expect(matchesExam('2014A', '2014_영어B-홀수형_문제.pdf')).toBe(false)
    expect(matchesExam('M2506', '202506_영어영역_문제지.pdf')).toBe(true)
    expect(matchesExam('2025', '202506_영어영역_문제지.pdf')).toBe(false)
  })
})

describe('개발 모드에서만 켜진다', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  it('프로덕션에서는 로컬 경로를 내주지 않는다', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(localPaperPath('2026')).toBeNull()
  })
  it('이상한 회차 id 는 파일 이름으로 흘려보내지 않는다', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(localPaperPath('../../etc')).toBeNull()
  })
  it.runIf(fs.existsSync('C:/Users/Administrator/Documents/영어/모의평가'))('이 PC 에서 29회차가 모두 잡힌다', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const missing = EXAMS.filter((e) => !localPaperPath(e))
    expect(missing).toEqual([])
  })
})
