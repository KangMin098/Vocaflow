// apps/web/src/lib/vcb/__tests__/market-status.test.ts
//
// 지수 패널이 **없는 것을 있다고 말하지 않는가**, 그리고 **천장이 있는 축을 미달로 부르지
// 않는가**. 두 가지가 이 파일의 전부다.
//
// 리포트가 없을 때 0 을 내면 화면이 "졌다" 로 읽히고, 천장에 닿은 축을 미달로 그리면
// 관리자가 고칠 수 없는 것을 고치려 든다.

import { describe, expect, it } from 'vitest'
import { ceilingNote } from '../market-panel-text'
import { ageInDays, readVcbMarketStatus } from '../server/market-status'

describe('리포트 읽기', () => {
  it('저장소의 실제 리포트를 읽어 종합과 세 축을 낸다', () => {
    const s = readVcbMarketStatus()
    expect(s.problem).toBeNull()
    expect(s.overall).toBeGreaterThan(0)
    expect(s.axes.map((a) => a.id).sort()).toEqual(['choice', 'content', 'design'])
  })

  it('목표 판정은 종합으로 한다', () => {
    const s = readVcbMarketStatus()
    expect(s.goal).toBe(1.2)
    expect(s.pass).toBe((s.overall ?? 0) >= 1.2)
  })

  it('**천장이 있는 축은 천장 대비로 판정한다** — 1.20 을 요구하면 영원히 미달이다', () => {
    const s = readVcbMarketStatus()
    const design = s.axes.find((a) => a.id === 'design')!
    expect(design.ceiling).not.toBeNull()
    expect(design.index).toBeLessThan(1.2)
    // 그런데도 ok — 이 축의 목표는 천장이기 때문이다.
    expect(design.ok).toBe(true)
  })

  it('무엇을 잰 값인지 함께 낸다 — 렌더인지 DB 조건인지', () => {
    const s = readVcbMarketStatus()
    expect(['rendered', 'catalog', null]).toContain(s.choiceBasis)
  })
})

describe('낡음', () => {
  it('시각이 없으면 나이를 지어내지 않는다', () => {
    expect(ageInDays(null)).toBeNull()
    expect(ageInDays('언젠가')).toBeNull()
  })

  it('며칠 지났는지 센다', () => {
    const now = new Date('2026-09-13T00:00:00.000Z')
    expect(ageInDays('2026-09-06T00:00:00.000Z', now)).toBe(7)
  })
})

describe('천장 문구', () => {
  it('천장이 있는 축과 없는 축을 **다른 말로** 적는다', () => {
    expect(ceilingNote(null)).toBe('천장 없음')
    expect(ceilingNote(1.153)).toContain('이 축의 목표')
  })
})
