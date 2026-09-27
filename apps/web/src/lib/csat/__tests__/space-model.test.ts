// apps/web/src/lib/csat/__tests__/space-model.test.ts
//
// **기출 작업 공간이 그리는 것을 잠근다.**
//
// 이 화면은 참조(Tines 3B) 앱 화면의 골격을 빌려 왔지만, 그 안의 수치는 전부 구운 코퍼스에서
// 온다. 그래서 검사할 것은 「화면이 예쁜가」가 아니라 셋이다:
//   ① 표의 수가 코퍼스와 **어긋나지 않는가**(손으로 적은 수가 끼어들면 여기서 걸린다)
//   ② 거르기가 **AND** 인가(한 축을 켤수록 좁아지는가)
//   ③ 무늬가 **결정론**인가(난수가 섞이면 SSR/CSR 이 갈리고 캡처 diff 가 무의미해진다)
// 그리고 이 저장소에서 가장 비싼 실수 하나 — **지문 인용이 학습자 화면으로 새지 않는가.**
//
// ⚠️ 특정 수(26·32·802)를 못 박지 않는다. 분석이 늘면 바뀌는 것이 정상이고, 바뀔 때마다
//    빨개지는 검사는 곧 주석 처리된다(trap-atlas.test.ts 와 같은 규칙).

import { describe, expect, it } from 'vitest'

import { ATLAS_TYPES, TRAPS, UNIVERSAL_MIN_TYPES } from '../trap-atlas'
import {
  EMPTY_SPACE_FILTER,
  PATTERN_VIEWBOX,
  SPACE_TONES,
  filterRows,
  patternShapes,
  spaceHeadline,
  starPath,
  stepsFor,
  toneAt,
  topTrapsOfType,
  trapRows,
  typeRows,
} from '../space-model'

const types = typeRows()
const traps = trapRows()

