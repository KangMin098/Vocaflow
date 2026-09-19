// apps/web/src/lib/csat/__tests__/my-traps.test.ts
//
// **「내 약점」이라고 말해도 되는 순간을 잠근다.**
//
// 이 화면이 무너지는 방식은 안 도는 것이 아니라 **너무 일찍 말하는 것**이다. 다섯 번 훈련한
// 사람에게 「당신의 약점은 인과 역전입니다」라고 적으면, 그 사람은 **없는 결함**을 고치러 간다.
// 그런데 그런 화면은 멀쩡히 돌고 보기에도 그럴듯하다 — 숫자가 있으니까.
//
// 그래서 문턱을 검사한다: 문턱 아래에서는 `lift` 가 `null` 이고 `enough` 가 거짓이어야 한다.

import { describe, expect, it } from 'vitest'

import { MIN_SEEN, MIN_TOTAL, myMissCounts, summarizeMyTraps, type MyAttempt } from '../my-traps'

/** `n` 번 만나 `missed` 번 틀린 기록을 만든다. */
const rec = (trap: string, n: number, missed: number): MyAttempt[] =>
  Array.from({ length: n }, (_, i) => ({ answer_trap: trap, is_correct: i >= missed }))

describe('세기', () => {
  it('맞은 수·놓친 수를 함정별로 접는다', () => {
    const s = summarizeMyTraps([...rec('무관', 4, 3), ...rec('반대 진술', 2, 0)])
    expect(s.total).toBe(6)
    expect(s.correct).toBe(3)
    expect(s.missedTotal).toBe(3)
    const 무관 = s.rows.find((r) => r.trap === '무관')!
    expect(무관).toMatchObject({ seen: 4, missed: 3 })
    expect(s.rows.find((r) => r.trap === '반대 진술')).toMatchObject({ seen: 2, missed: 0 })
  })

  it('많이 놓친 것이 위로 온다', () => {
    const s = summarizeMyTraps([...rec('무관', 2, 1), ...rec('어휘 함정', 5, 4)])
    expect(s.rows[0]!.trap).toBe('어휘 함정')
  })

  it('기록이 없어도 죽지 않는다', () => {
    const s = summarizeMyTraps([])
    expect(s).toMatchObject({ total: 0, correct: 0, missedTotal: 0, rows: [], enough: false, repeated: [] })
    expect(myMissCounts(s)).toEqual({})
  })

  it('다 맞히면 놓친 몫이 0 이고 지도에 그릴 것이 없다', () => {
    const s = summarizeMyTraps(rec('무관', 30, 0))
    expect(s.missedTotal).toBe(0)
    expect(s.rows[0]!.share).toBe(0)
    // 0인 것은 지도에 안 올린다 — 빈 막대는 정보가 아니다.
    expect(myMissCounts(s)).toEqual({})
  })
})

describe('문턱 — 표본이 얇으면 말하지 않는다', () => {
  it(`시도가 ${MIN_TOTAL} 미만이면 분포라고 부르지 않고 배수도 없다`, () => {
    const s = summarizeMyTraps([...rec('무관', 5, 5), ...rec('어휘 함정', 5, 3)])
    expect(s.total).toBeLessThan(MIN_TOTAL)
    expect(s.enough).toBe(false)
    for (const r of s.rows) expect(`${r.trap}:${r.lift}`).toBe(`${r.trap}:null`)
  })

  it(`시도가 충분해도 ${MIN_SEEN}번 미만 만난 함정은 배수를 안 준다`, () => {
    const s = summarizeMyTraps([...rec('무관', 22, 10), ...rec('인과 역전', 2, 2)])
    expect(s.enough).toBe(true)
    expect(s.rows.find((r) => r.trap === '무관')!.lift).not.toBeNull()
    // 두 번 만난 것은 **얼마나 유난한지** 말할 근거가 없다.
    expect(s.rows.find((r) => r.trap === '인과 역전')!.lift).toBeNull()
  })

  it('문턱을 넘으면 배수가 전체 분포와의 비율이다', () => {
    // 무관은 전체에서 8.4%인데 내 오답의 100%라면 배수는 1보다 훨씬 커야 한다.
    const s = summarizeMyTraps(rec('무관', 25, 25))
    expect(s.enough).toBe(true)
    const 무관 = s.rows.find((r) => r.trap === '무관')!
    expect(무관.share).toBe(1)
    expect(무관.lift).not.toBeNull()
    expect(무관.lift!).toBeGreaterThan(2)
  })
})

describe('「되풀이해 걸린다」', () => {
  it('한 번 틀린 것은 들지 않는다', () => {
    expect(summarizeMyTraps(rec('무관', 1, 1)).repeated).toEqual([])
  })

  it(`${MIN_SEEN}번 이상 만나 절반 넘게 놓친 것만 든다`, () => {
    const s = summarizeMyTraps([
      ...rec('무관', 4, 3), // 75% 놓침 → 든다
      ...rec('어휘 함정', 4, 2), // 정확히 절반 → 안 든다
      ...rec('반대 진술', 2, 2), // 다 놓쳤지만 두 번뿐 → 안 든다
    ])
    expect(s.repeated).toEqual(['무관'])
  })

  it('많이 놓친 것부터 온다 — 화면이 앞의 셋만 부른다', () => {
    // 화면은 `repeated.slice(0, 3)` 을 읽는다(여섯을 다 부르면 문장이 목록이 된다).
    // 그러니 **순서가 계약**이다 — 여기서 안 지키면 화면이 엉뚱한 셋을 부른다.
    const s = summarizeMyTraps([
      ...rec('무관', 4, 3),
      ...rec('범위 과대', 10, 9),
      ...rec('반대 진술', 6, 5),
    ])
    expect(s.repeated).toEqual(['범위 과대', '반대 진술', '무관'])
  })

  it('시도가 적어도 「되풀이」는 말할 수 있다 — 배수와 문턱이 다르다', () => {
    // 배수(얼마나 유난한가)는 전체 표본이 필요하지만, 「세 번 만나 세 번 놓쳤다」는
    // 그 자체로 사실이다. 둘을 같은 문턱에 묶으면 말할 수 있는 것도 못 말한다.
    const s = summarizeMyTraps(rec('무관', 3, 3))
    expect(s.enough).toBe(false)
    expect(s.repeated).toEqual(['무관'])
  })
})

describe('지도에 넘기는 값', () => {
  it('놓친 수만 넘긴다 — 만난 수가 아니다', () => {
    // 지도의 막대는 「내 오답 분포」다. 만난 수를 넘기면 잘 맞힌 함정이 크게 그려진다.
    const s = summarizeMyTraps([...rec('무관', 10, 2), ...rec('어휘 함정', 3, 3)])
    expect(myMissCounts(s)).toEqual({ 무관: 2, '어휘 함정': 3 })
  })
})
