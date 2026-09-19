// packages/library-pipeline/src/textbook/explain-seam.test.ts

import { describe, expect, it } from 'vitest'
import { toCsatInsert, toCsatOrder } from './csat-format'
import { EXPLANATION_CHARS } from './explain-items'
import { assemble, explainInsertSeam, explainOrderSeam, explainShortInsertSeam, readOrderConstraints } from './explain-seam'

// 원문 8문장. `toCsatOrder` 는 도입문 1 + (A)(B)(C) 로 가른다.
const SOURCE = [
  'Milestones once told travellers how far they still had to go.',
  'The people who ruled the roads wanted one fixed way to measure a route.',
  'A letter or a load could then be charged by the same rule everywhere.',
  'As a result, the stones did more than count.',
  'They turned a rough path into a road with a shape.',
  'That road could be named, mended, and compared with other roads.',
  'Later, signs of metal and paint took over that work.',
  'Every sign beside a road today is a quiet copy of those first stones.',
]

describe('explainOrderSeam', () => {
  const item = toCsatOrder(SOURCE, SOURCE.map((_, i) => i))!

  it('정답이 만드는 이음매를 원문에서 인용한다', () => {
    const e = explainOrderSeam(item)
    expect(e).not.toBeNull()
    expect(e!.hasCitation).toBe(true)
    expect(e!.ko).toContain('도입문')
    expect(e!.ko).toMatch(/\(A\)|\(B\)|\(C\)/)
  })

  /**
   * ⚠️ **여기는 앞판을 뒤집은 자리다.** 앞판은 오답 배제가 `원문의 이음매와 다르다` 로
   * 끝나기를 요구했다. 그 진술은 **참이지만**(원문이 정답 키다) **학습자는 원문을 못 본다** —
   * 3인 검수 1·2회차에서 순서 유형이 **전량** 「순환 논증」으로 지적받았다.
   *
   * 근거로 쓸 수 있는 것은 지문 안에 있는 것뿐이다. 이유를 못 대면 **안 대는 것**이
   * 지어내는 것보다 낫다 — 그래서 이음매 인용은 남기되, 원문을 근거로 들지 않는다.
   */
  it('오답이 만드는 이음매를 보이되, **원문을 근거로 들지 않는다**', () => {
    const e = explainOrderSeam(item)!
    expect(e.hasWrongOption).toBe(true)
    expect(e.ko).toContain('반면')
    expect(e.ko, '학습자가 볼 수 없는 것을 근거로 들었다').not.toContain('원문의 이음매와 다르다')
  })

  /**
   * **지문에서 읽어 낸 근거**는 쓴다 — `These maps` 로 여는 덩어리는 `maps` 를 처음
   * 내놓는 덩어리 뒤에 와야 하고, 그것은 지문만 보고 확인된다.
   */
  it('되받이 표지가 있으면 그것을 근거로 든다', () => {
    const withAnaphor = {
      kind: 'order' as const,
      intro: 'A survey team walked the ridge before the rains came.',
      blocks: [
        { label: 'A' as const, sentences: ['They drew maps of every stream along the slope.'] },
        { label: 'B' as const, sentences: ['These maps later guided the repair crews.'] },
        { label: 'C' as const, sentences: ['The repair work finished before winter.'] },
      ],
      choices: [
        ['A', 'C', 'B'],
        ['B', 'A', 'C'],
        ['B', 'C', 'A'],
        ['C', 'A', 'B'],
        ['C', 'B', 'A'],
      ] as Array<Array<'A' | 'B' | 'C'>>,
      answer: 1,
    }
    const e = explainOrderSeam(withAnaphor)
    expect(e).not.toBeNull()
    // 정답 쪽 근거 — 지문만 보고 확인된다.
    expect(e!.ko).toContain('These maps')
    // 오답 배제도 그 낱말로 짚는다 — (B)를 (A)보다 앞에 두는 답지들.
    expect(e!.ko).toMatch(/가리킬 것이 아직 없다/)
  })

  it('되받이가 없으면 이유를 지어내지 않는다 — 이음매만 사실로 보인다', () => {
    const e = explainOrderSeam(item)!
    // 이 픽스처에는 읽어 낼 되받이가 없다. 그래도 해설은 나오고, 근거를 지어내지 않는다.
    expect(e.ko).not.toContain('가리킬 것이 아직 없다')
    expect(e.ko).toContain('반면')
  })

  it('시장 규격 길이 안에 든다', () => {
    const e = explainOrderSeam(item)!
    expect(e.ko.length).toBeGreaterThanOrEqual(EXPLANATION_CHARS.min)
    expect(e.ko.length).toBeLessThanOrEqual(EXPLANATION_CHARS.max)
  })

  it('작성기 이름을 남긴다 — 나중에 배치 해설로 올려칠 수 있어야 한다', () => {
    expect(explainOrderSeam(item)!.writer).toBe('order_seam')
  })
})

