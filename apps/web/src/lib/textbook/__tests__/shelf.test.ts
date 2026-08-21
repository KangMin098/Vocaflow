// apps/web/src/lib/textbook/__tests__/shelf.test.ts
//
// 교재 서가 판정 규칙.
//
// 여기서 지키는 것 중 가장 중요한 하나: **"못 잼" 과 "없음" 을 절대 같게 만들지 않는다.**
// 첫 구현이 정확히 그 실수를 했다 — `csat_dcp_items` 의 RLS 정책이 admin 하나뿐이라
// 학습자 조회가 빈 배열을 돌려줬고, 화면은 그것을 '근간 예정'(재료 없음)으로 인쇄했다.
// 문항 1,241개를 가진 계단이 '없음' 으로 보였다(실측 2026-08-21).

import { describe, expect, it } from 'vitest'

import type { Inventory } from '@vocaflow/library-pipeline'

import { SHELF_MIN_ITEMS, buildShelf } from '../shelf'

/** DB 저장 유형만으로 채운 재고 — 고등 계단(V5~7)에 해당한다. */
function dbInventory(vLevel: number, count: number): Inventory {
  return [
    { type: 'vocab_choice', vLevel, count },
    { type: 'grammar_choice', vLevel, count },
    { type: 'order', vLevel, count },
    { type: 'insert', vLevel, count },
    { type: 'irrelevant', vLevel, count },
  ] as Inventory
}

describe('못 잼 ≠ 없음 (이 화면의 첫 결함)', () => {
  it('조회가 막히면 empty 가 아니라 unmeasured 다', () => {
    const shelf = buildShelf([], false)
    const highSteps = shelf.volumes.filter((v) => v.vLevels.some((l) => l >= 5))
    expect(highSteps.length).toBeGreaterThan(0)
    for (const v of highSteps) {
      expect(v.status, `step ${v.step}`).toBe('unmeasured')
    }
    expect(shelf.hasUnmeasured).toBe(true)
  })

  it('조회에 성공했고 정말 0이면 empty 다', () => {
    const shelf = buildShelf([], true)
    const high = shelf.volumes.find((v) => v.vLevels.includes(7))!
    expect(high.status).toBe('empty')
    expect(shelf.hasUnmeasured).toBe(false)
  })

  it('초등 전용 계단은 DB 조회 실패와 무관하다 — 사전에서 생성되기 때문', () => {
    // step 1 은 rhyme·word_meaning·spell_blank 만 쓴다(elementary.ts — DB 미저장).
    const shelf = buildShelf(
      [
        { type: 'rhyme', vLevel: 1, count: 400 },
        { type: 'word_meaning', vLevel: 1, count: 400 },
        { type: 'spell_blank', vLevel: 1, count: 400 },
      ] as Inventory,
      false, // DB 조회는 실패했지만
    )
    const step1 = shelf.volumes.find((v) => v.step === 1)!
    expect(step1.status).not.toBe('unmeasured')
    expect(step1.itemCount).toBe(1200)
  })
})

describe('분량 판정', () => {
  it('한 권 분량에 못 미치면 building', () => {
    const shelf = buildShelf(dbInventory(7, 5), true) // 25개
    const v = shelf.volumes.find((x) => x.vLevels.includes(7))!
    expect(v.itemCount).toBeLessThan(SHELF_MIN_ITEMS)
    expect(v.status).toBe('building')
  })

  it('분량을 넘기면 ready', () => {
    const shelf = buildShelf(dbInventory(7, 40), true) // 200개
    const v = shelf.volumes.find((x) => x.vLevels.includes(7))!
    expect(v.status).toBe('ready')
    expect(shelf.readyCount).toBeGreaterThanOrEqual(1)
  })
})

describe('사다리 정본을 다시 만들지 않는다', () => {
  it('계단은 항상 일곱이고 순서가 곧 진열 순서다', () => {
    const shelf = buildShelf([], true)
    expect(shelf.volumes.map((v) => v.step)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('학령·유형은 SERIES_SPINE 에서 온다 — 화면이 짓지 않는다', () => {
    const shelf = buildShelf([], true)
    const step5 = shelf.volumes.find((v) => v.step === 5)!
    expect(step5.schoolBand).toBe('고1')
    // 순서·삽입은 고1에서 열린다(수능 지문 길이 전제)
    expect(step5.types).toContain('order')
    expect(step5.types).toContain('insert')
    // 초등 계단에는 들어가면 안 된다
    const step1 = shelf.volumes.find((v) => v.step === 1)!
    expect(step1.types).not.toContain('order')
    expect(step1.types).not.toContain('insert')
  })

  it('쓰지 않는 유형의 재고는 그 계단에 세지 않는다', () => {
    // V1 에 order 를 넣어도 step1 은 그것을 쓰지 않으므로 0 이어야 한다.
    const shelf = buildShelf([{ type: 'order', vLevel: 1, count: 999 }] as Inventory, true)
    const step1 = shelf.volumes.find((v) => v.step === 1)!
    expect(step1.itemCount).toBe(0)
  })
})
