// apps/web/src/components/csat/diagnosis/map/__tests__/inspector-study.test.tsx
//
// T-0159 — 학습지도 「기출 해부로 공부하기」 목록은 같은 지문 보호(노출 원장)를 거친 entriesFor 결과만 링크로 만든다.
// studyItemsFor 는 공급 · 계획 입력으로만 남는다(그 목록을 직접 링크로 그리면 안 푼 확인 문항과 같은 지문의 해설이 열린다).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { ExposureLedger } from '@/lib/csat/map/v62/assessment-exposure'
import { entriesFor, researchTypeOf } from '@/lib/csat/bridge/entry'

const src = readFileSync(join(__dirname, '..', 'TaskInspector.tsx'), 'utf8')
const block = src.slice(src.indexOf('data-testid="inspector-study"'), src.indexOf('data-testid="inspector-study-withheld"'))

describe('TaskInspector 기출 목록 가드', () => {
  it('목록 링크는 entriesFor 결과(entry.entries)에서만 — study.items 를 그리지 않는다', () => {
    expect(block).toContain('entry.entries.map')
    expect(block).not.toContain('study.items.map')
    expect(src).toMatch(/ledger: data\.v4\?\.assessmentExposure \?\? \{ status: 'error'/)
  })
  it('추천 이유 · 판단 능력 · 해설 열람 의미를 보인다', () => {
    for (const id of ['inspector-study-why', 'inspector-study-goal', 'inspector-study-meaning']) expect(src).toContain(`data-testid="${id}"`)
    expect(src).toContain('약점으로 확정하지 않았어요')
  })
  it('과거 보기는 지도 복귀 문맥을 싣지 않는다', () => {
    expect(block).toContain('href={past ? `/csat/item/${toItemSlug(e.item)}` : e.href}')
  })
})

describe('화면이 받는 원장(compactLedger 형태)으로 같은 지문 보호가 동작', () => {
  const base = {
    task: 'r.central_meaning', need: null, goalNeed: null, goalSet: false,
    check: { taskKey: 'claim-support', status: 'unverified' as const, independentItems: 0, attemptedItems: 0, verifiedItems: [], wrongItems: [], unseen: ['2024#22'], examSeen: [], verifiedAt: null },
    confirm: [{ target: '2024-22', href: '', label: '' }], transfer: [], typeOf: researchTypeOf, ctx: {},
  }
  it('안 푼 확인 문항과 같은 지문인 연구 사례는 빠지고 withheld 로 센다', () => {
    const ledger: ExposureLedger = { status: 'ok', events: [], passageKeys: { '2024#22': 'p', '2019#23': 'p', '2015#32': 'q', '2014B#38': 'r', '2020#36': 's' } }
    const r = entriesFor({ ...base, ledger })
    expect(r.entries.map((e) => e.item)).not.toContain('2019#23')
    expect(r.entries.map((e) => e.item)).toContain('2015#32')
    expect(r.withheld).toBeGreaterThanOrEqual(2)
  })
  it('원장 오류면 연구 사례 전부 보류', () => {
    expect(entriesFor({ ...base, ledger: { status: 'error', failed: [] } }).entries).toEqual([])
  })
  it('연구 데이터 유형은 그대로, 없는 문항은 null', () => {
    expect(researchTypeOf('2019#23')).toBe('R-TOPIC')
    expect(researchTypeOf('2019-23')).toBe('R-TOPIC')
    expect(researchTypeOf('1999#1')).toBeNull()
  })
})
