// apps/web/src/lib/textbook/__tests__/source-process.test.ts
import { describe, expect, it } from 'vitest'
import { buildSourceProcess, type SourceProcessCounts } from '../source-process'

const base: SourceProcessCounts = {
  intake: 0,
  analysisIncomplete: 0,
  rawPendingExtraction: 0,
  contentUnjudged: 0,
  contentRejected: 0,
  cefrAboveBand: 0,
  qualitySignals: 0,
  rejectedWithItems: 0,
  eligible: 0,
  ready: 0,
}

describe('공정 관문', () => {
  /**
   * 이 테스트가 이 파일의 본체다. 앞선 작업 큐는 **같은 31,220편**을 「미판정 내용 검토」와
   * 「미절단 원본」 두 줄에 겹쳐 놓고 서로 반대되는 처방을 달았다. 실측에서 내용 미판정 중
   * 판정으로 열리는 몫은 0편이었으므로 첫 줄은 대상이 없는 지시였다.
   */
  it('추출 대기와 내용 판정이 같은 재고를 두 번 세지 않는다', () => {
    const view = buildSourceProcess({
      ...base,
      intake: 64102,
      contentUnjudged: 31220,
      rawPendingExtraction: 31220,
    })
    const ids = view.gates.map((g) => g.id)
    expect(ids).toContain('extract')
    // 판정으로 열리는 몫이 0이면 그 관문은 아예 뜨지 않는다 — 대상 없는 지시를 내지 않는다.
    expect(ids).not.toContain('judgment')
    expect(view.gates.find((g) => g.id === 'extract')?.stuck).toBe(31220)
  })

  it('판정으로 열리는 몫이 있으면 그 차이만 내용 판정 관문에 선다', () => {
    const view = buildSourceProcess({
      ...base,
      intake: 1000,
      contentUnjudged: 400,
      rawPendingExtraction: 250,
    })
    expect(view.gates.find((g) => g.id === 'judgment')?.stuck).toBe(150)
    expect(view.gates.find((g) => g.id === 'extract')?.stuck).toBe(250)
  })

  /** 앞선 모델에서 이어받은 성질 — 관문은 겹치므로 합계가 분모를 넘을 수 있다. */
  it('겹친 관문의 걸린 수를 더하면 판정 대상을 넘을 수 있다 — 합계를 쓰지 않는다는 뜻', () => {
    const view = buildSourceProcess({
      ...base,
      intake: 64102,
      contentUnjudged: 31220,
      rawPendingExtraction: 31220,
      cefrAboveBand: 50757,
      qualitySignals: 5061,
    })
    const sum = view.gates.reduce((n, g) => n + g.stuck, 0)
    expect(sum).toBeGreaterThan(view.intake)
  })

  /**
   * 병목은 **드레인으로 열리는 것 중** 가장 큰 것이다. 그냥 최댓값을 고르면 늘 CEFR(정책)이
   * 뽑히고, 화면이 아무도 손댈 수 없는 것을 「지금 할 일」로 내민다.
   */
  it('병목은 지금 돌릴 수 있는 것에서만 고른다', () => {
    const view = buildSourceProcess({
      ...base,
      intake: 64102,
      cefrAboveBand: 50757,
      contentUnjudged: 31220,
      rawPendingExtraction: 31220,
    })
    expect(view.bottleneck?.id).toBe('extract')
    expect(view.bottleneck?.by).toBe('drain')
  })

  it('열 수 있는 관문이 하나도 없으면 병목을 지어내지 않는다', () => {
    const view = buildSourceProcess({ ...base, intake: 100, cefrAboveBand: 90 })
    expect(view.bottleneck).toBeNull()
    expect(view.gates.map((g) => g.id)).toEqual(['cefr'])
  })

  it('걸린 것이 없는 관문은 그리지 않는다', () => {
    const view = buildSourceProcess({ ...base, intake: 100, eligible: 100, ready: 100 })
    expect(view.gates).toEqual([])
    expect(view.ready).toBe(100)
  })

  /** 관문은 `evaluateSource` 가 보는 차례대로 선다 — 순서가 곧 처방의 순서다. */
  it('관문 순번이 오름차순이다', () => {
    const view = buildSourceProcess({
      ...base,
      intake: 1000,
      analysisIncomplete: 2,
      rawPendingExtraction: 250,
      contentUnjudged: 400,
      contentRejected: 10,
      cefrAboveBand: 500,
      qualitySignals: 30,
      rejectedWithItems: 5,
    })
    const steps = view.gates.map((g) => g.step)
    expect(steps).toEqual([...steps].sort((a, b) => a - b))
    expect(new Set(steps).size).toBe(steps.length)
  })

  /** 관문마다 「무엇이 여는가」가 있어야 한다 — 없으면 걸린 수만 보여 주는 셈이다. */
  it('모든 관문이 여는 방법과 볼 목록을 갖는다', () => {
    const view = buildSourceProcess({
      ...base,
      intake: 1000,
      analysisIncomplete: 2,
      rawPendingExtraction: 250,
      contentUnjudged: 400,
      contentRejected: 10,
      cefrAboveBand: 500,
      qualitySignals: 30,
      rejectedWithItems: 5,
    })
    for (const gate of view.gates) {
      expect(gate.opens.length).toBeGreaterThan(10)
      expect(gate.target.queue).toBeTruthy()
    }
  })
})

/* 「적격 · 재료 있음」과 「재료 태그 있음」은 다른 수다 — 2026-09-24 에 내가 뒤의 것을 앞자리에
 * 넣어 **막힌 6,291편이 관문을 통과한 것처럼** 보이는 화면을 만들었다. 실측은 정반대였다
 * (태그 있는 6,291편 중 적격 0편 · 6,273편이 오직 cefr_above_band). */
describe('적격 · 재료 있음', () => {
  it('통과한 것이 없으면 0을 그대로 낸다 — 태그 수로 메우지 않는다', () => {
    const view = buildSourceProcess({
      ...base,
      intake: 64102,
      eligible: 10560,
      ready: 0,          // 적격 ∩ 재료
      cefrAboveBand: 50757,
    })
    expect(view.ready).toBe(0)
    expect(view.eligible).toBe(10560)
  })

  it('관문 총수는 안 그려진 것까지 센다 — 번호가 건너뛰는 이유를 화면이 말할 수 있어야 한다', () => {
    const view = buildSourceProcess({ ...base, intake: 100, cefrAboveBand: 90 })
    expect(view.gates).toHaveLength(1)
    expect(view.totalGates).toBeGreaterThan(view.gates.length)
  })
})
