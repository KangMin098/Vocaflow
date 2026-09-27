// apps/web/src/lib/admin/__tests__/source-profile.test.ts
import { describe, expect, it } from 'vitest'

import { profileIssues, quartiles, topCounts, type SourceProfile } from '../source-profile'

const base = (): SourceProfile => ({
  source: 'voa',
  measuredAt: '2026-09-25T00:00:00.000Z',
  total: 100,
  firstAt: null,
  lastAt: null,
  status: { ready: 100, queued: 0, published: 0, archived: 0, failed: 0 },
  units: { originals: 100, derived: 0 },
  audio: 0,
  vLevel: { unknown: 0 } as SourceProfile['vLevel'],
  cefr: { unknown: 0 } as SourceProfile['cefr'],
  license: { unknown: 0 } as SourceProfile['license'],
  rights: { evidence: {}, untagged: 0, needsResolution: 0 },
  retention: { keep: 100, hold: 0, discard: 0, none: 0 } as SourceProfile['retention'],
  verdict: { none: 0 } as SourceProfile['verdict'],
  eligibility: { uncached: 0 } as SourceProfile['eligibility'],
  sample: { size: 0, words: { p25: null, p50: null, p75: null }, feeds: [], topics: [] },
  recent: [],
})

describe('profileIssues — 가장 먼저 볼 문제(DESIGN.md A3)', () => {
  it('문제가 없으면 빈 배열 — 첫 줄을 비운다', () => {
    expect(profileIssues(base())).toEqual([])
  })

  it('수집 실패가 판정 공백보다 앞선다', () => {
    const p = base()
    p.status.failed = 2
    p.retention.keep = 50
    const issues = profileIssues(p)
    expect(issues[0]!.row).toBe(1)
    expect(issues[0]!.text).toContain('수집 실패 2편')
    expect(issues.some((i) => i.row === 2 && i.text.includes('원천 50편이 보관 판정 전'))).toBe(true)
  })

  it('파생물이 절반 이상이면 원천 부족을 알린다 (europe_pmc 1,211/1,300 같은 경우)', () => {
    const p = base()
    p.units = { originals: 89, derived: 1211 }
    p.total = 1300
    p.retention.keep = 89
    expect(profileIssues(p)[0]!.text).toContain('93% 가 파생물')
  })

  it('권리 해소 필요는 권리 행(4)에 권점', () => {
    const p = base()
    p.rights.needsResolution = 7
    expect(profileIssues(p)).toEqual([{ row: 4, text: expect.stringContaining('권리 해소 필요 7편') }])
  })
})

describe('표본 분포', () => {
  it('quartiles — 최근접 순위 · 비면 null', () => {
    expect(quartiles([])).toEqual({ p25: null, p50: null, p75: null })
    expect(quartiles([400, 100, 300, 200])).toEqual({ p25: 100, p50: 200, p75: 300 })
  })

  it('topCounts — 상위 k 와 「그 밖」', () => {
    const out = topCounts(['a', 'a', 'b', 'c', null, 'd'], 2)
    expect(out[0]).toEqual({ key: 'a', count: 2 })
    expect(out.at(-1)).toEqual({ key: '그 밖', count: 3 })
  })
})
