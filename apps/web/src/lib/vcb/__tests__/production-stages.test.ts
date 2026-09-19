// apps/web/src/lib/vcb/__tests__/production-stages.test.ts
//
// 제작 단계 콘솔이 **거짓말하지 않는가**.
//
// 콘솔의 쓸모는 "아직 안 된 것" 을 정확히 짚는 데 있다. 완료를 후하게 세면 관리자가 끝난 줄
// 알고 넘어가고, 아직인 권 이름을 안 보여 주면 무엇을 고칠지 알 수 없다.

import { describe, expect, it } from 'vitest'
import {
  computeStageStatus,
  currentStage,
  PRODUCTION_STAGES,
  type ProductionSetRow,
} from '../production-stages'

const full = (over: Partial<ProductionSetRow> = {}): ProductionSetRow => ({
  id: 'a',
  title: '완성본',
  slug: 'cat-full',
  wordCount: 100,
  curationQuery: {
    blueprint: 'freq-tier',
    recipe: { version: 3 },
    brand: { family: 'list' },
    qa: { checked: 100, passed: 95 },
    level: { median: 5 },
  },
  ...over,
})

describe('완료 판정', () => {
  it('다 갖춘 세트는 전 단계 완료다', () => {
    const st = computeStageStatus([full()])
    expect(st.every((s) => s.doneCount === 1)).toBe(true)
    expect(currentStage(st)).toBeNull()
  })

  it('검수가 0 이면 판권 각인은 **완료가 아니다** — 0/0 은 "0개 통과" 가 아니라 "센 적 없음"', () => {
    const st = computeStageStatus([
      full({ curationQuery: { ...full().curationQuery, qa: { checked: 0, passed: 0 } } }),
    ])
    expect(st.find((s) => s.id === 'imprint')!.doneCount).toBe(0)
  })

  it('난이도 실측이 없으면 판권 각인은 완료가 아니다 — 검수만으로는 판권면이 못 채워진다', () => {
    const cq = { ...full().curationQuery! }
    delete (cq as { level?: unknown }).level
    const st = computeStageStatus([full({ curationQuery: cq })])
    expect(st.find((s) => s.id === 'imprint')!.doneCount).toBe(0)
  })

  it('계열 없는 브랜드 각인은 완료가 아니다 — 표지가 계열을 못 정한다', () => {
    const st = computeStageStatus([full({ curationQuery: { ...full().curationQuery, brand: {} } })])
    expect(st.find((s) => s.id === 'brand')!.doneCount).toBe(0)
  })

  it('curation_query 자체가 없는 레거시 세트도 터지지 않는다', () => {
    const st = computeStageStatus([full({ curationQuery: null, slug: null })])
    expect(st.find((s) => s.id === 'recipe')!.doneCount).toBe(0)
    expect(st.find((s) => s.id === 'slug')!.doneCount).toBe(0)
  })
})

describe('아직인 권을 짚는다', () => {
  it('이름을 보여 준다 — 개수만 세면 무엇을 고칠지 알 수 없다', () => {
    const st = computeStageStatus([full(), full({ id: 'b', title: '슬러그 없음', slug: null })])
    const slug = st.find((s) => s.id === 'slug')!
    expect(slug.doneCount).toBe(1)
    expect(slug.pending).toEqual(['슬러그 없음'])
  })

  it('많으면 잘라 보이되 **몇 개가 더 있는지 밝힌다**', () => {
    const many = Array.from({ length: 10 }, (_, i) => full({ id: `x${i}`, title: `권${i}`, slug: null }))
    const slug = computeStageStatus(many).find((s) => s.id === 'slug')!
    expect(slug.pending).toHaveLength(6)
    expect(slug.pendingMore).toBe(4)
  })
})

describe('교대 — 지금 누구 차례인가', () => {
  it('단계마다 사용자/Claude Code 가 적혀 있다', () => {
    for (const s of PRODUCTION_STAGES) {
      expect(['user', 'claude-code']).toContain(s.actor)
    }
    // 교대가 실제로 일어난다 — 한쪽만 있으면 "교대" 가 아니다.
    const actors = new Set(PRODUCTION_STAGES.map((s) => s.actor))
    expect(actors.size).toBe(2)
  })

  it('아직인 첫 단계를 현재로 짚는다', () => {
    const st = computeStageStatus([full({ curationQuery: { ...full().curationQuery, brand: undefined } })])
    expect(currentStage(st)?.id).toBe('brand')
  })

  it('모든 단계에 **다음 한 걸음**이 있다 — 막다른 줄을 만들지 않는다', () => {
    for (const s of PRODUCTION_STAGES) {
      expect(s.next.trim().length, `${s.id} 에 다음 걸음이 없다`).toBeGreaterThan(10)
      expect(s.says.trim().length).toBeGreaterThan(10)
      expect(s.says).not.toBe(s.label)
    }
  })
})
