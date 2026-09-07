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
  type Readiness,
  type StageState,
} from '../production-stages'

/**
 * 실릴 문항 기준 준비도 — **테스트가 직접 넣는다.**
 *
 * ⚠️ 판정이 스냅샷을 직접 읽던 때가 있었는데, 그러면 픽스처로 해설 0 을 넣어도 실제 파일이
 *    60/60 이라 늘 done 이 나왔다(실측 2026-09-07). 모델을 순수하게 두고 여기서 넣는다.
 */
function readiness(over: Partial<Readiness> = {}): Readiness {
  return { items: 60, renderable: 60, explained: 60, byType: {}, ...over }
}

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
const stateOf = (v: ShelfVolume, id: string, r: Readiness | null = readiness()): StageState =>
  measureVolume(v, r).states[stageIndex(id)]!

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
    const p = measureVolume(volume(), readiness())
    expect(p.blockedAt).toBeNull()
    expect(p.doneCount).toBe(PRODUCTION_STAGES.length)
  })

  it('쓰기로 한 유형에 재고가 비면 재고 칸이 안 끝난다', () => {
    expect(stateOf(volume({ emptyTypes: ['insert'] }), 'stock')).toBe('todo')
  })

  it('단원이 하나도 안 나오면 단원 칸이 안 끝난다 — 그 권은 책이 안 된다', () => {
    expect(stateOf(volume({ maxUnits: 0 }), 'units')).toBe('todo')
  })

  it('**실릴 문항을 다 못 그리면** 조판 칸이 안 끝난다 — 목차엔 있고 지면엔 없다', () => {
    // 실측 2026-09-07: 6·7단의 `irrelevant` 11문항이 이 상태였다(49/60).
    expect(stateOf(volume(), 'render', readiness({ renderable: 49 }))).toBe('todo')
  })

  it('해설은 **실릴 문항 중 조판 가능한 것** 기준이다 — 재고 전량이 아니다', () => {
    // ⚠️ 재고 전량으로 재던 때는 콘솔이 전 권을 "해설 아직" 으로 적고 **할 일이 0인**
    //    드레인을 가리켰다(배치 몫 전 밴드 0). 분모가 틀리면 없는 일을 시킨다.
    expect(stateOf(volume({ explainedCount: 0 }), 'explain', readiness())).toBe('done')
    expect(stateOf(volume(), 'explain', readiness({ explained: 59 }))).toBe('todo')
  })

  it('조판 안 되는 문항은 해설을 묻지 않는다 — 지면에 없으므로 앞 칸의 일이다', () => {
    expect(stateOf(volume(), 'explain', readiness({ renderable: 49, explained: 49 }))).toBe('done')
  })

  it('사람이 아직 안 열었으면 펼치기 칸이 안 끝난다', () => {
    expect(stateOf(volume({ status: 'building' }), 'open')).toBe('todo')
  })

  it('**앞에서부터 처음 막힌 칸**이 그 권의 걸린 자리다 — 뒤가 더 비어도 앞을 먼저 푼다', () => {
    const p = measureVolume(volume({ emptyTypes: ['insert'] }), readiness({ explained: 0 }))
    expect(p.blockedAt?.id).toBe('stock')
  })
})

describe('못 쟀다 ≠ 0', () => {
  it('준비도를 못 읽었으면 조판·해설이 **미완료가 아니라 판정 불가**다', () => {
    expect(stateOf(volume(), 'render', null)).toBe('unmeasured')
    expect(stateOf(volume(), 'explain', null)).toBe('unmeasured')
  })

  it('재고를 못 셌으면 재고·단원·펼치기가 전부 판정 불가다 — 0 으로 세지 않는다', () => {
    const v = volume({ status: 'unmeasured' })
    for (const id of ['stock', 'units', 'open']) expect(stateOf(v, id)).toBe('unmeasured')
  })

  it('판정 불가는 완료로도 세지 않는다 — 그 권은 다 됐다고 말하면 안 된다', () => {
    const p = measureVolume(volume(), null)
    expect(p.doneCount).toBeLessThan(PRODUCTION_STAGES.length)
    expect(p.blockedAt?.id).toBe('render')
  })
})

describe('서가 전체', () => {
  it('단계별 완료 수를 센다', () => {
    const r = measureProduction([volume(), volume({ step: 6 })], (v) =>
      v.step === 6 ? readiness({ explained: 10 }) : readiness(),
    )
    expect(r.doneByStage[stageIndex('stock')]).toBe(2)
    expect(r.doneByStage[stageIndex('explain')]).toBe(1)
  })

  it('못 잰 권을 **따로** 센다 — 완료 수에 섞으면 화면이 거짓말한다', () => {
    const r = measureProduction([volume(), volume({ step: 6 })], (v) =>
      v.step === 6 ? null : readiness(),
    )
    expect(r.doneByStage[stageIndex('explain')]).toBe(1)
    expect(r.unmeasuredByStage[stageIndex('explain')]).toBe(1)
  })

  it('**차례는 가장 앞에서 막힌 칸**의 담당이다 — 뒤 단계가 더 비어도 앞을 먼저 푼다', () => {
    // 해설(Claude Code)이 두 권 비었지만 재고(스크립트)가 한 권 비었으면 스크립트 차례다.
    const r = measureProduction(
      [volume({ emptyTypes: ['insert'] }), volume({ step: 6 })],
      () => readiness({ explained: 0 }),
    )
    expect(r.turnStage?.id).toBe('stock')
    expect(r.turn).toBe('script')
  })

  it('전 권이 끝났으면 차례가 없다 — 할 일이 없는데 누구 차례라고 적지 않는다', () => {
    const r = measureProduction([volume(), volume({ step: 6 })], () => readiness())
    expect(r.turn).toBeNull()
    expect(r.turnStage).toBeNull()
  })

  it('빈 서가에서도 죽지 않는다 — 아직 아무 권도 없을 때가 있다', () => {
    const r = measureProduction([], () => readiness())
    expect(r.turn).toBeNull()
    expect(r.volumes).toEqual([])
  })
})