describe('작업 공간 — 표의 수는 코퍼스에서만 온다', () => {
  it('유형 줄 수와 문항 합계가 코퍼스와 같다', () => {
    expect(types).toHaveLength(ATLAS_TYPES.length)
    const fromRows = types.reduce((sum, row) => sum + row.weight, 0)
    const fromAtlas = ATLAS_TYPES.reduce((sum, type) => sum + type.items, 0)
    expect(fromRows).toBe(fromAtlas)
  })

  it('함정 줄 수와 오답 합계가 코퍼스와 같다', () => {
    expect(traps).toHaveLength(TRAPS.length)
    const fromRows = traps.reduce((sum, row) => sum + row.weight, 0)
    const fromAtlas = TRAPS.reduce((sum, trap) => sum + trap.n, 0)
    expect(fromRows).toBe(fromAtlas)
  })

  it('큰 것이 위로 — 줄 순서가 양의 내림차순이다', () => {
    for (const rows of [types, traps]) {
      for (let i = 1; i < rows.length; i += 1) {
        expect(rows[i - 1].weight).toBeGreaterThanOrEqual(rows[i].weight)
      }
    }
  })

  it('「유형을 가로지름」은 코퍼스의 경계와 같은 판정이다', () => {
    for (const row of traps) {
      const trap = TRAPS.find((t) => t.key === row.key)!
      expect(`${row.key}:${row.live}`).toBe(`${row.key}:${trap.types >= UNIVERSAL_MIN_TYPES}`)
    }
  })

  it('머리 눈금은 잰 때를 함께 낸다 — 낡았는지 화면에서 보인다', () => {
    const head = spaceHeadline()
    expect(head.items).toBeGreaterThan(0)
    expect(head.named).toBeLessThanOrEqual(head.distractors)
    expect(head.recentTotal).toBeLessThanOrEqual(head.distractors)
    expect(head.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
    expect(head.recentFrom).toBeGreaterThanOrEqual(head.yearMin)
  })

  it('색은 자리가 정한다 — 목록 밖 색이 나오지 않는다', () => {
    for (const row of [...types, ...traps]) expect(SPACE_TONES).toContain(row.tone)
    for (const i of [-7, -1, 0, 5, 6, 13]) expect(SPACE_TONES).toContain(toneAt(i))
  })
})

describe('작업 공간 — 거르기는 AND 다', () => {
  it('축을 켤수록 좁아진다', () => {
    const all = filterRows(types, EMPTY_SPACE_FILTER)
    const withExample = filterRows(types, { ...EMPTY_SPACE_FILTER, withExample: true })
    const both = filterRows(types, { ...EMPTY_SPACE_FILTER, withExample: true, recentOnly: true })
    expect(all.length).toBeGreaterThanOrEqual(withExample.length)
    expect(withExample.length).toBeGreaterThanOrEqual(both.length)
    expect(withExample.every((row) => row.example !== null)).toBe(true)
    expect(both.every((row) => row.recent > 0)).toBe(true)
  })

  it('찾기는 낱말을 전부 만족해야 한다(하나라도 없으면 뺀다)', () => {
    const first = types.find((row) => row.example)!
    const hit = filterRows(types, { ...EMPTY_SPACE_FILTER, query: first.name })
    expect(hit.map((row) => row.name)).toContain(first.name)
    const miss = filterRows(types, { ...EMPTY_SPACE_FILTER, query: `${first.name} 그런낱말은없다` })
    expect(miss).toHaveLength(0)
  })

  it('회차 이름으로도 찾힌다 — 레일의 회차 목록이 실제로 거른다', () => {
    const row = traps.find((r) => r.example)!
    const hit = filterRows(traps, { ...EMPTY_SPACE_FILTER, query: row.example!.label })
    expect(hit.length).toBeGreaterThan(0)
    // 낱말 AND 다 — 「2026학년도 수능」은 두 낱말이고, 두 낱말을 **다** 가진 줄만 남는다
    // (같은 회차가 아니어도 두 낱말을 다 가지면 남는 것이 이 규칙의 정의다).
    const words = row.example!.label.toLowerCase().split(/\s+/)
    expect(hit.every((r) => words.every((w) => r.search.includes(w)))).toBe(true)
  })
})

describe('작업 공간 — 무늬는 데이터이고 결정론이다', () => {
  const weights = types.slice(0, 20).map((row) => row.weight)

  it('같은 씨는 같은 그림을 준다', () => {
    expect(patternShapes(weights, 7)).toEqual(patternShapes(weights, 7))
  })

  it('다른 씨는 다른 그림을 준다 — 탭을 바꾸면 띠가 바뀐다', () => {
    expect(patternShapes(weights, 7)).not.toEqual(patternShapes(weights, 23))
  })

  it('지름이 양을 따른다 — 가장 큰 줄이 가장 큰 원이다', () => {
    const shapes = patternShapes(weights, 7)
    expect(shapes).toHaveLength(weights.length)
    const round = shapes.filter((s) => s.kind !== 'star')
    const maxRound = round.reduce((a, b) => (a.r >= b.r ? a : b))
    expect(weights[shapes.indexOf(maxRound)]).toBe(Math.max(...weights))
  })

  it('빈 목록에서도 서고, 좌표가 유한하다', () => {
    expect(patternShapes([], 7)).toEqual([])
    for (const shape of patternShapes(weights, 7)) {
      expect(Number.isFinite(shape.cx) && Number.isFinite(shape.cy) && Number.isFinite(shape.r)).toBe(true)
      expect(shape.cy).toBeLessThanOrEqual(PATTERN_VIEWBOX.h)
    }
  })

  it('네모별 경로에 NaN 이 없다', () => {
    expect(starPath(10, 20, 6)).not.toMatch(/NaN/)
  })
})

describe('작업 공간 — 펼친 줄', () => {
  it('줄마다 다음 걸음 넷이 서고, 예시가 있으면 해설 극장으로 간다', () => {
    for (const row of [types[0], traps[0]]) {
      const steps = stepsFor(row)
      expect(steps).toHaveLength(4)
      const example = steps[2]
      if (row.example) expect(example.href).toBe(`/csat/item/${row.example.slug}`)
      else expect(example.href).toBeUndefined()
      expect(steps.every((step) => step.title.length > 0 && step.body.length > 0)).toBe(true)
    }
  })

  it('유형의 상위 함정은 그 유형에 실제로 나온 것만이다', () => {
    const top = topTrapsOfType(types[0].key)
    expect(top.every((t) => t.n > 0)).toBe(true)
    for (let i = 1; i < top.length; i += 1) expect(top[i - 1].n).toBeGreaterThanOrEqual(top[i].n)
  })
})

describe('작업 공간 — 지문은 이 화면에 오지 않는다', () => {
  it('줄과 카드 어디에도 예시의 인용문이 실리지 않는다', () => {
    const quotes = TRAPS.flatMap((trap) => trap.examples.flatMap((e) => [e.tempting, e.reject]))
      .map((s) => s.trim())
      .filter((s) => s.length > 12)
    const surface = [...types, ...traps]
      .flatMap((row) => [
        row.name,
        row.reach,
        row.search,
        ...row.meta,
        ...row.badges.map((b) => b.label),
        ...stepsFor(row).map((s) => `${s.title} ${s.body}`),
      ])
      .join('\n')
    const leaked = quotes.filter((quote) => surface.includes(quote))
    expect(leaked).toEqual([])
  })
})
