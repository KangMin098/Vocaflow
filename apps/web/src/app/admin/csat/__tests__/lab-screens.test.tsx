// apps/web/src/app/admin/csat/__tests__/lab-screens.test.tsx
//
// 전략 연구소 두 화면 — **판정이 화면에서 뒤집히지 않는지** 본다.
//
// 기획: 「120% 우위」는 합본 평균이 아니라 **구속점**으로 판정한다. 그리고 못 잰 축을 대등(1.0)으로
//       채우지 않는다 — 채우면 종합이 올라가는데 그건 개선이 아니라 분식이다.
// 설계: **셀 수 없는 칸(초등 3종)과 재고 0 칸이 같은 색이면** 관리자가 있지도 않은 구멍을 메우러 간다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { BenchPublisher } from '@/lib/csat/factory-bench'
import { verdictOf, type BlueprintView, type MarketView } from '@/lib/csat/factory-lab-model'

import { BlueprintClient } from '../blueprint/BlueprintClient'
import { MarketClient } from '../strategy/MarketClient'

const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

const pub = (o: Partial<BenchPublisher>): BenchPublisher => ({
  publisher: 'EBS',
  docs: 3,
  pages: 698,
  overallIndex: 1.199,
  reachableMax: 1.199,
  targetReachable: false,
  axesMeasured: 2,
  axesTotal: 7,
  gaps: ['해설 축 A1~A4'],
  axes: [
    {
      id: 'A1',
      name: '해설 보유율',
      ours: 1,
      market: 1,
      unit: '%',
      why: '해설이 없으면 혼자 공부할 수 없다',
      index: null,
      ceiling: null,
      insufficient: '이 코퍼스에 해당 출판사의 정답해설 문서가 0건',
    },
    {
      id: 'A6',
      name: '지문 어수 규격 적합률',
      ours: 1,
      market: 0.8,
      unit: '%',
      why: '학년대별 지문 길이',
      index: 1.25,
      ceiling: 1.25,
      insufficient: null,
    },
  ],
  ...o,
})

const market: MarketView = {
  warehouse: null,
  volume: {
    generatedAt: '2026-09-01T07:33:23.059Z',
    scope: '사다리 7권 — 70단원 · 420문항',
    bindingPublisher: 'EBS',
    bindingIndex: 1.199,
    pooledIndex: 1.424,
    publishers: [pub({}), pub({ publisher: 'NE능률', overallIndex: 1.343, reachableMax: 1.391, targetReachable: true, gaps: [] })],
  },
  target: 1.2,
  loadError: null,
}

describe('verdictOf — 파이프라인이 막는가, 증거가 막는가', () => {
  it('천장이 목표 아래면 「증거가 막는다」 — 배치를 더 돌려도 안 오른다', () => {
    expect(verdictOf({ overallIndex: 1.199, reachableMax: 1.199 }, 1.2)).toBe('evidence-bound')
  })

  it('천장이 목표 위면 좁힐 수 있다 — 파이프라인을 고치면 오른다', () => {
    expect(verdictOf({ overallIndex: 1.114, reachableMax: 1.423 }, 1.2)).toBe('closable')
  })

  it('목표를 넘겼으면 도달', () => {
    expect(verdictOf({ overallIndex: 1.343, reachableMax: 1.391 }, 1.2)).toBe('reached')
  })

  it('종합을 못 쟀으면 0 이 아니라 못 잼', () => {
    expect(verdictOf({ overallIndex: null, reachableMax: null }, 1.2)).toBe('unmeasured')
  })

  it('경계값 — 목표와 정확히 같으면 도달이다', () => {
    expect(verdictOf({ overallIndex: 1.2, reachableMax: 1.2 }, 1.2)).toBe('reached')
  })
})

