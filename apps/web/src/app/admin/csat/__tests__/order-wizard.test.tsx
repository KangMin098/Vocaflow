// apps/web/src/app/admin/csat/__tests__/order-wizard.test.tsx
//
// **「새 교재 만들기」 회귀.**
//
// 이 화면이 지켜야 하는 것은 세 가지고, 셋 다 조용히 깨질 수 있는 종류다:
//
//   ① **관문 판정** — 순서가 인과다(문항 → 배합 → 해설 → 근거). 순서가 바뀌면 관리자가
//      해설부터 채우다가 문항이 없어서 헛일을 한다.
//   ② **명령의 인자** — 이 화면의 산출물은 인자가 다 채워진 한 줄이다. 인자가 틀리면
//      **화면은 멀쩡하고 명령만 다른 권을 찍는다.** 눈으로는 절대 안 잡힌다.
//   ③ **한 번에 한 걸음** — 넷을 다 펴면 이 화면도 공정 화면들과 같은 판이 된다.
//
// ⚠️ 「평가원 대응 없음」을 **결함으로 판정하지 않는다**는 것도 여기서 잠근다. 내신·초등 축은
//   평가원이 안 내는 유형이라 짝이 없는 것이 사실이고, 그것을 미달로 세면 초등 권은 영영
//   발주가 안 된다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  CSAT_BACKING,
  firstBlocked,
  judgeGates,
  renderCommand,
  type OrderEvidence,
  type OrderTypeAsset,
  type OrderVolume,
} from '@/lib/csat/order-model'

import { measure } from './density-scan'
import { OrderWizard } from '../new/OrderWizard'

const ITEMS = 60
const UNITS = 10

function asset(over: Partial<OrderTypeAsset> = {}): OrderTypeAsset {
  return {
    type: 'vocab_choice',
    label: '어휘',
    items: 500,
    explained: 500,
    csat: [{ id: 'R-VOCAB', name: '어휘(문맥)', items: 29, analyses: 29, report: true }],
    ...over,
  }
}

function volume(over: Partial<OrderVolume> = {}): OrderVolume {
  const types = over.types ?? [asset()]
  return {
    seriesId: 'vocab',
    brand: 'Vocaflow Vocab',
    accent: '#8B5CF6',
    step: 6,
    schoolBand: '고2',
    title: 'Vocaflow Vocab Master',
    recipe: '문맥에서 고르기 + 본문 어휘 + 빈칸에 쓰기.',
    items: types.reduce((n, t) => n + (t.items ?? 0), 0),
    explained: types.reduce((n, t) => n + (t.explained ?? 0), 0),
    published: false,
    ...over,
    types,
  }
}

const EVIDENCE: OrderEvidence = {
  exams: { suneung: 14, mock: 16 },
  items: 802,
  analyses: 2234,
  reviews: 6702,
  typeReports: 26,
  typeReportsTotal: 26,
  market: {
    series: 22,
    publishers: 6,
    documents: 79,
    itemsMeasured: 140739,
    index: 1.5,
    measuredAt: '2026-08-30T12:49:22.698Z',
  },
}

describe('새 교재 만들기 — 관문', () => {
  it('순서가 인과다 — 문항 → 배합 → 해설 → 근거', () => {
    const ids = judgeGates(volume(), ITEMS, UNITS).map((g) => g.id)
    expect(ids).toEqual(['items', 'typeMix', 'explained', 'evidence'])
  })

  it('다 찬 권은 관문 넷을 모두 넘는다', () => {
    const gates = judgeGates(volume(), ITEMS, UNITS)
    expect(gates.every((g) => g.pass)).toBe(true)
    expect(firstBlocked(gates)).toBeNull()
  })

  it('문항이 모자라면 부족분을 숫자로 말한다', () => {
    const g = judgeGates(volume({ types: [asset({ items: 12, explained: 12 })] }), ITEMS, UNITS)
    expect(g[0]!.pass).toBe(false)
    expect(g[0]!.why).toContain('48개 모자란다')
    expect(g[0]!.commands[0]!.cmd).toContain('--band 6')
  })

  it('배합에 빈 유형이 있으면 문항 수가 차도 막힌다', () => {
    const v = volume({
      types: [
        asset({ items: 900, explained: 900 }),
        asset({ type: 'unit_vocab', label: '본문 어휘', items: 0, explained: 0, csat: [] }),
      ],
    })
    const g = judgeGates(v, ITEMS, UNITS)
    expect(g[0]!.pass, '문항 수는 찼다').toBe(true)
    expect(g[1]!.pass, '배합은 못 맞춘다').toBe(false)
    expect(g[1]!.why).toContain('본문 어휘')
  })

  it('못 잰 재고를 0 으로 세지 않는다 — 「모른다」로 막는다', () => {
    const g = judgeGates(volume({ items: null, types: [asset({ items: null })] }), ITEMS, UNITS)
    expect(g[0]!.pass).toBe(false)
    expect(g[0]!.why).toContain('모르는 것')
    expect(g[1]!.why).toBe('재고를 못 쟀다')
  })

  it('평가원 대응이 없는 유형만으로 된 권도 근거 관문을 넘는다', () => {
    // 초등 축(파닉스·철자)은 평가원이 안 내는 유형이다. 미달로 세면 그 권은 영영 못 나온다.
    const v = volume({
      seriesId: 'reading',
      step: 1,
      types: [asset({ type: 'rhyme', label: '파닉스 운율', csat: [] })],
    })
    const g = judgeGates(v, ITEMS, UNITS)
    expect(g[3]!.pass).toBe(true)
    expect(g[3]!.why).toBeNull()
  })

  it('유형 리포트가 없으면 근거 관문이 그 유형을 이름으로 말한다', () => {
    const v = volume({
      types: [
        asset({
          csat: [{ id: 'R-VOCAB', name: '어휘(문맥)', items: 29, analyses: 0, report: false }],
        }),
      ],
    })
    const g = judgeGates(v, ITEMS, UNITS)
    expect(g[3]!.pass).toBe(false)
    expect(g[3]!.why).toContain('어휘(문맥)')
  })

  it('막힌 관문은 **처음 하나**만 돌려준다 — 뒤부터 풀면 헛일이다', () => {
    const v = volume({ types: [asset({ items: 0, explained: 0 })] })
    expect(firstBlocked(judgeGates(v, ITEMS, UNITS))!.id).toBe('items')
  })
})

