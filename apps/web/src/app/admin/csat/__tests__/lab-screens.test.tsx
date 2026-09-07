// apps/web/src/app/admin/csat/__tests__/lab-screens.test.tsx
//
// 전략 연구소 두 화면 — **판정이 화면에서 뒤집히지 않는지** 본다.
//
// 기획: 「120% 우위」는 합본 평균이 아니라 **구속점**으로 판정한다. 그리고 못 잰 축을 대등(1.0)으로
//       채우지 않는다 — 채우면 종합이 올라가는데 그건 개선이 아니라 분식이다.
// 설계: **셀 수 없는 칸(초등 3종)과 재고 0 칸이 같은 색이면** 관리자가 있지도 않은 구멍을 메우러 간다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  EVAL_DIMENSIONS,
  unbenchedDimensions,
} from '@vocaflow/library-pipeline/textbook-evaluation'

import type { BenchPublisher } from '@/lib/csat/factory-bench'
import {
  MIN_ATTEMPTS_FOR_ACCURACY,
  platformMeasurable,
  verdictOf,
  type BlueprintView,
  type MarketView,
} from '@/lib/csat/factory-lab-model'

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
  platform: { itemAttempts: 1, renderedVolumes: 7, itemAttemptsError: null },
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
        <MarketClient
          warehouse={null}
          volume={null}
          target={1.2}
          platform={{ itemAttempts: 0, renderedVolumes: 0, itemAttemptsError: null }}
          loadError="리포트 없음"
        />,
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

describe('일곱 축 밖 — 플랫폼 우위를 주장하지 않는다', () => {
  it('관측이 필요 표본에 못 미치면 「설계도이지 사실이 아니다」라고 말한다', () => {
    const html = text(
      renderToString(
        <MarketClient
          {...market}
          platform={{ itemAttempts: 1, renderedVolumes: 7, itemAttemptsError: null }}
        />,
      ),
    )
    expect(html).toContain('일곱 축 밖')
    expect(html).toContain('종이가 못 하는 자리')
    expect(html).toContain('설계도이지 사실이 아니다')
    // 임계는 짐작이 아니라 저장소의 정답률 게이트에서 유도한 값이다
    expect(html).toContain(String(MIN_ATTEMPTS_FOR_ACCURACY))
  })

  it('필요 표본을 넘겨도 「충분조건은 아니다」를 함께 말한다', () => {
    const html = text(
      renderToString(
        <MarketClient
          {...market}
          platform={{ itemAttempts: MIN_ATTEMPTS_FOR_ACCURACY, renderedVolumes: 7, itemAttemptsError: null }}
        />,
      ),
    )
    expect(html).toContain('필요조건은 채웠다')
    expect(html).toContain('한 문항에 모여야')
  })

  it('관측이 0 이어도 「못 잼」이라고 하지 않는다 — 0 은 사실이다', () => {
    const html = text(
      renderToString(
        <MarketClient
          {...market}
          platform={{ itemAttempts: 0, renderedVolumes: 7, itemAttemptsError: null }}
        />,
      ),
    )
    expect(html).toContain('기출 문항 시도')
    // 0 은 "아무도 안 풀었다"(사실)이고 「못 잼」(모름)과 다르다
    expect(html).toContain('>0<')
  })

  it('관측 표를 못 읽었으면 0 이 아니라 「못 잼」과 이유를 적는다', () => {
    const html = text(
      renderToString(
        <MarketClient
          {...market}
          platform={{ itemAttempts: null, renderedVolumes: null, itemAttemptsError: '관측을 못 읽었다: 권한 없음' }}
        />,
      ),
    )
    expect(html).toContain('못 잼')
    expect(html).toContain('관측을 못 읽었다: 권한 없음')
  })

  it('관측이 충분해도 「잰다」가 아니라 다음 할 일을 말한다 — 주장으로 넘어가지 않는다', () => {
    const html = text(
      renderToString(
        <MarketClient
          {...market}
          platform={{ itemAttempts: 5000, renderedVolumes: 7, itemAttemptsError: null }}
        />,
      ),
    )
    expect(html).toContain('필요조건은 채웠다')
    expect(html).toContain('A8')
    // 관측이 많아도 「종이보다 낫다」로 건너뛰지 않는다 — 축을 정의하는 것이 먼저다
    expect(html).toContain('축을 정의해')
  })
})

