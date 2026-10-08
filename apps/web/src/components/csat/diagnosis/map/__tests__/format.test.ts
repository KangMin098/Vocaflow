// apps/web/src/components/csat/diagnosis/map/__tests__/format.test.ts

import { describe, expect, it } from 'vitest'

import type { MapSourceRow } from '@/lib/csat/map/load'

import { STATUS_LABEL, evidenceBadge, pct, shortExam, toneOf } from '../format'

const src = (id: string, status: MapSourceRow['status']): MapSourceRow => ({ id, citation: id, supports: '', status, url: null })

describe('pct', () => {
  it('표시에서만 반올림한다', () => {
    expect(pct(0.734)).toBe('73%')
    expect(pct(1)).toBe('100%')
    expect(pct(0)).toBe('0%')
    expect(pct(null)).toBe('—')
  })
  it('만점에 못 미치는 값이 100% 로 보이지 않는다 — 1999/2000 은 99.9%', () => {
    expect(pct(1999 / 2000)).toBe('99.9%')
    expect(pct(0.9951)).toBe('99.5%')
  })
})

describe('toneOf', () => {
  it('달성 · 근접 · 미달 외에는 중립', () => {
    expect(toneOf('met')).toBe('met')
    expect(toneOf('near')).toBe('near')
    expect(toneOf('short')).toBe('short')
    for (const s of ['hold', 'needs_diagnosis', 'no_items', 'tasks_only'] as const) expect(toneOf(s)).toBe('muted')
  })
})

describe('evidenceBadge', () => {
  const sources = [src('a', 'verified'), src('b', 'needs_review')]
  it('출처 없음 = 보류, 전부 검토 필요 = 검토 필요, 확인된 출처가 있으면 근거 있음', () => {
    expect(evidenceBadge(undefined, sources)).toBe('pending')
    expect(evidenceBadge([], sources)).toBe('pending')
    expect(evidenceBadge(['b'], sources)).toBe('review')
    expect(evidenceBadge(['a'], sources)).toBe('sourced')
    expect(evidenceBadge(['a', 'b'], sources)).toBe('sourced')
    expect(evidenceBadge(['zzz'], sources)).toBe('pending') // 모르는 출처 id 는 근거로 세지 않는다
  })
})

describe('shortExam', () => {
  it('시험 이름을 줄인다', () => {
    expect(shortExam('2027학년도 6월 모의평가')).toBe('27학년도 6월 모평')
    expect(shortExam('2026학년도 수능')).toBe('26학년도 수능')
  })
})

describe('proxy 문구 회귀(2026-10-03)', () => {
  it('지도 상태 라벨에 숙달 · 달성 어휘가 없다', async () => {
    const { FORBIDDEN_WORDS } = await import('@/lib/csat/map/core')
    for (const label of Object.values(STATUS_LABEL)) expect(label).not.toMatch(FORBIDDEN_WORDS)
  })
})
