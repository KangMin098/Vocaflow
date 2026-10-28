// apps/web/src/components/csat/diagnosis/map/__tests__/study-av.test.ts
//
// T-0186 — 지도 기출 해부 링크가 결속 분석 판본(map_av)을 싣는다 · 모르면 싣지 않는다 · 기존 복귀 문맥은 그대로.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseMapReturn, returnQueryOf } from '@/lib/csat/map-return'
import { bridgeItemHref } from '@/lib/csat/bridge/round-trip'
import { studyHref, studyVersionsOf } from '../study-av'

const ctx = { mapTask: 'r.central_meaning', ws: 'ws.central-meaning', mapWs: '0b0c8f0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f', mapPlan: '3', mapGoal: '1248' }
const base = bridgeItemHref('2019#23', ctx)
const q = (h: string) => new URL(h, 'http://x').searchParams

describe('studyHref', () => {
  it('결속 판본을 map_av 로 싣고 기존 문맥은 그대로', () => {
    const h = studyHref(base, '2019#23', { '2019#23': 7 })
    expect(q(h).getAll('map_av')).toEqual(['7'])
    for (const k of ['from', 'map_task', 'ws', 'map_ws', 'map_plan', 'map_goal']) expect(q(h).get(k), k).toBe(q(base).get(k))
    expect(new URL(h, 'http://x').pathname).toBe('/csat/item/2019-23')
  })
  it('문항에 실린 map_av 를 문항 화면이 그대로 돌려준다(T-0167 KEYS 왕복)', () => {
    const h = studyHref(base, '2019#23', { '2019#23': 7 })
    const sp = Object.fromEntries(q(h).entries())
    expect(parseMapReturn(returnQueryOf(sp)).mapAv).toBe('7')
  })
  it('판본을 모르면 · 형식 밖이면 · 다른 문항 값이면 싣지 않는다', () => {
    expect(studyHref(base, '2019#23', null)).toBe(base)
    expect(studyHref(base, '2019#23', {})).toBe(base)
    expect(studyHref(base, '2019#23', { '2020#23': 5 })).toBe(base)
    for (const bad of [0, -1, 1.5, 1234567890, Number.NaN]) expect(q(studyHref(base, '2019#23', { '2019#23': bad })).getAll('map_av'), String(bad)).toEqual([])
    expect(studyHref(base, '2019#23', { '2019#23': '7' as unknown as number })).toBe(base)
  })
  it('지도 문맥 없는 링크(과거 보기)는 바꾸지 않는다', () => {
    expect(studyHref('/csat/item/2019-23', '2019#23', { '2019#23': 7 })).toBe('/csat/item/2019-23')
  })
  it('같은 키가 겹치지 않는다', () => {
    const h = studyHref(studyHref(base, '2019#23', { '2019#23': 7 }), '2019#23', { '2019#23': 8 })
    expect(q(h).getAll('map_av')).toEqual(['8'])
  })
})

describe('studyVersionsOf', () => {
  it('객체만 받는다', () => {
    expect(studyVersionsOf(undefined)).toBeNull()
    expect(studyVersionsOf({})).toBeNull()
    expect(studyVersionsOf({ studyAnalysisVersions: [1] })).toBeNull()
    expect(studyVersionsOf({ studyAnalysisVersions: { '2019#23': 7 } })).toEqual({ '2019#23': 7 })
  })
})

describe('TaskInspector 연결', () => {
  const src = readFileSync(join(__dirname, '..', 'TaskInspector.tsx'), 'utf8')
  it('기출 해부 링크가 studyHref 로 판본을 싣는다 · 과거 보기는 문맥 없이', () => {
    expect(src).toContain('href={past ? `/csat/item/${toItemSlug(e.item)}` : studyHref(e.href, e.item, studyAv)}')
    expect(src).toContain('const studyAv = studyVersionsOf(data.v4)')
  })
})
