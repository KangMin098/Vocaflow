// apps/web/src/lib/textbook/__tests__/production-stages.test.ts
//
// 제작 단계 판정의 **잴 수 있는 계약**을 못 박는다.
//
// 가장 중요한 것은 마지막 묶음이다 — **"못 쟀다" 를 "미완료" 로 세지 않는가.**
// 이 저장소가 매대에서 이미 한 번 밟은 함정이고(0 과 null 을 같게 적어 화면이 조용히
// 거짓말했다), 콘솔에서 다시 밟으면 관리자가 **없는 일을 하러 간다.**

import { describe, expect, it } from 'vitest'

import type { ShelfVolume } from '../shelf'
import {
  PRODUCTION_STAGES,
  measureProduction,
  measureVolume,
  type StageState,
} from '../production-stages'

/** 다 끝난 권 하나. 각 검사는 여기서 한 가지만 어긋뜨린다. */
function volume(over: Partial<ShelfVolume> = {}): ShelfVolume {
  return {
    step: 5,
    title: 'Vocaflow Reading 4',
    schoolBand: '고1',
    vLevels: [5],
    types: ['order', 'insert'],
    rationale: '학평 대응.',
    itemCount: 1200,
    byType: { order: 600, insert: 600 },
    emptyTypes: [],
    status: 'ready',
    maxUnits: 10,
    bySource: { original: 1200 },
    explainedCount: 1200,
    ...over,
  } as ShelfVolume
}

const stageIndex = (id: string): number => PRODUCTION_STAGES.findIndex((s) => s.id === id)
const stateOf = (v: ShelfVolume, id: string): StageState =>
  measureVolume(v).states[stageIndex(id)]!

describe('단계 정의', () => {
  it('단계가 비어 있지 않고 id 가 유일하다 — 겹치면 화면이 같은 칸을 두 번 그린다', () => {
    expect(PRODUCTION_STAGES.length).toBeGreaterThan(2)
    expect(new Set(PRODUCTION_STAGES.map((s) => s.id)).size).toBe(PRODUCTION_STAGES.length)
  })

  it('사람과 Claude Code 가 **둘 다** 있다 — 한쪽만 있으면 교대가 아니다', () => {
    const actors = new Set(PRODUCTION_STAGES.map((s) => s.actor))
    expect(actors.has('claude-code')).toBe(true)
    expect(actors.has('user')).toBe(true)
  })

  it('단계마다 다음 한 걸음이 있다 — 막다른 칸을 두지 않는다', () => {
    for (const s of PRODUCTION_STAGES) expect(s.next.trim().length).toBeGreaterThan(0)
  })
})

describe('한 권 판정', () => {
  it('다 된 권은 막힌 칸이 없다', () => {
    const p = measureVolume(volume())
    expect(p.blockedAt).toBeNull()
    expect(p.doneCount).toBe(PRODUCTION_STAGES.length)
  })

  it('쓰기로 한 유형에 재고가 비면 재고 칸이 안 끝난다', () => {
    expect(stateOf(volume({ emptyTypes: ['insert'] }), 'stock')).toBe('todo')
  })

  it('단원이 하나도 안 나오면 단원 칸이 안 끝난다 — 그 권은 책이 안 된다', () => {
    expect(stateOf(volume({ maxUnits: 0 }), 'units')).toBe('todo')
  })

  it('해설이 문항 수에 못 미치면 해설 칸이 안 끝난다', () => {
    expect(stateOf(volume({ explainedCount: 1199 }), 'explain')).toBe('todo')
  })

  it('사람이 아직 안 열었으면 펼치기 칸이 안 끝난다', () => {
    expect(stateOf(volume({ status: 'building' }), 'open')).toBe('todo')
  })

  it('**앞에서부터 처음 막힌 칸**이 그 권의 걸린 자리다 — 뒤가 더 비어도 앞을 먼저 푼다', () => {
    const p = measureVolume(volume({ emptyTypes: ['insert'], explainedCount: 0 }))
    expect(p.blockedAt?.id).toBe('stock')
  })
})

describe('못 쟀다 ≠ 0', () => {
  it('해설 수를 못 셌으면 **미완료가 아니라 판정 불가**다', () => {
    expect(stateOf(volume({ explainedCount: null }), 'explain')).toBe('unmeasured')
  })

  it('재고를 못 셌으면 재고·단원·펼치기가 전부 판정 불가다 — 0 으로 세지 않는다', () => {
    const v = volume({ status: 'unmeasured' })
    for (const id of ['stock', 'units', 'open']) expect(stateOf(v, id)).toBe('unmeasured')
  })

  it('판정 불가는 완료로도 세지 않는다 — 그 권은 다 됐다고 말하면 안 된다', () => {
    const p = measureVolume(volume({ explainedCount: null }))
    expect(p.doneCount).toBeLessThan(PRODUCTION_STAGES.length)
    expect(p.blockedAt?.id).toBe('explain')
  })
})

describe('서가 전체', () => {
  it('단계별 완료 수를 센다', () => {
    const r = measureProduction([volume(), volume({ step: 6, explainedCount: 0 })])
    expect(r.doneByStage[stageIndex('stock')]).toBe(2)
    expect(r.doneByStage[stageIndex('explain')]).toBe(1)
  })

  it('못 잰 권을 **따로** 센다 — 완료 수에 섞으면 화면이 거짓말한다', () => {
    const r = measureProduction([volume(), volume({ step: 6, explainedCount: null })])
    expect(r.doneByStage[stageIndex('explain')]).toBe(1)
    expect(r.unmeasuredByStage[stageIndex('explain')]).toBe(1)
  })

  it('**차례는 가장 앞에서 막힌 칸**의 담당이다 — 뒤 단계가 더 비어도 앞을 먼저 푼다', () => {
    // 해설(Claude Code)이 두 권 비었지만 재고(스크립트)가 한 권 비었으면 스크립트 차례다.
    const r = measureProduction([
      volume({ emptyTypes: ['insert'], explainedCount: 0 }),
      volume({ step: 6, explainedCount: 0 }),
    ])
    expect(r.turnStage?.id).toBe('stock')
    expect(r.turn).toBe('script')
  })

  it('전 권이 끝났으면 차례가 없다 — 할 일이 없는데 누구 차례라고 적지 않는다', () => {
    const r = measureProduction([volume(), volume({ step: 6 })])
    expect(r.turn).toBeNull()
    expect(r.turnStage).toBeNull()
  })

  it('빈 서가에서도 죽지 않는다 — 아직 아무 권도 없을 때가 있다', () => {
    const r = measureProduction([])
    expect(r.turn).toBeNull()
    expect(r.volumes).toEqual([])
  })
})