describe('explainInsertSeam', () => {
  // 6문장을 남기고 3번째 문장을 뺀다 → 자리 5곳.
  const remaining = SOURCE.filter((_, i) => i !== 2)
  const item = toCsatInsert(remaining, SOURCE[2]!, 2)!

  it('원래 자리를 앞뒤 문장으로 보인다', () => {
    const e = explainInsertSeam(item)
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('정답은')
    expect(e!.hasCitation).toBe(true)
  })

  it('오답 자리가 무엇을 갈라놓는지 보인다', () => {
    const e = explainInsertSeam(item)!
    expect(e.hasWrongOption).toBe(true)
    // ⚠️ 순서 쪽과 같은 이유로 순환 문구를 뺐다 — 학습자는 원문을 못 본다.
    expect(e.ko, '학습자가 볼 수 없는 것을 근거로 들었다').not.toContain('원문에서 이 둘은 붙어 있다')
    expect(e.ko).toContain('사이를 가른다')
  })

  it('시장 규격 길이 안에 든다', () => {
    const e = explainInsertSeam(item)!
    expect(e.ko.length).toBeGreaterThanOrEqual(EXPLANATION_CHARS.min)
    expect(e.ko.length).toBeLessThanOrEqual(EXPLANATION_CHARS.max)
  })
})

describe('explainShortInsertSeam', () => {
  // 4문장 문단에서 1문장을 빼면 remaining 3 — `toCsatInsert` 는 null 을 준다(자리 5곳 필요).
  const short = SOURCE.slice(0, 4)
  const remaining = short.filter((_, i) => i !== 1)

  it('자리가 5곳이 안 되어도 학습 화면용 해설은 쓴다', () => {
    expect(toCsatInsert(remaining, short[1]!, 1)).toBeNull()
    const e = explainShortInsertSeam(remaining, short[1]!, 1)
    expect(e).not.toBeNull()
    expect(e!.writer).toBe('insert_seam')
    expect(e!.hasCitation).toBe(true)
  })

  it('자리가 범위를 벗어나면 쓰지 않는다', () => {
    expect(explainShortInsertSeam(remaining, short[1]!, 0)).toBeNull()
    expect(explainShortInsertSeam(remaining, short[1]!, 9)).toBeNull()
  })

  it('인용 잔해가 있으면 쓰지 않는다 — 인쇄 규격만 우회하고 안전장치는 그대로다', () => {
    const dirty = ['[] trained the model using a sample set.', ...remaining]
    expect(explainShortInsertSeam(dirty, short[1]!, 2)).toBeNull()
  })
})

/**
 * **정답이 어기는 제약은 버린다.**
 *
 * 원문 순서가 정답 키이므로, 읽어 낸 제약이 정답과 어긋나면 틀린 것은 **우리 읽기**다
 * (같은 낱말이 우연히 겹쳤거나, `The …` 가 되받이가 아니라 총칭이었거나).
 * 그대로 두면 **해설이 정답을 반박한다** — 해설이 없느니만 못하다.
 */
describe('되받이 제약 — 정답과 어긋나면 버린다', () => {
  const item = {
    kind: 'order' as const,
    intro: 'A survey team walked the ridge before the rains came.',
    blocks: [
      { label: 'A' as const, sentences: ['They drew maps of every stream along the slope.'] },
      { label: 'B' as const, sentences: ['These maps later guided the repair crews.'] },
      { label: 'C' as const, sentences: ['The repair work finished before winter.'] },
    ],
    choices: [
      ['A', 'C', 'B'],
      ['B', 'A', 'C'],
      ['B', 'C', 'A'],
      ['C', 'A', 'B'],
      ['C', 'B', 'A'],
    ] as Array<Array<'A' | 'B' | 'C'>>,
    answer: 1,
  }

  it('읽어 낸 제약 자체는 둘이다', () => {
    const cs = readOrderConstraints(item)
    expect(cs.map((c) => `${c.label}<-${c.after}`).sort()).toEqual(['B<-A', 'C<-B'])
  })

  it('정답 (A)-(C)-(B) 는 「C 는 B 뒤」를 어기므로 그 제약은 해설에 안 쓴다', () => {
    const e = explainOrderSeam(item)!
    expect(e.ko).toContain('These maps') // 정답과 맞는 제약은 쓴다
    expect(e.ko, '해설이 정답을 반박한다').not.toContain('(C)는 "The repair" 로 시작하므로')
  })

  it('근거 있는 오답을 먼저 적고, 근거 없는 것은 이음매만 보인다', () => {
    const e = explainOrderSeam(item)!
    const reasonedAt = e.ko.indexOf('가리킬 것이 아직 없다')
    const bareAt = e.ko.indexOf('를 붙인다')
    expect(reasonedAt).toBeGreaterThan(-1)
    expect(bareAt).toBeGreaterThan(reasonedAt)
  })

  it('시장 규격 길이를 넘지 않는다 — 오답 넷을 다 적어도', () => {
    const e = explainOrderSeam(item)!
    expect(e.ko.length).toBeLessThanOrEqual(EXPLANATION_CHARS.max)
  })
})