describe('MIN_ATTEMPTS_FOR_ACCURACY — 짐작이 아니라 유도한 값', () => {
  it('정답률 게이트(0.70) ±0.10 · 95% 에서 나온 81이다', () => {
    // n = p(1−p)(z/e)²  =  0.7 × 0.3 × (1.96/0.10)²
    const n = Math.ceil(0.7 * 0.3 * (1.96 / 0.1) ** 2)
    expect(MIN_ATTEMPTS_FOR_ACCURACY).toBe(n)
  })

  it('그 밑이면 못 잰다고 판정한다', () => {
    expect(platformMeasurable({ itemAttempts: MIN_ATTEMPTS_FOR_ACCURACY - 1, renderedVolumes: 7, itemAttemptsError: null })).toBe(false)
    expect(platformMeasurable({ itemAttempts: MIN_ATTEMPTS_FOR_ACCURACY, renderedVolumes: 7, itemAttemptsError: null })).toBe(true)
  })

  it('못 읽은 것(null)은 0 과 다르게 다룬다 — 둘 다 「못 잰다」지만 이유가 다르다', () => {
    expect(platformMeasurable({ itemAttempts: null, renderedVolumes: null, itemAttemptsError: 'x' })).toBe(false)
    expect(platformMeasurable({ itemAttempts: 0, renderedVolumes: 0, itemAttemptsError: null })).toBe(false)
  })
})

/**
 * **TBP 콘솔(`/admin/textbook`)을 지워도 잃는 것이 없는지** 본다.
 *
 * 그 화면의 고유 자산은 「평가 요소 15」 하나였다 — 벤치마크 7축이 **안 보는** 자리(법령·판형·
 * 교육과정 준수·난이도 데이터·개정 속도)가 거기에만 있었다. 여기로 옮겼으므로, 지고 있는 요소가
 * 화면에서 사라지면 그것은 이관 실패다.
 */
describe('일곱 축 밖 — 벤치마크가 안 보는 축(TBP 이관)', () => {
  const html = () => text(renderToString(<MarketClient {...market} />))

  it('두 갈래를 이름으로 가른다 — 종이가 못 하는 자리 / 종이도 하는데 안 재는 자리', () => {
    const h = html()
    expect(h).toContain('종이가 못 하는 자리')
    expect(h).toContain('종이도 하는 자리인데 안 재는 것')
  })

  it('지고 있는 요소를 이름으로 짚는다 — 이름이 없으면 다음에 할 일이 안 정해진다', () => {
    const h = html()
    const losing = unbenchedDimensions().filter(
      (d) => d.standing === 'inferior' || d.standing === 'absent',
    )
    expect(losing.length, '열위가 하나도 없다 — 표가 낙관적으로 바뀌었나').toBeGreaterThan(0)
    for (const d of losing) expect(h, `${d.label} 이 화면에 없다`).toContain(d.label)
  })

  it('실측 7축과 겹치는 요소는 안 건다 — 같은 것을 두 근거로 두 번 말하지 않는다', () => {
    const h = html()
    const overlapped = EVAL_DIMENSIONS.filter((d) => d.benchAxis !== null)
    expect(overlapped.length).toBeGreaterThan(0)
    // **행의 이름 자리**만 본다. 낱말이 어딘가에 스치는지가 아니라 이 표에 한 줄로 서 있는지가
    // 문제다 — 「해설」은 벤치마크 축 이름(A1 해설 보유율)에도 들어 있어서 통짜 검색은 늘 걸린다.
    const rowName = (label: string) => `text-[var(--t1)]">${label}</span>`
    for (const d of overlapped) {
      expect(h, `${d.label} 이 평가 요소표에 또 서 있다`).not.toContain(rowName(d.label))
    }
  })

  it('판정을 색만으로 말하지 않는다 — 기호와 글자를 함께 낸다', () => {
    const h = html()
    expect(h).toContain('열위')
    expect(h).toContain('우위')
    // 손 판정이라는 사실을 숨기지 않는다 — 실측 지수와 같은 무게로 읽히면 안 된다.
    expect(h).toContain('손 판정')
  })
})