describe('새 교재 만들기 — 조판 명령', () => {
  it('인자가 다 채워진다 — 시리즈 · 단 · 단원 · 출력', () => {
    const cmd = renderCommand(volume(), UNITS)
    expect(cmd).toBe(
      'pnpm dlx tsx scripts/textbook/render-volume.mjs --series vocab --band 6 --units 10 --out volume-vocab-v6.html'
    )
  })

  it('권이 다르면 명령도 다르다 — 예시 한 줄을 돌려주지 않는다', () => {
    const a = renderCommand(volume({ seriesId: 'reading', step: 3 }), UNITS)
    const b = renderCommand(volume({ seriesId: 'syntax', step: 7 }), UNITS)
    expect(a).not.toBe(b)
    expect(a).toContain('--series reading --band 3')
    expect(b).toContain('--series syntax --band 7')
  })
})

describe('새 교재 만들기 — 근거 매핑', () => {
  it('모든 시리즈 유형에 항목이 있다 — 빠지면 화면이 그 유형의 근거를 못 말한다', () => {
    // 값이 빈 배열인 것과 **키가 없는 것**은 다르다. 키가 없으면 `undefined` 를 순회하게 된다.
    for (const t of ['vocab_choice', 'order', 'insert', 'rhyme', 'unit_vocab'] as const) {
      expect(CSAT_BACKING[t], `${t} 에 근거 항목이 없다`).toBeDefined()
    }
  })

  it('평가원 코드는 실제 유형 id 형태다 — 오타가 나면 화면이 코드만 찍는다', () => {
    for (const ids of Object.values(CSAT_BACKING)) {
      for (const id of ids) expect(id).toMatch(/^[RX]-[A-Z0-9]+$/)
    }
  })
})

describe('새 교재 만들기 — 화면', () => {
  const view = {
    volumes: [
      volume(),
      volume({
        seriesId: 'reading',
        step: 5,
        schoolBand: '고1',
        brand: 'Vocaflow Reading',
        published: true,
      }),
    ],
    evidence: EVIDENCE,
    itemsPerVolume: ITEMS,
    unitsPerBook: UNITS,
    inventoryAt: null,
    loadError: null,
  }

  it('첫 화면은 **고르는 곳**이다 — 아직 관문도 명령도 안 보인다', () => {
    const html = renderToString(<OrderWizard {...view} />)
    expect(html).toContain('Vocaflow Vocab')
    expect(html).not.toContain('render-volume.mjs')
    expect(html).not.toContain('관문')
  })

  it('한 걸음만 편다 — 첫 화면 밀집도가 공정 화면 예산 안에 든다', () => {
    const d = measure(renderToString(<OrderWizard {...view} />))
    // 공장 화면 중 가장 가벼운 축(현황판 예산 110 · 490)과 견줄 만해야 한다.
    // 여기가 넘으면 「네 걸음으로 폈다」는 말이 거짓이 된다.
    expect(d.chunks, `덩어리 ${d.chunks}`).toBeLessThanOrEqual(130)
    expect(d.chars, `글자 ${d.chars}`).toBeLessThanOrEqual(560)
  })

  it('아직 권을 안 골랐으면 뒤 걸음을 못 누른다', () => {
    const html = renderToString(<OrderWizard {...view} />)
    // 걸음 넷 중 셋이 비활성 — 고르기 전에는 보여 줄 것이 없다.
    expect((html.match(/disabled=""/g) ?? []).length).toBe(3)
  })
})