/**
 * **같은 말을 두 번 적지 않는다.**
 *
 * 3회차 검수 지적(2026-09-13): ②와 ③에 **글자 그대로 같은 문장**이 적혔다.
 * 덩어리가 셋이라 서로 다른 답지가 같은 자리에서 같은 덩어리를 붙이는 일이 잦고,
 * 그러면 ③을 고른 학생은 ②와의 차이를 끝내 못 얻는다.
 *
 * ⚠️ 앞판은 `slice(0, 2)` 로 둘만 적어 이 중복이 **가려져 있었다** — 넷을 다 적으니 드러났다.
 * 오답을 더 많이 다루는 것이 중복을 만든 것이 아니라, **있던 중복을 보이게 했다.**
 */
describe('오답 배제 — 같은 문장을 묶는다', () => {
  const item = toCsatOrder(SOURCE, SOURCE.map((_, i) => i))!

  it('같은 이음매를 만드는 답지는 번호를 묶어 한 번만 적는다', () => {
    const e = explainOrderSeam(item)!
    // 「… 를 붙인다」 문장이 글자 그대로 두 번 나오면 안 된다.
    const bodies = e.ko.split(';').map((x) => x.replace(/[①②③④⑤]/g, '').trim())
    const seen = new Set<string>()
    for (const b of bodies) {
      if (!b.includes('붙인다')) continue
      expect(seen.has(b), `같은 배제 문장이 두 번 적혔다: ${b}`).toBe(false)
      seen.add(b)
    }
  })

  it('묶은 번호가 둘 다 남는다 — 하나를 버리지 않는다', () => {
    const e = explainOrderSeam(item)!
    for (const n of ['①', '②', '③', '④', '⑤']) {
      // 정답 번호는 앞머리에, 오답 번호는 배제 절에 — 어느 쪽이든 한 번은 나와야 한다.
      expect(e.ko.includes(n), `${n} 이 해설에서 통째로 빠졌다`).toBe(true)
    }
  })
})

/**
 * **상한을 재는 회귀는 있었는데 표본이 경계에 못 닿았다** (실측 2026-09-14).
 *
 * `assemble` 이 마지막 `join([body, ...closing])` 의 **이음매 한 칸**을 예산에서 빼먹어
 * 상한 473 인 해설이 정확히 **474자**로 나갔다. DB 실측 `order_seam` **3,292건**이 전부
 * 474자였는데 기존 회귀 셋은 전부 초록이었다 — 짧은 표본은 예산을 다 쓰지 않아
 * **경계를 한 번도 안 밟았기** 때문이다.
 *
 * ⚠️ 한 글자짜리 결함은 **표본 하나로는 못 잡는다.** 어느 길이가 경계에 닿을지 모르므로
 *   길이를 훑는다. 이 검사가 실제로 이빨이 있는지는 변이(이음매 한 칸을 다시 빼기)로
 *   확인했다 — 훑기 없이는 안 잡히고, 훑으면 잡힌다.
 */
describe('explainOrderSeam — 길이를 훑어 경계를 밟는다', () => {
  const filler = 'the survey team walked the ridge and marked every stream along the slope'

  /** 문장 길이를 조금씩 늘려 가며 예산 경계를 지나가게 한다. */
  const itemOfWidth = (pad: number) => {
    const tail = pad > 0 ? ` ${filler.slice(0, pad)}` : ''
    return toCsatOrder(
      [
        `Milestones once told travellers how far they still had to go${tail}.`,
        `The people who ruled the roads wanted one fixed way to measure a route${tail}.`,
        `A letter or a load could then be charged by the same rule everywhere${tail}.`,
        `As a result the stones did more than count${tail}.`,
        `They turned a rough path into a road with a shape${tail}.`,
        `That road could be named and mended and compared with other roads${tail}.`,
        `Later signs of metal and paint took over that work${tail}.`,
        `Every sign beside a road today is a quiet copy of those first stones${tail}.`,
      ],
      [0, 1, 2, 3, 4, 5, 6, 7],
    )
  }

  it('어느 길이에서도 상한을 넘지 않는다', () => {
    const over: string[] = []
    for (let pad = 0; pad <= filler.length; pad += 1) {
      const item = itemOfWidth(pad)
      if (!item) continue
      const e = explainOrderSeam(item)
      // 못 쓰면 null 이다 — 그것도 규격을 지키는 방법이다.
      if (e && e.ko.length > EXPLANATION_CHARS.max) over.push(`pad=${pad} · ${e.ko.length}자`)
    }
    expect(over, `상한을 넘긴 길이: ${over.join(' / ')}`).toEqual([])
  })
})