describe('MarketClient', () => {
  it('판정을 합본이 아니라 구속점으로 낸다', () => {
    const html = text(renderToString(<MarketClient {...market} />))
    expect(html).toContain('EBS')
    expect(html).toContain('1.199')
    expect(html).toContain('목표 1.200')
    // 합본은 보여 주되 판정 자리에 오지 않는다
    expect(html).toContain('합본 1.424')
  })

  it('못 잰 축을 대등(1.000)으로 채우지 않는다 — 「못 잼」이라고 적는다', () => {
    const html = text(renderToString(<MarketClient {...market} />))
    expect(html).toContain('못 잼')
    expect(html).toContain('이 코퍼스에 해당 출판사의 정답해설 문서가 0건')
  })

  it('증거가 막는 출판사와 도달한 출판사를 다르게 판정한다', () => {
    const html = text(renderToString(<MarketClient {...market} />))
    expect(html).toContain('증거가 막는다')
    expect(html).toContain('도달')
  })

  it('리포트를 하나도 못 읽으면 0 이 아니라 「아직 안 쟀다」고 말한다', () => {
    const html = text(
      renderToString(
        <MarketClient warehouse={null} volume={null} target={1.2} loadError="리포트 없음" />,
      ),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('아직 안')
    expect(html).not.toContain('0.000')
  })

  it('생성 시각을 적는다 — 「지금 그렇다」가 아니라 「그때 그랬다」이기 때문', () => {
    const html = text(renderToString(<MarketClient {...market} />))
    expect(html).toContain('2026-09-01')
  })
})

const blueprint: BlueprintView = {
  rungs: [
    {
      step: 1,
      schoolBand: '초등 저학년',
      vLevels: [1],
      volumeTitle: 'Starter',
      rationale: '소리·낱말 단위. 지문이 없다.',
      cells: [
        { type: 'rhyme', typeKo: '파닉스 운율', countable: false, count: null },
        { type: 'word_order', typeKo: '영작 배열', countable: true, count: 0 },
      ],
      emptyTypes: ['영작 배열'],
    },
    {
      step: 5,
      schoolBand: '고1',
      vLevels: [5],
      volumeTitle: 'Vol 4',
      rationale: '학평 대응. 순서·삽입이 여기서 열린다.',
      cells: [{ type: 'order', typeKo: '순서', countable: true, count: 4807 }],
      emptyTypes: [],
    },
  ],
  gates: [
    { stage: 'S1', metric: 'coverage', threshold: 0.98, isLocked: false, note: '입문 다독' },
    { stage: 'S2', metric: 'wpm', threshold: 130, isLocked: true, note: null },
  ],
  typeAxis: [
    { type: 'rhyme', typeKo: '파닉스 운율', countable: false },
    { type: 'word_order', typeKo: '영작 배열', countable: true },
    { type: 'order', typeKo: '순서', countable: true },
  ],
  loadError: null,
}

describe('BlueprintClient', () => {
  it('셀 수 없는 칸은 0 이 아니라 「함수」로 그린다', () => {
    const html = text(renderToString(<BlueprintClient {...blueprint} />))
    expect(html).toContain('함수')
  })

  it('끊긴 계단을 그 학령 이름과 함께 지목한다', () => {
    const html = text(renderToString(<BlueprintClient {...blueprint} />))
    expect(html).toContain('초등 저학년(영작 배열)')
  })

  it('재고가 있는 칸은 수를 그대로 적는다', () => {
    const html = text(renderToString(<BlueprintClient {...blueprint} />))
    expect(html).toContain('4,807')
  })

  it('게이트 임계를 지표에 맞는 단위로 적는다 — WPM 은 백분율이 아니다', () => {
    const html = text(renderToString(<BlueprintClient {...blueprint} />))
    expect(html).toContain('98%')
    expect(html).toContain('130')
    expect(html).not.toContain('13000%')
  })

  it('계단이 다 이어지면 끊긴 데 없다고 말한다', () => {
    const ok: BlueprintView = {
      ...blueprint,
      rungs: blueprint.rungs.map((r) => ({ ...r, emptyTypes: [] })),
    }
    const html = text(renderToString(<BlueprintClient {...ok} />))
    expect(html).toContain('끊긴 데 없이')
  })

  it('계단마다 그 유형을 쓰는 이유를 싣는다 — 규격이 근거 없이 정해진 것이 아니다', () => {
    const html = text(renderToString(<BlueprintClient {...blueprint} />))
    expect(html).toContain('순서·삽입이 여기서 열린다')
  })

  it('게이트가 하나도 없으면 그 사실을 말한다', () => {
    const html = text(renderToString(<BlueprintClient {...blueprint} gates={[]} />))
    expect(html).toContain('합격선 없이')
  })
})