/**
 * **예산 산술을 직접 잰다** (실측 2026-09-14).
 *
 * `assemble` 이 마지막 `join([body, ...closing])` 의 **이음매 한 칸**을 예산에서 빼먹어
 * 상한 473 인 해설이 정확히 **474자**로 나갔다 — DB `order_seam` **3,292건**.
 *
 * ⚠️ **지문 표본으로는 못 잡는다.** 넘치는 것은 `body.length + reserved` 가 상한과
 *   **정확히 같을 때**뿐인데, 문장 길이를 73가지로 훑어도 최대 468자였다(변이 검사로
 *   확인 — 훑기로는 안 잡히고 이 검사로는 잡힌다). 그래서 경계를 **직접 만든다.**
 */
describe('assemble — 이음매 한 칸까지 예산에 넣는다', () => {
  /** `body + ' ' + closing` 이 상한과 정확히 같아지도록 길이를 맞춘다. */
  // ⚠️ **닫는 말의 길이를 가정하지 않고 잰다.** 처음엔 `closingLen` 으로 계산했다가
  //   실제 길이와 1 이 어긋나 경계를 못 밟았고, 변이 검사가 그것을 잡아 줬다.
  const exact = (closingLen: number) => {
    const closing = [`반면 ${'나'.repeat(Math.max(0, closingLen - 4))}.`]
    // `body + ' ' + closing` 이 상한과 **정확히 같아지는** 길이 — 이음매를 안 세면 여기서 +1.
    const bodyLen = EXPLANATION_CHARS.max - closing[0]!.length
    return { lead: ['가'.repeat(bodyLen)], closing, closingActual: closing[0]!.length }
  }

  it('경계에서 상한을 넘지 않는다 — 한 글자가 넘치던 자리다', () => {
    const over: string[] = []
    for (let closingLen = 20; closingLen <= 60; closingLen += 1) {
      // body 를 「상한 − closing」 에 정확히 맞춘다: 이음매를 안 세면 여기서 +1 이 된다.
      const { lead, closing } = exact(closingLen)
      const e = assemble(lead, [], closing, 'test')
      if (e && e.ko.length > EXPLANATION_CHARS.max) over.push(`closing=${closingLen} · ${e.ko.length}자`)
    }
    expect(over, `상한을 넘긴 경우: ${over.join(' / ')}`).toEqual([])
  })

  it('상한 안이면 오답 배제를 버리지 않는다 — 예산을 아끼려고 내용을 잃지 않는다', () => {
    // 경계가 아니라 **넉넉한** 경우다 — 예산이 남는데 오답 배제를 버리면 안 된다.
    const e = assemble(['가'.repeat(100)], [], ['반면 ②③ 는 다른 자리를 붙인다.'], 'test')
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('반면')
  })
})

/**
 * **자리를 근거로 삼지 않는다** (3인 검수 3회차 실측 2026-09-15).
 *
 * 삽입 해설의 끝자리 가지에 「**글의 마지막 자리이므로** "…" 가 끝을 맺는다」가 남아 있었다.
 * 「⑤가 답인 이유는 ⑤가 마지막이라서」라는 순환 논증이라 학습자가 쓸 수 없다 — 순서
 * 유형에서 이미 없앤 「원문의 이음매와 다르다」와 **같은 꼴**이다. DB 실측 **29,121문항**.
 *
 * ⚠️ `insert` 정답이 끝자리인 것 자체는 결함이 아니다 — 실측 121,519문항 중 **24.0%** 로
 *   자리 다섯의 균등(20%)에 가깝다. 검수자가 「끝자리를 정답으로 내놓는다」고 본 것은
 *   표본 3건 중 2건이었고 **집단에서는 쏠림이 아니다.** 고칠 것은 자리가 아니라 해설이었다.
 */
describe('삽입 해설 — 끝자리를 자기 근거로 쓰지 않는다', () => {
  const short = SOURCE.slice(0, 6)
  // 마지막 문장을 빼면 정답 자리가 글의 끝이 된다.
  const remaining = short.slice(0, 5)

  it('「마지막 자리이므로」로 답을 정당화하지 않는다', () => {
    const e = explainShortInsertSeam(remaining, short[5]!, 5)
    expect(e).not.toBeNull()
    expect(e!.ko, '자리를 근거로 삼았다').not.toContain('마지막 자리이므로')
  })

  it('끝자리라는 **사실**과 앞 문장은 보인다 — 아무 말도 안 하는 것은 아니다', () => {
    const e = explainShortInsertSeam(remaining, short[5]!, 5)!
    expect(e.ko).toContain('끝자리')
    expect(e.hasCitation).toBe(true)
  })
})
